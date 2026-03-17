import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, TextInput, Image, ActivityIndicator,
  Platform, Modal, FlatList, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  db,
  auth,
  createDocument,
  generateText,
  extractStructuredData,
  CONSTRUCTION_HIERARCHY,
} from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getProjectById } from '../services/projectService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const PAINT_COVERAGE_PER_LITER = 120; // sq.ft per liter per coat (standard emulsion)
const EXTERIOR_WALL_FACTOR = 0.9; // External wall area is typically 0.8 - 1.0 of floor area
const WALL_HEIGHT_FT = 10;
const DOOR_AREA_SQFT = 21; // Standard door 3' x 7'
const WINDOW_AREA_SQFT = 16; // Standard window 4' x 4'
const MATERIAL_WASTE_FACTOR = 0.10; // 10% wastage for all materials

export default function PaintingScreen({ route, navigation }: any) {
  const { totalArea, projectId, tier, rooms = [], editEstimateId } = route.params || {};

  // --- REFS ---
  const fetchedRef = useRef(false);

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // --- UI STATE ---
  const [paintType, setPaintType] = useState<'Interior' | 'Exterior'>('Interior');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomsData, setRoomsData] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  // --- SELECTION STATE ---
  const [exteriorSelection, setExteriorSelection] = useState({
    area: String(Math.round((totalArea || 1000) * EXTERIOR_WALL_FACTOR)),
    filter: 'Paint',
    material: null as any,
    coats: '2'
  });

  // Sync rooms from route params or database
  useEffect(() => {
    const loadRooms = async () => {
      // 1. If we already have rooms from route, use them
      if (rooms && Array.isArray(rooms) && rooms.length > 0) {
        initRoomsData(rooms);
        return;
      }

      // 2. If no rooms in route, but we have projectId, fetch from DB
      if (projectId) {
        try {
          const projectData = await getProjectById(projectId);
          if (projectData?.rooms && Array.isArray(projectData.rooms)) {
            initRoomsData(projectData.rooms);
          }
        } catch (error) {
          console.error('Error fetching rooms for painting screen:', error);
        }
      }
    };

    loadRooms();
  }, [rooms, projectId]);

  const initRoomsData = (roomsToInit: any[]) => {
    setRoomsData(roomsToInit.map((room: any) => {
      // Correct engineering method: (Perimeter * Height) - Openings
      const length = parseFloat(String(room.length || room.dimensions?.length || 10));
      const width = parseFloat(String(room.width || room.dimensions?.width || 10));

      // Calculate Gross Wall Area
      const perimeter = 2 * (length + width);
      const grossWallArea = perimeter * WALL_HEIGHT_FT;

      // Subtract approximate openings (Doors and Windows)
      const doorDeduction = (room.doorCount || 1) * DOOR_AREA_SQFT;
      const windowDeduction = (room.windowCount || 1) * WINDOW_AREA_SQFT;
      const netWallArea = Math.max(0, grossWallArea - (doorDeduction + windowDeduction));

      return {
        id: room.id,
        name: room.name,
        area: String(Math.round(netWallArea)),
        filter: 'Paint',
        material: null as any,
        coats: '2',
        originalData: room // Store for reference
      };
    }));
    if (!selectedRoomId && roomsToInit.length > 0) {
      setSelectedRoomId(roomsToInit[0].id);
    }
  };

  // 1. Fetch Materials
  useEffect(() => {
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = data.filter(m => m.category === 'Wall Finishing');
      setMaterials(filtered);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 1.5. Load existing estimate if editing
  useEffect(() => {
    const loadExistingEstimate = async () => {
      if (editEstimateId && materials.length > 0 && roomsData.length > 0 && !fetchedRef.current) {
        fetchedRef.current = true;
        try {
          const docSnap = await getDoc(doc(db, 'estimates', editEstimateId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.lineItems && Array.isArray(data.lineItems)) {
              setRoomsData((prev: any) => prev.map((room: any) => {
                const roomItems = data.lineItems.filter((item: any) => item.roomId === room.id);
                if (roomItems.length > 0) {
                  const mat = materials.find((m: any) => m.id === roomItems[0].materialId);
                  return { ...room, material: mat || room.material };
                }
                return room;
              }));
            }
          }
        } catch (e) {
          console.error('Error loading existing painting estimate:', e);
        }
      }
    };
    loadExistingEstimate();
  }, [editEstimateId, materials.length, roomsData.length]);

  // 2. Default Selections (Tier-based + Room-type aware)
  useEffect(() => {
    if (materials.length > 0 && loading === false && roomsData.length > 0) {
      const hasSelections = roomsData.some(r => r.material !== null);
      if (hasSelections) return;

      const getMatByTier = (list: any[], budgetTier: string) => {
        const sortedList = [...list].sort((a, b) => (parseFloat(a.pricePerUnit) - parseFloat(b.pricePerUnit)));
        const total = sortedList.length;
        if (budgetTier === 'Economy') return sortedList[0];
        if (budgetTier === 'Luxury') return sortedList[total - 1];
        return sortedList[Math.floor(total / 2)];
      };

      const paintMats = materials.filter(m => m.subCategory === 'Paint');
      const claddingMats = materials.filter(m => m.subCategory === 'Cladding');
      const wallpaperMats = materials.filter(m => m.subCategory === 'Wallpaper');

      if (paintMats.length === 0) return;

      // Exterior Default
      if (!exteriorSelection.material) {
        const extPaints = paintMats.filter(m => m.name.toLowerCase().includes('exterior') || m.type.toLowerCase().includes('exterior'));
        setExteriorSelection(prev => ({
          ...prev,
          material: extPaints.length > 0 ? getMatByTier(extPaints, tier) : getMatByTier(paintMats, tier)
        }));
      }

      // Interior Defaults per room
      setRoomsData(prev => prev.map(room => {
        const lowerName = room.name.toLowerCase();
        const isWetArea = lowerName.includes('bath') || lowerName.includes('toilet') || lowerName.includes('wc');
        const isLiving = lowerName.includes('living') || lowerName.includes('hall') || lowerName.includes('drawing');
        const isPremium = lowerName.includes('master') || lowerName.includes('living');

        let mat = getMatByTier(paintMats, tier);

        if (isWetArea && claddingMats.length > 0) {
          // Default to Cladding/Tiles for Bathrooms
          return { ...room, filter: 'Cladding', material: claddingMats[0] };
        }

        if (isLiving && tier === 'Luxury' && wallpaperMats.length > 0) {
          // Feature wall concept: Apply high-end wallpaper or luxury paint
          mat = getMatByTier(paintMats, 'Luxury');
        }

        return { ...room, material: mat };
      }));
    }
  }, [materials, loading, tier, roomsData.length]);

  // AI Recommendation Logic
  const getBatchAIRecommendations = async (roomsToProcess: any[], budgetTier: string, allMats: any[]) => {
    try {
      const catalog = allMats.map(m => `ID:${m.id} | ${m.name} | ${m.subCategory} | Grade:${m.grade} | ₹${m.pricePerUnit}/${m.unit}`).join('\n');
      const roomsDescription = roomsToProcess.map(r => {
        const d = r.originalData || {};
        return `- ${r.name}: ${d.length || '?'}' x ${d.width || '?'}' (Net Wall Area: ${r.area} sq ft)`;
      }).join('\n');

      const prompt = `
You are a Senior Architect and Home Decor Expert.
Analyze these rooms and recommend the best wall finishes (Paint, Wallpaper, or Cladding) from the catalog provided.

BUDGET TIER: ${budgetTier}

ROOMS TO ANALYZE:
${roomsDescription}

AVAILABLE MATERIALS:
${catalog}

ENGINEERING & DESIGN RULES:
1. BATHROOMS/WET AREAS: Recommend "Cladding" (Tiles/Stone) - NEVER recommend standard interior paint or wallpaper for wet walls.
2. LUXURY SPACES (Living/Master Bed): If tier is "Luxury", recommend high-end "Interior Emulsion" or premium "Wallpaper" for feature walls.
3. DURABILITY: High traffic areas like Halls should have washable emulsion paints.
4. EXTERIOR: I will provide rooms only, but for exterior, ensure it's "Exterior Emulsion".

Return ONLY a JSON object:
{
  "recommendations": [
    {
      "roomName": "room_name_here",
      "materialId": "actual_material_id_from_catalog",
      "filter": "Paint/Wallpaper/Cladding",
      "reasoning": "Brief design explanation"
    }
  ]
}`;

      const aiResponse = await generateText(prompt, { temperature: 0.4 });
      let jsonText = aiResponse.trim();
      if (jsonText.includes('```json')) jsonText = jsonText.split('```json')[1].split('```')[0].trim();

      const parsed = JSON.parse(jsonText);
      return parsed.recommendations;
    } catch (error) {
      console.warn('AI recommendation failed:', error);
      return null;
    }
  };

  const applyRecommendations = async () => {
    setAiLoading(true);
    try {
      const recs = await getBatchAIRecommendations(roomsData, tier, materials);
      if (recs) {
        setRoomsData(prev => prev.map(room => {
          const rec = recs.find((r: any) => r.roomName === room.name);
          if (rec) {
            const mat = materials.find(m => m.id === rec.materialId);
            return {
              ...room,
              filter: rec.filter,
              material: mat || room.material,
              isRecommended: true
            };
          }
          return room;
        }));
        setAiApplied(true);
        Alert.alert('AI Applied', 'Recommendations tailored to your rooms have been applied.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  // 3. Calculation Engine
  const calculateSpecs = (item: any) => {
    const area = parseFloat(item.area) || 0;
    if (!item.material || area <= 0) return { cost: 0, qty: 0, unit: item.material?.unit || '' };

    const price = parseFloat(item.material.pricePerUnit) || 0;

    if (item.filter === 'Paint') {
      const numCoats = parseFloat(item.coats) || 2;
      // Coverage per liter applied per coat, including wastage
      const liters = Math.ceil(((area / PAINT_COVERAGE_PER_LITER) * numCoats) * (1 + MATERIAL_WASTE_FACTOR));
      return { cost: liters * price, qty: liters, unit: 'Litre' };
    } else {
      // Cladding/Wallpaper/Paneling area including wastage
      const qtyWithWaste = Math.ceil(area * (1 + MATERIAL_WASTE_FACTOR));
      return { cost: qtyWithWaste * price, qty: qtyWithWaste, unit: 'sq.ft' };
    }
  };

  const totals = useMemo(() => {
    const ext = calculateSpecs(exteriorSelection);
    const intCost = roomsData.reduce((sum, room) => sum + calculateSpecs(room).cost, 0);
    return {
      exterior: Math.round(ext.cost),
      interior: Math.round(intCost),
      total: Math.round(ext.cost + intCost)
    };
  }, [exteriorSelection, roomsData]);

  const materialBreakdown = useMemo(() => {
    const breakdown: any = {
      Paint: {},
      Cladding: {},
      Wallpaper: {},
      Paneling: {}
    };

    const processItem = (item: any, label: string) => {
      const specs = calculateSpecs(item);
      if (specs.cost > 0 && item.material) {
        const cat = item.filter;
        const matId = item.material.id;
        if (!breakdown[cat]) breakdown[cat] = {};
        if (!breakdown[cat][matId]) {
          breakdown[cat][matId] = {
            name: item.material.name,
            price: item.material.pricePerUnit,
            qty: 0,
            total: 0,
            unit: specs.unit,
            rooms: []
          };
        }
        breakdown[cat][matId].qty += specs.qty;
        breakdown[cat][matId].total += specs.cost;
        breakdown[cat][matId].rooms.push({ name: label, count: specs.qty, unit: specs.unit });
      }
    };

    processItem(exteriorSelection, 'Exterior');
    roomsData.forEach(room => processItem(room, room.name));
    return breakdown;
  }, [roomsData, exteriorSelection]);

  // 4. State Update Handlers
  const updateExterior = (field: string, value: any) => {
    setExteriorSelection(prev => {
      const updated = { ...prev, [field]: value };
      // If filter changed, try to auto-select a material of that type
      if (field === 'filter') {
        const best = materials.find(m => m.subCategory === value);
        updated.material = best || null;
      }
      return updated;
    });
  };

  const updateRoom = (roomId: string, field: string, value: any) => {
    setRoomsData(prev => prev.map(room => {
      if (room.id === roomId) {
        const updated = { ...room, [field]: value };
        if (field === 'filter') {
          const best = materials.find(m => m.subCategory === value);
          updated.material = best || null;
        }
        return updated;
      }
      return room;
    }));
  };

  const handleSave = async () => {
    if (!auth.currentUser || !projectId) return Alert.alert("Error", "Auth or Project ID missing.");
    if (totals.total === 0) return Alert.alert("Error", "Total cost is zero.");

    setSaving(true);
    try {
      const lineItems: any[] = [];

      // Add Exterior
      const extSpecs = calculateSpecs(exteriorSelection);
      if (extSpecs.cost > 0) {
        lineItems.push({
          name: exteriorSelection.material.name,
          desc: `Exterior ${exteriorSelection.filter} (${exteriorSelection.area} sq.ft)`,
          qty: extSpecs.qty,
          unit: extSpecs.unit,
          rate: exteriorSelection.material.pricePerUnit,
          total: extSpecs.cost
        });
      }

      // Add Interior Rooms
      roomsData.forEach(room => {
        const specs = calculateSpecs(room);
        if (specs.cost > 0) {
          lineItems.push({
            name: room.material.name,
            desc: `Interior ${room.filter} - ${room.name} (${room.area} sq.ft)`,
            qty: specs.qty,
            unit: specs.unit,
            rate: room.material.pricePerUnit,
            total: specs.cost
          });
        }
      });

      const estimatePayload = {
        projectId,
        userId: auth.currentUser.uid,
        itemName: 'Painting & Finishing',
        category: 'Painting',
        totalCost: totals.total,
        lineItems,
        specifications: {
          interiorCost: totals.interior,
          exteriorCost: totals.exterior,
          roomCount: roomsData.length
        },
      };
      if (editEstimateId) {
        await updateDoc(doc(db, 'estimates', editEstimateId), { ...estimatePayload, updatedAt: serverTimestamp() });
        Alert.alert("Updated", "Wall finishing estimate updated.");
        navigation.navigate('EstimateResult', { projectId });
      } else {
        await createDocument('estimates', { ...estimatePayload, createdAt: serverTimestamp() });
        Alert.alert("Success", "Wall finishing estimate saved.");
        navigation.navigate('ProjectSummary', { projectId });
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const currentRoom = roomsData.find(r => r.id === selectedRoomId);
  const activeSelection = paintType === 'Exterior' ? exteriorSelection : currentRoom;

  const filterOptions = paintType === 'Interior'
    ? ['Paint', 'Cladding', 'Wallpaper']
    : ['Paint', 'Cladding', 'Paneling'];

  const filteredMaterials = materials.filter(m => m.subCategory === activeSelection?.filter);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wall Finishing</Text>
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

          {/* 1. Type Toggle */}
          <View style={styles.typeTabContainer}>
            {['Interior', 'Exterior'].map((type: any) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeTab, paintType === type && styles.typeTabActive]}
                onPress={() => setPaintType(type)}
              >
                <Ionicons
                  name={type === 'Interior' ? 'home-outline' : 'cloud-outline'}
                  size={14}
                  color={paintType === type ? '#fff' : '#64748b'}
                />
                <Text style={[styles.typeTabText, paintType === type && styles.typeTabTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 2. Interior Room Selection */}
          {paintType === 'Interior' && (
            <>
              <Text style={styles.sectionLabel}>SELECT ROOM</Text>
              {roomsData.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
                  {roomsData.map(room => (
                    <TouchableOpacity
                      key={room.id}
                      style={[styles.roomChip, selectedRoomId === room.id && styles.roomChipActive]}
                      onPress={() => setSelectedRoomId(room.id)}
                    >
                      <Text style={[styles.roomChipText, selectedRoomId === room.id && styles.roomChipTextActive]}>{room.name}</Text>
                      {calculateSpecs(room).cost > 0 && <Ionicons name="checkmark-circle" size={12} color={selectedRoomId === room.id ? "#fff" : "#10b981"} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noRoomsBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                  <Text style={styles.noRoomsText}>No AI-detected rooms found for this project.</Text>
                </View>
              )}
            </>
          )}

          {/* 3. Specifications Card */}
          {activeSelection && (
            <View style={styles.inputCard}>
              <View style={styles.specHeader}>
                <Text style={styles.sectionLabel}>{paintType === 'Exterior' ? 'EXTERIOR' : activeSelection.name} SPECS</Text>
                {paintType === 'Interior' && (
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={10} color="#315b76" />
                    <Text style={styles.aiBadgeText}>AI DETECTED</Text>
                  </View>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.inputBox}>
                  <Text style={styles.label}>Wall Area (sq.ft)</Text>
                  <TextInput
                    style={styles.input}
                    value={activeSelection.area}
                    onChangeText={(val) => paintType === 'Exterior' ? updateExterior('area', val) : updateRoom(activeSelection.id, 'area', val)}
                    keyboardType="decimal-pad"
                  />
                </View>
                {activeSelection.filter === 'Paint' && (
                  <View style={styles.inputBox}>
                    <Text style={styles.label}>Coats</Text>
                    <TextInput
                      style={styles.input}
                      value={activeSelection.coats}
                      onChangeText={(val) => paintType === 'Exterior' ? updateExterior('coats', val) : updateRoom(activeSelection.id, 'coats', val)}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 4. Filter Chips */}
          <Text style={styles.sectionLabel}>FINISH TYPE</Text>
          <View style={styles.filterContainer}>
            {filterOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.filterChip, activeSelection?.filter === option && styles.filterChipActive]}
                onPress={() => paintType === 'Exterior' ? updateExterior('filter', option) : updateRoom(activeSelection!.id, 'filter', option)}
              >
                <Text style={[styles.filterChipText, activeSelection?.filter === option && styles.filterChipTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 5. Material Selection */}
          <Text style={styles.sectionLabel}>AVAILABLE MATERIALS</Text>
          <View style={styles.materialSection}>
            {filteredMaterials.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.materialScroll}>
                {filteredMaterials.map(item => {
                  const isSelected = activeSelection?.material?.id === item.id;
                  return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.materialCard, isSelected && styles.materialCardActive]}
                    onPress={() => {
                      // Toggle: if already selected, deselect (set to null), otherwise select
                      if (paintType === 'Exterior') {
                        updateExterior('material', isSelected ? null : item);
                      } else {
                        updateRoom(activeSelection!.id, 'material', isSelected ? null : item);
                      }
                    }}
                  >
                    <View style={styles.imagePlaceholder}>
                      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.materialImg} /> : <Ionicons name="color-palette-outline" size={24} color="#cbd5e1" />}
                    </View>
                    <Text style={styles.matName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.matPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                    {isSelected && (
                      <View style={styles.checkBadge}><Ionicons name="checkmark-circle" size={18} color="#315b76" /></View>
                    )}
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No materials found for {activeSelection?.filter}.</Text>
            )}
          </View>

          {/* 6. Estimation Summary */}
          <Text style={styles.sectionLabel}>MATERIAL BREAKDOWN</Text>

          {Object.entries(materialBreakdown).map(([category, mats]: [string, any]) => {
            const matList = Object.values(mats);
            if (matList.length === 0) return null;

            return (
              <View key={category} style={styles.categoryContainer}>
                <View style={styles.categoryHeader}>
                  <Ionicons
                    name={category === 'Paint' ? 'color-fill' : category === 'Wallpaper' ? 'layers' : 'grid'}
                    size={18}
                    color="#315b76"
                  />
                  <Text style={styles.categoryTitle}>{category}</Text>
                </View>
                <View style={styles.table}>
                  {matList.map((item: any, idx: number) => (
                    <View key={idx} style={styles.tableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.rooms.map((r: any, rIdx: number) => (
                          <View key={rIdx} style={styles.roomBadgeRow}>
                            <View style={styles.roomDot} />
                            <Text style={styles.roomInfoText}>{r.name}: {r.count} {r.unit}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={styles.itemQty}>{item.qty} <Text style={styles.itemUnit}>{item.unit}</Text></Text>
                      </View>
                      <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                        <Text style={styles.itemPrice}>₹{item.total.toLocaleString()}</Text>
                        <Text style={styles.itemRate}>@ ₹{item.price}/{item.unit}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={styles.resultCard}>
            <View style={styles.resRow}>
              <Text style={styles.resLabel}>Interior Total</Text>
              <Text style={styles.resVal}>₹{totals.interior.toLocaleString()}</Text>
            </View>
            <View style={styles.resRow}>
              <Text style={styles.resLabel}>Exterior Total</Text>
              <Text style={styles.resVal}>₹{totals.exterior.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalVal}>₹{totals.total.toLocaleString()}</Text>
            </View>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.mainBtn}
          onPress={handleSave}
          disabled={saving || totals.total === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={styles.mainBtnText}>Save Finishing Estimate</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  scroll: { paddingHorizontal: 20 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginVertical: 12, textTransform: 'uppercase', letterSpacing: 1 },
  inputCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  row: { flexDirection: 'row', gap: 10 },
  inputBox: { flex: 1 },
  label: { fontSize: 10, color: '#64748b', marginBottom: 5, fontWeight: '700' },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 15, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },

  typeTabContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  typeTab: { flex: 1, paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, elevation: 1 },
  typeTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  typeTabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  typeTabTextActive: { color: '#fff' },

  roomScroll: { marginBottom: 10 },
  roomChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomChipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  roomChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  roomChipTextActive: { color: '#fff' },

  filterContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  materialSection: { marginBottom: 15 },
  materialScroll: { paddingVertical: 5, paddingRight: 20 },
  materialCard: {
    width: 130,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 12,
    position: 'relative',
    elevation: 1,
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  materialCardActive: { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2 },
  imagePlaceholder: { height: 80, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8, overflow: 'hidden' },
  materialImg: { width: '100%', height: '100%', borderRadius: 12 },
  matName: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  matPrice: { fontSize: 11, color: '#315b76', fontWeight: 'bold', marginTop: 3 },
  checkBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', elevation: 2 },

  resultCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 15, marginTop: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 },
  resultHeader: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1, textAlign: 'center' },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resLabel: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  resVal: { color: '#1e293b', fontWeight: '700', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#1e293b', fontSize: 16, fontWeight: '800' },
  totalVal: { color: '#315b76', fontSize: 24, fontWeight: '900' },

  mainBtn: { backgroundColor: '#315b76', margin: 20, padding: 20, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, position: 'absolute', bottom: 0, left: 0, right: 0, elevation: 5 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', padding: 10 },

  /* New AI and Room Analysis Styles */
  noRoomsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginTop: 5
  },
  noRoomsText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  specHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: '#315b76' },

  /* Openings Screen Style Breakdown */
  categoryContainer: { marginBottom: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: '#315b76' },
  table: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  itemUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  itemRate: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  roomBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  roomDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#94a3b8' },
  roomInfoText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  /* AI Banner Styles */
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
});
