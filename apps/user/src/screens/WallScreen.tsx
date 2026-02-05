import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, TextInput, Image, ActivityIndicator, 
  Platform, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { db, WALL_TYPE_SPECS, WallType, CONSTRUCTION_HIERARCHY } from '@archlens/shared';
import { collection, query, onSnapshot } from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WallScreen({ route, navigation }: any) {
  const { totalArea, rooms, projectId, tier } = route.params || {};

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  
  // --- UI & MODAL STATE ---
  const [wallType, setWallType] = useState<WallType>('Load Bearing');
  const [materialType, setMaterialType] = useState<string>('All'); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeSelectionKey, setActiveSelectionKey] = useState<'Cement' | 'Sand' | null>(null);
  
  // --- INPUT FIELDS ---
  const defaultHeight = tier === 'Luxury' ? '11' : tier === 'Standard' ? '10.5' : '10';
  const [height, setHeight] = useState(defaultHeight);
  const [thickness, setThickness] = useState('0.75'); 
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
        return sorted[0] || null;
      };

      // Set default Brick if none selected for this wall type
      const brickOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === wallType);
      if (brickOpts.length > 0 && !initialSels['Bricks']) {
        initialSels['Bricks'] = filteredByTier(brickOpts);
      }

      // Set default Cement
      if (!initialSels['Cement']) {
        const cement = materials.find(m => m.type === 'Cement' || m.name?.toLowerCase().includes('cement'));
        if (cement) initialSels['Cement'] = cement;
      }

      // Set default Sand
      if (!initialSels['Sand']) {
        const sand = materials.find(m => m.type === 'Sand' || m.name?.toLowerCase().includes('sand'));
        if (sand) initialSels['Sand'] = sand;
      }

      setSelections(initialSels);
    }
  }, [materials, wallType]);

  // 3. Calculation Engine
  const calculation = useMemo(() => {
    const h = parseFloat(height) || 0;
    const t = parseFloat(thickness) || 0;
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const spec = WALL_TYPE_SPECS[wallType];

    if (h <= 0 || t <= 0) return { brickQty: 0, cementBags: 0, sandKg: 0, totalCost: 0, costBreakdown: { bricks: 0, cement: 0, sand: 0 } };

    let runningLength = (rooms?.length > 0) 
      ? rooms.reduce((acc: number, r: any) => acc + (2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0))), 0)
      : 4 * Math.sqrt(totalArea || 1000);

    const volume = (runningLength * h * t) * (1 - ded);
    const brickQty = Math.round(volume * spec.bricksPerCuFt);
    const dryMortar = (volume * spec.mortarRatio) * 1.45;
    
    const parts = spec.cementMortar + spec.sandMortar;
    const cementBags = Math.ceil((dryMortar / parts * spec.cementMortar) / 1.25);
    const sandKg = Math.round((dryMortar / parts * spec.sandMortar) * 45);

    const bPrice = parseFloat(selections['Bricks']?.pricePerUnit || 0);
    const cPrice = parseFloat(selections['Cement']?.pricePerUnit || 0);
    const sPrice = parseFloat(selections['Sand']?.pricePerUnit || 0);

    const bCost = bPrice * brickQty;
    const cCost = cPrice * cementBags;
    const sandUnit = selections['Sand']?.unit?.toLowerCase() || '';
    const sCost = sandUnit.includes('ton') ? (sPrice * sandKg / 1000) : (sPrice * sandKg / 45);

    return {
      brickQty, cementBags, sandKg,
      brickBrand: selections['Bricks']?.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      sandBrand: selections['Sand']?.name || 'Not Selected',
      mortarMix: `1:${spec.sandMortar}`,
      totalCost: Math.round(bCost + cCost + sCost),
      costBreakdown: { bricks: bCost, cement: cCost, sand: sCost }
    };
  }, [height, thickness, openingDeduction, selections, wallType, totalArea, rooms]);

  // 4. Filtering Logic for horizontal scroll
  const filteredBricks = materials.filter(m => {
    const matchesWall = m.category === 'Wall' && m.subCategory === wallType;
    if (!matchesWall) return false;
    if (materialType === 'All') return true;
    return m.type === materialType;
  });

  const materialTypeOptions = useMemo(() => {
    // @ts-ignore
    const options = CONSTRUCTION_HIERARCHY.Wall.subCategories[wallType] || [];
    return ['All', ...options];
  }, [wallType]);

  const openSelector = (key: 'Cement' | 'Sand') => {
    setActiveSelectionKey(key);
    setIsModalVisible(true);
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
          
          {/* 1. Dimensions Card */}
          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>DIMENSIONS & DEDUCTIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Height (ft)</Text>
                <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Thickness (ft)</Text>
                <TextInput style={styles.input} value={thickness} onChangeText={setThickness} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={[styles.label, {color: '#ef4444'}]}>Openings %</Text>
                <TextInput style={[styles.input, {borderColor: '#fee2e2'}]} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
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
              <Text style={styles.materialQty}>{calculation.sandKg} kg Required</Text>
            </TouchableOpacity>
          </View>

          {/* 6. Summary Result Card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>ESTIMATION SUMMARY</Text>
            <View style={styles.resRow}><Text style={styles.resLabel}>Brick/Block Qty</Text><Text style={styles.resVal}>{calculation.brickQty} Nos</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Cement Qty</Text><Text style={styles.resVal}>{calculation.cementBags} Bags</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Sand Qty</Text><Text style={styles.resVal}>{calculation.sandKg} kg</Text></View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Wall Cost</Text>
              <Text style={styles.totalVal}>₹{calculation.totalCost.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.mainBtn} onPress={() => navigation.navigate('EstimateResult', { projectId, wallData: calculation })}>
          <Text style={styles.mainBtnText}>Update Project Estimate</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
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
                data={materials.filter(m => m.type === activeSelectionKey || m.name?.toLowerCase().includes(activeSelectionKey?.toLowerCase() || ''))}
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