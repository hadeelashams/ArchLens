import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, 
  TextInput, ScrollView, FlatList, ActivityIndicator, Alert, Image 
} from 'react-native';
import { 
  db, createDocument, updateDocument, deleteDocument, 
  CONSTRUCTION_HIERARCHY, MATERIAL_UNITS, WALL_MATERIALS_SEED_DATA
} from '@archlens/shared';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import { Sidebar } from './Sidebar';

const BLUE_ARCH = '#1e293b';

export default function DashboardScreen({ navigation }: any) {
  // --- DATA STATE ---
  const [materials, setMaterials] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSeedingWallMaterials, setIsSeedingWallMaterials] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // --- UI STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUnitPickerVisible, setUnitPickerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- FORM STATE ---
  const [selCategory, setSelCategory] = useState<string | null>(null);
  const [selSubCategory, setSelSubCategory] = useState<string | null>(null); // "Method" e.g., RCC
  const [selIngredient, setSelIngredient] = useState<string | null>(null);   // "Ingredient" e.g., Cement
  
  const [name, setName] = useState(''); 
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<string>('');
  const [grade, setGrade] = useState(''); 
  const [dimensions, setDimensions] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // 1. Fetch Data
  useEffect(() => {
    console.log('📡 Setting up real-time listener for materials...');
    const q = query(collection(db, 'materials'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📥 Received ${snapshot.docs.length} materials from Firestore`);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaterials(data);
      setFilteredMaterials(data);
      setLoading(false);
    }, (error) => {
      console.error('❌ Firestore Listener Error:', error.message);
      Alert.alert('Firestore Error', `Listener failed: ${error.message}`);
    });
    return unsubscribe;
  }, []);

  // 2. Filter Logic
  useEffect(() => {
    let result = materials;
    if (filterCategory !== 'All') result = result.filter(m => m.category === filterCategory);
    if (searchQuery) {
      result = result.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.subCategory && m.subCategory.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredMaterials(result);
  }, [searchQuery, filterCategory, materials]);

  // --- HIERARCHY LOGIC (Robust) ---
  const getSubOptions = (category: string) => {
    if (!category) return [];
    // @ts-ignore
    const root = CONSTRUCTION_HIERARCHY[category]?.subCategories;
    return root ? Object.keys(root) : [];
  };

  const getLeafOptions = (category: string, sub: string) => {
    if (!category || !sub) return [];
    // @ts-ignore
    const root = CONSTRUCTION_HIERARCHY[category]?.subCategories;
    // @ts-ignore
    const leaves = root?.[sub];
    return Array.isArray(leaves) ? leaves : [];
  };

  const isWallCategory = () => selCategory?.toLowerCase().includes('wall');

  // Auto-fill Logic
  const handleIngredientSelect = (ing: string) => {
    setSelIngredient(ing);
    if (!editingId) setName(ing); 
    if (ing.includes('Cement')) setUnit('Bag (50kg)');
    else if (ing.includes('Steel')) setUnit('Kg');
    else if (ing.includes('Sand') || ing.includes('Aggregate')) setUnit('Cubic Feet (cft)');
    else if (ing.includes('Tile') || ing.includes('Granite')) setUnit('Square Feet (sq.ft)');
    else if (ing.includes('Block') || ing.includes('Brick')) setUnit('Nos (Numbers)');
    else setUnit('');
  };

  const handleSave = async () => {
    if (!selCategory || !name || !price || !unit) {
      return Alert.alert("Missing Fields", "Please fill Category, Name, Price, and Unit.");
    }
    setSaveLoading(true);
    try {
      const payload = {
        category: selCategory,
        subCategory: selSubCategory || 'Standard',
        type: selIngredient || 'Standard',
        name: name.trim(),
        pricePerUnit: parseFloat(price),
        unit: unit.trim(),
        grade: grade.trim(),
        dimensions: dimensions.trim(),
        imageUrl: imageUrl.trim(),
        updatedAt: serverTimestamp()
      };
      
      console.log('📤 Attempting to save material:', payload);
      
      let savedId = null;
      if (editingId) {
        await updateDocument('materials', editingId, payload);
        savedId = editingId;
        console.log('✅ Material updated:', editingId);
      } else {
        savedId = await createDocument('materials', payload);
        console.log('✅ Material created with ID:', savedId);
      }
      
      // Wait briefly for real-time listener to update
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      
      // Auto-close modal after successful save
      setTimeout(() => { 
        setModalVisible(false); 
        resetForm(); 
      }, 1200);
    } catch (e: any) { 
      console.error('❌ Save Error Details:', {
        message: e.message,
        code: e.code,
        fullError: e
      });
      Alert.alert("Save Failed ❌", `${e.message || 'Unknown error'}\n\nCheck console for details.`); 
    }
    setSaveLoading(false);
  };

  const resetForm = () => {
    setEditingId(null); setSelCategory(null); setSelSubCategory(null); setSelIngredient(null);
    setName(''); setPrice(''); setUnit(''); setGrade(''); setDimensions(''); setImageUrl('');
  };

  // ===== SEED WALL MATERIALS FUNCTION =====
  const handleSeedWallMaterials = async () => {
    console.log('🔘 Seed button clicked!');
    console.log('WALL_MATERIALS_SEED_DATA available:', !!WALL_MATERIALS_SEED_DATA);
    console.log('Data length:', WALL_MATERIALS_SEED_DATA?.length);
    setShowSeedConfirm(true);
  };

  const confirmSeed = async () => {
    setShowSeedConfirm(false);
    console.log('Starting seed process...');
    setIsSeedingWallMaterials(true);
    await seedMaterials();
  };

  const seedMaterials = async () => {
    try {
      console.log('📝 Creating batch write...');
      console.log('Materials to seed:', WALL_MATERIALS_SEED_DATA.length);
      
      const batch = writeBatch(db);
      let count = 0;

      for (const material of WALL_MATERIALS_SEED_DATA) {
        const ref = doc(collection(db, 'materials'));
        
        batch.set(ref, {
          ...material,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count++;
      }

      console.log(`✅ Batch ready: ${count} materials`);
      await batch.commit();
      
      console.log('✨ Batch successfully committed to Firestore!');
      setIsSeedingWallMaterials(false);
      
      Alert.alert(
        "✨ Success!",
        `All 19 wall materials have been added!\n\nThey will appear in the list below.`
      );
    } catch (error: any) {
      console.error('❌ Batch Error:', {
        message: error.message,
        code: error.code,
        fullError: error
      });
      setIsSeedingWallMaterials(false);
      Alert.alert("❌ Seed Failed", error.message || "Unknown error occurred");
    }
  };


  const openEdit = (item: any) => {
    setEditingId(item.id); 
    setSelCategory(item.category); 
    setSelSubCategory(item.subCategory);
    setSelIngredient(item.type); 
    setName(item.name); 
    setPrice(item.pricePerUnit.toString());
    setUnit(item.unit); 
    setGrade(item.grade || '');
    setDimensions(item.dimensions || '');
    setImageUrl(item.imageUrl || '');
    setModalVisible(true);
  };

  // Reusable Chips
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
      <Sidebar navigation={navigation} activeRoute="Dashboard" />

      <View style={styles.mainContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Material Rate Master</Text>
            <Text style={styles.subHeaderText}>Manage construction materials, units, and market prices.</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color="#64748b" />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search material..." 
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity 
              style={[styles.secondaryBtn, isSeedingWallMaterials && { opacity: 0.6 }]} 
              onPress={handleSeedWallMaterials}
              disabled={isSeedingWallMaterials}
            >
              {isSeedingWallMaterials ? (
                <ActivityIndicator color="#1e293b" size={18} />
              ) : (
                <>
                  <Feather name="download" size={18} color="#1e293b" />
                  <Text style={[styles.btnText, { color: '#1e293b' }]}>Seed Wall (19)</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.btnText}>Add Material</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CATEGORY TABS */}
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

        {/* SYNC STATUS BAR */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: '#f0fdf4',
          borderRadius: 12,
          marginBottom: 15,
          borderLeftWidth: 4,
          borderLeftColor: '#10b981'
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
          <Text style={{ fontSize: 12, color: '#166534', fontWeight: '500' }}>
            🔄 Real-time sync active • {materials.length} materials loaded
          </Text>
        </View>

        {/* DATA TABLE */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>MATERIAL NAME</Text>
            <Text style={[styles.th, { flex: 2 }]}>HIERARCHY (CAT / SUB)</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>PRICE DETAILS</Text>
            <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>ACTIONS</Text>
          </View>

          {loading ? <ActivityIndicator size="large" color={BLUE_ARCH} style={{marginTop: 50}} /> : (
            <FlatList
              data={filteredMaterials}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.tr}>
                  
                  {/* COLUMN 1: IMAGE + NAME + SPECS */}
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.tableImageContainer}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.tableImage} />
                      ) : (
                        <Feather name="box" size={16} color="#cbd5e1" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.tdName}>{item.name}</Text>
                      {/* Show Grade or Dimensions if available */}
                      {item.grade ? <Text style={styles.tdSpec}>Spec: {item.grade}</Text> : null}
                      {item.dimensions ? <Text style={styles.tdDim}>Size: {item.dimensions}</Text> : null}
                    </View>
                  </View>
                  
                  {/* COLUMN 2: HIERARCHY (The Fix you wanted) */}
                  <View style={{ flex: 2, justifyContent: 'center' }}>
                    {/* 1. Category Pill */}
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.category}</Text>
                    </View>
                    
                    {/* 2. SubCategory > Type (Logic Restored) */}
                    <Text style={styles.subText} numberOfLines={1}>
                      {item.subCategory} 
                      {/* Check if 'type' exists and is not same as subCat or 'Standard' */}
                      {item.type && item.type !== 'Standard' && item.type !== item.subCategory 
                        ? ` › ${item.type}` 
                        : ''}
                    </Text>
                  </View>
                  
                  {/* COLUMN 3: PRICE */}
                  <Text style={styles.tdPrice}>
                    ₹{item.pricePerUnit} 
                    <Text style={styles.unitText}> / {item.unit}</Text>
                  </Text>
                  
                  {/* COLUMN 4: ACTIONS */}
                  <View style={styles.actionCell}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                      <Feather name="edit-2" size={16} color={BLUE_ARCH} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDocument('materials', item.id)} style={styles.iconBtn}>
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* MODAL */}
      <Modal visible={isModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Material' : 'Add New Material'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              
              <SelectorGroup 
                label="1. Root Category" 
                options={Object.keys(CONSTRUCTION_HIERARCHY)} 
                selected={selCategory} 
                onSelect={(val: string) => { setSelCategory(val); setSelSubCategory(null); setSelIngredient(null); }} 
              />
              
              {selCategory && (
                <SelectorGroup 
                  label="2. Classification / Method" 
                  options={getSubOptions(selCategory)} 
                  selected={selSubCategory} 
                  onSelect={(val: string) => { setSelSubCategory(val); setSelIngredient(null); }} 
                />
              )}
              
              {selCategory && selSubCategory && getLeafOptions(selCategory, selSubCategory).length > 0 && (
                <SelectorGroup 
                  label="3. Material Type" 
                  options={getLeafOptions(selCategory, selSubCategory)} 
                  selected={selIngredient} 
                  onSelect={handleIngredientSelect} 
                />
              )}

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Material Details</Text>
                
                <View style={{ marginBottom: 15 }}>
                  <Text style={styles.label}>Product Display Name</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="e.g. Ultratech PPC Cement" 
                    value={name} 
                    onChangeText={setName} 
                  />
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.label}>Specification / Grade</Text>
                     <TextInput 
                       style={styles.input} 
                       placeholder="e.g. 53 Grade, Fe550" 
                       value={grade} 
                       onChangeText={setGrade} 
                     />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Image URL</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="https://..." 
                      value={imageUrl} 
                      onChangeText={setImageUrl} 
                    />
                  </View>
                </View>

                {isWallCategory() && (
                  <View style={{ marginTop: 15 }}>
                     <Text style={[styles.label, {color: '#d97706'}]}>Block Dimensions</Text>
                     <TextInput 
                       style={[styles.input, { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]} 
                       placeholder="L x W x H (inches)" 
                       value={dimensions} 
                       onChangeText={setDimensions} 
                     />
                  </View>
                )}

                <View style={[styles.row, { marginTop: 15 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Market Price (₹)</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="0.00" 
                      keyboardType="numeric" 
                      value={price} 
                      onChangeText={setPrice} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Unit (Strict Selection)</Text>
                    {/* Unit Picker - Force selection from predefined list for consistency */}
                    <TouchableOpacity 
                      style={[styles.input, { justifyContent: 'center', paddingVertical: 0 }]}
                      onPress={() => setUnitPickerVisible(true)}
                    >
                      <Text style={{ color: unit ? '#1e293b' : '#a0aec0', fontSize: 16 }}>
                        {unit || 'Select Unit...'}
                      </Text>
                    </TouchableOpacity>
                    {/* Unit Selection Modal */}
                    <Modal visible={isUnitPickerVisible} animationType="fade" transparent onRequestClose={() => setUnitPickerVisible(false)}>
                      <View style={styles.pickerOverlay}>
                        <View style={styles.pickerContent}>
                          <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Select Unit</Text>
                            <TouchableOpacity onPress={() => setUnitPickerVisible(false)}>
                              <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                          </View>
                          <FlatList
                            data={MATERIAL_UNITS}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                              <TouchableOpacity 
                                style={[styles.pickerItem, unit === item && styles.pickerItemActive]}
                                onPress={() => {
                                  setUnit(item);
                                  setUnitPickerVisible(false);
                                }}
                              >
                                <Text style={[styles.pickerItemText, unit === item && styles.pickerItemTextActive]}>
                                  {item}
                                </Text>
                              </TouchableOpacity>
                            )}
                          />
                        </View>
                      </View>
                    </Modal>
                  </View>
                </View>
              </View>

            </ScrollView>

            {/* SAVE BUTTON WITH FEEDBACK */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity 
                style={[
                  styles.saveBtn, 
                  saveLoading && { opacity: 0.6 },
                  saveSuccess && { backgroundColor: '#10b981' }
                ]} 
                onPress={handleSave} 
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.saveBtnText}>Saving...</Text>
                  </View>
                ) : saveSuccess ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.saveBtnText}>✅ Saved!</Text>
                  </View>
                ) : (
                  <Text style={styles.saveBtnText}>💾 Save Material</Text>
                )}
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                Data syncs to Firestore automatically
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* SEED CONFIRMATION MODAL */}
      <Modal visible={showSeedConfirm} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 40, width: 500, gap: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>🌱 Seed Wall Materials?</Text>
            <Text style={{ fontSize: 14, color: '#64748b', lineHeight: 20 }}>
              This will add all 19 wall materials (bricks, blocks, cement, sand) to Firestore.
            </Text>
            
            <View style={{ backgroundColor: '#f0fdf4', padding: 15, borderRadius: 12, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>✓ 3 brick types (load bearing)</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>✓ 4 concrete blocks (load bearing)</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>✓ 2 natural stones</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>✓ 4 partition blocks (AAC+Hollow)</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>✓ 6 mortar materials (Cement+Sand)</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center' }}
                onPress={() => setShowSeedConfirm(false)}
              >
                <Text style={{ fontWeight: '600', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' }}
                onPress={confirmSeed}
                disabled={isSeedingWallMaterials}
              >
                {isSeedingWallMaterials ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Seed Now 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f0f4f8' },
  mainContent: { flex: 1, padding: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  subHeaderText: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, width: 340, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 14, outlineStyle: 'none', color: '#1e293b' } as any,
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE_ARCH, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, gap: 8, borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow: { marginBottom: 24, height: 44 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4 },
  filterChipActive: { backgroundColor: BLUE_ARCH, borderColor: BLUE_ARCH },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  
  // Table Styles
  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', minHeight: 72 },
  
  tableImageContainer: { width: 48, height: 48, borderRadius: 11, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  tableImage: { width: '100%', height: '100%' },

  tdName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  tdSpec: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },
  tdDim: { fontSize: 12, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  tdPrice: { flex: 1.5, fontSize: 17, fontWeight: '800', color: '#10b981' },
  unitText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  
  // HIERARCHY STYLES
  badge: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, marginBottom: 7 },
  badgeText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  subText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  
  actionCell: { flex: 0.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  iconBtn: { padding: 10, borderRadius: 9, backgroundColor: '#f1f5f9' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: 700, borderRadius: 28, padding: 40, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  
  formSection: { marginTop: 10, paddingTop: 22, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1.2 },
  
  selectorContainer: { marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 10 },
  chipScroll: { gap: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#f8fafc', borderRadius: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: BLUE_ARCH, borderColor: BLUE_ARCH },
  chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 14, outlineStyle: 'none', color: '#1e293b' } as any,
  row: { flexDirection: 'row', gap: 16 },
  miniChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 6 },
  miniChipText: { fontSize: 11, color: '#64748b' },

  saveBtn: { backgroundColor: BLUE_ARCH, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Unit Picker Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { backgroundColor: '#fff', width: 420, borderRadius: 18, maxHeight: '70%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  pickerItem: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemActive: { backgroundColor: '#f0f4f8' },
  pickerItemText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  pickerItemTextActive: { color: BLUE_ARCH, fontWeight: '700' },
});