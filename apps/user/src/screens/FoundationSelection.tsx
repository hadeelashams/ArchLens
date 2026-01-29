import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, TextInput, ActivityIndicator, Image, Switch 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- 1. UPDATED LAYER DEFINITIONS ---
// "Aggregate" is removed here because it's now a manual selection, not from DB
const LAYER_MATS: Record<string, string[]> = {
  'PCC Base': ['Cement', 'Sand'], 
  'RCC Footing': ['Cement', 'Steel (TMT Bar)', 'Sand'],
  'Stone Masonry': ['Cement', 'Sand', 'Size Stone'],
  'Plinth Beam': ['Cement', 'Steel (TMT Bar)', 'Sand']
};

// --- AGGREGATE RULES ---
const AGGREGATE_OPTIONS: Record<string, string[]> = {
  'PCC Base': ['20 mm', '40 mm'],
  'RCC Footing': ['20 mm', '10 mm'],
  'Plinth Beam': ['20 mm', '10 mm'],
  'Stone Masonry': [] // No aggregate needed
};

export default function FoundationSelection({ route, navigation }: any) {
  const { totalArea: passedArea, projectId } = route.params || { totalArea: 0, projectId: null };

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Layer State
  const [mainLayer, setMainLayer] = useState<'RCC Footing' | 'Stone Masonry'>('RCC Footing');
  const [includePlinth, setIncludePlinth] = useState(true);

  // Input States
  const area = passedArea || 1000;
  const [depth, setDepth] = useState('5'); 
  const [footingCount, setFootingCount] = useState(''); 
  const [fLength, setFLength] = useState('5'); 
  const [fWidth, setFWidth] = useState('5');   
  const [pccThick, setPccThick] = useState('0.25'); 

  // Selection State (Materials from DB)
  const [selections, setSelections] = useState<Record<string, any>>({});
  
  // Aggregate State (Manual Dropdown Selection)
  const [aggSelections, setAggSelections] = useState<Record<string, string>>({
    'PCC Base': '40 mm',
    'RCC Footing': '20 mm',
    'Plinth Beam': '20 mm'
  });

  useEffect(() => {
    if (area) {
      const estimated = Math.ceil(area / 165);
      setFootingCount(estimated.toString());
    }
  }, [area]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', '==', 'Foundation'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const activeLayers = useMemo(() => {
    const layers = ['PCC Base', mainLayer]; 
    if (includePlinth) layers.push('Plinth Beam');
    return layers;
  }, [mainLayer, includePlinth]);

  const filterMaterialsForLayer = (layerName: string, type: string, items: any[]) => {
    return items.filter(item => {
      if (item.type !== type) return false;
      const grade = (item.grade || '').toLowerCase();
      const name = (item.name || '').toLowerCase();

      if (layerName === 'PCC Base') {
        if (type === 'Cement') return grade.includes('43') || grade.includes('ppc') || !grade.includes('53');
        if (type === 'Sand') return !name.includes('rcc');
      }

      if (layerName === 'RCC Footing' || layerName === 'Plinth Beam') {
        if (type === 'Cement') return grade.includes('53') || grade.includes('psc');
      }

      if (layerName === 'Stone Masonry') {
         if (type === 'Cement') return grade.includes('43') || grade.includes('ppc');
      }

      return true;
    });
  };

  const handleNext = () => {
    navigation.navigate('FoundationCost', {
      projectId,
      area,
      foundationConfig: { mainLayer, includePlinth, hasPCC: true },
      selections: { ...selections, ...aggSelections }, // Merge DB selections with Aggregate choices
      numFootings: footingCount,
      lengthFt: fLength,
      widthFt: fWidth,
      depthFt: depth,
      pccThicknessFt: pccThick
    });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation System</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* 1. STRUCTURAL DIMENSIONS (Unchanged) */}
          <View style={styles.paramsSection}>
            <Text style={styles.sectionLabel}>STRUCTURAL DIMENSIONS</Text>
            <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>AI Detected Area</Text>
                    <View style={[styles.textInputWrapper, styles.readOnlyField]}>
                        <Text style={styles.readOnlyText}>{area}</Text>
                        <Text style={styles.inputUnit}>sq.ft</Text>
                    </View>
                </View>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Footing Count</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput 
                            style={styles.textInput}
                            value={footingCount}
                            onChangeText={setFootingCount}
                            keyboardType="numeric"
                        />
                        <Ionicons name="apps-outline" size={14} color="#94a3b8" />
                    </View>
                </View>
            </View>
            <View style={[styles.inputRow, { marginTop: 15 }]}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Excavation Depth (ft)</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput style={styles.textInput} value={depth} onChangeText={setDepth} keyboardType="numeric" />
                    </View>
                </View>
            </View>
          </View>

          {/* 2. LAYER SELECTION */}
          <Text style={styles.sectionLabel}>LOAD BEARING LAYER</Text>
          <View style={styles.methodContainer}>
            {['RCC Footing', 'Stone Masonry'].map((m) => (
              <TouchableOpacity 
                key={m} 
                style={[styles.methodTab, mainLayer === m && styles.methodTabActive]}
                onPress={() => setMainLayer(m as any)}
              >
                <Text style={[styles.methodText, mainLayer === m && styles.methodTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Add Plinth Beam</Text>
              <Text style={styles.toggleSub}>Reinforced concrete beam at plinth level</Text>
            </View>
            <Switch 
              value={includePlinth}
              onValueChange={setIncludePlinth}
              trackColor={{ false: '#e2e8f0', true: '#315b76' }}
              thumbColor={'#fff'}
            />
          </View>

          {/* 3. MATERIAL SELECTION BY LAYER */}
          <Text style={styles.sectionLabel}>MATERIAL SPECIFICATIONS</Text>
          
          {activeLayers.map((layerName) => (
            <View key={layerName} style={styles.layerSection}>
              <View style={styles.layerHeader}>
                <Ionicons name="layers" size={16} color="#315b76" />
                <Text style={styles.layerTitle}>{layerName.toUpperCase()}</Text>
              </View>

              {/* A. Database Materials (Cement, Sand, Steel) */}
              {LAYER_MATS[layerName]?.map(type => {
                const filteredList = filterMaterialsForLayer(layerName, type, materials);
                const selectionKey = `${layerName}_${type}`;

                return (
                  <View key={type} style={styles.brandSelectionGroup}>
                    <Text style={styles.brandCategoryTitle}>{type}</Text>
                    {filteredList.length === 0 ? (
                      <Text style={styles.noMaterialText}>No matching materials found.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>
                        {filteredList.map(item => (
                          <TouchableOpacity 
                            key={item.id}
                            style={[styles.brandCard, selections[selectionKey]?.id === item.id && styles.brandActive]}
                            onPress={() => setSelections({...selections, [selectionKey]: item})}
                          >
                            <View style={styles.imageContainer}>
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.brandImage} />
                                ) : (
                                    <Ionicons name="cube-outline" size={24} color="#cbd5e1" />
                                )}
                            </View>
                            <Text style={styles.brandTitle} numberOfLines={1}>{item.name}</Text>
                            {item.grade && <Text style={styles.brandGrade}>{item.grade}</Text>}
                            <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              })}

              {/* B. Aggregate Selection (Manual Dropdown Logic) */}
              {AGGREGATE_OPTIONS[layerName] && AGGREGATE_OPTIONS[layerName].length > 0 && (
                <View style={styles.brandSelectionGroup}>
                  <Text style={styles.brandCategoryTitle}>Coarse Aggregate Size</Text>
                  <View style={styles.aggOptionsRow}>
                    {AGGREGATE_OPTIONS[layerName].map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.aggChip,
                          aggSelections[layerName] === size && styles.aggChipActive
                        ]}
                        onPress={() => setAggSelections({ ...aggSelections, [layerName]: size })}
                      >
                        <Text style={[
                          styles.aggChipText,
                          aggSelections[layerName] === size && styles.aggChipTextActive
                        ]}>
                          {size}
                        </Text>
                        {aggSelections[layerName] === size && (
                          <Ionicons name="checkmark-circle" size={16} color="#fff" style={{marginLeft: 6}} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

            </View>
          ))}
          
          <View style={{height: 120}} />
        </ScrollView>

        <TouchableOpacity style={styles.mainBtn} onPress={handleNext}>
          <Text style={styles.mainBtnText}>Calculate Detailed Cost</Text>
          <Ionicons name="calculator" size={20} color="#fff" />
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
  scroll: { padding: 20 },
  
  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  readOnlyField: { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', opacity: 0.8 },
  readOnlyText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#64748b' },
  textInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  inputUnit: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginLeft: 5 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  
  methodContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  methodTab: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  methodTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  methodText: { fontWeight: '700', color: '#64748b', fontSize: 12 },
  methodTextActive: { color: '#fff' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 25 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // --- LAYER STYLING ---
  layerSection: { marginBottom: 30, backgroundColor: '#fff', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  layerTitle: { fontSize: 13, fontWeight: '800', color: '#315b76', letterSpacing: 0.5 },

  brandSelectionGroup: { marginBottom: 15 },
  brandCategoryTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, marginLeft: 5 },
  brandCard: { backgroundColor: '#fff', padding: 10, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0', width: 130, alignItems: 'center' },
  brandActive: { borderColor: '#315b76', backgroundColor: '#F0F9FF' },
  imageContainer: { width: '100%', height: 70, backgroundColor: '#F8FAFC', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8, overflow: 'hidden' },
  brandImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandTitle: { fontSize: 12, fontWeight: '700', color: '#334155', textAlign: 'center' },
  brandGrade: { fontSize: 10, color: '#64748b', marginTop: 1, fontWeight: '500' },
  brandPrice: { fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: '700' },
  noMaterialText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginLeft: 10 },

  // --- AGGREGATE CHIPS ---
  aggOptionsRow: { flexDirection: 'row', gap: 10, paddingLeft: 5 },
  aggChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  aggChipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  aggChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  aggChipTextActive: { color: '#fff' },

  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#1e293b', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});