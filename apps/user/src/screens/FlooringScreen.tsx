import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  db,
  auth,
  createDocument,
  generateText,
  extractStructuredData,
  CONSTRUCTION_HIERARCHY
} from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getProjectById } from '../services/projectService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const TILE_WASTE_FACTOR = 0.05; // 5% waste
const formatUnit = (unit?: string) => {
  if (!unit) return 'sq.ft';
  const lowUnit = unit.toLowerCase();
  if (lowUnit.includes('square') || lowUnit.includes('sqft') || lowUnit.includes('sq.ft')) return 'sq.ft';
  return unit;
};

export default function FlooringScreen({ route, navigation }: any) {
  const { projectId, tier = 'Standard' } = route.params || {};

  // Debug logging
  console.log('FlooringScreen - Route params:', route.params);
  console.log('FlooringScreen - Project ID:', projectId);

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [totalArea, setTotalArea] = useState(0);
  const [projectName, setProjectName] = useState('Flooring Setup');

  // --- ROOM-WISE SELECTION STATE ---
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomsData, setRoomsData] = useState<any[]>([]);

  // --- UI STATE ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string | null>(null);
  const [selectedSubMaterialFilter, setSelectedSubMaterialFilter] = useState<string | null>(null);

  // Fetch project and AI-detected rooms from Firebase
  useEffect(() => {
    const fetchProjectRooms = async () => {
      try {
        if (!projectId) {
          console.warn('FlooringScreen - No projectId provided');
          setLoading(false);
          return;
        }

        console.log('FlooringScreen - Fetching project:', projectId);
        const projectData = await getProjectById(projectId);

        if (!projectData) {
          console.error('FlooringScreen - Project not found:', projectId);
          setLoading(false);
          return;
        }

        console.log('FlooringScreen - Project data:', projectData);
        setProjectName(projectData.name || 'Flooring Setup');
        setTotalArea(projectData.totalArea || 0);

        // Initialize rooms from project data (AI-detected rooms)
        if (projectData.rooms && Array.isArray(projectData.rooms)) {
          const initializedRooms = projectData.rooms.map((room: any, index: number) => ({
            id: room.id || `room_${index}`,
            name: room.name || room.roomName || `Room ${index + 1}`,
            area: parseFloat(String(room.area || room.dimensions?.area || room.squareFootage || 0)),
            length: room.length ? parseFloat(String(room.length)) : undefined,
            width: room.width ? parseFloat(String(room.width)) : undefined,
            flooringMaterial: null,
            isRecommended: room.isRecommended || false,
            originalData: room
          }));

          console.log('FlooringScreen - Initialized AI rooms from Firebase:', initializedRooms);
          setRoomsData(initializedRooms);

          // Set first room as selected
          if (initializedRooms.length > 0) {
            setSelectedRoomId(initializedRooms[0].id);
          }
        } else {
          console.warn('FlooringScreen - No rooms found in project');
        }

        setLoading(false);
      } catch (error) {
        console.error('FlooringScreen - Error fetching project:', error);
        setLoading(false);
      }
    };

    fetchProjectRooms();
  }, [projectId]);

  // 1. Fetch Materials
  useEffect(() => {
    console.log('FlooringScreen - Fetching materials...');
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      console.log('FlooringScreen - Materials fetched:', data.length, 'items');
      setMaterials(data);
      setLoading(false);
    }, (error) => {
      console.error('FlooringScreen - Error fetching materials:', error);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Auto-select flooring based on tier when rooms and materials are loaded
  useEffect(() => {
    if (!loading && materials.length > 0 && roomsData.length > 0) {
      const hasSelections = roomsData.some(r => r.flooringMaterial !== null);
      if (!hasSelections) {
        const floorMats = materials.filter(m =>
          m.category === 'Flooring' || m.type === 'Tile' || m.subCategory === 'Flooring'
        );

        if (floorMats.length > 0) {
          const sorted = [...floorMats].sort((a, b) => (a.pricePerUnit || 0) - (b.pricePerUnit || 0));

          const getMatByTier = (list: any[], budgetTier: string) => {
            const total = list.length;
            if (budgetTier === 'Economy') return list[0];
            if (budgetTier === 'Luxury') return list[total - 1];
            return list[Math.floor(total / 2)];
          };

          const antiSkidTiles = sorted.filter(m =>
            m.name?.toLowerCase().includes('anti') ||
            m.type?.toLowerCase().includes('skid') ||
            m.name?.toLowerCase().includes('matte')
          );
          const kitchenTiles = sorted.filter(m =>
            m.name?.toLowerCase().includes('kitchen') ||
            m.name?.toLowerCase().includes('vitrified') ||
            m.type?.toLowerCase().includes('vitrified')
          );
          const premiumMats = sorted.filter(m =>
            m.name?.toLowerCase().includes('marble') ||
            m.name?.toLowerCase().includes('granite')
          );
          const woodenMats = sorted.filter(m =>
            m.name?.toLowerCase().includes('wooden') ||
            m.name?.toLowerCase().includes('bamboo') ||
            m.name?.toLowerCase().includes('parquet')
          );

          setRoomsData(prev => prev.map(room => {
            const lowerName = room.name.toLowerCase();
            const isWetArea = lowerName.includes('bath') || lowerName.includes('toilet') || lowerName.includes('wc') ||
              lowerName.includes('powder') || lowerName.includes('wash') || lowerName.includes('utility') ||
              lowerName.includes('sit out') || lowerName.includes('balcony');
            const isKitchen = lowerName.includes('kitchen') || lowerName.includes('pantry') || lowerName.includes('store');
            const isLiving = lowerName.includes('living') || lowerName.includes('hall') || lowerName.includes('drawing') || lowerName.includes('great') || lowerName.includes('foyer');
            const isBed = lowerName.includes('bed') || lowerName.includes('master') || lowerName.includes('guest') || lowerName.includes('study');

            let finalMat = getMatByTier(sorted, tier);

            if (isWetArea && antiSkidTiles.length > 0) {
              finalMat = antiSkidTiles[0];
            } else if (isKitchen && kitchenTiles.length > 0) {
              finalMat = kitchenTiles[Math.floor(kitchenTiles.length / 2)] || kitchenTiles[0];
            } else if (isLiving && premiumMats.length > 0 && tier !== 'Economy') {
              finalMat = premiumMats[premiumMats.length - 1]; // Top premium for the tier
            } else if (isBed) {
              if (tier === 'Luxury' && premiumMats.length > 0) {
                // Prioritize Italian Marble for Luxury Bedrooms
                finalMat = premiumMats.find(m => m.name.toLowerCase().includes('italian')) || premiumMats[0];
              } else if (sorted.length > 2) {
                const tierIdx = Math.floor(sorted.length / 2);
                finalMat = sorted[tierIdx + 1] || sorted[tierIdx - 1] || sorted[tierIdx];
              }
            }

            return {
              ...room,
              flooringMaterial: finalMat
            };
          }));
        }
      }
    }
  }, [loading, materials.length, roomsData.length, tier]);

  // Reset filter when selected room changes
  useEffect(() => {
    if (selectedRoomId && roomsData.length > 0) {
      const selectedRoom = roomsData.find((r: any) => r.id === selectedRoomId);
      if (selectedRoom) {
        const categories = getMaterialTypesForRoom(getRoomType(selectedRoom.name));
        setSelectedMaterialFilter(categories[0] || null);
        setSelectedSubMaterialFilter(null);
      }
    }
  }, [selectedRoomId, roomsData]);

  // Helper function to get filtered materials by type
  const flooringMaterials = materials.filter(m =>
    m.category === 'Flooring' || m.type === 'Tile' || m.subCategory === 'Flooring'
  );

  const currentRoom = roomsData.find((r: any) => r.id === selectedRoomId);
  const allComplete = roomsData.every((r: any) => r.flooringMaterial !== null);

  // Total area and cost calculations
  const totalSelectedArea = roomsData.reduce((sum: number, room: any) =>
    room.flooringMaterial ? sum + room.area : sum, 0
  );

  const totalCost = roomsData.reduce((sum: number, room: any) => {
    if (room.flooringMaterial && room.area > 0) {
      const qtyNeeded = Math.ceil(room.area * (1 + TILE_WASTE_FACTOR));
      return sum + (room.flooringMaterial.pricePerUnit * qtyNeeded);
    }
    return sum;
  }, 0);

  const materialBreakdown = useMemo(() => {
    const breakdown: Record<string, any> = {};

    roomsData.forEach(room => {
      if (room.flooringMaterial && room.area > 0) {
        const mat = room.flooringMaterial;
        const qty = Math.ceil(room.area * (1 + TILE_WASTE_FACTOR));
        const cost = qty * mat.pricePerUnit;

        if (!breakdown[mat.id]) {
          const displayUnit = formatUnit(mat.unit);

          breakdown[mat.id] = {
            name: mat.name ? mat.name.charAt(0).toUpperCase() + mat.name.slice(1).toLowerCase() : 'Unknown Material',
            price: mat.pricePerUnit,
            unit: displayUnit,
            qty: 0,
            total: 0,
            rooms: []
          };
        }
        breakdown[mat.id].qty += qty;
        breakdown[mat.id].total += cost;
        breakdown[mat.id].rooms.push({ name: room.name, qty });
      }
    });

    return breakdown;
  }, [roomsData]);

  // Update room data helper
  const updateRoomData = (field: string, value: any) => {
    setRoomsData((prev: any[]) => {
      const updated = [...prev];
      const idx = updated.findIndex((r: any) => r.id === selectedRoomId);
      if (idx !== -1) updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Get room type from room name
  const getRoomType = (roomName: string): string => {
    const lowerName = roomName.toLowerCase();
    if (lowerName.includes('living') || lowerName.includes('dining')) return 'Living/Dining';
    if (lowerName.includes('bedroom') || lowerName.includes('bed')) return 'Bedroom';
    if (lowerName.includes('kitchen')) return 'Kitchen';
    if (lowerName.includes('bathroom') || lowerName.includes('bath') || lowerName.includes('toilet')) return 'Bathroom';
    if (lowerName.includes('balcony') || lowerName.includes('outdoor') || lowerName.includes('terrace')) return 'Outdoor/Balcony';
    return 'Living/Dining'; // Default
  };

  // Get material categories for current room
  const getMaterialTypesForRoom = (roomType: string): string[] => {
    const flooringConfig = (CONSTRUCTION_HIERARCHY as any)?.Flooring;
    return flooringConfig?.roomRecommendations?.[roomType] || [];
  };

  // Get sub-types for a selected category
  const getMaterialSubTypes = (category: string): string[] => {
    const flooringConfig = (CONSTRUCTION_HIERARCHY as any)?.Flooring?.subCategories;
    const categoryData = flooringConfig?.[category];
    if (categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData)) {
      return Object.keys(categoryData);
    }
    return [];
  };

  // Filter materials by category and optional sub-type
  const getFilteredMaterialsByType = (category: string, subType: string | null) => {
    return flooringMaterials.filter(m => {
      const materialName = (m.name || '').toLowerCase();
      const materialType = (m.type || '').toLowerCase();
      const materialSubCategory = (m.subCategory || '').toLowerCase();

      const categoryMatch = materialName.includes(category.toLowerCase()) ||
        materialType.includes(category.toLowerCase()) ||
        materialSubCategory.includes(category.toLowerCase());

      if (!subType) return categoryMatch;

      const subTypeMatch = materialName.includes(subType.toLowerCase()) ||
        materialType.includes(subType.toLowerCase()) ||
        materialSubCategory.includes(subType.toLowerCase());

      return categoryMatch && subTypeMatch;
    });
  };

  // AI-Powered Recommendation System with Batch Processing
  const getBatchAIRecommendations = async (roomsToProcess: any[], budgetTier: string, mats: any[]) => {
    try {
      const flooringList = mats.filter(m => m.category === 'Flooring' || m.subCategory === 'Flooring');
      const catalog = flooringList.map(m => `ID:${m.id} | ${m.name} | ${m.type} | Grade:${m.grade} | ₹${m.pricePerUnit}/${m.unit}`).join('\n');
      const roomsDescription = roomsToProcess.map(r => `- ${r.name} (ID: ${r.id}): ${r.area} sq ft`).join('\n');

      const prompt = `
You are a Senior Civil Engineer specializing in Indian residential construction.
Analyze these rooms and recommend the best flooring materials from the catalog provided.

BUDGET TIER: ${budgetTier}
PROJECT AREA: ${totalArea} sq ft

ROOMS TO ANALYZE:
${roomsDescription}

AVAILABLE FLOORING MATERIALS:
${catalog}

ENGINEERING RULES:
1. SAFETY FIRST (WET AREAS): For Toilets, Bathrooms, Wash Areas, Utilities, and Sit-outs, you MUST ONLY recommend materials that are explicitly "Anti-skid", "Anti-slip", "Matte", or "Rustico". NEVER recommend polished Granite, Marble, or Glossy Tiles for these areas.
2. LUXURY BEDROOMS: If the tier is "Luxury", prioritize "Italian Marble", "Premium Marble" or high-end "Onyx Marble" for Bedrooms. Only use wooden flooring if explicitly requested in a different context.
3. KITCHENS: Recommend durable, easy-to-clean materials like "Vitrified Tiles" or "Polished Granite" (only for platforms/dry areas).
4. STAY IN TIER: Recommendations must strictly align with the ${budgetTier} tier pricing and quality.

Return ONLY a JSON object in this exact format:
{
  "recommendations": [
    {
      "roomId": "room_id_here",
      "materialId": "actual_material_id_from_catalog",
      "confidence": 85,
      "reasoning": "Brief engineering explanation for this specific room"
    }
  ]
}`;

      const aiResponse = await generateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: 1500
      });

      // Clean response
      let jsonText = aiResponse.trim();
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        const structuredData = await extractStructuredData(aiResponse, `{
              "recommendations": [{"roomId": "string", "materialId": "string", "confidence": "number", "reasoning": "string"}]
          }`);
        parsed = JSON.parse(structuredData);
      }

      return parsed.recommendations;
    } catch (error) {
      console.warn('Batch AI recommendation failed:', error);
      return null;
    }
  };

  const applyRecommendations = async () => {
    if (!flooringMaterials || flooringMaterials.length === 0) return;

    setAiLoading(true);
    try {
      const batchResults = await getBatchAIRecommendations(roomsData, tier, materials);

      if (!batchResults) {
        throw new Error('No recommendations returned from AI');
      }

      const updatedRooms = roomsData.map((room: any) => {
        const recommendation = (batchResults as any[]).find(res => res.roomId === room.id);
        const roomType = getRoomType(room.name);
        const materialTypes = getMaterialTypesForRoom(roomType);

        if (recommendation) {
          const mat = flooringMaterials.find(m => m.id === recommendation.materialId) || flooringMaterials[0];
          return {
            ...room,
            flooringMaterial: mat,
            isRecommended: true,
            roomType: roomType,
            suggestedMaterialType: materialTypes[0]
          };
        }
        return room;
      });

      setRoomsData(updatedRooms);
      setAiApplied(true);

      // Set the filter to the first suggested material type for the current room
      const currentUpdatedRoom = updatedRooms.find((r: any) => r.id === selectedRoomId);
      if (currentUpdatedRoom?.suggestedMaterialType) {
        setSelectedMaterialFilter(currentUpdatedRoom.suggestedMaterialType);
      }

      Alert.alert(
        'AI Recommendations Applied',
        `Smart material selection completed in a single batch for ${updatedRooms.length} room(s).`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('AI recommendation error:', error);
      Alert.alert('Error', 'Unable to get AI recommendations. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Save Logic
  const handleSaveFlooringEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    if (!projectId) return Alert.alert("Error", "Project ID not found.");
    if (totalCost === 0) return Alert.alert("Error", "No flooring materials selected.");

    setSaving(true);
    try {
      const lineItems = roomsData.filter(room => room.flooringMaterial).map((room: any) => ({
        roomId: room.id,
        roomName: room.name,
        materialName: room.flooringMaterial.name,
        name: room.flooringMaterial.name,
        desc: `Flooring for ${room.name} (${room.area} sq.ft)`,
        qty: Math.ceil(room.area * (1 + TILE_WASTE_FACTOR)),
        unit: formatUnit(room.flooringMaterial.unit),
        total: Math.ceil(room.area * (1 + TILE_WASTE_FACTOR)) * room.flooringMaterial.pricePerUnit,
        rate: room.flooringMaterial.pricePerUnit
      }));

      // Sanitize data to remove undefined values
      const estimateData = {
        projectId: projectId || '',
        userId: auth.currentUser!.uid,
        itemName: 'Flooring',
        category: 'Flooring',
        totalCost: totalCost || 0,
        lineItems: lineItems.filter(item => item.name !== undefined),
        specifications: {
          totalArea: `${totalSelectedArea} sq.ft`,
          roomsSelected: roomsData.filter((r: any) => r.flooringMaterial).length,
          rooms: roomsData.filter((r: any) => r.flooringMaterial).map((r: any) => ({
            name: r.name,
            area: r.area,
            material: r.flooringMaterial.name
          }))
        },
        createdAt: serverTimestamp()
      };

      await createDocument('estimates', estimateData);

      Alert.alert("Success", "Flooring Estimate saved successfully to project summary.");
      navigation.navigate('ProjectSummary', { projectId });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const materialTypeOptions = ['All', 'Tile'];

  const filteredMaterials = materials.filter(m => {
    return m.category === 'Flooring' || m.type === 'Tile' || m.subCategory === 'Flooring';
  });

  // Debug logging for render
  console.log('FlooringScreen - Render state:', {
    loading,
    roomsDataLength: roomsData.length,
    materialsLength: materials.length,
    selectedRoomId,
    currentRoom: currentRoom?.name
  });

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  // Show error state if no AI-detected rooms available
  if (roomsData.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#315b76" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Flooring Setup</Text>
          </View>
          <View style={styles.centered}>
            <Ionicons name="scan-outline" size={64} color="#cbd5e1" style={{ marginBottom: 16 }} />
            <Text style={styles.errorText}>No AI-detected rooms found</Text>
            <Text style={styles.errorSubtext}>Please go back and analyze your floor plan first to detect rooms and dimensions.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryBtnText}>Analyze Floor Plan</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{projectName}</Text>
            <Text style={styles.headerSubtitle}>{roomsData.length} AI-detected rooms • {Math.round(totalArea)} sq.ft</Text>
          </View>
          <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* AI Recommendation Banner */}
          <TouchableOpacity
            style={[styles.aiBanner, aiApplied && styles.aiBannerApplied]}
            onPress={applyRecommendations}
            activeOpacity={0.8}
            disabled={aiLoading}
          >
            <View style={styles.aiIconContainer}>
              {aiLoading ? (
                <ActivityIndicator size={24} color="#315b76" />
              ) : (
                <MaterialCommunityIcons
                  name={aiApplied ? "robot-happy" : "robot"}
                  size={24}
                  color={aiApplied ? "#059669" : "#315b76"}
                />
              )}
            </View>
            <View style={styles.aiContent}>
              <Text style={[styles.aiTitle, aiApplied && styles.aiTitleApplied]}>
                {aiLoading
                  ? "AI Analyzing..."
                  : aiApplied
                    ? "AI Recommendation Applied"
                    : "AI Recommendation"
                }
              </Text>
              <Text style={styles.aiDesc}>
                {aiLoading
                  ? "Processing..."
                  : aiApplied
                    ? "Recommendations applied to your selections"
                    : `Get smart suggestions for your ${tier} plan`}
              </Text>
            </View>
            {!aiApplied && (
              <View style={styles.applyBadge}>
                <Text style={styles.applyBadgeText}>APPLY</Text>
                <Ionicons name="sparkles" size={12} color="#fff" />
              </View>
            )}
            {aiApplied && (
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
            )}
          </TouchableOpacity>

          {/* 1. Room Selection Section */}
          <View style={{ paddingLeft: 0, paddingRight: 12, marginBottom: 15 }}>
            <Text style={styles.sectionLabel}>AI-DETECTED ROOMS ({roomsData.filter((r: any) => r.flooringMaterial).length}/{roomsData.length} Complete)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.roomsContainer}>
                {roomsData.map((room: any) => (
                  <TouchableOpacity
                    key={room.id}
                    style={[
                      styles.roomPill,
                      selectedRoomId === room.id && styles.selectedRoomPill,
                      room.flooringMaterial && styles.completedRoomPill
                    ]}
                    onPress={() => setSelectedRoomId(room.id)}
                  >
                    <Ionicons
                      name={room.flooringMaterial ? "checkmark-circle" : "home-outline"}
                      size={16}
                      color={selectedRoomId === room.id ? "#fff" : "#315b76"}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[
                      styles.roomPillText,
                      selectedRoomId === room.id && styles.selectedRoomPillText
                    ]}>
                      {room.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 2. Material Selection for Current Room */}
          {currentRoom && (
            <>
              <View style={styles.inputCard}>
                <Text style={styles.sectionLabel}>FLOORING MATERIAL FOR {currentRoom.name.toUpperCase()}</Text>
                <View style={styles.roomInfoContainer}>
                  <View style={styles.roomInfoItem}>
                    <Ionicons name="scan-outline" size={16} color="#10b981" />
                    <Text style={styles.roomInfoText}>AI-detected: {Math.round(currentRoom.area)} sq.ft</Text>
                  </View>
                  {currentRoom.length && currentRoom.width && (
                    <View style={styles.roomInfoItem}>
                      <Ionicons name="expand-outline" size={16} color="#f59e0b" />
                      <Text style={styles.roomInfoText}>{currentRoom.length}×{currentRoom.width}ft</Text>
                    </View>
                  )}
                  <View style={styles.roomInfoItem}>
                    <Ionicons name="cube-outline" size={16} color="#315b76" />
                    <Text style={styles.roomInfoText}>Qty: {Math.ceil(currentRoom.area * (1 + TILE_WASTE_FACTOR))} {formatUnit(currentRoom.flooringMaterial?.unit)}</Text>
                  </View>
                </View>
              </View>

              {/* Material Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>SELECT CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {getMaterialTypesForRoom(getRoomType(currentRoom.name)).map((category: string) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.filterPill,
                        selectedMaterialFilter === category && styles.filterPillSelected
                      ]}
                      onPress={() => {
                        setSelectedMaterialFilter(category);
                        setSelectedSubMaterialFilter(null);
                      }}
                    >
                      <Text style={[styles.filterPillText, selectedMaterialFilter === category && styles.filterPillTextSelected]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Sub-Category Filter (Nested Hierarchy) */}
              {selectedMaterialFilter && getMaterialSubTypes(selectedMaterialFilter).length > 0 && (
                <View style={[styles.filterSection, { marginTop: -10 }]}>
                  <Text style={styles.filterLabel}>SELECT TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        selectedSubMaterialFilter === null && styles.filterPillSelected
                      ]}
                      onPress={() => setSelectedSubMaterialFilter(null)}
                    >
                      <Text style={[styles.filterPillText, selectedSubMaterialFilter === null && styles.filterPillTextSelected]}>
                        All {selectedMaterialFilter}
                      </Text>
                    </TouchableOpacity>
                    {getMaterialSubTypes(selectedMaterialFilter).map((subType: string) => (
                      <TouchableOpacity
                        key={subType}
                        style={[
                          styles.filterPill,
                          selectedSubMaterialFilter === subType && styles.filterPillSelected
                        ]}
                        onPress={() => setSelectedSubMaterialFilter(subType)}
                      >
                        <Text style={[styles.filterPillText, selectedSubMaterialFilter === subType && styles.filterPillTextSelected]}>
                          {subType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Material Cards - Horizontal Scrollable - Outside Card */}
              {selectedMaterialFilter && (
                <View style={styles.materialCardSection}>
                  <Text style={styles.materialListLabel}>
                    {selectedSubMaterialFilter ? `${selectedSubMaterialFilter} ${selectedMaterialFilter}` : `${selectedMaterialFilter} Products`}
                  </Text>
                  {getFilteredMaterialsByType(selectedMaterialFilter, selectedSubMaterialFilter).length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materialCardsScroll}>
                      {getFilteredMaterialsByType(selectedMaterialFilter, selectedSubMaterialFilter).map(material => (
                        <TouchableOpacity
                          key={material.id}
                          style={[
                            styles.materialCard,
                            currentRoom.flooringMaterial?.id === material.id && styles.selectedMaterialCard
                          ]}
                          onPress={() => updateRoomData('flooringMaterial', material)}
                        >
                          <View style={styles.materialImageContainer}>
                            {material.imageUrl ? (
                              <Image source={{ uri: material.imageUrl }} style={styles.materialImage} />
                            ) : (
                              <Ionicons name="cube-outline" size={32} color="#cbd5e1" />
                            )}
                          </View>
                          <Text style={styles.materialName} numberOfLines={2}>{material.name}</Text>
                          <Text style={styles.materialPrice}>₹{material.pricePerUnit || 0}/{formatUnit(material.unit)}</Text>
                          <Text style={styles.materialCost} numberOfLines={1}>
                            ₹{((material.pricePerUnit || 0) * Math.ceil(currentRoom.area * (1 + TILE_WASTE_FACTOR))).toLocaleString()}
                          </Text>
                          {currentRoom.flooringMaterial?.id === material.id && (
                            <View style={styles.materialCheckmark}>
                              <Ionicons name="checkmark-circle" size={20} color="#315b76" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptyText}>No materials found for {selectedMaterialFilter}.</Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* 3. Material Breakdown Summary (Redesigned) */}
          {Object.keys(materialBreakdown).length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>

              <View style={styles.categoryContainer}>
                <View style={styles.categoryHeader}>
                  <MaterialCommunityIcons name="layers-triple" size={20} color="#315b76" />
                  <Text style={styles.categoryTitle}>Flooring & Tiles</Text>
                </View>

                <View style={styles.table}>
                  {Object.values(materialBreakdown).map((item: any, idx: number) => (
                    <View key={idx} style={[styles.tableRow, idx === Object.values(materialBreakdown).length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.tableColMain}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={styles.roomList}>
                          {item.rooms.map((r: any, rIdx: number) => (
                            <View key={rIdx} style={styles.roomBadgeRow}>
                              <View style={styles.roomDot} />
                              <Text style={styles.roomInfoText}>{r.name}: {r.qty} {item.unit}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={styles.tableColSide}>
                        <View style={styles.qtyContainer}>
                          <Text style={styles.itemQty}>{item.qty}</Text>
                          <Text style={styles.itemUnit}>{item.unit}</Text>
                        </View>
                        <View style={styles.priceContainer}>
                          <Text style={styles.itemPrice}>₹{item.total.toLocaleString()}</Text>
                          <Text style={styles.itemRate}>@ ₹{item.price}/{item.unit}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.resultCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Grand Total ({Math.round(totalSelectedArea)} sq.ft)</Text>
                  <Text style={styles.totalVal}>₹{totalCost.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.mainBtn, (!allComplete || totalCost === 0) && styles.disabledBtn]}
          onPress={handleSaveFlooringEstimate}
          disabled={saving || !allComplete || totalCost === 0}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.mainBtnText}>
                {allComplete ? 'Save Flooring Estimate' : `Complete ${roomsData.length - roomsData.filter((r: any) => r.flooringMaterial).length} More Room(s)`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },
  inputCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, marginBottom: 15 },

  // Room Selection Styles
  roomsContainer: { flexDirection: 'row', paddingVertical: 5 },
  roomPill: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 10, flexDirection: 'row', alignItems: 'center' },
  selectedRoomPill: { backgroundColor: '#315b76', borderColor: '#315b76' },
  completedRoomPill: { borderColor: '#10b981' },
  roomPillText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  selectedRoomPillText: { color: '#fff' },
  roomInfoContainer: { flexDirection: 'row', gap: 16, marginBottom: 15 },
  roomInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomInfoText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // Material Selection Styles
  materialScroll: { marginTop: 10 },

  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginLeft: 5 },

  resultCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 15, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0 },
  resultHeader: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#1e293b', fontSize: 14, fontWeight: '600' },
  totalVal: { color: '#10b981', fontSize: 22, fontWeight: '800' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5, textTransform: 'uppercase' },
  categoryContainer: { marginBottom: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: '#315b76' },
  table: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableColMain: { flex: 1.5, paddingRight: 10 },
  tableColSide: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start' },
  qtyContainer: { marginBottom: 6, alignItems: 'flex-end' },
  priceContainer: { alignItems: 'flex-end' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  roomList: { marginTop: 2 },
  itemQty: { fontSize: 16, fontWeight: '800', color: '#475569' },
  itemUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#10b981' },
  itemRate: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  roomBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  roomDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#cbd5e1' },

  mainBtn: { backgroundColor: '#315b76', margin: 20, padding: 18, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },
  disabledBtn: { backgroundColor: '#94a3b8' },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Error state styles
  errorText: { fontSize: 18, color: '#1e293b', textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  errorSubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: { backgroundColor: '#315b76', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* AI Recommendation Banner */
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 12,
  },
  aiBannerApplied: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  aiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0c4a6e',
  },
  aiTitleApplied: {
    color: '#065f46',
  },
  aiDesc: {
    fontSize: 11,
    color: '#0369a1',
    fontWeight: '500',
  },
  applyBadge: {
    backgroundColor: '#315b76',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applyBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Material Filter Styles */
  filterSection: {
    paddingLeft: 0,
    paddingRight: 12,
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 8,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  filterPillSelected: {
    backgroundColor: '#315b76',
    borderColor: '#315b76',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextSelected: {
    color: '#fff',
  },

  /* Material List Styles */
  materialCardSection: {
    marginTop: 12,
    paddingLeft: 0,
    paddingRight: 12,
    marginBottom: 15,
  },
  materialListLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  materialCardsScroll: {
    marginTop: 5,
  },
  materialCard: {
    width: 120,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  selectedMaterialCard: {
    borderColor: '#315b76',
    borderWidth: 1,
    backgroundColor: '#eff6ff',
  },
  materialImageContainer: {
    height: 60,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  materialImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  materialName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  materialPrice: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  materialCost: {
    fontSize: 10,
    color: '#315b76',
    fontWeight: '700',
  },
  materialCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
    elevation: 2,
  },
});
