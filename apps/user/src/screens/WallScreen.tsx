import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, TextInput, Image, ActivityIndicator, 
  Platform, Modal, FlatList, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { 
  db, 
  WALL_TYPE_SPECS, 
  WallType, 
  CONSTRUCTION_HIERARCHY, 
  auth
} from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS (Imported for calculation consistency) ---
const IN_TO_FT = 1 / 12;
const FT_TO_M = 0.3048;           
const CEMENT_BAGS_PER_M3 = 28.8; // Standard 50kg bags per 1m³ of cement
const DRY_VOL_MULTIPLIER = 1.33; // Dry volume factor for mortar
const SAND_DENSITY_KG_M3 = 1600; // Average density of sand
const CFT_PER_M3 = 35.3147;
// -----------------------------------------------------------------

export default function WallScreen({ route, navigation }: any) {
  const { totalArea = 1000, rooms = [], projectId, tier = 'Standard' } = route.params || {};

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  
  // --- UI & MODAL STATE ---
  const [wallType, setWallType] = useState<WallType>('Load Bearing');
  const [materialType, setMaterialType] = useState<string>('All'); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeSelectionKey, setActiveSelectionKey] = useState<'Cement' | 'Sand' | 'LoadBearingBrick' | 'PartitionBrick' | null>(null);
  const [wallThicknessError, setWallThicknessError] = useState<string | null>(null); // NEW ERROR STATE
  
  // --- SEPARATE MATERIAL SELECTIONS FOR EACH WALL TYPE ---
  const [loadBearingBrick, setLoadBearingBrick] = useState<any>(null);
  const [partitionBrick, setPartitionBrick] = useState<any>(null);
  
  // --- INPUT FIELDS (Inches for thickness, Feet for height) ---
  const [height, setHeight] = useState('10.5');
  const [wallThickness, setWallThickness] = useState('9'); // Wall Thickness in INCHES (e.g., 9 for a 9" wall)
  const [jointThickness, setJointThickness] = useState('0.375'); // Mortar Joint Thickness in INCHES (3/8 inch)
  const [openingDeduction, setOpeningDeduction] = useState('20');
  
  // --- METADATA FROM AI ANALYSIS ---
  const [avgOpeningPercentage, setAvgOpeningPercentage] = useState(20); // Will be updated from rooms data
  const [avgMainWallRatio, setAvgMainWallRatio] = useState(0.6); // Load-Bearing wall proportion
  const [avgPartitionWallRatio, setAvgPartitionWallRatio] = useState(0.4); // Partition wall proportion

  // 1. Fetch Materials Once
  useEffect(() => {
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 1.5. Extract Wall Metadata from Rooms (Deep Metadata Extraction)
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      // Calculate averages from room metadata
      let totalMainRatio = 0;
      let totalPartitionRatio = 0;
      let totalOpeningPercentage = 0;
      let roomsWithMetadata = 0;

      rooms.forEach((room: any) => {
        if (room.wallMetadata) {
          totalMainRatio += room.wallMetadata.mainWallRatio || 0.6;
          totalPartitionRatio += room.wallMetadata.partitionWallRatio || 0.4;
          roomsWithMetadata++;
        }
        if (room.openingPercentage) {
          totalOpeningPercentage += room.openingPercentage;
        }
      });

      if (roomsWithMetadata > 0) {
        const avgMain = totalMainRatio / roomsWithMetadata;
        const avgPartition = totalPartitionRatio / roomsWithMetadata;
        const avgOpening = Math.round(totalOpeningPercentage / rooms.length);

        setAvgMainWallRatio(avgMain);
        setAvgPartitionWallRatio(avgPartition);
        setAvgOpeningPercentage(avgOpening);

        // Intelligently set wall thickness based on detected wall classes
        // Load-Bearing walls: 9" (0.75 ft), Partition walls: 4.5" (0.375 ft)
        // Use weighted average: (mainRatio * 9) + (partitionRatio * 4.5)
        const estimatedThickness = (avgMain * 9) + (avgPartition * 4.5);
        setWallThickness(estimatedThickness.toFixed(2));

        // Update opening deduction based on AI analysis
        setOpeningDeduction(avgOpening.toString());

        console.log(`Wall Metadata Extracted:`, {
          mainWallRatio: avgMain.toFixed(2),
          partitionWallRatio: avgPartition.toFixed(2),
          estimatedThickness: estimatedThickness.toFixed(2),
          estimatedOpeningDeduction: avgOpening,
        });
      }
    }
  }, [rooms]);

  // 2. Default Selections Logic
  useEffect(() => {
    if (materials.length > 0) {
      const initialSels: any = { ...selections };
      
      const filteredByTier = (items: any[]) => {
        const sorted = [...items].sort((a, b) => tier === 'Economy' 
          ? (parseFloat(a.pricePerUnit) - parseFloat(b.pricePerUnit)) 
          : (parseFloat(b.pricePerUnit) - parseFloat(a.pricePerUnit))
        );
        return sorted[0] || items[0] || null;
      };

      // Set default Load Bearing Brick (thick walls)
      const loadBearingOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing' && m.type?.includes('Brick'));
      if (loadBearingOpts.length > 0 && !loadBearingBrick) {
        setLoadBearingBrick(filteredByTier(loadBearingOpts));
      }

      // Set default Partition Brick (thin walls)
      const partitionOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Non-Load Bearing' && m.type?.includes('Brick'));
      if (partitionOpts.length > 0 && !partitionBrick) {
        setPartitionBrick(filteredByTier(partitionOpts));
      }

      // Set default Cement & Sand
      if (!initialSels['Cement']) {
        initialSels['Cement'] = filteredByTier(materials.filter(m => m.type === 'Cement'));
      }
      if (!initialSels['Sand']) {
        initialSels['Sand'] = filteredByTier(materials.filter(m => m.type === 'Sand'));
      }

      setSelections(initialSels);
    }
  }, [materials, tier]);

  // 3. Calculation Engine (Updated for weighted material-specific quantity)
  const calculation = useMemo(() => { 
    
    const h_ft = parseFloat(height) || 0; // Height in Feet
    const wt_in = parseFloat(wallThickness) || 0; // Wall Thickness in Inches
    const jt_in = parseFloat(jointThickness) || 0; // Joint Thickness in Inches
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const selectedLoadBearing = loadBearingBrick;
    const selectedPartition = partitionBrick;

    if (h_ft <= 0 || wt_in <= 0 || (!selectedLoadBearing && !selectedPartition)) return { 
      brickQty: 0, cementBags: 0, sandQty: 0, totalCost: 0, 
      costBreakdown: { bricks: 0, cement: 0, sand: 0 }, 
      sandUnit: 'cft', 
      loadBearingBrand: 'Not Selected',
      partitionBrand: 'Not Selected',
      cementBrand: 'Not Selected', 
      sandBrand: 'Not Selected', 
      mortarMix: '1:0' 
    };

    // --- 1. Running Length & Total Volume (in CUM) ---
    const runningLength_ft = (rooms?.length > 0) 
      ? (rooms.reduce((acc: number, r: any) => acc + (2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0))), 0)) * 0.7
      : 4 * Math.sqrt(totalArea || 1000) * 0.7;
    
    const wallLength_m = runningLength_ft * FT_TO_M;
    const wallHeight_m = h_ft * FT_TO_M;
    const wallThickness_m = wt_in * IN_TO_FT * FT_TO_M; 

    const totalVolume_m3 = (wallLength_m * wallHeight_m * wallThickness_m) * (1 - ded);

    // --- 2. Split Volume based on AI Detected Ratios ---
    const loadBearingVolume_m3 = totalVolume_m3 * avgMainWallRatio;
    const partitionVolume_m3 = totalVolume_m3 * avgPartitionWallRatio;

    /**
     * Helper function to calculate quantities for a given brick type and volume
     */
    const calculateForBrickType = (brick: any, volume: number, mortarSpec: {cementMortar: number, sandMortar: number}) => {
      if (!brick || volume <= 0) return { qty: 0, brickVolume: 0, mortarVolume: 0 };

      const dimsMatch = brick.dimensions?.match(/(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)/)
      if (!dimsMatch) return { qty: 0, brickVolume: 0, mortarVolume: 0 };

      const brickDimsIn = [
        parseFloat(dimsMatch[1]), 
        parseFloat(dimsMatch[3]), 
        parseFloat(dimsMatch[5])
      ].sort((a, b) => b - a);

      const brickVolume_m3 = (brickDimsIn[0] * brickDimsIn[1] * brickDimsIn[2]) * IN_TO_FT * IN_TO_FT * IN_TO_FT * FT_TO_M * FT_TO_M * FT_TO_M;
      const totalL_m = (brickDimsIn[0] + jt_in) * IN_TO_FT * FT_TO_M;
      const totalW_m = (brickDimsIn[1] + jt_in) * IN_TO_FT * FT_TO_M;
      const totalH_m = (brickDimsIn[2] + jt_in) * IN_TO_FT * FT_TO_M;
      const totalVolumePerBrick_m3 = totalL_m * totalW_m * totalH_m;

      const qty = Math.round(volume / totalVolumePerBrick_m3);
      const totalBrickVolume = qty * brickVolume_m3;
      const mortarVolume = volume - totalBrickVolume;

      return { qty, brickVolume: totalBrickVolume, mortarVolume };
    };

    // Calculate for Load-Bearing
    const loadBearingCalc = calculateForBrickType(selectedLoadBearing, loadBearingVolume_m3, WALL_TYPE_SPECS['Load Bearing']);
    
    // Calculate for Partition
    const partitionCalc = calculateForBrickType(selectedPartition, partitionVolume_m3, WALL_TYPE_SPECS['Non-Load Bearing']);

    // --- 3. Combined Mortar and Material Quantities ---
    const totalMortarVolume_m3 = loadBearingCalc.mortarVolume + partitionCalc.mortarVolume;
    const dryMortar_m3 = totalMortarVolume_m3 * DRY_VOL_MULTIPLIER;

    // --- For cement/sand, use weighted average of mortar specs ---
    const avgCementParts = (WALL_TYPE_SPECS['Load Bearing'].cementMortar * avgMainWallRatio) + 
                           (WALL_TYPE_SPECS['Non-Load Bearing'].cementMortar * avgPartitionWallRatio);
    const avgSandParts = (WALL_TYPE_SPECS['Load Bearing'].sandMortar * avgMainWallRatio) + 
                         (WALL_TYPE_SPECS['Non-Load Bearing'].sandMortar * avgPartitionWallRatio);
    const parts = avgCementParts + avgSandParts;

    const cementVol_m3 = dryMortar_m3 * (avgCementParts / parts);
    const sandVol_m3 = dryMortar_m3 * (avgSandParts / parts);

    const cementBags = Math.ceil(cementVol_m3 * CEMENT_BAGS_PER_M3);
    const sandUnit = selections['Sand']?.unit?.toLowerCase() || 'cft';
    let finalSandQty: number;
    let sandUnitDisplay: string;
    
    if (sandUnit.includes('cft')) {
        finalSandQty = sandVol_m3 * CFT_PER_M3;
        sandUnitDisplay = 'cft';
    } else if (sandUnit.includes('ton')) {
        finalSandQty = (sandVol_m3 * SAND_DENSITY_KG_M3) / 1000;
        sandUnitDisplay = 'Ton';
    } else {
        finalSandQty = sandVol_m3 * SAND_DENSITY_KG_M3;
        sandUnitDisplay = 'kg';
    }
    finalSandQty = parseFloat(finalSandQty.toFixed(2));

    // --- 4. Cost Calculation ---
    const lbPrice = parseFloat(selectedLoadBearing?.pricePerUnit || 0);
    const pbPrice = parseFloat(selectedPartition?.pricePerUnit || 0);
    const cPrice = parseFloat(selections['Cement']?.pricePerUnit || 0);
    const sPrice = parseFloat(selections['Sand']?.pricePerUnit || 0);

    const lbCost = Math.round(lbPrice * loadBearingCalc.qty);
    const pbCost = Math.round(pbPrice * partitionCalc.qty);
    const cCost = Math.round(cPrice * cementBags);
    const sCost = Math.round(sPrice * finalSandQty);
    
    return {
      brickQty: loadBearingCalc.qty + partitionCalc.qty, 
      loadBearingQty: loadBearingCalc.qty,
      partitionQty: partitionCalc.qty,
      cementBags, sandQty: finalSandQty, sandUnit: sandUnitDisplay,
      loadBearingBrand: selectedLoadBearing?.name || 'Not Selected',
      partitionBrand: selectedPartition?.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      sandBrand: selections['Sand']?.name || 'Not Selected',
      mortarMix: `1:${(avgSandParts).toFixed(1)}`,
      totalCost: Math.round(lbCost + pbCost + cCost + sCost),
      costBreakdown: { bricks: lbCost + pbCost, cement: cCost, sand: sCost }
    };
  }, [height, wallThickness, jointThickness, openingDeduction, selections, loadBearingBrick, partitionBrick, totalArea, rooms, avgMainWallRatio, avgPartitionWallRatio]);

  // 5. Save Logic
  const handleSaveWallEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    if (!projectId) return Alert.alert("Error", "Project ID not found.");
    
    // Validation checks
    const h_ft = parseFloat(height) || 0;
    const wt_in = parseFloat(wallThickness) || 0;
    
    if (h_ft <= 0) return Alert.alert("Validation Error", "Please enter a valid height.");
    if (wt_in <= 0) return Alert.alert("Validation Error", "Please enter a valid wall thickness.");
    if (!loadBearingBrick && !partitionBrick) return Alert.alert("Validation Error", "Please select at least one material type.");
    if (calculation.totalCost === 0) return Alert.alert("Error", "Cost calculation failed. Check dimensions and material selections.");
    if (wallThicknessError) return Alert.alert("Validation Error", wallThicknessError);

    setSaving(true);
    try {
        const lineItems = [];
        
        // Load Bearing bricks
        if (calculation.loadBearingQty > 0) {
          lineItems.push({
            name: calculation.loadBearingBrand || 'Not Selected',
            desc: 'Load-Bearing Bricks/Blocks',
            qty: calculation.loadBearingQty,
            unit: 'Nos',
            total: Math.round((calculation.costBreakdown.bricks * (calculation.loadBearingQty / calculation.brickQty)) || 0),
            rate: loadBearingBrick?.pricePerUnit || 0
          });
        }

        // Partition bricks
        if (calculation.partitionQty > 0) {
          lineItems.push({
            name: calculation.partitionBrand || 'Not Selected',
            desc: 'Partition Bricks/Blocks',
            qty: calculation.partitionQty,
            unit: 'Nos',
            total: Math.round((calculation.costBreakdown.bricks * (calculation.partitionQty / calculation.brickQty)) || 0),
            rate: partitionBrick?.pricePerUnit || 0
          });
        }

        // Cement
        lineItems.push({
          name: calculation.cementBrand || 'Not Selected',
          desc: `Mortar Cement (Mix ${calculation.mortarMix})`,
          qty: calculation.cementBags,
          unit: 'Bags',
          total: calculation.costBreakdown.cement,
          rate: selections['Cement']?.pricePerUnit || 0
        });

        // Sand
        lineItems.push({
          name: calculation.sandBrand || 'Not Selected',
          desc: `Mortar Sand (Mix ${calculation.mortarMix})`,
          qty: calculation.sandQty,
          unit: calculation.sandUnit || 'cft',
          total: calculation.costBreakdown.sand,
          rate: selections['Sand']?.pricePerUnit || 0
        });
        
        // Sanitize data to remove undefined values
        const estimateData = {
            projectId: projectId || '',
            userId: auth.currentUser!.uid,
            itemName: `Wall Masonry (Load-Bearing & Partition)`,
            category: 'Wall',
            totalCost: calculation.totalCost || 0, 
            lineItems: lineItems.filter(item => item.name !== undefined),
            specifications: {
                wallComposition: `${(avgMainWallRatio * 100).toFixed(0)}% Load-Bearing, ${(avgPartitionWallRatio * 100).toFixed(0)}% Partition`,
                height: `${height} ft`,
                thickness: `${wallThickness} in`,
                jointThickness: `${jointThickness} in`,
                deduction: `${openingDeduction}%`,
            },
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'estimates'), estimateData);
        
        Alert.alert("Success", "Wall Estimate saved successfully.");
        navigation.navigate('ProjectSummary', { projectId }); 
    } catch (e: any) {
        Alert.alert("Error", e.message);
    } finally {
        setSaving(false);
    }
  };

  const materialTypeOptions = useMemo(() => {
    return ['Brick', 'Block', 'Stone'];
  }, []);

  const openSelector = (key: 'Cement' | 'Sand' | 'LoadBearingBrick' | 'PartitionBrick') => {
    setActiveSelectionKey(key);
    setIsModalVisible(true);
  };

  // Filter materials based on active selection
  const getModalItems = () => {
    if (activeSelectionKey === 'LoadBearingBrick') {
      return materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing');
    } else if (activeSelectionKey === 'PartitionBrick') {
      return materials.filter(m => m.category === 'Wall' && m.subCategory === 'Non-Load Bearing');
    } else if (activeSelectionKey === 'Cement') {
      return materials.filter(m => m.type === 'Cement');
    } else if (activeSelectionKey === 'Sand') {
      return materials.filter(m => m.type === 'Sand');
    }
    return [];
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tier} Wall Setup</Text>
          <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          {/* AI EXTRACTED METADATA INFO - TOP SECTION */}
          {(avgMainWallRatio > 0 || avgPartitionWallRatio > 0) && (
            <View style={styles.metadataInfoCard}>
              <Text style={styles.metadataInfoTitle}>📊 AI-Detected Wall Composition</Text>
              <View style={styles.metadataInfoRow}>
                <View style={styles.metadataInfoItem}>
                  <Text style={styles.metadataInfoLabel}>Load-Bearing</Text>
                  <Text style={styles.metadataInfoValue}>{(avgMainWallRatio * 100).toFixed(0)}%</Text>
                  <View style={{height: 4, backgroundColor: '#ef4444', borderRadius: 2, marginTop: 4, width: '100%'}} />
                </View>
                <View style={styles.metadataInfoItem}>
                  <Text style={styles.metadataInfoLabel}>Partition</Text>
                  <Text style={styles.metadataInfoValue}>{(avgPartitionWallRatio * 100).toFixed(0)}%</Text>
                  <View style={{height: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginTop: 4, width: '100%'}} />
                </View>
                <View style={styles.metadataInfoItem}>
                  <Text style={styles.metadataInfoLabel}>Openings</Text>
                  <Text style={styles.metadataInfoValue}>{avgOpeningPercentage}%</Text>
                  <View style={{height: 4, backgroundColor: '#f59e0b', borderRadius: 2, marginTop: 4, width: '100%'}} />
                </View>
              </View>
            </View>
          )}
          
          {/* 1. Dimensions Card (Updated Inputs and Error Display) */}
          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>DIMENSIONS & DEDUCTIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Height (ft)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Wall Thickness (in)</Text>
                <TextInput 
                    style={[styles.input, wallThicknessError && {borderColor: '#ef4444'}]} 
                    value={wallThickness} 
                    onChangeText={setWallThickness} 
                    keyboardType="decimal-pad" 
                />
              </View>
            </View>
            {/* NEW: Error Message for Wall Thickness */}
            {wallThicknessError && <Text style={styles.inputErrorText}>{wallThicknessError}</Text>}

            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={styles.inputBox}>
                <Text style={[styles.label, {color: '#ef4444'}]}>Openings %</Text>
                <TextInput style={[styles.input, {borderColor: '#fee2e2'}]} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
              </View>
              <View style={styles.inputBox}>
                <Text style={[styles.label, {color: '#315b76'}]}>Joint Thickness (in)</Text>
                <TextInput style={[styles.input, {borderColor: '#d1e0f0'}]} value={jointThickness} onChangeText={setJointThickness} keyboardType="decimal-pad" />
              </View>
            </View>
          </View>

          {/* 2. Dual Material Selection (Load-Bearing & Partition) */}
          <Text style={styles.sectionLabel}>WALL MATERIALS</Text>
          
          {/* Load-Bearing Material Card with Horizontal Scroll Inside */}
          <View style={styles.materialCard}>
            <View style={styles.materialCardHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.materialLabel}>Load-Bearing Walls</Text>
                <Text style={styles.materialSubLabel}>{(avgMainWallRatio * 100).toFixed(0)}% of structure</Text>
              </View>
              <View style={{backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}>
                <Text style={{color: '#fff', fontSize: 9, fontWeight: '700'}}>9 inch</Text>
              </View>
            </View>

            {/* Display Selected Material Info */}
            {loadBearingBrick && (
              <Text style={styles.selectedMaterialText}>✓ Selected: {loadBearingBrick.name}</Text>
            )}

            {/* Horizontal Scroll - Load-Bearing Materials */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, {marginVertical: 10}]}>
              {(() => {
                const loadBearingMaterials = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing');
                return loadBearingMaterials.length > 0 ? loadBearingMaterials.map(item => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.brandCard, styles.materialBrandCard, loadBearingBrick?.id === item.id && styles.activeBrand]} 
                    onPress={() => setLoadBearingBrick(item)}
                  >
                    <View style={styles.imagePlaceholder}>
                      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.emptyText}>No load-bearing materials available.</Text>
                );
              })()}
            </ScrollView>

            {loadBearingBrick && (
              <Text style={styles.materialQty}>{calculation.loadBearingQty} units needed</Text>
            )}
          </View>

          {/* Partition Material Card with Horizontal Scroll Inside */}
          <View style={[styles.materialCard, {marginTop: 12}]}>
            <View style={styles.materialCardHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.materialLabel}>Partition Walls</Text>
                <Text style={styles.materialSubLabel}>{(avgPartitionWallRatio * 100).toFixed(0)}% of structure</Text>
              </View>
              <View style={{backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}>
                <Text style={{color: '#fff', fontSize: 9, fontWeight: '700'}}>4.5 inch</Text>
              </View>
            </View>

            {/* Display Selected Material Info */}
            {partitionBrick && (
              <Text style={styles.selectedMaterialText}>✓ Selected: {partitionBrick.name}</Text>
            )}

            {/* Horizontal Scroll - Partition Materials */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, {marginVertical: 10}]}>
              {(() => {
                const partitionMaterials = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Non-Load Bearing');
                return partitionMaterials.length > 0 ? partitionMaterials.map(item => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.brandCard, styles.materialBrandCard, partitionBrick?.id === item.id && styles.activeBrand]} 
                    onPress={() => setPartitionBrick(item)}
                  >
                    <View style={styles.imagePlaceholder}>
                      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.emptyText}>No partition materials available.</Text>
                );
              })()}
            </ScrollView>

            {partitionBrick && (
              <Text style={styles.materialQty}>{calculation.partitionQty} units needed</Text>
            )}
          </View>

          {/* Material Type Filter Chips (Brick, Block, Stone) */}
          <Text style={styles.sectionLabel}>MATERIAL CLASSIFICATION</Text>
          <View style={styles.materialTypeContainer}>
            {materialTypeOptions.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, materialType === type && styles.typeChipActive]}
                onPress={() => setMaterialType(type)}
              >
                <Text style={[styles.typeChipText, materialType === type && styles.typeChipTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Horizontal Bricks/Blocks/Stone Selection (View Materials) */}
          <Text style={styles.sectionLabel}>SELECT SPECIFIC {materialType.toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll}>
            {(() => {
              const filteredMaterials = materials.filter(m => m.category === 'Wall' && m.type === materialType);
              return filteredMaterials.length > 0 ? filteredMaterials.map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.brandCard]} 
                  onPress={() => {
                    // Guide user to use Load-Bearing or Partition selector
                    Alert.alert("Info", "Please select Load-Bearing or Partition materials from the dedicated sections above.");
                  }}
                >
                  <View style={styles.imagePlaceholder}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                  </View>
                  <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                  <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                </TouchableOpacity>
              )) : (
                <Text style={styles.emptyText}>No {materialType.toLowerCase()} found in this category.</Text>
              );
            })()}
          </ScrollView>

          {/* 3. Mortar Materials Selectors */}
          <Text style={styles.sectionLabel}>MORTAR MATERIALS</Text>
          <View style={styles.materialGrid}>
            <TouchableOpacity style={styles.materialCard} onPress={() => openSelector('Cement')}>
              <Text style={styles.materialLabel}>Cement Brand</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{calculation.cementBrand}</Text>
                <Ionicons name="chevron-down" size={14} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.cementBags} Bags Required</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.materialCard} onPress={() => openSelector('Sand')}>
              <Text style={styles.materialLabel}>Sand Type</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{calculation.sandBrand}</Text>
                <Ionicons name="chevron-down" size={14} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.sandQty} {calculation.sandUnit} Required</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Summary Result Card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>ESTIMATION SUMMARY</Text>
            <View style={styles.resRow}><Text style={styles.resLabel}>Load-Bearing Bricks</Text><Text style={styles.resVal}>{calculation.loadBearingQty} Nos</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Partition Bricks</Text><Text style={styles.resVal}>{calculation.partitionQty} Nos</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Total Bricks</Text><Text style={styles.resVal}>{calculation.brickQty} Nos</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Cement Qty (Bags)</Text><Text style={styles.resVal}>{calculation.cementBags} Bags</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Sand Qty ({calculation.sandUnit})</Text><Text style={styles.resVal}>{calculation.sandQty} {calculation.sandUnit}</Text></View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Wall Material Cost</Text>
              <Text style={styles.totalVal}>₹{calculation.totalCost.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Floating Action Button (Updated Action) */}
        <TouchableOpacity 
          style={[styles.mainBtn, (saving) && styles.mainBtnDisabled]} 
          onPress={handleSaveWallEstimate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.mainBtnText}>Save Estimate</Text>
              <Ionicons name="save-outline" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* Selection Modal for Materials */}
        <Modal visible={isModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activeSelectionKey === 'LoadBearingBrick' ? 'Load-Bearing Materials' :
                   activeSelectionKey === 'PartitionBrick' ? 'Partition Materials' :
                   `Choose ${activeSelectionKey}`}
                </Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#1e293b" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={getModalItems()}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity 
                    style={styles.selectorItem} 
                    onPress={() => {
                      if (activeSelectionKey === 'LoadBearingBrick') {
                        setLoadBearingBrick(item);
                      } else if (activeSelectionKey === 'PartitionBrick') {
                        setPartitionBrick(item);
                      } else {
                        setSelections({...selections, [activeSelectionKey!]: item});
                      }
                      setIsModalVisible(false);
                    }}
                  >
                    <View>
                      <Text style={styles.selectorItemName}>{item.name}</Text>
                      <Text style={styles.selectorItemPrice}>₹{item.pricePerUnit} / {item.unit}</Text>
                    </View>
                    {((activeSelectionKey === 'LoadBearingBrick' && loadBearingBrick?.id === item.id) ||
                      (activeSelectionKey === 'PartitionBrick' && partitionBrick?.id === item.id) ||
                      (activeSelectionKey !== 'LoadBearingBrick' && activeSelectionKey !== 'PartitionBrick' && selections[activeSelectionKey!]?.id === item.id)) && 
                      <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 30 }}
              />
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },
  inputCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  row: { flexDirection: 'row', gap: 10 },
  inputBox: { flex: 1 },
  label: { fontSize: 10, color: '#64748b', marginBottom: 5, fontWeight: '700' },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 15, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  inputErrorText: { color: '#ef4444', fontSize: 10, marginTop: 5, marginLeft: 2, fontWeight: '600' }, // New Style
  
  // AI Metadata Info Display
  metadataInfoCard: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, marginTop: 0, marginBottom: 15 },
  metadataInfoTitle: { fontSize: 12, fontWeight: '700', color: '#15803d', marginBottom: 10 },
  metadataInfoRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-around' },
  metadataInfoItem: { flex: 1, alignItems: 'center' },
  metadataInfoLabel: { fontSize: 10, color: '#22c55e', fontWeight: '600', marginBottom: 4 },
  metadataInfoValue: { fontSize: 16, fontWeight: '800', color: '#15803d' },
  
  wallTypeContainer: { flexDirection: 'row', gap: 8 },
  wallTypeTab: { flex: 1, paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  wallTypeTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  wallTypeText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  wallTypeTextActive: { color: '#fff' },

  materialTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  typeChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  typeChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#fff' },

  brandScroll: { marginBottom: 10 },
  brandCard: { width: 130, backgroundColor: '#fff', padding: 10, borderRadius: 15, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  activeBrand: { borderColor: '#315b76', backgroundColor: '#eff6ff', borderWidth: 2 },
  imagePlaceholder: { height: 70, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandImg: { width: '100%', height: '100%', borderRadius: 10 },
  brandName: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  brandPrice: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 2 },
  brandDim: { fontSize: 9, color: '#94a3b8', marginTop: 1 }, // Added style for dimension
  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginLeft: 5 },

  materialGrid: { flexDirection: 'row', gap: 12 },
  materialCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 0 },
  materialCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  materialLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  materialSubLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  selectedMaterialText: { fontSize: 11, fontWeight: '600', color: '#10b981', marginBottom: 10 },
  materialSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8 },
  materialValue: { fontSize: 11, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 5 },
  materialBrandCard: { width: 100, marginRight: 10 },
  materialQty: { fontSize: 11, fontWeight: '600', color: '#315b76', marginTop: 10 },

  resultCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 15, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  resultHeader: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resLabel: { color: '#64748b', fontSize: 12 },
  resVal: { color: '#1e293b', fontWeight: '700', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#1e293b', fontSize: 14, fontWeight: '600' },
  totalVal: { color: '#10b981', fontSize: 22, fontWeight: '800' },

  mainBtn: { backgroundColor: '#315b76', margin: 20, padding: 18, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },
  mainBtnDisabled: { opacity: 0.6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: SCREEN_HEIGHT * 0.7 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  selectorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectorItemName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  selectorItemPrice: { fontSize: 14, color: '#10b981', fontWeight: '700', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});