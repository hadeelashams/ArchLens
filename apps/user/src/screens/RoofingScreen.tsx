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
  CONSTRUCTION_HIERARCHY, 
  auth, 
  createDocument, 
} from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const SQ_FT_TO_SQ_M = 0.092903;
const WATERPROOFING_COVERAGE_SQ_M = 10; // 10 sq.m per unit

export default function RoofingScreen({ route, navigation }: any) {
  const { totalArea, projectId, tier } = route.params || {};

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  
  // --- UI & MODAL STATE ---
  const [materialType, setMaterialType] = useState<string>('All'); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeSelectionKey, setActiveSelectionKey] = useState<'Concrete' | 'Waterproofing' | null>(null);
  
  // --- INPUT FIELDS ---
  const [roofingArea, setRoofingArea] = useState(String(totalArea || 1000));
  const [slabThickness, setSlabThickness] = useState('150'); // Slab thickness in mm
  const [openingDeduction, setOpeningDeduction] = useState('5');

  // 1. Fetch Materials
  useEffect(() => {
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 2. Default Selections
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

      // Set default Concrete & Waterproofing
      if (!initialSels['Concrete']) {
        initialSels['Concrete'] = filteredByTier(materials.filter(m => m.type === 'Concrete' || m.category === 'Roofing'));
      }
      if (!initialSels['Waterproofing']) {
        initialSels['Waterproofing'] = filteredByTier(materials.filter(m => m.type === 'Waterproofing'));
      }

      setSelections(initialSels);
    }
  }, [materials, tier]);

  // 3. Calculation Engine
  const calculation = useMemo(() => {
    const area_sqft = parseFloat(roofingArea) || 0;
    const slab_mm = parseFloat(slabThickness) || 0;
    const ded = (parseFloat(openingDeduction) || 0) / 100;
    const selectedConcrete = selections['Concrete'];

    if (area_sqft <= 0 || slab_mm <= 0 || !selectedConcrete) 
      return { concreteQty: 0, waterproofingQty: 0, totalCost: 0, costBreakdown: { concrete: 0, waterproofing: 0 }, concreteBrand: 'Not Selected', waterproofingBrand: 'Not Selected' };

    // --- 1. Concrete Volume Calculation ---
    const area_sqm = area_sqft * SQ_FT_TO_SQ_M * (1 - ded);
    const slab_m = slab_mm / 1000;
    const concreteVol_m3 = area_sqm * slab_m;
    const concreteQty = Math.round(concreteVol_m3 * 10) / 10; // Rounded to 1 decimal

    // --- 2. Waterproofing Quantity ---
    const waterproofingQty = Math.ceil(area_sqm / WATERPROOFING_COVERAGE_SQ_M);

    // --- 3. Cost Calculation ---
    const cPrice = parseFloat(selections['Concrete']?.pricePerUnit || 0);
    const wPrice = parseFloat(selections['Waterproofing']?.pricePerUnit || 0);

    const cCost = Math.round(cPrice * concreteQty);
    const wCost = Math.round(wPrice * waterproofingQty);
    
    return {
      concreteQty,
      waterproofingQty,
      concreteBrand: selectedConcrete.name || 'Not Selected',
      waterproofingBrand: selections['Waterproofing']?.name || 'Not Selected',
      totalCost: Math.round(cCost + wCost),
      costBreakdown: { concrete: cCost, waterproofing: wCost }
    };
  }, [roofingArea, slabThickness, openingDeduction, selections]);

  // 4. Save Logic
  const handleSaveRoofingEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    if (!projectId) return Alert.alert("Error", "Project ID not found.");
    if (calculation.totalCost === 0) return Alert.alert("Error", "Cost is zero. Check dimensions and material selections.");

    setSaving(true);
    try {
      const lineItems = [
        { name: calculation.concreteBrand || 'Not Selected', desc: 'RCC Concrete', qty: calculation.concreteQty, unit: 'cum', total: calculation.costBreakdown.concrete, rate: selections['Concrete']?.pricePerUnit || 0 },
        { name: calculation.waterproofingBrand || 'Not Selected', desc: 'Waterproofing', qty: calculation.waterproofingQty, unit: 'Nos', total: calculation.costBreakdown.waterproofing, rate: selections['Waterproofing']?.pricePerUnit || 0 },
      ];
      
      // Sanitize data to remove undefined values
      const estimateData = {
        projectId: projectId || '',
        userId: auth.currentUser!.uid,
        itemName: 'Roofing & Slab',
        category: 'Roofing',
        totalCost: calculation.totalCost || 0, 
        lineItems: lineItems.filter(item => item.name !== undefined),
        specifications: {
          area: `${roofingArea} sq.ft`,
          slabThickness: `${slabThickness} mm`,
          deduction: `${openingDeduction}%`,
        },
        createdAt: serverTimestamp()
      };
      
      await createDocument('estimates', estimateData);
      
      Alert.alert("Success", "Roofing Estimate saved successfully to project summary.");
      navigation.navigate('ProjectSummary', { projectId }); 
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const materialTypeOptions = ['All', 'Concrete', 'Waterproofing'];

  const openSelector = (key: 'Concrete' | 'Waterproofing') => {
    setActiveSelectionKey(key);
    setIsModalVisible(true);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesCategory = m.category === 'Roofing' || m.type === 'Concrete' || m.type === 'Waterproofing';
    if (!matchesCategory) return false;
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
          <Text style={styles.headerTitle}>{tier} Roofing Setup</Text>
          <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          {/* 1. Dimensions Card */}
          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>ROOFING DIMENSIONS & SPECIFICATIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Roofing Area (sq.ft)</Text>
                <TextInput style={styles.input} value={roofingArea} onChangeText={setRoofingArea} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Slab Thickness (mm)</Text>
                <TextInput style={styles.input} value={slabThickness} onChangeText={setSlabThickness} keyboardType="decimal-pad" />
              </View>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={styles.inputBox}>
                <Text style={[styles.label, {color: '#ef4444'}]}>Openings %</Text>
                <TextInput style={[styles.input, {borderColor: '#fee2e2'}]} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
              </View>
            </View>
          </View>

          {/* 2. Material Type Filter */}
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

          {/* 3. Horizontal Material Selection */}
          <Text style={styles.sectionLabel}>SELECT SPECIFIC MATERIALS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll}>
            {filteredMaterials.length > 0 ? filteredMaterials.map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.brandCard, selections['Concrete']?.id === item.id && styles.activeBrand]} 
                onPress={() => setSelections({...selections, 'Concrete': item})}
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

          {/* 4. Roofing Materials Selectors */}
          <Text style={styles.sectionLabel}>ROOFING MATERIALS</Text>
          <View style={styles.materialGrid}>
            <TouchableOpacity style={styles.materialCard} onPress={() => openSelector('Concrete')}>
              <Text style={styles.materialLabel}>Concrete</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{calculation.concreteBrand}</Text>
                <Ionicons name="chevron-down" size={14} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.concreteQty} cum Required</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.materialCard} onPress={() => openSelector('Waterproofing')}>
              <Text style={styles.materialLabel}>Waterproofing</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{calculation.waterproofingBrand}</Text>
                <Ionicons name="chevron-down" size={14} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.waterproofingQty} Nos Required</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Summary Result Card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>ESTIMATION SUMMARY</Text>
            <View style={styles.resRow}><Text style={styles.resLabel}>Concrete Qty (cum)</Text><Text style={styles.resVal}>{calculation.concreteQty} cum</Text></View>
            <View style={styles.resRow}><Text style={styles.resLabel}>Waterproofing Qty</Text><Text style={styles.resVal}>{calculation.waterproofingQty} Nos</Text></View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Roofing Cost</Text>
              <Text style={styles.totalVal}>₹{calculation.totalCost.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={styles.mainBtn} 
          onPress={handleSaveRoofingEstimate}
          disabled={saving || calculation.totalCost === 0}
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

        {/* Selection Modal */}
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
                data={materials.filter(m => m.type === activeSelectionKey || m.category === activeSelectionKey)}
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
