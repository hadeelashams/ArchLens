import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, TextInput, Image, ActivityIndicator, 
  Platform, Modal, FlatList, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialSelectionModal } from '../components/MaterialSelectionModal';
import { MaterialCard } from '../components/MaterialCard';
import { 
  db, 
  WALL_TYPE_SPECS, 
  WallType, 
  CONSTRUCTION_HIERARCHY, 
  auth,
  getComponentRecommendation,
  detectWallComposition
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
  const { totalArea = 1000, rooms = [], projectId, tier = 'Standard', wallComposition } = route.params || {};

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
  
  // --- INPUT FIELDS (Inches for thickness, Feet for height) - VALUES FROM AI ONLY ---
  const [height, setHeight] = useState('10.5');
  const [wallThickness, setWallThickness] = useState(''); // Wall Thickness in INCHES - from AI detection only
  const [jointThickness, setJointThickness] = useState('0.375'); // Mortar Joint Thickness in INCHES (3/8 inch)
  const [openingDeduction, setOpeningDeduction] = useState(''); // From AI detection only
  
  // --- METADATA FROM AI ANALYSIS (NO DEFAULTS - AI ONLY) ---
  const [avgOpeningPercentage, setAvgOpeningPercentage] = useState(0); // Will be updated from AI detection only
  const [avgMainWallRatio, setAvgMainWallRatio] = useState(0); // Load-Bearing wall proportion from AI
  const [avgPartitionWallRatio, setAvgPartitionWallRatio] = useState(0); // Partition wall proportion from AI
  const [isDetectingComposition, setIsDetectingComposition] = useState(false);
  const [compositionDetected, setCompositionDetected] = useState(false); // Track if AI detection was successful

  // --- AI RECOMMENDATION STATE ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, string>>({
    loadBearingBrick: null,
    partitionBrick: null,
    cement: null,
    sand: null
  });

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

  // 1.5. AI Detect Wall Composition from Floor Plan (or use pre-computed from floor plan analysis)
  useEffect(() => {
    // If wall composition was already computed during floor plan analysis, use it directly
    if (wallComposition && typeof wallComposition === 'object') {
      console.log('📊 Using pre-computed wall composition from floor plan analysis:', wallComposition);
      
      const loadBearing = Math.round(parseFloat(wallComposition.loadBearingPercentage));
      const partition = Math.round(parseFloat(wallComposition.partitionPercentage));
      const opening = Math.round(parseFloat(wallComposition.openingPercentage));
      const thickness = parseFloat(wallComposition.averageWallThickness);

      // Validate the values
      if (!isNaN(loadBearing) && !isNaN(partition) && !isNaN(opening) && loadBearing >= 0 && partition >= 0) {
        setAvgMainWallRatio(loadBearing / 100);
        setAvgPartitionWallRatio(partition / 100);
        setAvgOpeningPercentage(opening);
        setCompositionDetected(true);

        // Set wall thickness from AI analysis
        if (!isNaN(thickness) && thickness > 0) {
          setWallThickness(thickness.toFixed(2));
        } else {
          // Fallback thickness calculation
          const estimatedThickness = (loadBearing / 100 * 9) + (partition / 100 * 4.5);
          setWallThickness(estimatedThickness.toFixed(2));
        }
        setOpeningDeduction(opening.toString());

        console.log('✓ Applied pre-computed wall composition:', {
          loadBearingPercentage: loadBearing,
          partitionPercentage: partition,
          openingPercentage: opening,
          wallThickness: thickness || 'calculated',
          confidence: wallComposition.confidence
        });
      } else {
        console.warn('Wall composition values invalid, will detect from rooms:', { loadBearing, partition, opening });
      }
      return; // Skip AI detection since we already have the data
    }

    // Otherwise, detect wall composition from room data
    if (rooms && rooms.length > 0 && totalArea > 0) {
      setIsDetectingComposition(true);
      detectWallComposition(rooms, totalArea)
        .then((composition: any) => {
          console.log('📊 Received wall composition:', composition);
          
          // Validate and parse AI response
          const loadBearing = Math.round(parseFloat(composition.loadBearingPercentage));
          const partition = Math.round(parseFloat(composition.partitionPercentage));
          const opening = Math.round(parseFloat(composition.openingPercentage));

          // Validate the values
          if (isNaN(loadBearing) || isNaN(partition) || isNaN(opening)) {
            throw new Error('AI returned invalid numeric values');
          }

          if (loadBearing < 0 || loadBearing > 100 || partition < 0 || partition > 100) {
            throw new Error('AI returned out-of-range percentages');
          }

          // Convert percentages to ratios - AI values only
          const totalPercent = loadBearing + partition;
          if (totalPercent === 0) {
            throw new Error('AI returned zero total wall percentage');
          }
          
          setAvgMainWallRatio(loadBearing / 100);
          setAvgPartitionWallRatio(partition / 100);
          setAvgOpeningPercentage(opening);
          setCompositionDetected(true);

          // Update wall thickness based on detected composition
          const avgMain = loadBearing / 100;
          const estimatedThickness = (avgMain * 9) + ((100 - loadBearing) / 100 * 4.5);
          setWallThickness(estimatedThickness.toFixed(2));
          setOpeningDeduction(opening.toString());

          console.log('✓ AI Detected Wall Composition:', {
            loadBearingPercentage: loadBearing,
            partitionPercentage: partition,
            openingPercentage: opening,
            confidence: composition.confidence
          });
        })
        .catch((error: any) => {
          // No fallback - always require AI detection
          console.error('❌ Wall composition AI detection failed:', {
            message: error?.message,
            roomCount: rooms?.length,
            totalArea,
            error
          });
          setCompositionDetected(false);
          setIsDetectingComposition(false);
          // Notify user that AI detection is required
          Alert.alert(
            'AI Analysis Required',
            `Wall composition detection failed: ${error?.message || 'Unknown error'}. Please try again or check your internet connection.`,
            [{ text: 'OK' }]
          );
        })
        .finally(() => {
          setIsDetectingComposition(false);
        });
    }
  }, [rooms, totalArea, wallComposition]);

  // 1.6. Extract Wall Metadata from Rooms (AI-Only Metadata Extraction)
  // Skip if we already have wall composition from floor plan analysis
  useEffect(() => {
    // Skip if we already have pre-computed wall composition
    if (wallComposition) {
      return;
    }

    if (rooms && rooms.length > 0) {
      // Calculate averages from room metadata - AI-generated only
      let totalMainRatio = 0;
      let totalPartitionRatio = 0;
      let totalOpeningPercentage = 0;
      let roomsWithMetadata = 0;

      rooms.forEach((room: any) => {
        if (room.wallMetadata) {
          totalMainRatio += room.wallMetadata.mainWallRatio;
          totalPartitionRatio += room.wallMetadata.partitionWallRatio;
          roomsWithMetadata++;
        }
        if (room.openingPercentage) {
          totalOpeningPercentage += room.openingPercentage;
        }
      });

      // Only use AI-generated metadata - no defaults
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

        // Update opening deduction based on detected data
        setOpeningDeduction(avgOpening.toString());

        console.log(`Wall Metadata Extracted (AI-Only):`, {
          mainWallRatio: avgMain.toFixed(2),
          partitionWallRatio: avgPartition.toFixed(2),
          estimatedThickness: estimatedThickness.toFixed(2),
          estimatedOpeningDeduction: avgOpening,
          source: 'ai-metadata'
        });
      } else {
        console.warn('No AI-generated wall metadata available - waiting for AI analysis');
      }
    }
  }, [rooms, wallComposition]);

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

  // 3. Calculation Engine (Layer Logic with Wythes & Orientation Awareness)
  const calculation = useMemo(() => { 
    
    const h_ft = parseFloat(height) || 0; // Height in Feet
    const wt_in = parseFloat(wallThickness) || 0; // Wall Thickness in INCHES - CRITICAL for layer calculation
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const jt_in = parseFloat(jointThickness) || 0; // Joint thickness in inches
    
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
      mortarMix: '1:0',
      layers: 0
    };

    // --- Helper: Calculate Material Quantity with Layer Logic ---
    /**
     * Layer Logic (Wythes): Calculates how many layers of bricks are needed
     * to fill the wall thickness, then multiplies by the number of bricks
     * needed per layer based on face area.
     */
    const calculateType = (brick: any, faceArea_sqft: number, targetWallThick_in: number) => {
      if (!brick || faceArea_sqft <= 0) return { qty: 0, mortarVol_ft3: 0, layers: 0 };

      // 1. Parse Dimensions (Length x Width x Height) from string
      // Example: "7 x 3 x 2" -> L:7, W:3 (thickness), H:2
      const dims = brick.dimensions?.toLowerCase().split('x').map((v: string) => parseFloat(v.trim())) || [9, 4, 3];
      const bL_in = dims[0]; // Face length
      const bW_in = dims[1]; // Brick width (thickness)
      const bH_in = dims[2]; // Face height

      // 2. Calculate Layers (Wythes)
      // If wall is 9" and brick is 3" wide, you need 3 layers
      const layers = Math.max(1, Math.round(targetWallThick_in / bW_in));

      // 3. Face Area of one brick WITH mortar joint
      const bL_ft = (bL_in + jt_in) * IN_TO_FT;
      const bH_ft = (bH_in + jt_in) * IN_TO_FT;
      const brickFaceArea_sqft = bL_ft * bH_ft;

      // 4. Calculate Quantity
      // (Wall Face Area / Brick Face Area) * number of layers * 1.05 (5% wastage)
      const baseQty = faceArea_sqft / brickFaceArea_sqft;
      const qty = Math.ceil(baseQty * layers * 1.05);

      // 5. Calculate Mortar Volume (The "Void" Logic)
      // Total Wall Volume - Total Physical Brick Volume
      const totalWallVol_ft3 = faceArea_sqft * (targetWallThick_in * IN_TO_FT);
      const singleBrickPhysVol_ft3 = (bL_in * bW_in * bH_in) * Math.pow(IN_TO_FT, 3);
      const totalBrickPhysVol_ft3 = qty * singleBrickPhysVol_ft3;
      
      const mortarVol_ft3 = Math.max(0, totalWallVol_ft3 - totalBrickPhysVol_ft3);

      return { qty, mortarVol_ft3, layers };
    };

    // --- 1. Calculate Total Wall Face Area (Length × Height) ---
    const runningLength_ft = (rooms?.length > 0) 
      ? (rooms.reduce((acc: number, r: any) => acc + (2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0))), 0)) * 0.55
      : 4 * Math.sqrt(totalArea || 1000) * 0.55;
    
    const wallFaceArea_sqft = runningLength_ft * h_ft;
    const netWallFaceArea_sqft = wallFaceArea_sqft * (1 - ded); // Deduct openings

    // --- 2. Split Face Area based on AI Detected Wall Composition ---
    const lbFaceArea_sqft = netWallFaceArea_sqft * avgMainWallRatio;
    const pbFaceArea_sqft = netWallFaceArea_sqft * avgPartitionWallRatio;

    // --- 3. Calculate quantities using Layer Logic ---
    // For Load-Bearing walls, use the selected wall thickness (9" typical)
    const lbCalc = calculateType(selectedLoadBearing, lbFaceArea_sqft, wt_in);
    
    // For Partition walls, ALWAYS use standard thickness (4.5")
    // Partition walls are independent of overall wall thickness composition
    const pbWallThick_in = 4.5;
    const pbCalc = calculateType(selectedPartition, pbFaceArea_sqft, pbWallThick_in);

    // --- 4. Convert Mortar Volume (ft³) to m³ and apply dry factor ---
    const FT3_TO_M3 = Math.pow(FT_TO_M, 3);
    const lbMortarVol_m3 = lbCalc.mortarVol_ft3 * FT3_TO_M3;
    const pbMortarVol_m3 = pbCalc.mortarVol_ft3 * FT3_TO_M3;

    const totalMortarVolume_m3 = lbMortarVol_m3 + pbMortarVol_m3;

    // --- 5. Calculate Cement and Sand using actual mortar specs ---
    const lbMortarSpec = WALL_TYPE_SPECS['Load Bearing'];
    const pbMortarSpec = WALL_TYPE_SPECS['Non-Load Bearing'];

    // Apply dry volume multiplier ONCE to get total dry mortar, then split by ratio
    const lbDryMortar_m3 = lbMortarVol_m3 * DRY_VOL_MULTIPLIER;
    const pbDryMortar_m3 = pbMortarVol_m3 * DRY_VOL_MULTIPLIER;

    const lbCementVol = lbDryMortar_m3 * (lbMortarSpec.cementMortar / (lbMortarSpec.cementMortar + lbMortarSpec.sandMortar));
    const lbSandVol = lbDryMortar_m3 * (lbMortarSpec.sandMortar / (lbMortarSpec.cementMortar + lbMortarSpec.sandMortar));

    const pbCementVol = pbDryMortar_m3 * (pbMortarSpec.cementMortar / (pbMortarSpec.cementMortar + pbMortarSpec.sandMortar));
    const pbSandVol = pbDryMortar_m3 * (pbMortarSpec.sandMortar / (pbMortarSpec.cementMortar + pbMortarSpec.sandMortar));

    const totalCementVol_m3 = lbCementVol + pbCementVol;
    const totalSandVol_m3 = lbSandVol + pbSandVol;

    const cementBags = Math.ceil(totalCementVol_m3 * CEMENT_BAGS_PER_M3);

    // --- 6. Mortar Ratio (Cement:Sand in 1:X format) ---
    const mortarRatio = totalCementVol_m3 > 0 ? (totalSandVol_m3 / totalCementVol_m3).toFixed(1) : '0';

    // --- 7. Sand Quantity with Unit-Price Sync ---
    const sandUnit = selections['Sand']?.unit?.toLowerCase() || 'cft';
    let finalSandQty: number;
    let sandUnitDisplay: string;
    
    if (sandUnit.includes('cft') || sandUnit.includes('cubic')) {
        finalSandQty = totalSandVol_m3 * CFT_PER_M3;
        sandUnitDisplay = 'cft';
    } else if (sandUnit.includes('ton') || sandUnit.includes('tonne')) {
        finalSandQty = (totalSandVol_m3 * SAND_DENSITY_KG_M3) / 1000;
        sandUnitDisplay = 'Ton';
    } else if (sandUnit.includes('kg')) {
        finalSandQty = totalSandVol_m3 * SAND_DENSITY_KG_M3;
        sandUnitDisplay = 'kg';
    } else {
        finalSandQty = totalSandVol_m3 * CFT_PER_M3;
        sandUnitDisplay = 'cft';
    }
    finalSandQty = parseFloat(finalSandQty.toFixed(2));

    // --- 8. Cost Calculation with Unit-Price Sync ---
    const lbPrice = parseFloat(selectedLoadBearing?.pricePerUnit || 0);
    const pbPrice = parseFloat(selectedPartition?.pricePerUnit || 0);
    const cPrice = parseFloat(selections['Cement']?.pricePerUnit || 0);
    const sPrice = parseFloat(selections['Sand']?.pricePerUnit || 0);

    const lbCost = Math.round(lbPrice * lbCalc.qty);
    const pbCost = Math.round(pbPrice * pbCalc.qty);
    const cCost = Math.round(cPrice * cementBags);
    
    // Sand cost must match unit in database
    let sCost = 0;
    if (sandUnit.includes('ton')) {
        const sandQtyInTon = (totalSandVol_m3 * SAND_DENSITY_KG_M3) / 1000;
        sCost = Math.round(sandQtyInTon * sPrice);
    } else {
        sCost = Math.round(finalSandQty * sPrice);
    }
    
    return {
      brickQty: lbCalc.qty + pbCalc.qty, 
      loadBearingQty: lbCalc.qty,
      partitionQty: pbCalc.qty,
      cementBags, sandQty: finalSandQty, sandUnit: sandUnitDisplay,
      loadBearingBrand: selectedLoadBearing?.name || 'Not Selected',
      partitionBrand: selectedPartition?.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      sandBrand: selections['Sand']?.name || 'Not Selected',
      mortarMix: `1:${mortarRatio}`,
      totalCost: Math.round(lbCost + pbCost + cCost + sCost),
      costBreakdown: { bricks: lbCost + pbCost, cement: cCost, sand: sCost },
      layers: `LB: ${lbCalc.layers} layers, PB: ${pbCalc.layers} layers`
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

  // 6. AI Auto-Select Handler
  const handleAiAutoSelect = async () => {
    setIsAiLoading(true);
    try {
      const result = await getComponentRecommendation('Wall', tier, totalArea, materials);
      
      // Track which materials the AI recommended
      const recommendedIds: Record<string, string> = {
        loadBearingBrick: null,
        partitionBrick: null,
        cement: null,
        sand: null
      };

      // Apply AI recommendations to selected materials
      if (result.recommendations && Array.isArray(result.recommendations)) {
        result.recommendations.forEach((rec: any) => {
          const match = materials.find(m => m.id === rec.id);
          if (!match) return;

          // Match recommendation type to state variable
          const typeStr = rec.type.toLowerCase();
          
          if (typeStr.includes('load-bearing') || typeStr.includes('load bearing brick')) {
            setLoadBearingBrick(match);
            recommendedIds.loadBearingBrick = rec.id;
          } else if (typeStr.includes('partition') || typeStr.includes('partition brick')) {
            setPartitionBrick(match);
            recommendedIds.partitionBrick = rec.id;
          } else if (typeStr.includes('cement')) {
            setSelections(prev => ({...prev, Cement: match}));
            recommendedIds.cement = rec.id;
          } else if (typeStr.includes('sand')) {
            setSelections(prev => ({...prev, Sand: match}));
            recommendedIds.sand = rec.id;
          }
        });
      }

      // Store recommendations for badge display
      setAiRecommendations(recommendedIds);
      setAiAdvice(result.advice || '');
      
      Alert.alert("✓ AI Selection Applied", `Materials selected for ${tier} tier. You can still change them manually.`);
    } catch (error: any) {
      console.error('AI Selection Error:', error);
      Alert.alert("AI Error", error.message || "Could not get recommendations. Please select materials manually.");
    } finally {
      setIsAiLoading(false);
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
          
          {/* AI EXTRACTED METADATA INFO - TOP SECTION (Always Display) */}
          <View style={[styles.metadataInfoCard, isDetectingComposition && {opacity: 0.8}]}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
              <Text style={styles.metadataInfoTitle}>📊 Wall Composition</Text>
              {rooms && rooms.length > 0 && (
                <View style={{marginLeft: 8, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4}}>
                  <Text style={{color: '#fff', fontSize: 8, fontWeight: '700'}}>From Rooms</Text>
                </View>
              )}
            </View>
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
          
          {/* 1. Dimensions Card (Updated Inputs and Error Display) */}
          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>DIMENSIONS & DEDUCTIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Height (ft)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Wall Thickness (in)*</Text>
                <Text style={{fontSize: 11, color: '#666', marginBottom: 4, fontStyle: 'italic'}}>Affects layers & mortar</Text>
                <TextInput 
                    style={[styles.input, wallThicknessError && {borderColor: '#ef4444'}]} 
                    value={wallThickness} 
                    onChangeText={setWallThickness} 
                    keyboardType="decimal-pad" 
                    placeholder="e.g. 9"
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
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <Text style={styles.sectionLabel}>WALL MATERIALS</Text>
            {/* AI Chip Button */}
            <TouchableOpacity 
              style={[styles.aiChipButton, isAiLoading && {opacity: 0.6}]} 
              onPress={handleAiAutoSelect}
              disabled={isAiLoading}
            >
              {isAiLoading ? (
                <ActivityIndicator size="small" color="#315b76" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={12} color="#315b76" />
                  <Text style={styles.aiChipText}>AI Select</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Load-Bearing Material Card with AI Detection Inside */}
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

            {aiAdvice ? (
              <View style={styles.adviceBoxCompact}>
                <Text style={styles.adviceTextCompact}>💡 {aiAdvice}</Text>
              </View>
            ) : null}

            {/* Display Selected Material Info with AI Badge */}
            <View style={styles.materialSelectionRow}>
              {loadBearingBrick && (
                <Text style={styles.selectedMaterialText}>✓ Selected: {loadBearingBrick.name}</Text>
              )}
              {aiRecommendations.loadBearingBrick && loadBearingBrick?.id === aiRecommendations.loadBearingBrick && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                  <Text style={styles.aiBadgeText}>AI Recommended</Text>
                </View>
              )}
            </View>

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

            {/* Display Selected Material Info with AI Badge */}
            <View style={styles.materialSelectionRow}>
              {partitionBrick && (
                <Text style={styles.selectedMaterialText}>✓ Selected: {partitionBrick.name}</Text>
              )}
              {aiRecommendations.partitionBrick && partitionBrick?.id === aiRecommendations.partitionBrick && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                  <Text style={styles.aiBadgeText}>AI Recommended</Text>
                </View>
              )}
            </View>

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

        {/* Selection Modal for Materials - Using New Component */}
        {activeSelectionKey === 'LoadBearingBrick' && (
          <MaterialSelectionModal
            visible={isModalVisible}
            title="Select Load-Bearing Brick Material"
            materials={materials
              .filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing')
              .map(m => ({
                id: m.id,
                name: m.name,
                brand: m.brand,
                imageUrl: m.imageUrl,
                pricePerUnit: parseFloat(m.pricePerUnit),
                currency: '₹',
                unit: m.unit || 'Nos',
                dimensions: m.dimensions,
                category: m.category,
                subCategory: m.subCategory,
                availability: m.availability || 'In Stock',
                rating: m.rating || 0,
                reviews: m.reviews || 0,
                discount: m.discount || 0,
              }))}
            selectedMaterialId={loadBearingBrick?.id}
            onMaterialSelect={(material) => {
              const selectedMaterial = materials.find(m => m.id === material.id);
              if (selectedMaterial) {
                setLoadBearingBrick(selectedMaterial);
              }
            }}
            onClose={() => setIsModalVisible(false)}
            filterByCategory="Wall"
            filterBySubCategory="Load Bearing"
            displayMode="list"
          />
        )}

        {activeSelectionKey === 'PartitionBrick' && (
          <MaterialSelectionModal
            visible={isModalVisible}
            title="Select Partition Brick Material"
            materials={materials
              .filter(m => m.category === 'Wall' && m.subCategory === 'Non-Load Bearing')
              .map(m => ({
                id: m.id,
                name: m.name,
                brand: m.brand,
                imageUrl: m.imageUrl,
                pricePerUnit: parseFloat(m.pricePerUnit),
                currency: '₹',
                unit: m.unit || 'Nos',
                dimensions: m.dimensions,
                category: m.category,
                subCategory: m.subCategory,
                availability: m.availability || 'In Stock',
                rating: m.rating || 0,
                reviews: m.reviews || 0,
                discount: m.discount || 0,
              }))}
            selectedMaterialId={partitionBrick?.id}
            onMaterialSelect={(material) => {
              const selectedMaterial = materials.find(m => m.id === material.id);
              if (selectedMaterial) {
                setPartitionBrick(selectedMaterial);
              }
            }}
            onClose={() => setIsModalVisible(false)}
            filterByCategory="Wall"
            filterBySubCategory="Non-Load Bearing"
            displayMode="list"
          />
        )}

        {activeSelectionKey === 'Cement' && (
          <MaterialSelectionModal
            visible={isModalVisible}
            title="Select Cement Material"
            materials={materials
              .filter(m => m.type === 'Cement')
              .map(m => ({
                id: m.id,
                name: m.name,
                brand: m.brand,
                imageUrl: m.imageUrl,
                pricePerUnit: parseFloat(m.pricePerUnit),
                currency: '₹',
                unit: m.unit || 'Bag',
                dimensions: m.dimensions,
                category: 'Materials',
                availability: m.availability || 'In Stock',
                rating: m.rating || 0,
                reviews: m.reviews || 0,
                discount: m.discount || 0,
              }))}
            selectedMaterialId={selections['Cement']?.id}
            onMaterialSelect={(material) => {
              const selectedMaterial = materials.find(m => m.id === material.id);
              if (selectedMaterial) {
                setSelections({...selections, Cement: selectedMaterial});
              }
            }}
            onClose={() => setIsModalVisible(false)}
            displayMode="list"
          />
        )}

        {activeSelectionKey === 'Sand' && (
          <MaterialSelectionModal
            visible={isModalVisible}
            title="Select Sand Material"
            materials={materials
              .filter(m => m.type === 'Sand')
              .map(m => ({
                id: m.id,
                name: m.name,
                brand: m.brand,
                imageUrl: m.imageUrl,
                pricePerUnit: parseFloat(m.pricePerUnit),
                currency: '₹',
                unit: m.unit || 'cft',
                dimensions: m.dimensions,
                category: 'Materials',
                availability: m.availability || 'In Stock',
                rating: m.rating || 0,
                reviews: m.reviews || 0,
                discount: m.discount || 0,
              }))}
            selectedMaterialId={selections['Sand']?.id}
            onMaterialSelect={(material) => {
              const selectedMaterial = materials.find(m => m.id === material.id);
              if (selectedMaterial) {
                setSelections({...selections, Sand: selectedMaterial});
              }
            }}
            onClose={() => setIsModalVisible(false)}
            displayMode="list"
          />
        )}

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
  
  // AI Chip Button Styles (Compact Pill)
  aiChipButton: { backgroundColor: '#e0f2fe', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#315b76' },
  aiChipText: { color: '#315b76', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  adviceBoxCompact: { marginBottom: 12, marginTop: 10, backgroundColor: '#e0f2fe', borderLeftWidth: 3, borderLeftColor: '#315b76', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  adviceTextCompact: { fontSize: 11, color: '#064e78', fontWeight: '500', lineHeight: 16 },
  aiHeader: { marginVertical: 15 },
  aiMagicButton: { backgroundColor: '#315b76', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 3, shadowColor: '#315b76', shadowOpacity: 0.3, shadowRadius: 8 },
  aiMagicText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  adviceBox: { marginTop: 10, backgroundColor: '#e0f2fe', borderLeftWidth: 4, borderLeftColor: '#315b76', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  adviceText: { fontSize: 12, color: '#064e78', fontWeight: '500', lineHeight: 18 },
  aiMagicButtonInline: { backgroundColor: '#315b76', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12, elevation: 2, shadowColor: '#315b76', shadowOpacity: 0.25, shadowRadius: 6 },
  aiMagicTextInline: { color: '#fff', fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  adviceBoxInline: { marginBottom: 12, backgroundColor: '#e0f2fe', borderLeftWidth: 3, borderLeftColor: '#315b76', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  adviceTextInline: { fontSize: 11, color: '#064e78', fontWeight: '500', lineHeight: 16 },
  materialSelectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  aiBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  
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