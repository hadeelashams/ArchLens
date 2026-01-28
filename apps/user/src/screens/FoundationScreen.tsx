import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, TextInput, ActivityIndicator, Image 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// Engineering Ratios per 1 Cubic Meter (m3) of Concrete
const RCC_RATIOS = {
  'Cement': 8,           // Bags per m3
  'Steel (TMT Bar)': 90, // kg per m3
  'Sand': 0.42,          // m3 per m3
  'Aggregate': 0.84      // m3 per m3
};

const FT3_TO_M3 = 0.0283168; // Conversion Factor

export default function FoundationScreen({ route, navigation }: any) {
  const { totalArea: passedArea, projectId } = route.params || { totalArea: 0, projectId: null };

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeMethod, setActiveMethod] = useState('RCC'); 
  const area = passedArea || 1000;
  const [depth, setDepth] = useState('4'); 
  const [selections, setSelections] = useState<Record<string, any>>({});

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', '==', 'Foundation'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(data);
      
      const initialSels: any = {};
      data.forEach(m => {
        if (!initialSels[m.type]) initialSels[m.type] = m;
      });
      setSelections(initialSels);
      setLoading(false);
    });
    return unsub;
  }, []);

  // --- NEW VOLUME-BASED CALCULATION ---
  const calculation = useMemo(() => {
    const parsedArea = parseFloat(area.toString()) || 0;
    const parsedDepth = parseFloat(depth) || 0;

    // 1. Calculate Foundation Volume in m3
    const volumeFt3 = parsedArea * parsedDepth;
    const volumeM3 = volumeFt3 * FT3_TO_M3;

    let grandTotal = 0;

    const items = Object.keys(RCC_RATIOS).map(type => {
      const selectedBrand = selections[type];
      
      // 2. Calculate Quantity based on m3 Volume
      // @ts-ignore
      const qty = volumeM3 * RCC_RATIOS[type];
      
      const cost = selectedBrand ? qty * selectedBrand.pricePerUnit : 0;
      grandTotal += cost;
      
      return {
        type,
        qty: qty.toFixed(2),
        unit: selectedBrand?.unit || (type === 'Steel (TMT Bar)' ? 'kg' : 'Bags'),
        brandName: selectedBrand?.name || 'Select Brand',
        cost: Math.round(cost)
      };
    });

    return { 
        items, 
        grandTotal: Math.round(grandTotal), 
        volumeM3: volumeM3.toFixed(2),
        volumeFt3: volumeFt3.toFixed(2)
    };
  }, [activeMethod, area, depth, selections]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation Estimator</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* 1. PROJECT PARAMETERS (Volume Displayed) */}
          <View style={styles.paramsSection}>
            <Text style={styles.sectionLabel}>PROJECT PARAMETERS</Text>
            <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Total Area</Text>
                    <View style={[styles.textInputWrapper, styles.readOnlyField]}>
                        <Text style={styles.readOnlyText}>{area}</Text>
                        <Text style={styles.inputUnit}>sq.ft</Text>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Foundation Depth</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput 
                            style={styles.textInput}
                            value={depth}
                            onChangeText={setDepth}
                            keyboardType="numeric"
                            placeholder="Depth"
                            placeholderTextColor="#94a3b8"
                        />
                        <Text style={styles.inputUnit}>ft</Text>
                    </View>
                </View>
            </View>
            
            <View style={styles.volumeBadge}>
                <MaterialCommunityIcons name="database-outline" size={16} color="#315b76" />
                <Text style={styles.volumeText}>Est. Concrete Volume: {calculation.volumeM3} m³</Text>
            </View>
          </View>

          {/* 2. CONSTRUCTION METHOD */}
          <Text style={styles.sectionLabel}>CONSTRUCTION METHOD</Text>
          <View style={styles.methodContainer}>
            {['RCC', 'PCC'].map(m => (
              <TouchableOpacity 
                key={m} 
                style={[styles.methodTab, activeMethod === m && styles.methodTabActive]}
                onPress={() => setActiveMethod(m)}
              >
                <Text style={[styles.methodText, activeMethod === m && styles.methodTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 3. BRAND SELECTION */}
          <Text style={styles.sectionLabel}>SELECT BRANDS</Text>
          {Object.keys(RCC_RATIOS).map(type => (
            <View key={type} style={styles.brandSelectionGroup}>
              <Text style={styles.brandCategoryTitle}>{type}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>
                {materials.filter(m => m.type === type).map(item => (
                  <TouchableOpacity 
                    key={item.id}
                    style={[styles.brandCard, selections[type]?.id === item.id && styles.brandActive]}
                    onPress={() => setSelections({...selections, [type]: item})}
                  >
                    <View style={styles.imageContainer}>
                        {item.imageUrl ? (
                            <Image source={{ uri: item.imageUrl }} style={styles.brandImage} />
                        ) : (
                            <Ionicons name="cube-outline" size={24} color="#cbd5e1" />
                        )}
                    </View>
                    <Text style={styles.brandTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          {/* 4. QUANTITY PREVIEW (The core engineering results) */}
          <Text style={styles.sectionLabel}>ESTIMATED QUANTITY & COST (m³ BASIS)</Text>
          <View style={styles.calcTable}>
            {calculation.items.map((item, idx) => (
              <View key={idx} style={styles.calcRow}>
                <View style={styles.rowMain}>
                  <Text style={styles.itemType}>{item.type}</Text>
                  <Text style={styles.itemBrand}>{item.brandName}</Text>
                </View>
                <View style={styles.rowQty}>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <Text style={styles.unitText}>{item.unit}</Text>
                </View>
                <Text style={styles.rowCost}>₹{item.cost.toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Foundation Cost</Text>
              <Text style={styles.totalVal}>₹{calculation.grandTotal.toLocaleString()}</Text>
            </View>
          </View>
          
          <View style={{height: 40}} />
        </ScrollView>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('EstimateResult', { 
            projectId, 
            foundationData: calculation,
            totalArea: area,
            depth: depth,
            concreteVolumeM3: calculation.volumeM3
          })}
        >
          <Text style={styles.mainBtnText}>Confirm Estimation</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  scroll: { padding: 20, paddingBottom: 100 },

  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', gap: 15 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  readOnlyField: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', opacity: 0.8 },
  readOnlyText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#64748b' },
  textInput: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  inputUnit: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginLeft: 5 },
  
  volumeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', padding: 10, borderRadius: 10, marginTop: 15 },
  volumeText: { fontSize: 13, fontWeight: '700', color: '#315b76', marginLeft: 8 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  
  methodContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  methodTab: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  methodTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  methodText: { fontWeight: '700', color: '#64748b', fontSize: 12 },
  methodTextActive: { color: '#fff' },

  calcTable: { backgroundColor: '#fff', borderRadius: 20, padding: 15, marginBottom: 25, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  calcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowMain: { flex: 2 },
  itemType: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  itemBrand: { fontSize: 11, color: '#94a3b8' },
  rowQty: { flex: 1.5, alignItems: 'center' },
  qtyText: { fontSize: 16, fontWeight: '800', color: '#315b76' },
  unitText: { fontSize: 10, color: '#64748b' },
  rowCost: { flex: 1.2, textAlign: 'right', fontSize: 15, fontWeight: '700', color: '#10b981' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0', borderStyle: 'dashed' },
  totalLabel: { fontWeight: '700', color: '#64748b' },
  totalVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  brandSelectionGroup: { marginBottom: 20 },
  brandCategoryTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  brandCard: { backgroundColor: '#fff', padding: 10, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0', width: 130, alignItems: 'center' },
  brandActive: { borderColor: '#315b76', backgroundColor: '#F0F9FF' },
  imageContainer: { width: '100%', height: 70, backgroundColor: '#F8FAFC', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8, overflow: 'hidden' },
  brandImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandTitle: { fontSize: 12, fontWeight: '700', color: '#334155', textAlign: 'center' },
  brandPrice: { fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: '700' },

  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#1e293b', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 4 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});