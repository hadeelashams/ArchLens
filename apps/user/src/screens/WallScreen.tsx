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
  auth, 
  createDocument
} from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

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
  const { totalArea, rooms, projectId, tier } = route.params || {};

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  
  // --- UI & MODAL STATE ---
  const [wallType, setWallType] = useState<WallType>('Load Bearing');
  const [materialType, setMaterialType] = useState<string>('All'); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeSelectionKey, setActiveSelectionKey] = useState<'Cement' | 'Sand' | null>(null);
  const [wallThicknessError, setWallThicknessError] = useState<string | null>(null); // NEW ERROR STATE
  
  // --- INPUT FIELDS (Inches for thickness, Feet for height) ---
  const defaultHeight = tier === 'Luxury' ? '11' : tier === 'Standard' ? '10.5' : '10';
  const [height, setHeight] = useState(defaultHeight);
  const [wallThickness, setWallThickness] = useState('9'); // Wall Thickness in INCHES (e.g., 9 for a 9" wall)
  const [jointThickness, setJointThickness] = useState('0.375'); // Mortar Joint Thickness in INCHES (3/8 inch)
  const [openingDeduction, setOpeningDeduction] = useState('20');

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

      // Set default Brick/Block
      const brickOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === wallType && m.type?.includes('Brick'));
      if (brickOpts.length > 0 && !initialSels['Bricks']) {
        initialSels['Bricks'] = filteredByTier(brickOpts);
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
  }, [materials, wallType, tier]);

  // 3. Calculation Engine (Updated for material-specific quantity)
  const calculation = useMemo(() => {
    // Reset error on recalculation
    setWallThicknessError(null); 
    
    const h_ft = parseFloat(height) || 0; // Height in Feet
    const wt_in = parseFloat(wallThickness) || 0; // Wall Thickness in Inches
    const jt_in = parseFloat(jointThickness) || 0; // Joint Thickness in Inches
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const selectedBrick = selections['Bricks'];
    const spec = WALL_TYPE_SPECS[wallType];

    if (h_ft <= 0 || wt_in <= 0 || !selectedBrick) return { brickQty: 0, cementBags: 0, sandQty: 0, totalCost: 0, costBreakdown: { bricks: 0, cement: 0, sand: 0 }, sandUnit: 'cft', brickBrand: 'Not Selected', cementBrand: 'Not Selected', sandBrand: 'Not Selected', mortarMix: '1:0' };

    // --- 1. Running Length & Total Volume (in CUM) ---
    const runningLength_ft = (rooms?.length > 0) 
      ? rooms.reduce((acc: number, r: any) => acc + (2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0))), 0)
      : 4 * Math.sqrt(totalArea || 1000);
    
    const wallLength_m = runningLength_ft * FT_TO_M;
    const wallHeight_m = h_ft * FT_TO_M;
    const wallThickness_m = wt_in * IN_TO_FT * FT_TO_M; 

    const totalVolume_m3 = (wallLength_m * wallHeight_m * wallThickness_m) * (1 - ded);

    // --- 2. Brick/Block Quantity Calculation (CRITICAL FIX) ---
    const dimsMatch = selectedBrick.dimensions?.match(/(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)/);
    
    if (!dimsMatch) {
      setWallThicknessError('Dimensions not set for selected block/brick in the database.');
      return { brickQty: 0, cementBags: 0, sandQty: 0, totalCost: 0, costBreakdown: { bricks: 0, cement: 0, sand: 0 }, sandUnit: 'cft' };
    }

    const brickDimsIn = [
        parseFloat(dimsMatch[1]), 
        parseFloat(dimsMatch[3]), 
        parseFloat(dimsMatch[5])
    ].sort((a, b) => b - a); // Sort descending to easily find largest dimension

    const brickL_in = brickDimsIn[0]; // Largest dimension
    const brickW_in = brickDimsIn[1]; // Second largest
    const brickH_in = brickDimsIn[2]; // Smallest

    // Validate Wall Thickness against Brick Dimensions
    const effectiveBrickWidth = brickW_in + jt_in; // Brick's width + one joint
    const effectiveBrickLength = brickL_in + jt_in; // Brick's length + one joint
    const effectiveBrickHeight = brickH_in + jt_in; // Brick's height + one joint

    // Check if Wall Thickness is a sensible multiple of brick's width or length (the cross-sectional dims)
    const isSensibleThickness = 
        Math.abs(wt_in - effectiveBrickWidth) < 0.5 || // Close to one width (e.g. 4.5 inch wall)
        Math.abs(wt_in - effectiveBrickLength) < 0.5 || // Close to one length (rare, but possible)
        Math.abs(wt_in - (effectiveBrickWidth * 2 - jt_in)) < 0.5; // Close to two widths with a joint in between (e.g. 9 inch wall)

    if (!isSensibleThickness && wt_in > 0.5) {
        setWallThicknessError(`Wall thickness (${wt_in} in) is unusual for a ${brickL_in}x${brickW_in}x${brickH_in} block with ${jt_in} joint. Check if this is a sensible multiple of ${effectiveBrickWidth} or ${effectiveBrickLength}.`);
    }

    // Use the maximum of the brick's largest dimension or the wall thickness for the quantity calc.
    // Assuming the largest brick face is laid along the wall.
    // The width of the brick + joint in the direction of the wall thickness determines the number of layers.
    const layers = Math.ceil(wt_in / effectiveBrickWidth); 

    // Volume of one material unit INCLUDING mortar joint (in CUM)
    const totalL_m = (brickL_in + jt_in) * IN_TO_FT * FT_TO_M;
    const totalW_m = (brickW_in + jt_in) * IN_TO_FT * FT_TO_M;
    const totalH_m = (brickH_in + jt_in) * IN_TO_FT * FT_TO_M;
    const totalVolumePerBrick_m3 = totalL_m * totalW_m * totalH_m;

    // Calculate bricks per unit volume based on layers
    // The volume of a wall using this brick is: L_wall * H_wall * W_wall
    // The total volume of wall built by one brick is the volume of the brick + mortar in the L, H direction, times the thickness.
    // Bricks per M3 of finished wall:
    const bricksPerM3 = layers / (wallThickness_m * totalH_m * totalL_m);
    
    // A SIMPLER, MORE ROBUST WAY to calculate total units:
    const totalUnits = Math.round(totalVolume_m3 / totalVolumePerBrick_m3);


    // --- 3. Mortar Volume Calculation ---
    const brickVolume_m3 = (brickL_in * brickW_in * brickH_in) * IN_TO_FT * IN_TO_FT * IN_TO_FT * FT_TO_M * FT_TO_M * FT_TO_M;
    const totalBrickVolume_m3 = totalUnits * brickVolume_m3;
    const totalMortarVolume_m3 = totalVolume_m3 - totalBrickVolume_m3; // Total WET Mortar (Total Wall Vol - Total Brick Vol)
    
    const dryMortar_m3 = totalMortarVolume_m3 * DRY_VOL_MULTIPLIER;

    // --- 4. Cement & Sand Quantity (Based on 1:N Mortar Mix) ---
    const parts = spec.cementMortar + spec.sandMortar;
    const cementVol_m3 = dryMortar_m3 * (spec.cementMortar / parts);
    const sandVol_m3 = dryMortar_m3 * (spec.sandMortar / parts);

    const cementBags = Math.ceil(cementVol_m3 * CEMENT_BAGS_PER_M3);
    const sandUnit = selections['Sand']?.unit?.toLowerCase() || 'cft';
    let finalSandQty: number;
    let sandUnitDisplay: string;
    
    // Convert sand volume to the unit specified in the database
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

    // --- 5. Cost Calculation ---
    const bPrice = parseFloat(selections['Bricks']?.pricePerUnit || 0);
    const cPrice = parseFloat(selections['Cement']?.pricePerUnit || 0);
    const sPrice = parseFloat(selections['Sand']?.pricePerUnit || 0);

    const bCost = Math.round(bPrice * totalUnits);
    const cCost = Math.round(cPrice * cementBags);
    const sCost = Math.round(sPrice * finalSandQty);
    
    return {
      brickQty: totalUnits, cementBags, sandQty: finalSandQty, sandUnit: sandUnitDisplay,
      brickBrand: selectedBrick.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      sandBrand: selections['Sand']?.name || 'Not Selected',
      mortarMix: `1:${spec.sandMortar}`,
      totalCost: Math.round(bCost + cCost + sCost),
      costBreakdown: { bricks: bCost, cement: cCost, sand: sCost }
    };
  }, [height, wallThickness, jointThickness, openingDeduction, selections, wallType, totalArea, rooms]);

  // 5. Save Logic
  const handleSaveWallEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    if (!projectId) return Alert.alert("Error", "Project ID not found.");
    if (calculation.totalCost === 0) return Alert.alert("Error", "Cost is zero. Check dimensions and material selections.");
    if (wallThicknessError) return Alert.alert("Validation Error", "Please adjust Wall Thickness or select a different block.");

    setSaving(true);
    try {
        const lineItems = [
            { name: calculation.brickBrand || 'Not Selected', desc: 'Bricks/Blocks', qty: calculation.brickQty, unit: 'Nos', total: calculation.costBreakdown.bricks, rate: selections['Bricks']?.pricePerUnit || 0 },
            { name: calculation.cementBrand || 'Not Selected', desc: `Mortar Cement (Mix ${calculation.mortarMix})`, qty: calculation.cementBags, unit: 'Bags', total: calculation.costBreakdown.cement, rate: selections['Cement']?.pricePerUnit || 0 },
            { name: calculation.sandBrand || 'Not Selected', desc: `Mortar Sand (Mix ${calculation.mortarMix})`, qty: calculation.sandQty, unit: calculation.sandUnit || 'cft', total: calculation.costBreakdown.sand, rate: selections['Sand']?.pricePerUnit || 0 },
        ];
        
        // Sanitize data to remove undefined values
        const estimateData = {
            projectId: projectId || '',
            userId: auth.currentUser!.uid,
            itemName: `${wallType} Wall Masonry`,
            category: 'Wall',
            totalCost: calculation.totalCost || 0, 
            lineItems: lineItems.filter(item => item.name !== undefined),
            specifications: {
                wallType: wallType || '',
                height: `${height} ft`,
                thickness: `${wallThickness} in`,
                jointThickness: `${jointThickness} in`,
                deduction: `${openingDeduction}%`,
            },
            createdAt: serverTimestamp()
        };
        
        await createDocument('estimates', estimateData);
        
        Alert.alert("Success", "Wall Estimate saved successfully to project summary.");
        navigation.navigate('ProjectSummary', { projectId }); 
    } catch (e: any) {
        Alert.alert("Error", e.message);
    } finally {
        setSaving(false);
    }
  };

  const materialTypeOptions = useMemo(() => {
    // @ts-ignore
    const options = CONSTRUCTION_HIERARCHY.Wall.subCategories[wallType] || [];
    return ['All', ...options];
  }, [wallType]);

  const openSelector = (key: 'Cement' | 'Sand') => {
    setActiveSelectionKey(key);
    setIsModalVisible(true);
  };

  // 4. Filtering Logic for horizontal scroll (Bricks/Blocks)
  const filteredBricks = materials.filter(m => {
    const matchesWall = m.category === 'Wall' && m.subCategory === wallType;
    if (!matchesWall) return false;
    if (materialType === 'All') return true;
    return m.type === materialType;
  });

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

          {/* 2. Wall Type Tabs */}
          <Text style={styles.sectionLabel}>WALL TYPE</Text>
          <View style={styles.wallTypeContainer}>
            {(Object.keys(WALL_TYPE_SPECS) as WallType[]).map((type) => (
              <TouchableOpacity 
                key={type} 
                style={[styles.wallTypeTab, wallType === type && styles.wallTypeTabActive]} 
                onPress={() => { setWallType(type); setMaterialType('All'); }}
              >
                <Ionicons 
                  name={type === 'Load Bearing' ? 'cube' : type === 'Non-Load Bearing' ? 'business' : 'grid-outline'} 
                  size={14} 
                  color={wallType === type ? '#fff' : '#64748b'} 
                />
                <Text style={[styles.wallTypeText, wallType === type && styles.wallTypeTextActive]}>{WALL_TYPE_SPECS[type].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 3. Material Type Filter Chips (Brick, Block, Stone) */}
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

          {/* 4. Horizontal Bricks Selection */}
          <Text style={styles.sectionLabel}>SELECT SPECIFIC {materialType.toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll}>
            {filteredBricks.length > 0 ? filteredBricks.map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.brandCard, selections['Bricks']?.id === item.id && styles.activeBrand]} 
                onPress={() => setSelections({...selections, 'Bricks': item})}
              >
                <View style={styles.imagePlaceholder}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                </View>
                <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.emptyText}>No materials found for this category.</Text>
            )}
          </ScrollView>

          {/* 5. Mortar Materials Selectors */}
          <Text style={styles.sectionLabel}>MORTAR MATERIALS (1:{WALL_TYPE_SPECS[wallType].sandMortar} Mix)</Text>
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

          {/* 6. Summary Result Card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>ESTIMATION SUMMARY</Text>
            <View style={styles.resRow}><Text style={styles.resLabel}>{selections['Bricks']?.name?.includes('Block') ? 'Block' : 'Brick'} Qty</Text><Text style={styles.resVal}>{calculation.brickQty} Nos</Text></View>
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
          style={styles.mainBtn} 
          onPress={handleSaveWallEstimate}
          disabled={saving || calculation.totalCost === 0 || !!wallThicknessError} // Disable if error exists
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.mainBtnText}>Save & View Project Summary</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* Selection Modal for Cement/Sand */}
        <Modal visible={isModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose {activeSelectionKey}</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#1e293b" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={materials.filter(m => m.type === activeSelectionKey)}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity 
                    style={styles.selectorItem} 
                    onPress={() => {
                      setSelections({...selections, [activeSelectionKey!]: item});
                      setIsModalVisible(false);
                    }}
                  >
                    <View>
                      <Text style={styles.selectorItemName}>{item.name}</Text>
                      <Text style={styles.selectorItemPrice}>₹{item.pricePerUnit} / {item.unit}</Text>
                    </View>
                    {selections[activeSelectionKey!]?.id === item.id && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
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
  materialCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  materialLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  materialSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8 },
  materialValue: { fontSize: 11, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 5 },
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