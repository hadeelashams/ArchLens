import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db, createDocument, getRoofingPerspectives, CONSTRUCTION_HIERARCHY } from '@archlens/shared';
import type { RoofingPerspective } from '@archlens/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// @ts-ignore
const getRoofConfig = (roofType: string) => CONSTRUCTION_HIERARCHY['Roof']?.subCategories?.[roofType];

const getMaterialTypesForRoofType = (roofType: string): string[] => {
  const c = getRoofConfig(roofType);
  if (!c) return [];
  if (Array.isArray(c)) return c;
  return Object.values(c).flat() as string[];
};

const getMaterialGroupsForRoofType = (roofType: string): { groupName: string; types: string[] }[] => {
  const c = getRoofConfig(roofType);
  if (!c) return [];
  if (Array.isArray(c)) return [{ groupName: '', types: c }];
  return Object.entries(c as Record<string, string[]>).map(([groupName, types]) => ({ groupName, types }));
};

// @ts-ignore
const getAvailableRoofTypes = (): string[] => Object.keys(CONSTRUCTION_HIERARCHY['Roof']?.subCategories || {});

const SHORT_LABEL: Record<string, string> = { 'Sloped Roof - Tile': 'Tile', 'Sloped Roof - Sheet': 'Sheet' };
const SINGLE_SELECT_GROUPS = ['Truss Structure', 'Roof Covering', 'Protection'];
const PITCH_OPTIONS = [
  { label: 'Low (3:12)', value: '0.25', description: '14' },
  { label: 'Standard (6:12)', value: '0.5', description: '27' },
  { label: 'Steep (9:12)', value: '0.75', description: '37' },
  { label: 'Very Steep (12:12)', value: '1.0', description: '45' },
];

