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

type FoundationType = 'RCC' | 'StoneMasonry';

// --- SYSTEM-SPECIFIC LAYER DEFINITIONS ---
const RCC_CORE_LAYERS: Record<string, string[]> = {
  'RCC Footing': ['Cement', 'Steel (TMT Bar)', 'Sand'],
};

const PLINTH_LAYERS: Record<string, string[]> = {
  'Plinth Beam': ['Cement', 'Steel (TMT Bar)', 'Sand']
};

const PCC_BASE_LAYER: Record<string, string[]> = {
  'PCC Base': ['Cement', 'Sand']
};

const MASONRY_LAYERS: Record<string, string[]> = {
  'Stone Masonry': ['Cement', 'Sand', 'Stone'],
};

const AGGREGATE_OPTIONS: Record<string, string[]> = {
  'PCC Base': ['20 mm', '40 mm'],
  'RCC Footing': ['20 mm', '10 mm'],
  'Plinth Beam': ['20 mm', '10 mm'],
  'Stone Masonry': [] 
};

const ALL_LAYER_MAPS = {
  ...RCC_CORE_LAYERS,
  ...PLINTH_LAYERS,
  ...PCC_BASE_LAYER,
  ...MASONRY_LAYERS
};

export default function FoundationSelection({ route, navigation }: any) {
  const { totalArea: passedArea, projectId, tier = 'Standard' } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [foundationType, setFoundationType] = useState<FoundationType>('RCC');
  const [hasPCC, setHasPCC] = useState(true);
  const [includePlinth, setIncludePlinth] = useState(false);

  // Inputs
  const [footingCount, setFootingCount] = useState(''); 
  const [footingLength, setFootingLength] = useState('4'); 
  const [footingWidth, setFootingWidth] = useState('4');
  const [pccThickness, setPccThickness] = useState('0.33');
  const [rccExcavationDepth, setRccExcavationDepth] = useState('5');
  
  const [wallPerimeter, setWallPerimeter] = useState('');
  const [trenchWidth, setTrenchWidth] = useState('2');
  const [masonryExcavationDepth, setMasonryExcavationDepth] = useState('3');
  const [masonryThickness, setMasonryThickness] = useState('2');

  const area = passedArea || 1000;
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [aggSelections, setAggSelections] = useState<Record<string, string>>({
    'PCC Base': '40 mm',
    'RCC Footing': '20 mm',
    'Plinth Beam': '20 mm'
  });

  useEffect(() => {
    if (foundationType === 'RCC' && area) {
      setFootingCount(Math.ceil(area / 165).toString());
    } else if (foundationType === 'StoneMasonry' && area) {
      setWallPerimeter((4 * Math.sqrt(area)).toFixed(1));
    }
  }, [area, foundationType]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', '==', 'Foundation'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      const initialSelections: Record<string, any> = {};
      
      Object.keys(ALL_LAYER_MAPS).forEach(layer => {
        ALL_LAYER_MAPS[layer as keyof typeof ALL_LAYER_MAPS].forEach(type => {
          let typeItems = data.filter(m => m.type === type);
          typeItems.sort((a, b) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0));
          if (typeItems.length > 0) {
             if (tier === 'Economy') initialSelections[`${layer}_${type}`] = typeItems[0];
             else if (tier === 'Luxury') initialSelections[`${layer}_${type}`] = typeItems[typeItems.length - 1];
             else initialSelections[`${layer}_${type}`] = typeItems[Math.floor(typeItems.length / 2)];
          }
        });
      });
      setSelections(initialSelections);
      setLoading(false);
    });
    return unsub;
  }, [tier]);

  const activeLayers = useMemo(() => {
    const layers: string[] = [];
    if (foundationType === 'RCC') {
      if (hasPCC) layers.push('PCC Base');
      layers.push(...Object.keys(RCC_CORE_LAYERS));
      if (includePlinth) layers.push('Plinth Beam');
    } else {
      layers.push(...Object.keys(MASONRY_LAYERS));
    }
    return layers;
  }, [foundationType, hasPCC, includePlinth]);

  const filterMaterialsForLayer = (layerName: string, type: string, items: any[]) => {
    let typeItems = items.filter(item => item.type === type);
    typeItems.sort((a, b) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0));
    const total = typeItems.length;
    if (total < 3) return typeItems;
    const oneThird = Math.ceil(total / 3);
    if (tier === 'Economy') return typeItems.slice(0, oneThird);
    else if (tier === 'Luxury') return typeItems.slice(total - oneThird, total);
    return typeItems.slice(oneThird, total - oneThird); 
  };

  const handleNext = () => {
    const common = { projectId, area, tier, selections: { ...selections, ...aggSelections } };
    if (foundationType === 'RCC') {
      navigation.navigate('FoundationCost', { ...common, foundationType: 'RCC', foundationConfig: { hasPCC, includePlinth, footingCount: parseInt(footingCount) || 0, footingLength: parseFloat(footingLength), footingWidth: parseFloat(footingWidth), pccThickness: parseFloat(pccThickness), rccExcavationDepth: parseFloat(rccExcavationDepth) } });
    } else {
      navigation.navigate('FoundationCost', { ...common, foundationType: 'StoneMasonry', foundationConfig: { wallPerimeter: parseFloat(wallPerimeter), trenchWidth: parseFloat(trenchWidth), masonryExcavationDepth: parseFloat(masonryExcavationDepth), masonryThickness: parseFloat(masonryThickness) } });
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}><Ionicons name="arrow-back" size={20} color="#1e293b" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Foundation System</Text>
          <View style={[styles.tierBadge, tier === 'Economy' ? {backgroundColor: '#10b981'} : tier === 'Luxury' ? {backgroundColor: '#8b5cf6'} : {backgroundColor: '#3b82f6'}]}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>FOUNDATION TYPE</Text>
          <View style={styles.methodContainer}>
            {['RCC', 'StoneMasonry'].map((type) => (
              <TouchableOpacity key={type} style={[styles.methodTab, foundationType === type && styles.methodTabActive]} onPress={() => setFoundationType(type as FoundationType)}>
                <Text style={[styles.methodText, foundationType === type && styles.methodTextActive]}>{type === 'RCC' ? 'RCC Footing' : 'Stone Masonry'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {foundationType === 'RCC' ? (
            <View style={styles.paramsSection}>
              <Text style={styles.sectionLabel}>RCC FOOTING DIMENSIONS</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Area (sq.ft)</Text><View style={[styles.textInputWrapper, styles.readOnlyField]}><Text style={styles.readOnlyText}>{area}</Text></View></View>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>No. of Footings</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={footingCount} onChangeText={setFootingCount} keyboardType="numeric" /><Ionicons name="apps-outline" size={14} color="#94a3b8" /></View></View>
              </View>
              <View style={[styles.inputRow, { marginTop: 15 }]}>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Length (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={footingLength} onChangeText={setFootingLength} keyboardType="numeric" /></View></View>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Width (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={footingWidth} onChangeText={setFootingWidth} keyboardType="numeric" /></View></View>
              </View>
              <View style={[styles.inputRow, { marginTop: 15 }]}>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Excavation (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={rccExcavationDepth} onChangeText={setRccExcavationDepth} keyboardType="numeric" /></View></View>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>PCC Thick (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={pccThickness} onChangeText={setPccThickness} keyboardType="numeric" /></View></View>
              </View>
            </View>
          ) : (
            <View style={styles.paramsSection}>
              <Text style={styles.sectionLabel}>STONE MASONRY DIMENSIONS</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Area (sq.ft)</Text><View style={[styles.textInputWrapper, styles.readOnlyField]}><Text style={styles.readOnlyText}>{area}</Text></View></View>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Wall Perimeter (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={wallPerimeter} onChangeText={setWallPerimeter} keyboardType="numeric" /></View></View>
              </View>
              <View style={[styles.inputRow, { marginTop: 15 }]}>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Trench Width (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={trenchWidth} onChangeText={setTrenchWidth} keyboardType="numeric" /></View></View>
                <View style={styles.inputContainer}><Text style={styles.inputLabel}>Excavation (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={masonryExcavationDepth} onChangeText={setMasonryExcavationDepth} keyboardType="numeric" /></View></View>
              </View>
              {/* RESTORED MISSING INPUT FIELD BELOW */}
              <View style={[styles.inputRow, { marginTop: 15 }]}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Masonry Thickness (ft)</Text>
                  <View style={styles.textInputWrapper}>
                    <TextInput style={styles.textInput} value={masonryThickness} onChangeText={setMasonryThickness} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{flex: 1}} /> 
              </View>
            </View>
          )}

          {foundationType === 'RCC' && (
            <>
              <View style={styles.toggleRow}>
                <View><Text style={styles.toggleTitle}>Include PCC Base</Text><Text style={styles.toggleSub}>Plain cement concrete layer</Text></View>
                <Switch value={hasPCC} onValueChange={setHasPCC} trackColor={{ false: '#e2e8f0', true: '#315b76' }} thumbColor={'#fff'} />
              </View>
              <View style={styles.toggleRow}>
                <View><Text style={styles.toggleTitle}>Add Plinth Beam</Text><Text style={styles.toggleSub}>Reinforced beam at plinth level</Text></View>
                <Switch value={includePlinth} onValueChange={setIncludePlinth} trackColor={{ false: '#e2e8f0', true: '#315b76' }} thumbColor={'#fff'} />
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>MATERIAL SPECIFICATION ({tier})</Text>
          {activeLayers.map((layerName) => (
            <View key={layerName} style={styles.layerContainer}>
              <View style={styles.layerTitleRow}><View style={styles.layerTitleDot} /><Text style={styles.layerTitle}>{layerName}</Text></View>
              { (ALL_LAYER_MAPS[layerName as keyof typeof ALL_LAYER_MAPS] || []).map(type => {
                const filteredList = filterMaterialsForLayer(layerName, type, materials);
                const selectionKey = `${layerName}_${type}`;
                const selectedId = selections[selectionKey]?.id;
                return (
                  <View key={type} style={styles.materialRow}>
                    <Text style={styles.materialTypeLabel}>{type}</Text>
                    {filteredList.length === 0 ? (<View style={styles.emptyStateBox}><Text style={styles.noMaterialText}>No {tier} options</Text></View>) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20, paddingBottom: 10}}>
                        {filteredList.map(item => (
                          <TouchableOpacity key={item.id} style={[styles.materialCard, selectedId === item.id && styles.materialCardActive]} onPress={() => setSelections({...selections, [selectionKey]: item})}>
                            {selectedId === item.id && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                            <View style={styles.cardImageWrapper}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} /> : <View style={styles.placeholderImg}><Ionicons name="cube-outline" size={24} color="#94a3b8" /></View>}</View>
                            <View style={styles.cardContent}>
                              <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                              <View style={styles.cardMeta}><Text style={styles.cardPrice}>₹{item.pricePerUnit}</Text><Text style={styles.cardUnit}>/{item.unit}</Text></View>
                              {item.grade && <Text style={styles.cardGrade}>{item.grade}</Text>}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              })}
              {AGGREGATE_OPTIONS[layerName]?.length > 0 && (
                <View style={styles.materialRow}>
                  <Text style={styles.materialTypeLabel}>Aggregate Size</Text>
                  <View style={styles.chipRow}>
                    {AGGREGATE_OPTIONS[layerName].map((size) => (
                      <TouchableOpacity key={size} style={[styles.chip, aggSelections[layerName] === size && styles.chipActive]} onPress={() => setAggSelections({ ...aggSelections, [layerName]: size })}>
                        <Text style={[styles.chipText, aggSelections[layerName] === size && styles.chipTextActive]}>{size}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
          <View style={{height: 100}} />
        </ScrollView>
        <TouchableOpacity style={styles.mainBtn} onPress={handleNext}><Text style={styles.mainBtnText}>Calculate Cost</Text><Ionicons name="calculator" size={20} color="#fff" /></TouchableOpacity>
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
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 20 },
  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  readOnlyField: { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', opacity: 0.8 },
  readOnlyText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#64748b' },
  textInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginTop: 10 },
  methodContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  methodTab: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  methodTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  methodText: { fontWeight: '700', color: '#64748b', fontSize: 12 },
  methodTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  layerContainer: { marginBottom: 24 },
  layerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  layerTitleDot: { width: 4, height: 16, backgroundColor: '#315b76', borderRadius: 2 },
  layerTitle: { fontSize: 14, fontWeight: '800', color: '#315b76' },
  materialRow: { marginBottom: 16 },
  materialTypeLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginLeft: 4 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#1e293b', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});