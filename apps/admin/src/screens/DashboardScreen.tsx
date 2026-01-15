import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, 
  TextInput, ScrollView, Platform, Dimensions, FlatList, ActivityIndicator, Alert 
} from 'react-native';
import { db, createDocument, updateDocument, deleteDocument, CONSTRUCTION_HIERARCHY } from '@archlens/shared';
import { collection, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '@archlens/shared';

const { width } = Dimensions.get('window');
const BLUE_ARCH = '#2b3348';
const BG_LIGHT = '#ffffff';

export default function DashboardScreen() {
  // --- DATA STATE ---
  const [materials, setMaterials] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // --- UI STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- FORM STATE ---
  const [selCategory, setSelCategory] = useState<string | null>(null);
  const [selSubCategory, setSelSubCategory] = useState<string | null>(null);
  const [selType, setSelType] = useState<string | null>(null);
  
  // Inputs
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  
  // FIX: New State for Wall Dimensions
  const [dimensions, setDimensions] = useState(''); 

  // 1. Fetch Data
  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaterials(data);
      setFilteredMaterials(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 2. Filter Logic
  useEffect(() => {
    let result = materials;
    if (filterCategory !== 'All') {
      result = result.filter(m => m.category === filterCategory);
    }
    if (searchQuery) {
      result = result.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.subCategory && m.subCategory.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredMaterials(result);
  }, [searchQuery, filterCategory, materials]);

  // --- FIXED HIERARCHY PARSERS ---

  /**
   * FIX: Universal parser that doesn't rely on specific keys like 'styles' or 'classifications'.
   * It attempts to find any object-based children to populate the Sub-Category list.
   */
  const getSubOptions = (category: string) => {
    if (!category) return [];
    const root = CONSTRUCTION_HIERARCHY[category as keyof typeof CONSTRUCTION_HIERARCHY];
    if (!root) return [];

    // 1. Check known keys (Priority)
    if ('classifications' in root) return Object.keys(root.classifications);
    if ('styles' in root) return Object.keys(root.styles);
    if ('types' in root && !Array.isArray(root.types)) return Object.keys(root.types);
    if ('areas' in root) return Object.keys(root.areas);

    // 2. Fallback: Return any top-level keys that are objects (Generic Handler)
    return Object.keys(root).filter(key => {
      const val = (root as any)[key];
      return typeof val === 'object' && val !== null;
    });
  };

  /**
   * FIX: Universal leaf parser. It digs into the sub-category to find the list of types.
   * Handles both Arrays (simple lists) and Objects (complex definitions).
   */
  const getLeafOptions = (category: string, sub: string) => {
    if (!category || !sub) return [];
    const root = CONSTRUCTION_HIERARCHY[category as keyof typeof CONSTRUCTION_HIERARCHY] as any;
    if (!root) return [];

    // Find the specific sub-node
    let subNode = 
      root.classifications?.[sub] || 
      root.styles?.[sub] || 
      root.areas?.[sub] || 
      root.finishingTypes?.[sub] ||
      root.types?.[sub] ||
      root[sub]; // Generic fallback

    if (!subNode) return [];

    // If it's an Array, return it directly
    if (Array.isArray(subNode)) return subNode;
    
    // If it's an object with a 'types' array
    if (subNode.types && Array.isArray(subNode.types)) return subNode.types;

    // If it's an object, return its keys
    if (typeof subNode === 'object') return Object.keys(subNode);

    return [];
  };

  // Helper to check if current category needs dimensions
  const isWallCategory = () => {
    return selCategory?.toLowerCase().includes('wall');
  };

  // 3. CRUD Operations
  const handleSave = async () => {
    if (!selCategory || !name || !price) {
      Alert.alert("Missing Fields", "Please fill Category, Name, and Price.");
      return;
    }

    if (isWallCategory() && !dimensions) {
      Alert.alert("Missing Dimension", "Wall materials require dimensions (LxWxH) for volume calculation.");
      return;
    }

    // FIX: Hierarchy Depth Logic
    // If hierarchy is shallow (Foundation), 'selType' might be null. 
    // We use 'selSubCategory' as the type in that case to avoid empty fields.
    const finalType = selType || selSubCategory || 'Standard';

    const payload = {
      category: selCategory,
      subCategory: selSubCategory || '',
      type: finalType, 
      name: name.trim(),
      pricePerUnit: parseFloat(price),
      unit: unit.trim(),
      // FIX: Save dimensions for walls
      dimensions: isWallCategory() ? dimensions.trim() : null, 
      updatedAt: serverTimestamp()
    };

    setSaveLoading(true);
    try {
      if (editingId) {
        await updateDocument('materials', editingId, payload);
      } else {
        await createDocument('materials', payload);
      }
      setModalVisible(false);
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web') {
      if (confirm("Delete this material?")) await deleteDocument('materials', id);
    } else {
      Alert.alert("Delete", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteDocument('materials', id) }
      ]);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelCategory(null); setSelSubCategory(null); setSelType(null);
    setName(''); setPrice(''); setUnit(''); setDimensions('');
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setSelCategory(item.category);
    setSelSubCategory(item.subCategory);
    setSelType(item.type);
    setName(item.name);
    setPrice(item.pricePerUnit.toString());
    setUnit(item.unit);
    setDimensions(item.dimensions || '');
    setModalVisible(true);
  };

  const SelectorGroup = ({ label, options, selected, onSelect }: any) => {
    if (!options || options.length === 0) return null;
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.label}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {options.map((opt: string) => (
            <TouchableOpacity 
              key={opt} 
              style={[styles.chip, selected === opt && styles.chipActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.chipText, selected === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      
      {/* SIDEBAR */}
      <View style={styles.sidebar}>
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>ARCH LENS</Text>
          <Text style={styles.logoSub}>ADMIN CONSOLE</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
          <MaterialIcons name="logout" size={20} color="#cbd5e1" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.mainContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Material Rate Master</Text>
          <View style={styles.headerActions}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color="#64748b" />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search materials..." 
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.btnText}>Add Material</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['All', ...Object.keys(CONSTRUCTION_HIERARCHY)].map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.filterChip, filterCategory === cat && styles.filterChipActive]}
                onPress={() => setFilterCategory(cat)}
              >
                <Text style={[styles.filterText, filterCategory === cat && { color: '#fff' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Data Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>MATERIAL</Text>
            <Text style={[styles.th, { flex: 2 }]}>HIERARCHY (Cat / Sub)</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>PRICE DETAILS</Text>
            <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>EDIT</Text>
          </View>

          {loading ? <ActivityIndicator style={{ margin: 50 }} size="large" color={BLUE_ARCH} /> : (
            <FlatList
              data={filteredMaterials}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.tr}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.td, { fontWeight: '600', color: '#1e293b' }]}>{item.name}</Text>
                    {/* Display Dimensions if available */}
                    {item.dimensions && (
                       <Text style={{fontSize: 11, color: '#64748b'}}>Dim: {item.dimensions} (in)</Text>
                    )}
                  </View>
                  
                  <View style={{ flex: 2 }}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{item.category}</Text></View>
                    <Text style={styles.subText}>
                      {item.subCategory} {item.type !== item.subCategory ? `› ${item.type}` : ''}
                    </Text>
                  </View>
                  
                  <Text style={[styles.td, { flex: 1.5, fontWeight: 'bold', color: '#059669' }]}>
                    ₹{item.pricePerUnit} <Text style={{fontSize: 10, color: '#94a3b8'}}>/{item.unit}</Text>
                  </Text>
                  
                  <View style={[styles.td, { flex: 0.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 15 }]}>
                    <TouchableOpacity onPress={() => openEdit(item)}><Feather name="edit-2" size={18} color={BLUE_ARCH} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)}><Feather name="trash-2" size={18} color="#ef4444" /></TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* --- ADD/EDIT MODAL --- */}
      <Modal visible={isModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Material' : 'New Material'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={24} color="#64748b" /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
              {/* 1. Root Category */}
              <SelectorGroup 
                label="1. Root Category" 
                options={Object.keys(CONSTRUCTION_HIERARCHY)} 
                selected={selCategory} 
                onSelect={(val: string) => {
                  setSelCategory(val); setSelSubCategory(null); setSelType(null);
                }} 
              />

              {/* 2. Sub-Category Selector */}
              {selCategory && (
                <SelectorGroup 
                  label="2. Classification" 
                  options={getSubOptions(selCategory)} 
                  selected={selSubCategory} 
                  onSelect={(val: string) => {
                    setSelSubCategory(val); setSelType(null);
                  }} 
                />
              )}

              {/* 3. Type Selector */}
              {/* Only show if options exist. Foundation might not have this layer. */}
              {selCategory && selSubCategory && getLeafOptions(selCategory, selSubCategory).length > 0 && (
                <SelectorGroup 
                  label="3. Specific Type" 
                  options={getLeafOptions(selCategory, selSubCategory)} 
                  selected={selType} 
                  onSelect={setSelType} 
                />
              )}

              {/* 4. Details */}
              <Text style={styles.label}>4. Material Details</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Material Name (e.g. Red Brick / 20mm Aggregates)" 
                value={name} 
                onChangeText={setName} 
              />
              
              {/* FIX: Conditional Wall Dimensions Input */}
              {isWallCategory() && (
                <View style={{ marginTop: 10 }}>
                   <Text style={[styles.label, {color: '#d97706'}]}>Wall Block Size (L x W x H)</Text>
                   <TextInput 
                     style={[styles.input, { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]} 
                     placeholder="e.g. 9 x 4 x 3 (Inches)" 
                     value={dimensions} 
                     onChangeText={setDimensions} 
                   />
                   <Text style={{fontSize: 11, color: '#94a3b8', marginTop: 4}}>Required for wall volume calculation.</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 15, marginTop: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (₹)</Text>
                  <TextInput style={styles.input} placeholder="0.00" keyboardType="numeric" value={price} onChangeText={setPrice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput style={styles.input} placeholder="e.g. Bag, Nos, Cft" value={unit} onChangeText={setUnit} />
                </View>
              </View>

            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saveLoading}>
              {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Material</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: BG_LIGHT },
  sidebar: { width: 180, backgroundColor: BLUE_ARCH, paddingVertical: 30, paddingHorizontal: 20, justifyContent: 'space-between' },
  logoArea: { marginBottom: 40 },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  logoSub: { color: '#94a3b8', fontSize: 12, marginTop: 5, letterSpacing: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  logoutText: { color: '#cbd5e1', marginLeft: 12 },

  mainContent: { flex: 1, padding: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
  headerActions: { flexDirection: 'row', gap: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 15, width: 300, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, outlineStyle: 'none' } as any,
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE_ARCH, paddingHorizontal: 20, borderRadius: 8, gap: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },

  filterRow: { marginBottom: 20, height: 40 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: BLUE_ARCH, borderColor: BLUE_ARCH },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' } as any,
  td: { fontSize: 14, color: '#334155' },
  badge: { backgroundColor: '#e0f2fe', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
  badgeText: { color: '#0369a1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  subText: { fontSize: 12, color: '#94a3b8' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: 600, borderRadius: 16, padding: 30, maxHeight: '95%', ...Platform.select({ web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } }) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  
  selectorContainer: { marginBottom: 20 },
  chipScroll: { gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: BLUE_ARCH, borderColor: BLUE_ARCH },
  chipText: { fontSize: 13, color: '#475569' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, outlineStyle: 'none' } as any,
  
  saveBtn: { backgroundColor: BLUE_ARCH, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});