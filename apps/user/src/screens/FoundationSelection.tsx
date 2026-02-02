import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, TextInput, ActivityIndicator, Image, Switch 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- LAYER DEFINITIONS ---
const LAYER_MATS: Record<string, string[]> = {
  'PCC Base': ['Cement', 'Sand'], 
  'RCC Footing': ['Cement', 'Steel (TMT Bar)', 'Sand'],
  'Stone Masonry': ['Cement', 'Sand', 'Stone'],
  'Plinth Beam': ['Cement', 'Steel (TMT Bar)', 'Sand']
};

const AGGREGATE_OPTIONS: Record<string, string[]> = {
  'PCC Base': ['20 mm', '40 mm'],
  'RCC Footing': ['20 mm', '10 mm'],
  'Plinth Beam': ['20 mm', '10 mm'],
  'Stone Masonry': [] 
};

export default function FoundationSelection({ route, navigation }: any) {
  const { totalArea: passedArea, projectId, tier = 'Standard' } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Layer State
  const [mainLayer, setMainLayer] = useState<'RCC Footing' | 'Stone Masonry'>('RCC Footing');
  const [includePlinth, setIncludePlinth] = useState(false);

  // Input States
  const area = passedArea || 1000;
  const [depth, setDepth] = useState('5'); 
  const [footingCount, setFootingCount] = useState(''); 
  const [fLength, setFLength] = useState('4'); 
  const [fWidth, setFWidth] = useState('4');   
  const [pccThick, setPccThick] = useState('0.33'); 

  const [selections, setSelections] = useState<Record<string, any>>({});
  
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

  // Fetch & Sort Logic (Price Based)
  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', '==', 'Foundation'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      
      const initialSelections: Record<string, any> = {};
      
      Object.keys(LAYER_MATS).forEach(layer => {
        LAYER_MATS[layer].forEach(type => {
          let typeItems = data.filter(m => m.type === type);
          
          // Sort Low -> High
          typeItems.sort((a, b) => {
             const pA = parseFloat(a.pricePerUnit) || 0;
             const pB = parseFloat(b.pricePerUnit) || 0;
             return pA - pB;
          });

          let bestMatch;
          if (typeItems.length > 0) {
             if (tier === 'Economy') bestMatch = typeItems[0];
             else if (tier === 'Luxury') bestMatch = typeItems[typeItems.length - 1];
             else {
                const midIndex = Math.floor(typeItems.length / 2);
                bestMatch = typeItems[midIndex];
             }
          }

          if (bestMatch) {
            initialSelections[`${layer}_${type}`] = bestMatch;
          }
        });
      });

      setSelections(initialSelections);
      setLoading(false);
    });
    return unsub;
  }, [tier]);

  const activeLayers = useMemo(() => {
    const layers = ['PCC Base', mainLayer]; 
    if (includePlinth) layers.push('Plinth Beam');
    return layers;
  }, [mainLayer, includePlinth]);

  // Price Slicing Logic
  const filterMaterialsForLayer = (layerName: string, type: string, items: any[]) => {
    let typeItems = items.filter(item => item.type === type);
    typeItems.sort((a, b) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0));

    const total = typeItems.length;
    if (total < 3) return typeItems;

    const oneThird = Math.ceil(total / 3);

    if (tier === 'Economy') return typeItems.slice(0, oneThird);
    else if (tier === 'Luxury') return typeItems.slice(total - oneThird, total);
    else return typeItems.slice(oneThird, total - oneThird); 
  };

  const handleNext = () => {
    navigation.navigate('FoundationCost', {
      projectId,
      area,
      foundationConfig: { mainLayer, includePlinth, hasPCC: true },
      selections: { ...selections, ...aggSelections }, 
      numFootings: footingCount,
      lengthFt: fLength,
      widthFt: fWidth,
      depthFt: depth,
      pccThicknessFt: pccThick,
      tier 
    });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER (Restored Original Style) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation System</Text>
          <View style={[
            styles.tierBadge, 
            tier === 'Economy' ? {backgroundColor: '#10b981'} : 
            tier === 'Luxury' ? {backgroundColor: '#8b5cf6'} : 
            {backgroundColor: '#3b82f6'}
          ]}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* 1. INPUTS (Restored Original Static Card Style) */}
          <View style={styles.paramsSection}>
            <Text style={styles.sectionLabel}>STRUCTURAL DIMENSIONS</Text>
            
            <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Area (sq.ft)</Text>
                    <View style={[styles.textInputWrapper, styles.readOnlyField]}>
                        <Text style={styles.readOnlyText}>{area}</Text>
                    </View>
                </View>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>No. of Footings</Text>
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
                    <Text style={styles.inputLabel}>Footing Length (ft)</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput 
                          style={styles.textInput} 
                          value={fLength} 
                          onChangeText={setFLength} 
                          keyboardType="numeric" 
                        />
                    </View>
                </View>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Footing Width (ft)</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput 
                          style={styles.textInput} 
                          value={fWidth} 
                          onChangeText={setFWidth} 
                          keyboardType="numeric" 
                        />
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
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>PCC Thickness (ft)</Text>
                    <View style={styles.textInputWrapper}>
                        <TextInput 
                          style={styles.textInput} 
                          value={pccThick} 
                          onChangeText={setPccThick} 
                          keyboardType="numeric" 
                        />
                    </View>
                </View>
            </View>
          </View>

          {/* 2. METHODS (Restored Original Tab Style) */}
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

          {/* 3. PLINTH (Restored Original Row Style) */}
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

          {/* 4. MATERIALS (KEPT THE NEW UI) */}
          <Text style={styles.sectionLabel}>
             MATERIAL SELECTION ({tier})
          </Text>
          
          {activeLayers.map((layerName) => (
            <View key={layerName} style={styles.layerContainer}>
              <View style={styles.layerTitleRow}>
                <View style={styles.layerTitleDot} />
                <Text style={styles.layerTitle}>{layerName}</Text>
              </View>

              {LAYER_MATS[layerName]?.map(type => {
                const filteredList = filterMaterialsForLayer(layerName, type, materials);
                const selectionKey = `${layerName}_${type}`;
                const selectedId = selections[selectionKey]?.id;

                return (
                  <View key={type} style={styles.materialRow}>
                    <Text style={styles.materialTypeLabel}>{type}</Text>
                    
                    {filteredList.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Text style={styles.noMaterialText}>No {tier} options available</Text>
                      </View>
                    ) : (
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={{paddingRight: 20, paddingBottom: 10}}
                      >
                        {filteredList.map(item => {
                          const isSelected = selectedId === item.id;
                          return (
                            <TouchableOpacity 
                              key={item.id}
                              style={[styles.materialCard, isSelected && styles.materialCardActive]}
                              onPress={() => setSelections({...selections, [selectionKey]: item})}
                              activeOpacity={0.8}
                            >
                              {/* Selection Badge */}
                              {isSelected && (
                                <View style={styles.checkBadge}>
                                  <Ionicons name="checkmark" size={12} color="#fff" />
                                </View>
                              )}
                              
                              <View style={styles.cardImageWrapper}>
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                                ) : (
                                    <View style={styles.placeholderImg}>
                                       <Ionicons name="cube-outline" size={24} color="#94a3b8" />
                                    </View>
                                )}
                              </View>
                              
                              <View style={styles.cardContent}>
                                <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                                <View style={styles.cardMeta}>
                                  <Text style={styles.cardPrice}>₹{item.pricePerUnit}</Text>
                                  <Text style={styles.cardUnit}>/{item.unit}</Text>
                                </View>
                                {item.grade && <Text style={styles.cardGrade}>{item.grade}</Text>}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                );
              })}

              {/* AGGREGATES CHIPS (Kept Updated Style for consistency with Materials) */}
              {AGGREGATE_OPTIONS[layerName] && AGGREGATE_OPTIONS[layerName].length > 0 && (
                <View style={styles.materialRow}>
                   <Text style={styles.materialTypeLabel}>Aggregate Size</Text>
                   <View style={styles.chipRow}>
                    {AGGREGATE_OPTIONS[layerName].map((size) => {
                      const isActive = aggSelections[layerName] === size;
                      return (
                        <TouchableOpacity
                          key={size}
                          style={[styles.chip, isActive && styles.chipActive]}
                          onPress={() => setAggSelections({ ...aggSelections, [layerName]: size })}
                        >
                          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{size}</Text>
                        </TouchableOpacity>
                      );
                    })}
                   </View>
                </View>
              )}
            </View>
          ))}
          
          <View style={{height: 100}} />
        </ScrollView>

        <TouchableOpacity style={styles.mainBtn} onPress={handleNext}>
          <Text style={styles.mainBtnText}>Calculate Cost ({tier})</Text>
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
  
  // Header (Original)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  scroll: { padding: 20 },
  
  // Input Section (Original)
  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation:0.3 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  readOnlyField: { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', opacity: 0.8 },
  readOnlyText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#64748b' },
  textInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  
  // Methods (Original)
  methodContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  methodTab: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  methodTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  methodText: { fontWeight: '700', color: '#64748b', fontSize: 12 },
  methodTextActive: { color: '#fff' },

  // Toggle (Original)
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 25 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // --- NEW MATERIAL UI STYLES ---
  layerContainer: { marginBottom: 24 },
  layerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  layerTitleDot: { width: 4, height: 16, backgroundColor: '#315b76', borderRadius: 2 },
  layerTitle: { fontSize: 14, fontWeight: '800', color: '#315b76' },

  materialRow: { marginBottom: 16 },
  materialTypeLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  
  // Enhanced Material Card
  materialCard: { width: 150, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, padding: 10, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  materialCardActive: { borderColor: '#10b981', backgroundColor: '#ecfdf5', borderWidth: 1.5 },
  
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#fff' },
  
  cardImageWrapper: { width: '100%', height: 90, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImg: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  
  cardContent: { gap: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b', minHeight: 32 },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: '#10b981' },
  cardUnit: { fontSize: 10, color: '#94a3b8' },
  cardGrade: { fontSize: 10, color: '#64748b', marginTop: 2, backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  emptyStateBox: { padding: 15, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  noMaterialText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },

  // Main Button (Original)
  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#1e293b', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});