export default function RoofingScreen({ route, navigation }: any) {
  const { totalArea: passedArea, projectId, tier = 'Standard' } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [aiPerspectives, setAiPerspectives] = useState<RoofingPerspective[]>([]);
  const [selectedPerspectiveId, setSelectedPerspectiveId] = useState<string | null>(null);
  const [isPerspectiveLoading, setIsPerspectiveLoading] = useState(false);
  const [selectedGroupType, setSelectedGroupType] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [roofType, setRoofType] = useState('Sloped Roof - Tile');
  const [pitchRatio, setPitchRatio] = useState('0.5');
  const [roofArea, setRoofArea] = useState(String(passedArea || 1000));
  const [openingDeduction, setOpeningDeduction] = useState('5');

  const pickByTier = (items: any[]) => {
    if (!items.length) return undefined;
    if (tier === 'Economy') return items[0];
    if (tier === 'Luxury') return items[items.length - 1];
    return items[Math.floor(items.length / 2)];
  };

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', 'in', ['Roof', 'Foundation', 'Structural']));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      const init: Record<string, any> = {};
      getMaterialGroupsForRoofType(roofType).forEach(({ groupName, types }) => {
        (SINGLE_SELECT_GROUPS.includes(groupName) ? [types[0]] : types).forEach(type => {
          const sorted = data.filter(m => m.type === type).sort((a: any, b: any) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0));
          if (sorted.length) init[`${roofType}_${type}`] = pickByTier(sorted);
        });
      });
      setSelections(init);
      setLoading(false);
    });
  }, [tier, roofType]);

  const activeLayers = useMemo(() => [roofType], [roofType]);

  const loadAIPerspectives = async () => {
    setIsPerspectiveLoading(true);
    try {
      const results = await getRoofingPerspectives(tier, parseFloat(roofArea), materials);
      setAiPerspectives(results);
      if (results.length > 0) applyRoofingPerspective(results[0]);
    } catch (e) { console.error('Roofing perspectives error:', e); }
    finally { setIsPerspectiveLoading(false); }
  };

  const applyRoofingPerspective = (p: RoofingPerspective) => {
    const updated = { ...selections };
    activeLayers.forEach(layer => {
      getMaterialTypesForRoofType(layer).forEach(type => {
        const found = materials.find(m => m.id === p.materialSelections?.[type]);
        if (found) updated[`${layer}_${type}`] = found;
      });
    });
    setSelections(updated);
    setSelectedPerspectiveId(p.id);
    const updates: Record<string, string> = {};
    activeLayers.forEach(layer => {
      getMaterialGroupsForRoofType(layer).forEach(({ groupName, types }) => {
        if (!SINGLE_SELECT_GROUPS.includes(groupName)) return;
        const match = types.find(t => p.materialSelections?.[t]);
        if (match) updates[`${layer}__${groupName}`] = match;
      });
    });
    if (Object.keys(updates).length) setSelectedGroupType(prev => ({ ...prev, ...updates }));
  };

  const getActiveGroupType = (layer: string, groupName: string, types: string[]) =>
    selectedGroupType[`${layer}__${groupName}`] ?? types[0];

  const handleGroupTypeTab = (layer: string, groupName: string, type: string, prev: string) => {
    setSelectedGroupType(s => ({ ...s, [`${layer}__${groupName}`]: type }));
    if (prev !== type) setSelections(s => { const u = { ...s }; delete u[`${layer}_${prev}`]; return u; });
  };

  const handleMaterialSelect = (layer: string, type: string, item: any, groupName: string, groupTypes: string[]) => {
    const updated = { ...selections };
    if (SINGLE_SELECT_GROUPS.includes(groupName)) groupTypes.forEach(t => { if (t !== type) delete updated[`${layer}_${t}`]; });
    updated[`${layer}_${type}`] = item;
    setSelections(updated);
  };

  const handleSave = () => {
    const cleaned = { ...selections };
    let selectedCovering: string | undefined;
    activeLayers.forEach(layer => {
      getMaterialGroupsForRoofType(layer).forEach(({ groupName, types }) => {
        if (!SINGLE_SELECT_GROUPS.includes(groupName)) return;
        const active = getActiveGroupType(layer, groupName, types);
        types.forEach(t => { if (t !== active) delete cleaned[`${layer}_${t}`]; });
        if (groupName === 'Roof Covering') selectedCovering = active;
      });
    });
    navigation.navigate('RoofingCostScreen', { projectId, tier, roofType, roofArea, openingDeduction, pitchRatio, selectedCovering, selections: cleaned });
  };

  const MaterialCard = ({ item, selected, onPress }: { item: any; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.materialCard, selected && styles.materialCardActive]} onPress={onPress}>
      {selected && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
      <View style={styles.cardImageWrapper}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} /> : <View style={styles.placeholderImg}><Ionicons name="cube-outline" size={24} color="#94a3b8" /></View>}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardPrice}>₹{item.pricePerUnit}</Text>
          <Text style={styles.cardUnit}>/{item.unit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  const tierColor = tier === 'Economy' ? '#10b981' : tier === 'Luxury' ? '#8b5cf6' : '#3b82f6';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Roofing System</Text>
          <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>ROOF CONFIGURATION</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15 }}>
            {getAvailableRoofTypes().map(type => (
              <TouchableOpacity key={type} style={[styles.methodTab, { flex: 1 }, roofType === type && styles.methodTabActive]} onPress={() => setRoofType(type)}>
                <Text style={[styles.methodText, roofType === type && styles.methodTextActive]}>{SHORT_LABEL[type] ?? type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={styles.sectionLabel}>ROOF PITCH</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {PITCH_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={[styles.methodTab, { flex: 1, minWidth: 70 }, pitchRatio === opt.value && styles.methodTabActive]} onPress={() => setPitchRatio(opt.value)}>
                  <Text style={[styles.methodText, { fontSize: 11 }, pitchRatio === opt.value && styles.methodTextActive]}>{opt.label}</Text>
                  <Text style={{ fontSize: 9, color: pitchRatio === opt.value ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: 2 }}>{opt.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.perspectivesSection}>
            <View style={styles.perspectivesHeader}>
              <Text style={styles.sectionLabel}>AI GENERATED OPTIONS</Text>
              <TouchableOpacity style={[styles.regenerateBtn, isPerspectiveLoading && { opacity: 0.6 }]} onPress={loadAIPerspectives} disabled={isPerspectiveLoading}>
                {isPerspectiveLoading ? <ActivityIndicator size="small" color="#315b76" /> : <><Ionicons name="refresh" size={12} color="#315b76" /><Text style={styles.regenerateBtnText}>Refresh</Text></>}
              </TouchableOpacity>
            </View>
            {isPerspectiveLoading ? (
              <View style={styles.perspectiveLoadingCard}>
                <ActivityIndicator size="large" color="#315b76" />
                <Text style={styles.perspectiveLoadingText}>Generating {tier} roofing options</Text>
              </View>
            ) : aiPerspectives.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                {aiPerspectives.map(p => {
                  const isSelected = selectedPerspectiveId === p.id;
                  return (
                    <TouchableOpacity key={p.id} style={[styles.perspectiveCard, isSelected && styles.perspectiveCardSelected]} onPress={() => applyRoofingPerspective(p)} activeOpacity={0.8}>
                      <View style={styles.perspectiveCardHeader}>
                        <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                          <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}>Option {p.id}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.perspectiveTitle, isSelected && { color: '#315b76' }]}>{p.title}</Text>
                          <Text style={styles.perspectiveSubtitle}>{p.subtitle}</Text>
                        </View>
                        <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={isSelected ? '#315b76' : '#cbd5e1'} />
                      </View>
                      <View style={styles.perspectiveFocusRow}>
                        <Ionicons name="flash-outline" size={11} color="#94a3b8" />
                        <Text style={styles.perspectiveFocusText} numberOfLines={2}>
                          {p.description.replace(/^(this option|this approach|this perspective)[,:]?\s*/i, '').replace(/^[a-z]/, c => c.toUpperCase())}
                        </Text>
                      </View>
                      <View style={styles.perspectiveMaterials}>
                        {Object.entries(p.materialSelections || {}).slice(0, 3).map(([type, matId]) => {
                          const mat = materials.find(m => m.id === matId);
                          return mat ? <Text key={type} style={styles.perspectiveMaterialItem}>{type}: {mat.name}  ₹{mat.pricePerUnit}/{mat.unit}</Text> : null;
                        })}
                      </View>
                      <View style={styles.perspectiveTags}>
                        {p.tags.map(tag => <View key={tag} style={styles.perspectiveTagChip}><Text style={styles.perspectiveTagText}>{tag}</Text></View>)}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <TouchableOpacity style={styles.loadPerspectivesBtn} onPress={loadAIPerspectives}>
                <Ionicons name="sparkles" size={16} color="#315b76" />
                <Text style={styles.loadPerspectivesBtnText}>Generate AI Options</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.paramsSection}>
            <Text style={styles.sectionLabel}>ROOF DIMENSIONS</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Total Area (sq.ft)</Text>
                <View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={roofArea} onChangeText={setRoofArea} keyboardType="numeric" /></View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Openings Deduction (%)</Text>
                <View style={styles.textInputWrapper}><TextInput style={styles.textInput} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" /></View>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>MATERIAL SPECIFICATION ({tier})</Text>
          {activeLayers.map(layer => (
            <View key={layer} style={styles.layerContainer}>
              <View style={styles.layerTitleRow}>
                <View style={styles.layerTitleDot} />
                <Text style={styles.layerTitle}>{layer}</Text>
              </View>
              {getMaterialGroupsForRoofType(layer).map(({ groupName, types }) => (
                <View key={groupName || 'default'}>
                  {groupName && groupName !== 'System' && (
                    <View style={styles.groupHeaderRow}>
                      <Ionicons name="play" size={9} color="#315b76" />
                      <Text style={styles.groupHeaderText}>{groupName}</Text>
                    </View>
                  )}
                  {SINGLE_SELECT_GROUPS.includes(groupName) ? (
                    <View>
                      <View style={styles.trussTabRow}>
                        {types.map(t => {
                          const active = getActiveGroupType(layer, groupName, types);
                          return (
                            <TouchableOpacity key={t} style={[styles.trussTab, active === t && styles.trussTabActive]} onPress={() => handleGroupTypeTab(layer, groupName, t, active)}>
                              <Text style={[styles.trussTabText, active === t && styles.trussTabTextActive]}>{t}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {(() => {
                        const activeType = getActiveGroupType(layer, groupName, types);
                        const selKey = `${layer}_${activeType}`;
                        return (
                          <View style={styles.materialRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                              {materials.filter(m => m.type === activeType).map(item => (
                                <MaterialCard key={item.id} item={item} selected={selections[selKey]?.id === item.id} onPress={() => handleMaterialSelect(layer, activeType, item, groupName, types)} />
                              ))}
                            </ScrollView>
                          </View>
                        );
                      })()}
                    </View>
                  ) : (
                    types.map(type => {
                      const selKey = `${layer}_${type}`;
                      return (
                        <View key={type} style={styles.materialRow}>
                          <Text style={styles.materialTypeLabel}>{type}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                            {materials.filter(m => m.type === type).map(item => (
                              <MaterialCard key={item.id} item={item} selected={selections[selKey]?.id === item.id} onPress={() => handleMaterialSelect(layer, type, item, groupName, types)} />
                            ))}
                          </ScrollView>
                        </View>
                      );
                    })
                  )}
                </View>
              ))}
            </View>
          ))}

          <View style={{ height: 120 }} />
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
  perspectivesSection: { marginBottom: 18 },
  perspectivesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  regenerateBtnText: { fontSize: 11, color: '#315b76', fontWeight: '700' },
  perspectiveLoadingCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  perspectiveLoadingText: { fontSize: 12, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  perspectiveCard: { width: 300, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  perspectiveCardSelected: { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2 },
  perspectiveCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  optionBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 64, alignItems: 'center' },
  optionBadgeSelected: { backgroundColor: '#315b76', borderColor: '#315b76' },
  optionBadgeText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  optionBadgeTextSelected: { color: '#fff' },
  perspectiveTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  perspectiveSubtitle: { fontSize: 10, color: '#64748b', marginTop: 1 },
  perspectiveFocusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 8 },
  perspectiveFocusText: { fontSize: 11, color: '#475569', fontWeight: '500', flex: 1, lineHeight: 15 },
  perspectiveMaterials: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 3 },
  perspectiveMaterialItem: { fontSize: 10, color: '#315b76', fontWeight: '600' },
  perspectiveTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  perspectiveTagChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  perspectiveTagText: { fontSize: 9, color: '#64748b', fontWeight: '700' },
  loadPerspectivesBtn: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#315b76' },
  loadPerspectivesBtnText: { fontSize: 13, color: '#315b76', fontWeight: '700' },
  paramsSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputContainer: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  textInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  textInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  layerContainer: { marginBottom: 24 },
  layerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  layerTitleDot: { width: 4, height: 16, backgroundColor: '#315b76', borderRadius: 2 },
  layerTitle: { fontSize: 14, fontWeight: '800', color: '#315b76' },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8, paddingLeft: 2 },
  groupHeaderText: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.3 },
  trussTabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trussTab: { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  trussTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  trussTabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  trussTabTextActive: { color: '#fff' },
  materialRow: { marginBottom: 16 },
  materialTypeLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  materialCard: { width: 140, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, padding: 10, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2 },
  materialCardActive: { borderColor: '#315b76', backgroundColor: '#eff6ff', borderWidth: 2 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#315b76', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  cardImageWrapper: { width: '100%', height: 80, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  cardImage: { width: '100%', height: '100%' },
  placeholderImg: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 13, fontWeight: '800', color: '#315b76' },
  cardUnit: { fontSize: 10, color: '#94a3b8' },
  mainBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 6 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
