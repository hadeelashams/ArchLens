import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal, 
  TextInput, Dimensions, ActivityIndicator, Platform, ScrollView 
} from 'react-native';
import { auth, db, createDocument, updateDocument, deleteDocument } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function DashboardScreen() {
  const [groupedMaterials, setGroupedMaterials] = useState<any>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [qtyPerSqFt, setQtyPerSqFt] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('category', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flatData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTotalCount(flatData.length);

      const grouped = flatData.reduce((acc: any, item: any) => {
        const cat = item.category || 'Uncategorized';
        const typ = item.type || 'General';
        if (!acc[cat]) acc[cat] = {};
        if (!acc[cat][typ]) acc[cat][typ] = [];
        acc[cat][typ].push(item);
        return acc;
      }, {});

      setGroupedMaterials(grouped);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    if (isWeb) {
      if (window.confirm("Logout from Admin Panel?")) await signOut(auth);
      return;
    }
    Alert.alert("Logout", "Sign out?", [{ text: "Cancel" }, { text: "Logout", onPress: () => signOut(auth) }]);
  };

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setCategory(item.category);
      setType(item.type);
      setName(item.name);
      setPrice(item.pricePerUnit.toString());
      setUnit(item.unit);
      setQtyPerSqFt(item.quantityPerSqFt.toString());
    } else {
      setEditingId(null);
      setCategory(''); setType(''); setName(''); setPrice(''); setUnit(''); setQtyPerSqFt('');
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!category || !type || !name || !price || !unit || !qtyPerSqFt) return Alert.alert("Error", "Fill all fields");

    const materialData = {
      category: category.trim(),
      type: type.trim(),
      name: name.trim(),
      pricePerUnit: parseFloat(price),
      unit: unit.trim(),
      quantityPerSqFt: parseFloat(qtyPerSqFt),
      updatedAt: serverTimestamp()
    };

    setSaveLoading(true);
    try {
      if (editingId) await updateDocument('materials', editingId, materialData);
      else await createDocument('materials', materialData);
      setModalVisible(false);
    } catch (e) { Alert.alert("Error", "Save failed"); }
    finally { setSaveLoading(false); }
  };

  return (
    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.centerContainer}>
      <View style={styles.responsiveContent}>
        
        {/* TOP STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{totalCount}</Text>
            <Text style={styles.statLab}>Total Materials</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{Object.keys(groupedMaterials).length}</Text>
            <Text style={styles.statLab}>Categories</Text>
          </View>
          <TouchableOpacity style={[styles.statCard, styles.addStatCard]} onPress={() => openModal()}>
            <MaterialIcons name="add-circle" size={32} color="white" />
            <Text style={styles.addStatText}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, styles.logoutStatCard]} onPress={handleLogout}>
            <MaterialIcons name="power-settings-new" size={24} color="#ef4444" />
            <Text style={styles.logoutStatText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Material Rate Master</Text>

        {loading ? <ActivityIndicator size="large" color="#0d9488" /> : (
          Object.keys(groupedMaterials).map((catName) => (
            <View key={catName} style={styles.categoryCard}>
              <LinearGradient colors={['#315b76', '#4a7a96']} style={styles.catHeader}>
                <Text style={styles.catTitle}>{catName.toUpperCase()}</Text>
              </LinearGradient>

              {Object.keys(groupedMaterials[catName]).map((typeName) => (
                <View key={typeName} style={styles.typeBox}>
                  <Text style={styles.typeTitle}>{typeName}</Text>
                  
                  {/* DATA TABLE HEADERS */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.hText, {flex: 3}]}>Material Name</Text>
                    <Text style={[styles.hText, {flex: 1}]}>Unit</Text>
                    <Text style={[styles.hText, {flex: 1}]}>Rate</Text>
                    <Text style={[styles.hText, {flex: 1, textAlign: 'right'}]}>Actions</Text>
                  </View>

                  {groupedMaterials[catName][typeName].map((item: any) => (
                    <View key={item.id} style={styles.row}>
                      <Text style={[styles.rText, {flex: 3, fontWeight: '600'}]}>{item.name}</Text>
                      <Text style={[styles.rText, {flex: 1}]}>{item.unit}</Text>
                      <Text style={[styles.rText, {flex: 1, color: '#0d9488', fontWeight: 'bold'}]}>₹{item.pricePerUnit}</Text>
                      <View style={styles.rowActions}>
                        <TouchableOpacity onPress={() => openModal(item)}><MaterialIcons name="edit" size={20} color="#315b76" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteDocument('materials', item.id)}><MaterialIcons name="delete" size={20} color="#ef4444" /></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {/* MODAL (Responsive Width) */}
      <Modal visible={isModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Material' : 'Add New Material'}</Text>
            <TextInput style={styles.input} placeholder="Category (e.g. Wall)" value={category} onChangeText={setCategory} />
            <TextInput style={styles.input} placeholder="Type (e.g. Brick)" value={type} onChangeText={setType} />
            <TextInput style={styles.input} placeholder="Material Name" value={name} onChangeText={setName} />
            <View style={{flexDirection: 'row', gap: 10}}>
              <TextInput style={[styles.input, {flex: 1}]} placeholder="Rate" value={price} onChangeText={setPrice} keyboardType="numeric" />
              <TextInput style={[styles.input, {flex: 1}]} placeholder="Unit" value={unit} onChangeText={setUnit} />
            </View>
            <TextInput style={styles.input} placeholder="Qty Constant (e.g. 0.45)" value={qtyPerSqFt} onChangeText={setQtyPerSqFt} keyboardType="numeric" />
            
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saveLoading}>
                {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: 'bold'}}>Save Material</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainScroll: { flex: 1, backgroundColor: '#f0f4f8' },
  centerContainer: { alignItems: 'center', paddingVertical: 20 },
  responsiveContent: { 
    width: isWeb ? 1100 : width * 0.95, // Center content on Web
    paddingHorizontal: isWeb ? 20 : 5 
  },
  
  // Stats Row
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
  statCard: { 
    flex: 1, minWidth: isWeb ? 200 : '45%', 
    backgroundColor: '#fff', padding: 20, borderRadius: 16, 
    elevation: 4, alignItems: 'center', justifyContent: 'center' 
  },
  statVal: { fontSize: 24, fontWeight: 'bold', color: '#315b76' },
  statLab: { fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: '600' },
  addStatCard: { backgroundColor: '#315b76' },
  addStatText: { color: '#fff', fontWeight: 'bold', marginTop: 5 },
  logoutStatCard: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  logoutStatText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12, marginTop: 5 },

  sectionHeader: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20, marginLeft: 5 },
  
  // Category Cards
  categoryCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 25, elevation: 3 },
  catHeader: { padding: 15 },
  catTitle: { color: '#fff', fontWeight: 'bold', letterSpacing: 1, fontSize: 14 },
  
  typeBox: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  typeTitle: { fontSize: 16, fontWeight: 'bold', color: '#315b76', marginBottom: 10 },

  // Table Styles
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 },
  hText: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' },
  row: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  rText: { fontSize: 14, color: '#334155' },
  rowActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },

  // Modal Responsive
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: isWeb ? 500 : '90%', borderRadius: 24, padding: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#315b76' },
  input: { borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', padding: 12, marginBottom: 15, fontSize: 15 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { padding: 15 },
  saveBtn: { backgroundColor: '#0d9488', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 }
});