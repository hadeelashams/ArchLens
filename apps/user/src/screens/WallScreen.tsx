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
  getComponentRecommendation,
  detectWallComposition
} from '@archlens/shared';
import { collection, query, onSnapshot } from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS (Imported for calculation consistency) ---
const IN_TO_FT = 1 / 12;
const FT_TO_M = 0.3048;           
const CEMENT_BAGS_PER_M3 = 28.8; // Standard 50kg bags per 1m³ of cement
const DRY_VOL_MULTIPLIER = 1.33; // Dry volume factor for mortar
const SAND_DENSITY_KG_M3 = 1600; // Average density of sand
const CFT_PER_M3 = 35.3147;
const MORTAR_WASTAGE_FACTOR = 1.15; // 15% additional mortar for spillage and brick indentations (frogs)
// -----------------------------------------------------------------

export default function WallScreen({ route, navigation }: any) {
  const { totalArea = 1000, rooms = [], projectId, tier = 'Standard', wallComposition } = route.params || {};

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  
  // --- UI & MODAL STATE ---
  const [wallType, setWallType] = useState<WallType>('Load Bearing');
  const [materialType, setMaterialType] = useState<string>('All'); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeSelectionKey, setActiveSelectionKey] = useState<'Cement' | 'Sand' | 'LoadBearingBrick' | 'PartitionBrick' | null>(null);
  const [wallThicknessError, setWallThicknessError] = useState<string | null>(null); // NEW ERROR STATE
  const [cementDropdownOpen, setCementDropdownOpen] = useState(false);
  const [sandDropdownOpen, setSandDropdownOpen] = useState(false);
  
  // --- SEPARATE MATERIAL SELECTIONS FOR EACH WALL TYPE ---
  const [loadBearingBrick, setLoadBearingBrick] = useState<any>(null);
  const [partitionBrick, setPartitionBrick] = useState<any>(null);
  
  // --- MATERIAL CLASSIFICATION FILTERS FOR LOAD-BEARING AND PARTITION ---
  const [loadBearingMaterialType, setLoadBearingMaterialType] = useState<string>('All');
  const [partitionMaterialType, setPartitionMaterialType] = useState<string>('All');
  
  // --- INPUT FIELDS (Inches for thickness, Feet for height) - VALUES FROM AI ONLY ---
  const [height, setHeight] = useState('10.5');
  const [wallThickness, setWallThickness] = useState(''); // Wall Thickness in INCHES - from AI detection only
  const [jointThickness, setJointThickness] = useState('0.375'); // Mortar Joint Thickness in INCHES (3/8 inch)
  const [openingDeduction, setOpeningDeduction] = useState(''); // From AI detection only
  const [partitionWallThickness, setPartitionWallThickness] = useState(4.5); // Partition wall thickness - now configurable for Economy tier (3" for AAC)
  
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
    partition: null,
    cement: null,
    sand: null
  });
  
  // --- AI INSIGHTS STATE (for Engineering Insight Badge) ---
  const [aiInsights, setAiInsights] = useState<{
    costSavingsPercent?: number;
    reason?: string;
    materialChoice?: string;
  } | null>(null);

  // --- FINISH PREFERENCE STATE (Plastered vs Exposed Aesthetic) ---
  const [finishPreference, setFinishPreference] = useState<'Plastered' | 'Exposed' | null>(null);
  const [showFinishPreferenceModal, setShowFinishPreferenceModal] = useState(false);

  // --- MATERIAL SELECTION MODE TRACKING (AI vs Manual) ---
  const [materialSelectionMode, setMaterialSelectionMode] = useState<Record<string, 'ai' | 'manual'>>({
    loadBearing: 'manual',
    partition: 'manual'
  });

  // --- SYSTEM COST TRACKING (Material + Plaster/Paint Costs) ---
  const [systemCosts, setSystemCosts] = useState<Record<string, number>>({
    loadBearing: 0,
    partition: 0
  });

  // --- TIER BUDGET VIOLATIONS TRACKING ---
  const [budgetViolations, setBudgetViolations] = useState<Record<string, {violated: boolean, difference: number}>>({
    loadBearing: {violated: false, difference: 0},
    partition: {violated: false, difference: 0}
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
      const loadBearingOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing');
      if (loadBearingOpts.length > 0 && !loadBearingBrick) {
        setLoadBearingBrick(filteredByTier(loadBearingOpts));
      }

      // Set default Partition Brick (thin walls)
      // For Economy tier, prioritize 3-inch AAC blocks (more economical due to fewer joints and less mortar)
      let partitionOpts = materials.filter(m => m.category === 'Wall' && (m.subCategory === 'Partition Wall' || m.subCategory === 'Partition' || m.subCategory === 'Non-Load Bearing'));
      if (tier === 'Economy') {
        // Try to find 3-inch AAC blocks first for Economy tier
        const aacEconomyBlocks = partitionOpts.filter(m => 
          m.dimensions && m.dimensions.includes('24x3') && m.name.toLowerCase().includes('aac')
        );
        if (aacEconomyBlocks.length > 0 && !partitionBrick) {
          // Select the cheapest 3-inch AAC block
          const cheapest = aacEconomyBlocks.sort((a, b) => 
            parseFloat(a.pricePerUnit) - parseFloat(b.pricePerUnit)
          )[0];
          setPartitionBrick(cheapest);
          setPartitionWallThickness(3); // Use 3-inch thickness for AAC blocks
        } else if (partitionOpts.length > 0 && !partitionBrick) {
          const selected = filteredByTier(partitionOpts);
          setPartitionBrick(selected);
        }
      } else if (partitionOpts.length > 0 && !partitionBrick) {
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

  // 2.5. Track System Costs and Budget Violations whenever materials or finish preference change
  useEffect(() => {
    if (!loadBearingBrick || !partitionBrick || !height || !wallThickness) return;

    const h_ft = parseFloat(height);
    const wt_in = parseFloat(wallThickness);
    
    if (h_ft <= 0 || wt_in <= 0) return;

    let runningLength_ft = 0;
    
    if (rooms && rooms.length > 0) {
      runningLength_ft = rooms.reduce((acc: number, r: any) => {
        const roomPerimeter = 2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0));
        return acc + roomPerimeter;
      }, 0);
    } else {
      runningLength_ft = Math.max(200, 4 * Math.sqrt(totalArea || 1000));
    }

    const wallFaceArea_sqft = runningLength_ft * h_ft;
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const netWallFaceArea_sqft = wallFaceArea_sqft * (1 - ded);

    const lbFaceArea_sqft = netWallFaceArea_sqft * avgMainWallRatio;
    const pbFaceArea_sqft = netWallFaceArea_sqft * avgPartitionWallRatio;

    // Calculate system costs
    const lbSystemCost = calculateSystemCost(loadBearingBrick, lbFaceArea_sqft, 'loadBearing');
    const pbSystemCost = calculateSystemCost(partitionBrick, pbFaceArea_sqft, 'partition');

    setSystemCosts({
      loadBearing: lbSystemCost,
      partition: pbSystemCost
    });

    // Check for tier budget violations
    const lbTierBudget = getTierBudgetPerMaterial('loadBearing');
    const pbTierBudget = getTierBudgetPerMaterial('partition');

    const lbViolated = parseFloat(loadBearingBrick.pricePerUnit) > lbTierBudget * 2; // 2x multiplier as threshold
    const pbViolated = parseFloat(partitionBrick.pricePerUnit) > pbTierBudget * 2;

    setBudgetViolations({
      loadBearing: {
        violated: lbViolated,
        difference: Math.round((parseFloat(loadBearingBrick.pricePerUnit) - lbTierBudget) * 1000) // Very rough estimate of cost difference
      },
      partition: {
        violated: pbViolated,
        difference: Math.round((parseFloat(partitionBrick.pricePerUnit) - pbTierBudget) * 1000)
      }
    });
  }, [loadBearingBrick, partitionBrick, finishPreference, height, wallThickness, openingDeduction, rooms, totalArea, avgMainWallRatio, avgPartitionWallRatio]);

  // 3. Minimal Calculation Engine (Only for display quantities on this screen)
  const calculation = useMemo(() => { 
    const h_ft = parseFloat(height) || 0;
    const wt_in = parseFloat(wallThickness) || 0;
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const jt_in = parseFloat(jointThickness) || 0;
    
    if (h_ft <= 0 || wt_in <= 0 || (!loadBearingBrick && !partitionBrick)) {
      return { loadBearingQty: 0, partitionQty: 0 };
    }

    // Helper: Calculate just the brick quantities
    const calculateBrickQty = (brick: any, faceArea_sqft: number, targetWallThick_in: number) => {
      if (!brick || faceArea_sqft <= 0) return 0;

      const dims = brick.dimensions?.toLowerCase().split('x').map((v: string) => parseFloat(v.trim())) || [9, 4, 3];
      const bL_in = dims[0];
      const bW_in = dims[1];
      const bH_in = dims[2];

      const layers = Math.max(1, Math.round(targetWallThick_in / bW_in));
      const bL_ft = (bL_in + jt_in) * IN_TO_FT;
      const bH_ft = (bH_in + jt_in) * IN_TO_FT;
      const brickFaceArea_sqft = bL_ft * bH_ft;

      const baseQty = faceArea_sqft / brickFaceArea_sqft;
      return Math.ceil(baseQty * layers * 1.05);
    };

    // Calculate running length from rooms
    let runningLength_ft = 0;
    if (rooms && rooms.length > 0) {
      runningLength_ft = rooms.reduce((acc: number, r: any) => {
        const roomPerimeter = 2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0));
        return acc + roomPerimeter;
      }, 0);
    } else {
      runningLength_ft = Math.max(200, 4 * Math.sqrt(totalArea || 1000));
    }

    const wallFaceArea_sqft = runningLength_ft * h_ft;
    const netWallFaceArea_sqft = wallFaceArea_sqft * (1 - ded);

    const lbFaceArea_sqft = netWallFaceArea_sqft * avgMainWallRatio;
    const pbFaceArea_sqft = netWallFaceArea_sqft * avgPartitionWallRatio;

    // Calculate only the quantities needed for display
    const loadBearingQty = calculateBrickQty(loadBearingBrick, lbFaceArea_sqft, wt_in);
    const partitionQty = calculateBrickQty(partitionBrick, pbFaceArea_sqft, partitionWallThickness);

    // Mortar calculation for cement & sand
    const calcMortarForBrick = (brick: any, faceArea_sqft: number, targetWallThick_in: number) => {
      if (!brick || faceArea_sqft <= 0) return { cementBags: 0, sandKg: 0 };
      const dims = brick.dimensions?.toLowerCase().split('x').map((v: string) => parseFloat(v.trim())) || [9, 4, 3];
      const bL_in = dims[0]; const bW_in = dims[1]; const bH_in = dims[2];
      const jt = jt_in || 0.375;
      const layers = Math.max(1, Math.round(targetWallThick_in / bW_in));
      const brickVol_ft3 = (bL_in * IN_TO_FT) * (bW_in * IN_TO_FT) * (bH_in * IN_TO_FT);
      const unitVol_ft3 = ((bL_in + jt) * IN_TO_FT) * ((bW_in + jt) * IN_TO_FT) * ((bH_in + jt) * IN_TO_FT);
      const mortarFraction = (unitVol_ft3 - brickVol_ft3) / unitVol_ft3;
      const wallVol_ft3 = faceArea_sqft * (targetWallThick_in * IN_TO_FT) * layers;
      const mortarVol_m3 = wallVol_ft3 * mortarFraction * DRY_VOL_MULTIPLIER * MORTAR_WASTAGE_FACTOR / CFT_PER_M3;
      return {
        cementBags: Math.ceil((mortarVol_m3 / 7) * CEMENT_BAGS_PER_M3),
        sandKg: Math.ceil((mortarVol_m3 * 6 / 7) * SAND_DENSITY_KG_M3),
      };
    };

    const lbMortar = calcMortarForBrick(loadBearingBrick, lbFaceArea_sqft, wt_in);
    const pbMortar = calcMortarForBrick(partitionBrick, pbFaceArea_sqft, partitionWallThickness);
    const cementQty = lbMortar.cementBags + pbMortar.cementBags;
    const sandQty = lbMortar.sandKg + pbMortar.sandKg;

    return { loadBearingQty, partitionQty, cementQty, sandQty };
  }, [height, wallThickness, jointThickness, openingDeduction, loadBearingBrick, partitionBrick, totalArea, rooms, avgMainWallRatio, avgPartitionWallRatio, partitionWallThickness]);

  // 5. AI Auto-Select Handler
  const handleAiAutoSelect = async () => {
    // First, check if finish preference is set - if not, show modal
    if (!finishPreference) {
      setShowFinishPreferenceModal(true);
      return;
    }

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
            setMaterialSelectionMode(prev => ({...prev, loadBearing: 'ai'}));
            recommendedIds.loadBearingBrick = rec.id;
          } else if (typeStr.includes('partition') || typeStr.includes('partition brick')) {
            setPartitionBrick(match);
            setMaterialSelectionMode(prev => ({...prev, partition: 'ai'}));
            recommendedIds.partitionBrick = rec.id;
            
            // For Economy tier, auto-set partition wall thickness to 3" if AAC blocks are recommended
            if (tier === 'Economy' && match.dimensions && match.dimensions.includes('24x3')) {
              setPartitionWallThickness(3);
            }
          } else if (typeStr.includes('cement')) {
            setSelections(prev => ({...prev, Cement: match}));
            recommendedIds.cement = rec.id;
          } else if (typeStr.includes('sand')) {
            setSelections(prev => ({...prev, Sand: match}));
            recommendedIds.sand = rec.id;
          }
        });
      }

      // Extract cost savings insights for Economy tier
      let insightData: any = null;
      if (tier === 'Economy' && result.costSavingsRecommendation) {
        // Parse cost savings from the AI recommendation
        const savingsText = result.costSavingsRecommendation;
        const percentMatch = savingsText.match(/(\d+)%/);
        const savingsPercent = percentMatch ? parseInt(percentMatch[1]) : 0;
        
        insightData = {
          costSavingsPercent: savingsPercent,
          reason: savingsText,
          materialChoice: result.advice
        };
        setAiInsights(insightData);
      }

      // Store recommendations for badge display
      setAiRecommendations(recommendedIds);
      setAiAdvice(result.advice || '');
      
      Alert.alert("✓ AI Selection Applied", `Materials selected for ${tier} tier. ${insightData?.costSavingsPercent ? `Potential savings: ${insightData.costSavingsPercent}%` : 'You can edit selections manually.'}`);
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

  // --- SYSTEM COST CALCULATION HELPER ---
  // Calculate the total cost of material + finishing (plaster/paint)
  const calculateSystemCost = (material: any, faceArea_sqft: number, wallType: 'loadBearing' | 'partition'): number => {
    if (!material) return 0;
    
    const unitPrice = parseFloat(material.pricePerUnit) || 0;
    
    // Base material cost
    let materialCost = 0;
    const dims = material.dimensions?.toLowerCase().split('x').map((v: string) => parseFloat(v.trim())) || [9, 4, 3];
    const bL_in = dims[0];
    const bH_in = dims[2];
    const jt_in = parseFloat(jointThickness) || 0;
    
    const bL_ft = (bL_in + jt_in) * IN_TO_FT;
    const bH_ft = (bH_in + jt_in) * IN_TO_FT;
    const brickFaceArea_sqft = bL_ft * bH_ft;
    const baseQty = faceArea_sqft / brickFaceArea_sqft;
    const wt_in = wallType === 'loadBearing' ? parseFloat(wallThickness) : partitionWallThickness;
    const layers = Math.max(1, Math.round(wt_in / dims[1]));
    const qty = Math.ceil(baseQty * layers * 1.05);
    
    materialCost = unitPrice * qty;

    // Finishing cost (Plaster/Paint)
    let finishingCost = 0;
    const requiresPlastering = !material.requiresPlastering || material.requiresPlastering === true;
    
    if (finishPreference === 'Plastered' && requiresPlastering) {
      // Cost of 2 layers of plaster (₹15-25/sqft per layer) + putty (₹5/sqft) + paint (₹8-12/sqft)
      // Average: ₹45/sqft for rough surfaces, ₹30/sqft for semi-finished
      const plasterCostPerSqft = material.finishRoughness === 'high' ? 45 : material.finishRoughness === 'medium' ? 30 : 20;
      finishingCost = plasterCostPerSqft * faceArea_sqft;
    } else if (finishPreference === 'Exposed') {
      // No additional finishing costs for exposed finishes
      finishingCost = 0;
    }

    return Math.round(materialCost + finishingCost);
  };

  // --- MATERIAL FILTERING HELPER ---
  // Filter materials based on finish preference
  const getFilteredMaterials = (materials: any[], preference: 'Plastered' | 'Exposed' | null) => {
    if (!preference) return materials;
    
    if (preference === 'Exposed') {
      // Show only materials that don't require plastering or have high aesthetic appeal when exposed
      return materials.filter(m => 
        m.requiresPlastering === false || 
        m.name.toLowerCase().includes('exposed') ||
        m.name.toLowerCase().includes('wire-cut') ||
        m.name.toLowerCase().includes('pressed')
      );
    }
    // For 'Plastered', show all materials
    return materials;
  };

  // --- GET TIER-APPROPRIATE MATERIAL COST (for budget violation detection) ---
  const getTierBudgetPerMaterial = (wallType: 'loadBearing' | 'partition'): number => {
    // Define tier-appropriate material costs (unit price range)
    const tierBudgets: Record<string, Record<"loadBearing" | "partition", number>> = {
      'Economy': { loadBearing: 10, partition: 8 },
      'Standard': { loadBearing: 18, partition: 12 },
      'Luxury': { loadBearing: 35, partition: 25 }
    };
    
    return tierBudgets[tier]?.[wallType] || 10;
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
                <TextInput style={[styles.input, wallThicknessError && {borderColor: '#ef4444'}]} value={wallThickness} onChangeText={setWallThickness} keyboardType="decimal-pad" placeholder="e.g. 9" />
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

          {/* FINISH PREFERENCE SELECTOR */}
          <TouchableOpacity 
            style={[styles.finishPreferenceSelector, finishPreference && {borderColor: '#315b76', backgroundColor: '#eff6ff'}]}
            onPress={() => setShowFinishPreferenceModal(true)}
          >
            <View style={{flex: 1}}>
              <Text style={styles.finishPreferenceLabel}>Desired Look</Text>
              <Text style={styles.finishPreferenceValue}>
                {finishPreference || 'Select appearance type'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#315b76" />
          </TouchableOpacity>
          
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

            {/* System Cost & Budget Impact Card */}
            {loadBearingBrick && finishPreference && (
              <View style={[styles.systemCostCard, budgetViolations.loadBearing.violated && styles.systemCostCardWarning]}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 10}}>
                  <View style={[styles.systemCostIcon, budgetViolations.loadBearing.violated && {backgroundColor: '#fed7aa'}]}>
                    <Ionicons 
                      name={budgetViolations.loadBearing.violated ? "alert-circle" : "checkmark-circle"} 
                      size={16} 
                      color={budgetViolations.loadBearing.violated ? "#d97706" : "#10b981"} 
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
                      <Text style={styles.systemCostLabel}>System Cost</Text>
                      {materialSelectionMode.loadBearing === 'ai' && (
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                          <Ionicons name="bulb" size={12} color="#10b981" />
                          <Text style={{fontSize: 9, color: '#10b981', fontWeight: '700'}}>Saves Labor</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.systemCostValue}>₹{systemCosts.loadBearing.toLocaleString()}</Text>
                    <Text style={styles.systemCostBreakdown}>
                      Material: ₹{Math.round(parseFloat(loadBearingBrick.pricePerUnit) * 1000).toLocaleString()} {finishPreference === 'Plastered' ? '+ Finish' : ''}
                    </Text>
                    {materialSelectionMode.loadBearing === 'manual' && budgetViolations.loadBearing.violated && (
                      <View style={{marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#fee2e2'}}>
                        <Text style={{fontSize: 10, color: '#dc2626', fontWeight: '600'}}>
                          ⚠️ This {tier} tier material exceeds typical budget. Total cost may increase.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Material Classification Filter for Load-Bearing */}
            <View style={styles.materialTypeContainer}>
              <TouchableOpacity
                style={[styles.typeChip, loadBearingMaterialType === 'All' && styles.typeChipActive]}
                onPress={() => setLoadBearingMaterialType('All')}
              >
                <Text style={[styles.typeChipText, loadBearingMaterialType === 'All' && styles.typeChipTextActive]}>All</Text>
              </TouchableOpacity>
              {['Brick Wall', 'Block Wall', 'Stone Wall'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, loadBearingMaterialType === type && styles.typeChipActive]}
                  onPress={() => setLoadBearingMaterialType(type)}
                >
                  <Text style={[styles.typeChipText, loadBearingMaterialType === type && styles.typeChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horizontal Scroll - Load-Bearing Materials */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, {marginVertical: 10}]}>
              {(() => {
                let loadBearingMaterials = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing');
                if (loadBearingMaterialType !== 'All') {
                  loadBearingMaterials = loadBearingMaterials.filter(m => m.type === loadBearingMaterialType);
                }
                const filteredMaterials = finishPreference ? getFilteredMaterials(loadBearingMaterials, finishPreference) : loadBearingMaterials;
                return filteredMaterials.length > 0 ? filteredMaterials.map(item => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.brandCard, styles.materialBrandCard, loadBearingBrick?.id === item.id && styles.activeBrand]} 
                    onPress={() => {
                      setLoadBearingBrick(item);
                      setMaterialSelectionMode(prev => ({...prev, loadBearing: 'manual'}));
                    }}
                  >
                    <View style={styles.imagePlaceholder}>
                      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                    {finishPreference === 'Exposed' && !item.requiresPlastering && (
                      <View style={{backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginTop: 6}}>
                        <Text style={{color: '#fff', fontSize: 8, fontWeight: '700'}}>No Plaster Needed</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.emptyText}>No load-bearing materials available for {finishPreference} finish.</Text>
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
                <Text style={{color: '#fff', fontSize: 9, fontWeight: '700'}}>{partitionWallThickness.toFixed(1)} inch</Text>
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

            {/* System Cost & Budget Impact Card for Partition */}
            {partitionBrick && finishPreference && (
              <View style={[styles.systemCostCard, budgetViolations.partition.violated && styles.systemCostCardWarning]}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start', gap: 10}}>
                  <View style={[styles.systemCostIcon, budgetViolations.partition.violated && {backgroundColor: '#fed7aa'}]}>
                    <Ionicons 
                      name={budgetViolations.partition.violated ? "alert-circle" : "checkmark-circle"} 
                      size={16} 
                      color={budgetViolations.partition.violated ? "#d97706" : "#10b981"} 
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
                      <Text style={styles.systemCostLabel}>System Cost</Text>
                      {materialSelectionMode.partition === 'ai' && (
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                          <Ionicons name="bulb" size={12} color="#10b981" />
                          <Text style={{fontSize: 9, color: '#10b981', fontWeight: '700'}}>Saves Labor</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.systemCostValue}>₹{systemCosts.partition.toLocaleString()}</Text>
                    <Text style={styles.systemCostBreakdown}>
                      Material: ₹{Math.round(parseFloat(partitionBrick.pricePerUnit) * 1000).toLocaleString()} {finishPreference === 'Plastered' ? '+ Finish' : ''}
                    </Text>
                    {materialSelectionMode.partition === 'manual' && budgetViolations.partition.violated && (
                      <View style={{marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#fee2e2'}}>
                        <Text style={{fontSize: 10, color: '#dc2626', fontWeight: '600'}}>
                          ⚠️ This {tier} tier material exceeds typical budget. Total cost may increase.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Material Classification Filter for Partition */}
            <View style={styles.materialTypeContainer}>
              <TouchableOpacity
                style={[styles.typeChip, partitionMaterialType === 'All' && styles.typeChipActive]}
                onPress={() => setPartitionMaterialType('All')}
              >
                <Text style={[styles.typeChipText, partitionMaterialType === 'All' && styles.typeChipTextActive]}>All</Text>
              </TouchableOpacity>
              {['Brick Partition', 'Block Partition', 'Dry Wall', 'Glass', 'Wood Wall'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, partitionMaterialType === type && styles.typeChipActive]}
                  onPress={() => setPartitionMaterialType(type)}
                >
                  <Text style={[styles.typeChipText, partitionMaterialType === type && styles.typeChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horizontal Scroll - Partition Materials */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.brandScroll, {marginVertical: 10}]}>
              {(() => {
                let partitionMaterials = materials.filter(m => m.category === 'Wall' && (m.subCategory === 'Partition Wall' || m.subCategory === 'Partition' || m.subCategory === 'Non-Load Bearing'));
                if (partitionMaterialType !== 'All') {
                  partitionMaterials = partitionMaterials.filter(m => m.type === partitionMaterialType);
                }
                const filteredMaterials = finishPreference ? getFilteredMaterials(partitionMaterials, finishPreference) : partitionMaterials;
                return filteredMaterials.length > 0 ? filteredMaterials.map(item => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.brandCard, styles.materialBrandCard, partitionBrick?.id === item.id && styles.activeBrand]} 
                    onPress={() => {
                      setPartitionBrick(item);
                      setMaterialSelectionMode(prev => ({...prev, partition: 'manual'}));
                    }}
                  >
                    <View style={styles.imagePlaceholder}>
                      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube-outline" size={24} color="#cbd5e1" />}
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    <Text style={styles.brandDim}>{item.dimensions || 'Dimensions N/A'}</Text>
                    {finishPreference === 'Exposed' && !item.requiresPlastering && (
                      <View style={{backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginTop: 6}}>
                        <Text style={{color: '#fff', fontSize: 8, fontWeight: '700'}}>No Plaster Needed</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.emptyText}>No partition materials available for {finishPreference} finish.</Text>
                );
              })()}
            </ScrollView>

            {partitionBrick && (
              <Text style={styles.materialQty}>{calculation.partitionQty} units needed</Text>
            )}
          </View>

          {/* 3. Mortar Materials Selectors - Horizontal Cards */}
          <Text style={styles.sectionLabel}>MORTAR MATERIALS</Text>
          
          <View style={styles.mortarCardsRow}>
            {/* Cement Card */}
            <TouchableOpacity 
              style={[styles.mortarMaterialCard, styles.cementCard, cementDropdownOpen && styles.mortarMaterialCardActive]}
              onPress={() => setCementDropdownOpen(!cementDropdownOpen)}
              activeOpacity={0.7}
            >
              <View style={styles.mortarCardHeader}>
                <View style={[styles.mortarIconBox, styles.cementIconBox]}>
                  <Ionicons name="cube-outline" size={20} color="#64748b" />
                </View>
                <View style={styles.mortarCardContent}>
                  <Text style={styles.mortarMaterialLabel}>Cement</Text>
                  <Text style={styles.mortarSelectedName} numberOfLines={1}>
                    {selections['Cement']?.name || 'Select cement'}
                  </Text>
                </View>
                <Ionicons 
                  name={cementDropdownOpen ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#64748b"
                  style={styles.mortarHeaderChevron}
                />
              </View>
              <View style={styles.mortarCardFooter}>
                <View style={styles.mortarPriceQtyRow}>
                  <View>
                    <Text style={styles.mortarFooterLabel}>Price</Text>
                    <Text style={styles.mortarPriceValue}>₹{selections['Cement']?.pricePerUnit || '0'}</Text>
                  </View>
                  <View style={styles.mortarDividerVertical} />
                  <View>
                    <Text style={styles.mortarFooterLabel}>Quantity</Text>
                    <Text style={styles.mortarQtyValue}>{calculation.cementQty > 0 ? `${calculation.cementQty} bags` : '--'}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Sand Card */}
            <TouchableOpacity 
              style={[styles.mortarMaterialCard, styles.sandCard, sandDropdownOpen && styles.mortarMaterialCardActive]}
              onPress={() => setSandDropdownOpen(!sandDropdownOpen)}
              activeOpacity={0.7}
            >
              <View style={styles.mortarCardHeader}>
                <View style={[styles.mortarIconBox, styles.sandIconBox]}>
                  <Ionicons name="water-outline" size={20} color="#64748b" />
                </View>
                <View style={styles.mortarCardContent}>
                  <Text style={styles.mortarMaterialLabel}>Sand</Text>
                  <Text style={styles.mortarSelectedName} numberOfLines={1}>
                    {selections['Sand']?.name || 'Select sand'}
                  </Text>
                </View>
                <Ionicons 
                  name={sandDropdownOpen ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#64748b"
                  style={styles.mortarHeaderChevron}
                />
              </View>
              <View style={styles.mortarCardFooter}>
                <View style={styles.mortarPriceQtyRow}>
                  <View>
                    <Text style={styles.mortarFooterLabel}>Price</Text>
                    <Text style={styles.mortarPriceValue}>₹{selections['Sand']?.pricePerUnit || '0'}</Text>
                  </View>
                  <View style={styles.mortarDividerVertical} />
                  <View>
                    <Text style={styles.mortarFooterLabel}>Quantity</Text>
                    <Text style={styles.mortarQtyValue}>{calculation.sandQty > 0 ? `${calculation.sandQty} kg` : '--'}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cement Dropdown List - Below Cards */}
          {cementDropdownOpen && (
            <View style={styles.mortarDropdownList}>
              {materials
                .filter(m => m.type === 'Cement')
                .map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.mortarDropdownItem,
                      selections['Cement']?.id === item.id && styles.mortarDropdownItemSelected
                    ]}
                    onPress={() => {
                      setSelections({...selections, Cement: item});
                      setCementDropdownOpen(false);
                    }}
                  >
                    <View style={styles.mortarDropdownItemContent}>
                      <Text style={[
                        styles.mortarDropdownItemName,
                        selections['Cement']?.id === item.id && styles.mortarDropdownItemNameSelected
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={styles.mortarDropdownItemPrice}>
                        ₹{item.pricePerUnit}/{item.unit}
                      </Text>
                    </View>
                    {selections['Cement']?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={18} color="#315b76" />
                    )}
                  </TouchableOpacity>
                ))
              }
            </View>
          )}

          {/* Sand Dropdown List - Below Cards */}
          {sandDropdownOpen && (
            <View style={styles.mortarDropdownList}>
              {materials
                .filter(m => m.type === 'Sand')
                .map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.mortarDropdownItem,
                      selections['Sand']?.id === item.id && styles.mortarDropdownItemSelected
                    ]}
                    onPress={() => {
                      setSelections({...selections, Sand: item});
                      setSandDropdownOpen(false);
                    }}
                  >
                    <View style={styles.mortarDropdownItemContent}>
                      <Text style={[
                        styles.mortarDropdownItemName,
                        selections['Sand']?.id === item.id && styles.mortarDropdownItemNameSelected
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={styles.mortarDropdownItemPrice}>
                        ₹{item.pricePerUnit}/{item.unit}
                      </Text>
                    </View>
                    {selections['Sand']?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={18} color="#315b76" />
                    )}
                  </TouchableOpacity>
                ))
              }
            </View>
          )}

        </ScrollView>

        {/* FINISH PREFERENCE MODAL */}
        <Modal 
          visible={showFinishPreferenceModal} 
          transparent={true} 
          animationType="slide"
          onRequestClose={() => setShowFinishPreferenceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Your Look</Text>
                <TouchableOpacity onPress={() => setShowFinishPreferenceModal(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={{gap: 12}}>
                {/* Plastered Option */}
                <TouchableOpacity 
                  style={[styles.finishOptionCard, finishPreference === 'Plastered' && styles.finishOptionCardSelected]}
                  onPress={() => {
                    setFinishPreference('Plastered');
                    setShowFinishPreferenceModal(false);
                  }}
                >
                  <View style={styles.finishOptionHeader}>
                    <View style={{flex: 1}}>
                      <Text style={[styles.finishOptionTitle, finishPreference === 'Plastered' && {color: '#315b76'}]}>
                        Standard Plastered
                      </Text>
                      <Text style={[styles.finishOptionDescription, finishPreference === 'Plastered' && {color: '#0f766e'}]}>
                        Smooth, painted finish. Requires plaster + putty + paint.
                      </Text>
                    </View>
                    {finishPreference === 'Plastered' && (
                      <View style={styles.finishOptionCheckmark}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.finishOptionCost}>+₹20-45/sqft (finishing cost)</Text>
                </TouchableOpacity>

                {/* Exposed Option */}
                <TouchableOpacity 
                  style={[styles.finishOptionCard, finishPreference === 'Exposed' && styles.finishOptionCardSelected]}
                  onPress={() => {
                    setFinishPreference('Exposed');
                    setShowFinishPreferenceModal(false);
                  }}
                >
                  <View style={styles.finishOptionHeader}>
                    <View style={{flex: 1}}>
                      <Text style={[styles.finishOptionTitle, finishPreference === 'Exposed' && {color: '#315b76'}]}>
                        Raw/Exposed Aesthetic
                      </Text>
                      <Text style={[styles.finishOptionDescription, finishPreference === 'Exposed' && {color: '#0f766e'}]}>
                        Visible brick/block texture. No plaster needed!
                      </Text>
                    </View>
                    {finishPreference === 'Exposed' && (
                      <View style={styles.finishOptionCheckmark}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
                    <Ionicons name="leaf" size={14} color="#10b981" />
                    <Text style={styles.finishOptionCost}>Saves ₹30-45/sqft on finishing!</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Next Button - Navigate to Cost Summary */}
        <TouchableOpacity 
          style={[styles.mainBtn, (!loadBearingBrick && !partitionBrick) && styles.mainBtnDisabled]} 
          onPress={() => {
            if (!loadBearingBrick && !partitionBrick) {
              Alert.alert("Selection Required", "Please select at least one brick type before proceeding.");
              return;
            }
            
            navigation.navigate('WallCostSummary', {
              totalArea,
              rooms,
              projectId,
              tier,
              height,
              wallThickness,
              jointThickness,
              openingDeduction,
              partitionWallThickness,
              avgMainWallRatio,
              avgPartitionWallRatio,
              avgOpeningPercentage,
              loadBearingBrick,
              partitionBrick,
              cement: selections['Cement'],
              sand: selections['Sand'],
              aiInsights,
              finishPreference,
              materialSelectionMode,
              systemCosts,
              budgetViolations
            });
          }}
          disabled={!loadBearingBrick && !partitionBrick}
        >
          <Text style={styles.mainBtnText}>Continue to Cost Summary</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
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
              .filter(m => m.category === 'Wall' && (m.subCategory === 'Partition Wall' || m.subCategory === 'Partition' || m.subCategory === 'Non-Load Bearing'))
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
            filterBySubCategory="Partition Wall"
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
  materialListContainer: { marginVertical: 10, gap: 8 },
  materialListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  materialListItemSelected: { backgroundColor: '#eff6ff', borderColor: '#315b76', borderWidth: 2 },
  materialListItemText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  materialListItemTextSelected: { color: '#315b76', fontWeight: '700' },
  dropdownHeader: { backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  dropdownHeaderActive: { borderColor: '#315b76', borderWidth: 2, backgroundColor: '#eff6ff' },
  dropdownHeaderText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  dropdownList: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 8, overflow: 'hidden' },
  dropdownListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  dropdownListItemSelected: { backgroundColor: '#eff6ff' },
  dropdownItemContent: { flex: 1 },
  dropdownItemName: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  dropdownItemNameSelected: { color: '#315b76', fontWeight: '700' },
  dropdownItemPrice: { fontSize: 10, color: '#10b981', fontWeight: '600', marginTop: 2 },


  // Mortar Materials Cards (Horizontal Layout - Redesigned)
  mortarCardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  mortarMaterialCard: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    borderWidth: 1.5, 
    borderColor: '#e2e8f0', 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  cementCard: { borderColor: '#e2e8f0' },
  sandCard: { borderColor: '#e2e8f0' },
  mortarMaterialCardActive: { borderColor: '#315b76', borderWidth: 2.5, backgroundColor: '#f0f9ff' },
  mortarCardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9',
    gap: 12
  },
  mortarIconBox: { 
    width: 42, 
    height: 42, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  cementIconBox: { backgroundColor: '#f1f5f9' },
  sandIconBox: { backgroundColor: '#f1f5f9' },
  mortarCardContent: { flex: 1 },
  mortarMaterialLabel: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: '#64748b', 
    textTransform: 'uppercase', 
    letterSpacing: 0.7, 
    marginBottom: 3 
  },
  mortarSelectedName: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#1e293b'
  },
  mortarHeaderChevron: { marginLeft: 4 },
  mortarCardFooter: { padding: 12 },
  mortarPriceQtyRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center'
  },
  mortarDividerVertical: { 
    width: 1, 
    height: 28, 
    backgroundColor: '#e2e8f0', 
    marginHorizontal: 8 
  },
  mortarFooterLabel: { 
    fontSize: 8, 
    fontWeight: '700', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 2
  },
  mortarPriceValue: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#10b981'
  },
  mortarQtyValue: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#315b76'
  },
  mortarDropdownList: { 
    backgroundColor: '#f8fafc', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    marginVertical: 8, 
    overflow: 'hidden', 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1
  },
  mortarDropdownItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  mortarDropdownItemSelected: { backgroundColor: '#eff6ff' },
  mortarDropdownItemContent: { flex: 1 },
  mortarDropdownItemName: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#1e293b' 
  },
  mortarDropdownItemNameSelected: { 
    color: '#315b76', 
    fontWeight: '700' 
  },
  mortarDropdownItemPrice: { 
    fontSize: 10, 
    color: '#10b981', 
    fontWeight: '600', 
    marginTop: 2 
  },

  resultCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 15, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  resultHeader: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resLabel: { color: '#64748b', fontSize: 12 },
  resVal: { color: '#1e293b', fontWeight: '700', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#1e293b', fontSize: 14, fontWeight: '600' },
  totalVal: { color: '#10b981', fontSize: 22, fontWeight: '800' },
  
  // AI Engineering Insight Badge Styles
  aiInsightBadge: { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0', borderRadius: 12, padding: 14, marginBottom: 8 },
  aiInsightIconBox: { width: 36, height: 36, backgroundColor: '#16a34a', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  aiInsightTitle: { fontSize: 12, fontWeight: '700', color: '#15803d', marginBottom: 6 },
  aiInsightSavings: { fontSize: 13, fontWeight: '700', color: '#10b981', marginBottom: 4 },
  aiInsightReason: { fontSize: 11, color: '#22c55e', fontWeight: '500', lineHeight: 16 },

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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Finish Preference Modal Styles
  finishOptionCard: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, marginBottom: 8 },
  finishOptionCardSelected: { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2.5 },
  finishOptionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  finishOptionTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  finishOptionDescription: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  finishOptionCheckmark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#315b76', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  finishOptionCost: { fontSize: 10, color: '#10b981', fontWeight: '700', marginTop: 6 },

  // System Cost Card Styles
  systemCostCard: { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, marginVertical: 10 },
  systemCostCardWarning: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  systemCostIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  systemCostLabel: { fontSize: 9, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 },
  systemCostValue: { fontSize: 18, fontWeight: '800', color: '#15803d', marginVertical: 4 },
  systemCostBreakdown: { fontSize: 10, color: '#4b5563', lineHeight: 15 },

  // Finish Preference Selector Styles
  finishPreferenceSelector: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  finishPreferenceLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  finishPreferenceValue: { fontSize: 12, fontWeight: '700', color: '#315b76' },
});