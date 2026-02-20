import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, TextInput, Image, ActivityIndicator, 
  Platform, Switch, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { 
  db, 
  auth, 
  createDocument, 
  getComponentRecommendation,
  CONSTRUCTION_HIERARCHY
} from '@archlens/shared';
import { collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- DYNAMIC MATERIAL EXTRACTION FROM CONSTRUCTION_HIERARCHY ---
/**
 * Extract all material types for a given roof type
 * Handles both simple arrays and grouped structures
 */
const getMaterialTypesForRoofType = (roofType: string): string[] => {
  // @ts-ignore
  const roofConfig = CONSTRUCTION_HIERARCHY['Roof']?.subCategories?.[roofType];
  
  if (!roofConfig) return [];
  
  if (Array.isArray(roofConfig)) {
    return roofConfig;
  } else if (typeof roofConfig === 'object') {
    // Flatten grouped materials: {"Slab Core": [...], "Protection": [...]} => [...]
    return Object.values(roofConfig).flat() as string[];
  }
  return [];
};

/**
 * Get available roof type options from construction hierarchy
 */
const getAvailableRoofTypes = (): string[] => {
  // @ts-ignore
  return Object.keys(CONSTRUCTION_HIERARCHY['Roof']?.subCategories || {});
};

export default function RoofingScreen({ route, navigation }: any) {
  const { totalArea: passedArea, projectId, tier = 'Standard', floorPlanAnalyzed = false } = route.params || {};

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [saving, setSaving] = useState(false);

  // --- CONFIG STATE ---
  const [roofType, setRoofType] = useState<string>('RCC Slab');
  const [hasWaterproofing, setHasWaterproofing] = useState(true);
  const [hasParapet, setHasParapet] = useState(false);

  // --- INPUTS ---
  const [roofArea, setRoofArea] = useState(String(passedArea || 1000));
  const [slabThickness, setSlabThickness] = useState('0.5'); // in feet for foundation style consistency
  const [openingDeduction, setOpeningDeduction] = useState('5');
  const [parapetHeight, setParapetHeight] = useState('3'); // in feet
  const [parapetThickness, setParapetThickness] = useState('0.75'); // in feet

  // 1. Fetch Materials and Initialize Selections based on Roof Type
  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', 'in', ['Roofing', 'Foundation', 'Structural']));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      
      // DEBUG: Log available material types
      const availableTypes = new Set(data.map(m => m.type));
      console.log('📦 Available Material Types:', Array.from(availableTypes));
      
      // DEBUG: Log expected types for current roof type
      const expectedTypes = getMaterialTypesForRoofType('RCC Slab');
      console.log('🏢 Expected Types for RCC Slab:', expectedTypes);
      
      // Default Selections based on Roof Type and Tier
      const initialSelections: Record<string, any> = {};
      const materialTypesForRoof = getMaterialTypesForRoofType('RCC Slab');
      
      materialTypesForRoof.forEach(type => {
        let typeItems = data.filter(m => m.type === type);
        console.log(`  - ${type}: ${typeItems.length} items found`);
        typeItems.sort((a, b) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0));
        if (typeItems.length > 0) {
          const selKey = `${'RCC Slab'}_${type}`;
          if (tier === 'Economy') initialSelections[selKey] = typeItems[0];
          else if (tier === 'Luxury') initialSelections[selKey] = typeItems[typeItems.length - 1];
          else initialSelections[selKey] = typeItems[Math.floor(typeItems.length / 2)];
        }
      });
      setSelections(initialSelections);
      setLoading(false);
    });
    return unsub;
  }, [tier, roofType]);

  const activeLayers = useMemo(() => {
    const layers = [roofType]; // Use dynamic roof type instead of hardcoded 'RCC Slab'
    if (hasWaterproofing && !roofType.includes('Sloped')) layers.push('Waterproofing');
    if (hasParapet) layers.push('Parapet Wall');
    return layers;
  }, [roofType, hasWaterproofing, hasParapet]);

  // AI Auto-Select Logic
  const handleAiAutoSelect = async () => {
    setIsAiLoading(true);
    try {
      const result = await getComponentRecommendation('Roofing', tier, parseFloat(roofArea), materials);
      setAiAdvice(result.advice || "Optimized for thermal insulation and structural integrity.");
      Alert.alert("✓ AI Selection Applied", "Roofing materials optimized for your project tier.");
    } catch (e) {
      Alert.alert("Error", "Could not fetch AI recommendations.");
    } finally { setIsAiLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    // Logic for saving estimate to Firestore...
    setTimeout(() => {
      setSaving(false);
      navigation.navigate('ProjectSummary', { projectId });
    }, 1500);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Roofing System</Text>
          <View style={[styles.tierBadge, tier === 'Economy' ? {backgroundColor: '#10b981'} : tier === 'Luxury' ? {backgroundColor: '#8b5cf6'} : {backgroundColor: '#3b82f6'}]}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* ROOF TYPE & AI CHIP */}
          <Text style={styles.sectionLabel}>ROOF CONFIGURATION</Text>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <View style={{flex: 1, flexDirection: 'row', gap: 10}}>
              {getAvailableRoofTypes().map((type) => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.methodTab, roofType === type && styles.methodTabActive]} 
                  onPress={() => setRoofType(type)}
                >
                  <Text style={[styles.methodText, roofType === type && styles.methodTextActive]}>
                    {type.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.aiChipButton} onPress={handleAiAutoSelect}>
              <Ionicons name="sparkles" size={12} color="#315b76" />
              <Text style={styles.aiChipText}>AI</Text>
            </TouchableOpacity>
          </View>

          {aiAdvice ? (
            <View style={styles.adviceBoxCompact}>
              <Text style={styles.adviceText}>💡 {aiAdvice}</Text>
            </View>
          ) : null}

          {/* DIMENSIONS SECTION */}
          <View style={styles.paramsSection}>
            <Text style={styles.sectionLabel}>SLAB DIMENSIONS</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Total Area (sq.ft)</Text>
                <View style={styles.textInputWrapper}>
                    <TextInput style={styles.textInput} value={roofArea} onChangeText={setRoofArea} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Thickness (ft)</Text>
                <View style={styles.textInputWrapper}>
                    <TextInput style={styles.textInput} value={slabThickness} onChangeText={setSlabThickness} keyboardType="numeric" />
                </View>
              </View>
            </View>
            <View style={[styles.inputRow, { marginTop: 15 }]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Openings Deduction (%)</Text>
                <View style={styles.textInputWrapper}>
                    <TextInput style={styles.textInput} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
                </View>
              </View>
              <View style={{flex: 1}} />
            </View>
          </View>

          {/* TOGGLES */}
          <View style={styles.toggleRow}>
            <View><Text style={styles.toggleTitle}>Waterproofing System</Text><Text style={styles.toggleSub}>Protective liquid or membrane layer</Text></View>
            <Switch value={hasWaterproofing} onValueChange={setHasWaterproofing} trackColor={{ false: '#e2e8f0', true: '#315b76' }} thumbColor={'#fff'} />
          </View>

          <View style={styles.toggleRow}>
            <View><Text style={styles.toggleTitle}>Parapet Wall</Text><Text style={styles.toggleSub}>Safety wall around the roof edge</Text></View>
            <Switch value={hasParapet} onValueChange={setHasParapet} trackColor={{ false: '#e2e8f0', true: '#315b76' }} thumbColor={'#fff'} />
          </View>

          {hasParapet && (
             <View style={[styles.paramsSection, { marginTop: 10 }]}>
                <Text style={styles.sectionLabel}>PARAPET DIMENSIONS</Text>
                <View style={styles.inputRow}>
                    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Height (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={parapetHeight} onChangeText={setParapetHeight} keyboardType="numeric" /></View></View>
                    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Thickness (ft)</Text><View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={parapetThickness} onChangeText={setParapetThickness} keyboardType="numeric" /></View></View>
                </View>
             </View>
          )}

          {/* MATERIAL SPECIFICATION */}
          <Text style={styles.sectionLabel}>MATERIAL SPECIFICATION ({tier})</Text>
          {activeLayers.map((layerName) => {
            // Dynamically get material types for this layer from construction hierarchy
            const materialTypesForLayer = getMaterialTypesForRoofType(layerName);
            return (
              <View key={layerName} style={styles.layerContainer}>
                <View style={styles.layerTitleRow}><View style={styles.layerTitleDot} /><Text style={styles.layerTitle}>{layerName}</Text></View>
                {materialTypesForLayer.map(type => {
                  const filteredList = materials.filter(m => m.type === type);
                  const selectionKey = `${layerName}_${type}`;
                  const selectedId = selections[selectionKey]?.id;
                  
                  return (
                    <View key={type} style={styles.materialRow}>
                      <Text style={styles.materialTypeLabel}>{type}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>
                        {filteredList.map(item => (
                          <TouchableOpacity 
                              key={item.id} 
                              style={[styles.materialCard, selectedId === item.id && styles.materialCardActive]} 
                              onPress={() => setSelections({...selections, [selectionKey]: item})}
                          >
                            {selectedId === item.id && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                            <View style={styles.cardImageWrapper}>
                              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} /> : <View style={styles.placeholderImg}><Ionicons name="cube-outline" size={24} color="#94a3b8" /></View>}
                            </View>
                            <View style={styles.cardContent}>
                              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                              <View style={styles.cardMeta}><Text style={styles.cardPrice}>₹{item.pricePerUnit}</Text><Text style={styles.cardUnit}>/{item.unit}</Text></View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={{height: 120}} />
        </ScrollView>

        <TouchableOpacity style={styles.mainBtn} onPress={handleSave}>
          {saving ? <ActivityIndicator color="#fff" /> : <><Text style={styles.mainBtnText}>Calculate & Save</Text><Ionicons name="calculator" size={20} color="#fff" /></>}
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 15, marginTop: 10, textTransform: 'uppercase' },
  methodTab: { flex: 1, padding: 12, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  methodTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  methodText: { fontWeight: '700', color: '#64748b', fontSize: 12 },
  methodTextActive: { color: '#fff' },
  aiChipButton: { backgroundColor: '#e0f2fe', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#315b76', marginLeft: 10 },
  aiChipText: { color: '#315b76', fontSize: 10, fontWeight: '700' },
  adviceBoxCompact: { marginBottom: 15, backgroundColor: '#e0f2fe', borderLeftWidth: 3, borderLeftColor: '#315b76', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  adviceText: { fontSize: 12, color: '#064e78', fontWeight: '500' },
  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  textInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  layerContainer: { marginBottom: 24 },
  layerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  layerTitleDot: { width: 4, height: 16, backgroundColor: '#315b76', borderRadius: 2 },
  layerTitle: { fontSize: 14, fontWeight: '800', color: '#315b76' },
  materialRow: { marginBottom: 16 },
  materialTypeLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  materialCard: { width: 140, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, padding: 10, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
  materialCardActive: { borderColor: '#10b981', backgroundColor: '#ecfdf5', borderWidth: 1.5 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  cardImageWrapper: { width: '100%', height: 80, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  cardImage: { width: '100%', height: '100%' },
  placeholderImg: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 13, fontWeight: '800', color: '#10b981' },
  cardUnit: { fontSize: 10, color: '#94a3b8' },
  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});