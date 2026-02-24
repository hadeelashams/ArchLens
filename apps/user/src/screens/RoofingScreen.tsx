import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db, getRoofingPerspectives, CONSTRUCTION_HIERARCHY } from '@archlens/shared';
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

// ── Shared sort comparator ────────────────────────────────────────────────────
const byPrice = (a: any, b: any) => (parseFloat(a.pricePerUnit) || 0) - (parseFloat(b.pricePerUnit) || 0);

const ROOF_SHAPES = [
  { id: 'gable', label: 'Pitched / Gable', subtitle: 'Simple, cheap, great drainage', icon: 'home-outline', accent: '#3b82f6' },
  { id: 'flat', label: 'Flat Roof', subtitle: 'Easy construction, urban-friendly', icon: 'remove-circle-outline', accent: '#10b981' },
  { id: 'hip', label: 'Hip Roof', subtitle: 'Better wind resistance', icon: 'stats-chart-outline', accent: '#f97316' },
  { id: 'shed', label: 'Shed Roof', subtitle: 'Single-slope, modern form', icon: 'trending-up-outline', accent: '#8b5cf6' },
] as const;

type RoofShapeId = typeof ROOF_SHAPES[number]['id'];

// Flat → Slab System; everything else → Structural System
const getStructuralLabel = (shape: RoofShapeId) =>
  shape === 'flat' ? 'SUPPORT SYSTEM' : 'STRUCTURAL SYSTEM';

// Protection is multi-select (user can pick Underlayment AND Membrane together)
const SINGLE_SELECT_GROUPS = ['Truss Structure', 'Structural Support', 'Roof Covering', 'Slab Core'];

// Types that must NOT be shown for a given roofType.
// Tile roofs only need underlayment — waterproof membrane is for flat/slab roofs.
const HIDDEN_PROTECTION_TYPES: Record<string, string[]> = {
  'Sloped Roof - Tile': ['Waterproof Membrane'],
};

const PITCH_OPTIONS = [
  { label: 'Low (3:12)', value: '0.25', description: '14' },
  { label: 'Standard (6:12)', value: '0.5', description: '27' },
  { label: 'Steep (9:12)', value: '0.75', description: '37' },
  { label: 'Very Steep (12:12)', value: '1.0', description: '45' },
];

// High-level covering toggle options
const COVERING_OPTIONS = [
  { value: 'tile' as const, icon: 'grid-outline' as const, label: 'Tile' },
  { value: 'sheet' as const, icon: 'layers-outline' as const, label: 'Sheet' },
];

const PERSP_META: Record<string, { color: string; icon: string; shortLabel: string }> = {
  'Aesthetic': { color: '#8b5cf6', icon: 'diamond-outline', shortLabel: 'Aesthetic' },
  'Basic Performance': { color: '#10b981', icon: 'flash-outline', shortLabel: 'Performance' },
  'Strength': { color: '#f97316', icon: 'shield-outline', shortLabel: 'Strength' },
};
const getPerspMeta = (type?: string) =>
  PERSP_META[type ?? ''] ?? { color: '#315b76', icon: 'star-outline', shortLabel: type ?? 'Option' };

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
  const [roofShape, setRoofShape] = useState<RoofShapeId>('gable');
  const [coveringChoice, setCoveringChoice] = useState<'tile' | 'sheet'>('tile');
  const [roofType, setRoofType] = useState('Sloped Roof - Tile');
  const [pitchRatio, setPitchRatio] = useState('0.5');
  const [roofArea, setRoofArea] = useState(String(passedArea || 1000));
  const [openingDeduction, setOpeningDeduction] = useState('5');
  const [pitchDropdownOpen, setPitchDropdownOpen] = useState(false);

  // ── Tier picker helper ────────────────────────────────────────────────────
  const pickByTier = (items: any[]) => {
    if (!items.length) return undefined;
    if (tier === 'Economy') return items[0];
    if (tier === 'Luxury') return items[items.length - 1];
    return items[Math.floor(items.length / 2)];
  };

  // ── Shared: get the default material for a type ───────────────────────────
  const getDefaultMaterial = (type: string, matList: any[] = materials) => {
    const sorted = matList.filter(m => m.type === type).sort(byPrice);
    return pickByTier(sorted);
  };

  // ── Shared: seed initial selections for a given roofType ─────────────────
  const seedSelections = (rt: string, matList: any[]): Record<string, any> => {
    const init: Record<string, any> = {};
    getMaterialGroupsForRoofType(rt).forEach(({ groupName, types }) => {
      const typesToSeed = SINGLE_SELECT_GROUPS.includes(groupName) ? [types[0]] : types;
      typesToSeed.forEach(type => {
        const mat = getDefaultMaterial(type, matList);
        if (mat) init[`${rt}_${type}`] = mat;
      });
    });
    return init;
  };

  // ── Firestore listener: fires ONCE on mount (and on tier change) ─────────
  // Seeds initial selections for the DEFAULT roofType only.
  // Subsequent roofType changes are handled by the cleanup useEffect below.
  useEffect(() => {
    const currentRoofType = roofShape === 'flat' ? 'Slab'
      : (coveringChoice === 'sheet' ? 'Sloped Roof - Sheet' : 'Sloped Roof - Tile');
    const q = query(collection(db, 'materials'), where('category', 'in', ['Roof', 'Foundation', 'Structural']));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      setSelections(seedSelections(currentRoofType, data));
      setLoading(false);
    });
  }, [tier]); // ← only re-seed on tier change, NOT on roofType change

  // ── Cleanup and Sync on Roof Type Change ─────────────────────────────────
  useEffect(() => {
    if (!materials.length) return;

    // 1. Identify valid types for the new roofType
    const groups = getMaterialGroupsForRoofType(roofType);
    const validTypes = new Set<string>();
    const newSelectedGroupType: Record<string, string> = {};

    groups.forEach(({ groupName, types }) => {
      types.forEach(t => validTypes.add(t));
      if (SINGLE_SELECT_GROUPS.includes(groupName)) {
        const current = selectedGroupType[`${roofType}__${groupName}`];
        newSelectedGroupType[`${roofType}__${groupName}`] =
          (current && types.includes(current)) ? current : types[0];
      }
    });

    // 2. Filter selections to remove incompatible/leftover materials from other roof types
    setSelections(prev => {
      const next: Record<string, any> = {};
      // Only keep selections that match the current roofType AND are of a valid type
      Object.keys(prev).forEach(key => {
        if (key.startsWith(`${roofType}_`)) {
          const type = key.replace(`${roofType}_`, '');
          if (validTypes.has(type)) next[key] = prev[key];
        }
      });

      // 3. Auto-populate if some required fields are now empty
      groups.forEach(({ groupName, types }) => {
        const activeType = SINGLE_SELECT_GROUPS.includes(groupName)
          ? (newSelectedGroupType[`${roofType}__${groupName}`] || types[0])
          : null;

        const typesToFill = activeType ? [activeType] : types;
        typesToFill.forEach(type => {
          const selKey = `${roofType}_${type}`;
          if (!next[selKey]) {
            const mat = getDefaultMaterial(type);
            if (mat) next[selKey] = mat;
          }
        });
      });

      return next;
    });

    setSelectedGroupType(prev => ({ ...prev, ...newSelectedGroupType }));
  }, [roofType, materials.length]);

  // ── Sync roofType from roofShape + coveringChoice ────────────────────────
  useEffect(() => {
    if (roofShape === 'flat') {
      setRoofType('Slab');
    } else {
      setRoofType(coveringChoice === 'sheet' ? 'Sloped Roof - Sheet' : 'Sloped Roof - Tile');
    }
  }, [roofShape, coveringChoice]);

  // ── Derive structural group name and options for the current roofType ─────
  const structuralGroupName = roofShape === 'flat' ? 'Structural Support' : 'Truss Structure';
  const structuralOptions = useMemo(() => {
    const groups = getMaterialGroupsForRoofType(roofType);
    const g = groups.find(({ groupName }) => groupName === structuralGroupName);
    return g ? g.types : [];
  }, [roofType, structuralGroupName]);

  // ── AI perspectives ───────────────────────────────────────────────────────
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
    const validRoofTypes = getAvailableRoofTypes();
    const isValidRecommended = !!(p.recommendedRoofType && validRoofTypes.includes(p.recommendedRoofType));
    const targetLayer = isValidRecommended ? p.recommendedRoofType! : roofType;

    if (isValidRecommended) setRoofType(p.recommendedRoofType!);
    if (p.recommendedRoofShape) setRoofShape(p.recommendedRoofShape as any);

    const updated = { ...selections };
    getMaterialTypesForRoofType(targetLayer).forEach(type => {
      const found = materials.find(m => m.id === p.materialSelections?.[type]);
      if (found) updated[`${targetLayer}_${type}`] = found;
    });
    setSelections(updated);
    setSelectedPerspectiveId(p.id);

    const updates: Record<string, string> = {};
    getMaterialGroupsForRoofType(targetLayer).forEach(({ groupName, types }) => {
      if (!SINGLE_SELECT_GROUPS.includes(groupName)) return;
      const match = types.find(t => p.materialSelections?.[t]);
      if (match) updates[`${targetLayer}__${groupName}`] = match;
    });
    if (Object.keys(updates).length) setSelectedGroupType(prev => ({ ...prev, ...updates }));
  };

  const getActiveGroupType = (layer: string, groupName: string, types: string[]) =>
    selectedGroupType[`${layer}__${groupName}`] ?? types[0];

  const handleGroupTypeTab = (layer: string, groupName: string, type: string, prev: string) => {
    setSelectedGroupType(s => ({ ...s, [`${layer}__${groupName}`]: type }));
    if (prev !== type) {
      setSelections(s => {
        const u = { ...s };
        delete u[`${layer}_${prev}`];
        const auto = getDefaultMaterial(type);
        if (auto) u[`${layer}_${type}`] = auto;
        return u;
      });
    }
  };

  const handleMaterialSelect = (layer: string, type: string, item: any, groupName: string, groupTypes: string[]) => {
    const updated = { ...selections };
    if (SINGLE_SELECT_GROUPS.includes(groupName)) {
      groupTypes.forEach(t => { if (t !== type) delete updated[`${layer}_${t}`]; });
      setSelectedGroupType(s => ({ ...s, [`${layer}__${groupName}`]: type }));
    }
    updated[`${layer}_${type}`] = item;
    setSelections(updated);
  };

  const handleSave = () => {
    const groups = getMaterialGroupsForRoofType(roofType);

    // ── Step 1: Build a NORMALISED selections map ───────────────────────────
    const allValidTypes = new Set<string>(groups.flatMap(g => g.types));
    const normalised: Record<string, any> = {};

    // First pass: keep everything already keyed under the current roofType
    Object.keys(selections).forEach(key => {
      if (key.startsWith(`${roofType}_`)) {
        const type = key.slice(`${roofType}_`.length);
        if (allValidTypes.has(type)) normalised[key] = selections[key];
      }
    });

    // Second pass: rescue types still missing from OTHER roofType keys
    allValidTypes.forEach(type => {
      const canonicalKey = `${roofType}_${type}`;
      if (!normalised[canonicalKey]) {
        const suffix = `_${type}`;
        const rescue = Object.keys(selections).find(k => k.endsWith(suffix));
        if (rescue) normalised[canonicalKey] = selections[rescue];
      }
    });

    // ── Step 2: Validate & finalise ─────────────────────────────────────────
    const cleaned = { ...normalised };
    let structuralSelected = false;
    let coveringSelected = false;
    let protectionSelected = false;
    let selectedCovering: string | undefined;

    groups.forEach(({ groupName, types }) => {
      if (SINGLE_SELECT_GROUPS.includes(groupName)) {
        const active = getActiveGroupType(roofType, groupName, types);
        types.forEach(t => { if (t !== active) delete cleaned[`${roofType}_${t}`]; });

        if (groupName === 'Roof Covering' || groupName === 'Slab Core') selectedCovering = active;

        const selKey = `${roofType}_${active}`;
        const isStructuralGroup = groupName === 'Truss Structure' || groupName === 'Structural Support' || groupName === 'Slab Core';

        if (isStructuralGroup) {
          // RCC Beams is auto-calculated, so it counts as selected even without a material card
          if (active === 'RCC Beams' || cleaned[selKey]) structuralSelected = true;
        }

        if (groupName === 'Roof Covering') {
          if (cleaned[selKey]) coveringSelected = true;
        }
      } else {
        // Multi-select groups (Protection)
        types.forEach(t => {
          if (cleaned[`${roofType}_${t}`]) {
            if (groupName === 'Protection') protectionSelected = true;
          }
        });
      }
    });

    // ── Step 3: Guard rails ─────────────────────────────────────────────────
    if (!structuralSelected) {
      return Alert.alert('Missing Structure', 'Please select a structural system or support system (Beams/Truss) for a realistic estimate.');
    }

    // For Sloped, we need Roof Covering. For Flat, we need Slab Core.
    const coveringNeeded = (roofType === 'Slab' ? 'Slab Design' : 'Roof Covering');
    const isCoveringFilled = (roofType === 'Slab')
      ? !!cleaned[`${roofType}_${selectedCovering}`]
      : coveringSelected;

    if (!isCoveringFilled) {
      return Alert.alert(`Missing ${coveringNeeded}`, `Please select a ${coveringNeeded} material.`);
    }

    // Auto-apply first VISIBLE protection layer if none chosen
    // Respects HIDDEN_PROTECTION_TYPES — e.g. Tile roofs only get Underlayment, never Membrane
    if (!protectionSelected) {
      const protectionGroup = groups.find(g => g.groupName === 'Protection');
      if (protectionGroup) {
        const hiddenTypes = HIDDEN_PROTECTION_TYPES[roofType] ?? [];
        const defaultType = protectionGroup.types.find(t => !hiddenTypes.includes(t));
        if (defaultType) {
          const mat = getDefaultMaterial(defaultType);
          if (mat) cleaned[`${roofType}_${defaultType}`] = mat;
        }
      }
    }

    navigation.navigate('RoofingCostScreen', {
      projectId,
      tier,
      roofType,
      roofShape,
      coveringChoice,
      roofArea,
      openingDeduction,
      pitchRatio: roofShape === 'flat' ? '0' : pitchRatio,
      selectedCovering,
      selections: cleaned,
    });
  };

  // ── Sub-components ────────────────────────────────────────────────────────
  const HierChainItem = ({ icon, label }: { icon: any; label?: string }) =>
    label ? (
      <View style={styles.hierItem}>
        <Ionicons name={icon} size={9} color="#475569" />
        <Text style={styles.hierItemText} numberOfLines={1}>{label}</Text>
      </View>
    ) : null;

  const MaterialCard = ({ item, selected, onPress }: { item: any; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.materialCard, selected && styles.materialCardActive]} onPress={onPress}>
      {selected && <View style={styles.checkBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
      <View style={styles.cardImageWrapper}>
        {item.imageUrl
          ? <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          : <View style={styles.placeholderImg}><Ionicons name="cube-outline" size={24} color="#94a3b8" /></View>}
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

  // ── Pre-computed values for render (avoids repeated calls inside JSX) ─────
  const activeStructural = getActiveGroupType(roofType, structuralGroupName, structuralOptions);
  const selectedPitchOption = PITCH_OPTIONS.find(o => o.value === pitchRatio);

  // Covering section variables (for sloped roofs or Slab Core for flat)
  const coveringGroups = getMaterialGroupsForRoofType(roofType);
  const coveringGroup = coveringGroups.find(g => g.groupName === (roofShape === 'flat' ? 'Slab Core' : 'Roof Covering'));
  const coveringTypes = coveringGroup?.types ?? [];
  const activeCoveringType = getActiveGroupType(roofType, coveringGroup?.groupName || 'Roof Covering', coveringTypes);

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

          {/* ════ TOP: AI GENERATED OPTIONS ══════════════════════════════════ */}
          <View style={styles.perspectivesSection}>
            <View style={styles.perspectivesHeader}>
              <Text style={styles.sectionLabel}>AI GENERATED OPTIONS</Text>
              <TouchableOpacity
                style={[styles.regenerateBtn, isPerspectiveLoading && { opacity: 0.6 }]}
                onPress={loadAIPerspectives}
                disabled={isPerspectiveLoading}
              >
                {isPerspectiveLoading
                  ? <ActivityIndicator size="small" color="#315b76" />
                  : <><Ionicons name="refresh" size={12} color="#315b76" /><Text style={styles.regenerateBtnText}>Refresh</Text></>}
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
                  const meta = getPerspMeta(p.perspectiveType);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.perspectiveCard, isSelected && styles.perspectiveCardSelected, { borderLeftWidth: 3, borderLeftColor: meta.color }]}
                      onPress={() => applyRoofingPerspective(p)}
                      activeOpacity={0.8}
                    >
                      {/* Perspective type + check */}
                      <View style={styles.perspCardTopRow}>
                        <View style={[styles.perspTypeBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '50' }]}>
                          <Ionicons name={meta.icon as any} size={10} color={meta.color} />
                          <Text style={[styles.perspTypeBadgeText, { color: meta.color }]}>{meta.shortLabel}</Text>
                        </View>
                        <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                          <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]}>Option {p.id}</Text>
                        </View>
                        <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isSelected ? '#315b76' : '#cbd5e1'} />
                      </View>

                      {/* Title / subtitle */}
                      <Text style={[styles.perspectiveTitle, isSelected && { color: '#315b76' }]}>{p.title}</Text>
                      <Text style={styles.perspectiveSubtitle}>{p.subtitle}</Text>

                      {/* 4-level hierarchy chain */}
                      {(p.recommendedRoofShape || p.recommendedRoofType || p.recommendedCoveringMethod) && (
                        <View style={styles.hierChain}>
                          <HierChainItem icon="home-outline" label={p.recommendedRoofShape === 'gable' ? 'Pitched' : p.recommendedRoofShape} />
                          {p.recommendedRoofType && (
                            <>
                              <Ionicons name="chevron-forward" size={9} color="#94a3b8" />
                              <HierChainItem icon="layers-outline" label={p.recommendedRoofType} />
                            </>
                          )}                          {p.recommendedCoveringMethod && (
                            <>
                              <Ionicons name="chevron-forward" size={9} color="#94a3b8" />
                              <HierChainItem icon="grid-outline" label={p.recommendedCoveringMethod} />
                            </>
                          )}
                          {p.recommendedConstructionMethod && (
                            <>
                              <Ionicons name="chevron-forward" size={9} color="#94a3b8" />
                              <HierChainItem icon="construct-outline" label={p.recommendedConstructionMethod} />
                            </>
                          )}
                        </View>
                      )}

                      {/* Description */}
                      <View style={styles.perspectiveFocusRow}>
                        <Ionicons name="flash-outline" size={11} color="#94a3b8" />
                        <Text style={styles.perspectiveFocusText} numberOfLines={2}>
                          {p.description.replace(/^(this option|this approach|this perspective)[,:]?\s*/i, '').replace(/^[a-z]/, c => c.toUpperCase())}
                        </Text>
                      </View>

                      {/* Reasoning */}
                      {p.reasoning ? (
                        <View style={styles.reasoningRow}>
                          <Ionicons name="information-circle-outline" size={11} color="#64748b" />
                          <Text style={styles.reasoningText} numberOfLines={2}>{p.reasoning}</Text>
                        </View>
                      ) : null}

                      {/* Material preview */}
                      <View style={styles.perspectiveMaterials}>
                        {Object.entries(p.materialSelections || {}).slice(0, 3).map(([type, matId]) => {
                          const mat = materials.find(m => m.id === matId);
                          return mat ? <Text key={type} style={styles.perspectiveMaterialItem}>{type}: {mat.name}  ₹{mat.pricePerUnit}/{mat.unit}</Text> : null;
                        })}
                      </View>

                      {/* Tags */}
                      <View style={styles.perspectiveTags}>
                        {p.tags.map(tag => (
                          <View key={tag} style={[styles.perspectiveTagChip, { borderColor: meta.color + '60' }]}>
                            <Text style={[styles.perspectiveTagText, { color: meta.color }]}>{tag}</Text>
                          </View>
                        ))}
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

          {/* ════ Step 1: Roof Shape ════════════════════════════════════════ */}
          <Text style={styles.sectionLabel}>STEP 1 · ROOF TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 18 }}>
            {ROOF_SHAPES.map(shape => {
              const active = roofShape === shape.id;
              return (
                <TouchableOpacity
                  key={shape.id}
                  style={[styles.shapeCardSmall, active && { borderColor: shape.accent, backgroundColor: '#f0f9ff', borderWidth: 2 }]}
                  onPress={() => setRoofShape(shape.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.shapeIconCircle, { backgroundColor: active ? shape.accent : '#f1f5f9' }]}>
                    <Ionicons name={shape.icon as any} size={18} color={active ? '#fff' : '#94a3b8'} />
                  </View>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <Text style={[styles.shapeLabel, { fontSize: 12 }, active && { color: shape.accent }]} numberOfLines={1}>{shape.label}</Text>
                    <Text style={[styles.shapeSubtitle, { fontSize: 10 }]} numberOfLines={2}>{shape.subtitle}</Text>
                  </View>
                  {active && (
                    <View style={[styles.shapeCheckBadge, { backgroundColor: shape.accent }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ════ ROOF DIMENSIONS ══════════════════════════════════════════ */}
          <Text style={styles.sectionLabel}>ROOF DIMENSIONS</Text>
          <View style={styles.paramsSection}>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Total Area (sq.ft)</Text>
                <View style={styles.textInputWrapper}>
                  <TextInput style={styles.textInput} value={roofArea} onChangeText={setRoofArea} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Openings Deduction (%)</Text>
                <View style={styles.textInputWrapper}>
                  <TextInput style={styles.textInput} value={openingDeduction} onChangeText={setOpeningDeduction} keyboardType="numeric" />
                </View>
              </View>
            </View>

            {/* Roof Pitch (sloped roofs only) */}
            {roofShape !== 'flat' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>Roof Pitch</Text>
                <TouchableOpacity
                  style={[styles.pitchDropdownBtn, pitchDropdownOpen && styles.pitchDropdownBtnActive]}
                  onPress={() => setPitchDropdownOpen(!pitchDropdownOpen)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pitchDropdownLabel}>{selectedPitchOption?.label || 'Select Pitch'}</Text>
                    <Text style={styles.pitchDropdownValue}>{selectedPitchOption?.description}° angle</Text>
                  </View>
                  <Ionicons name={pitchDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#315b76" />
                </TouchableOpacity>

                {pitchDropdownOpen && (
                  <View style={styles.pitchDropdownList}>
                    {PITCH_OPTIONS.map(opt => {
                      const isSelected = pitchRatio === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.pitchDropdownItem, isSelected && styles.pitchDropdownItemActive]}
                          onPress={() => { setPitchRatio(opt.value); setPitchDropdownOpen(false); }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pitchDropdownItemLabel, isSelected && { color: '#315b76' }]}>{opt.label}</Text>
                            <Text style={[styles.pitchDropdownItemDesc, isSelected && { color: '#315b76' }]}>
                              {opt.description}° angle ({roofShape === 'shed' ? 'single-slope' : 'two-slope'})
                            </Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={20} color="#315b76" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ════ Step 2: Structural / Slab System + Materials ════════════ */}
          <View style={{ marginBottom: 18 }}>
            <Text style={styles.sectionLabel}>STEP 2 · {getStructuralLabel(roofShape)}</Text>
            <View style={styles.structuralRow}>
              {structuralOptions.map(opt => {
                const isActive = activeStructural === opt;
                const accent = ROOF_SHAPES.find(s => s.id === roofShape)?.accent ?? '#315b76';
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.structuralCard, isActive && { borderColor: accent, backgroundColor: '#f0f9ff', borderWidth: 2 }]}
                    onPress={() => handleGroupTypeTab(roofType, structuralGroupName, opt, activeStructural)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.structuralCardLabel, isActive && { color: accent }]}>{opt}</Text>
                    {isActive && <View style={[styles.structuralDot, { backgroundColor: accent }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Structural Materials */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>Available {structuralGroupName} Options:</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                {materials.filter(m => m.type === activeStructural).map(item => (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    selected={selections[`${roofType}_${activeStructural}`]?.id === item.id}
                    onPress={() => handleMaterialSelect(roofType, activeStructural, item, structuralGroupName, structuralOptions)}
                  />
                ))}
                {materials.filter(m => m.type === activeStructural).length === 0 && activeStructural !== 'RCC Beams' && (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Ionicons name="alert-circle-outline" size={24} color="#94a3b8" />
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>No materials found for {activeStructural}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          {/* ════ Step 3: Roof Covering / Slab Design ════════════════════════ */}
          <View style={{ marginBottom: 18 }}>
            <Text style={styles.sectionLabel}>
              STEP 3 · {roofShape === 'flat' ? 'SLAB DESIGN' : 'COVERING TYPE'}
            </Text>

            {/* High-level Tile / Sheet toggle (sloped only) */}
            {roofShape !== 'flat' && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>Covering Material Category</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  {COVERING_OPTIONS.map(({ value, icon, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.coveringCard, coveringChoice === value && { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2 }]}
                      onPress={() => setCoveringChoice(value)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon} size={16} color={coveringChoice === value ? '#315b76' : '#94a3b8'} />
                      <Text style={[styles.coveringLabel, coveringChoice === value && { color: '#315b76' }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Sub-type tabs (e.g. GI / Alum / Polycarbonate) - ONLY shown for Sheet */}
            {coveringChoice === 'sheet' && roofShape !== 'flat' && coveringTypes.length > 1 && (
              <View style={styles.trussTabRow}>
                {coveringTypes.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.trussTab, activeCoveringType === t && styles.trussTabActive]}
                    onPress={() => handleGroupTypeTab(roofType, 'Roof Covering', t, activeCoveringType)}
                  >
                    <Text style={[styles.trussTabText, activeCoveringType === t && styles.trussTabTextActive]} numberOfLines={2}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Material cards */}
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 10 }}>
              {roofShape === 'flat' ? 'Select Slab Type:' : (coveringChoice === 'tile' ? 'Select Tile material:' : `Select ${activeCoveringType}:`)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {materials
                .filter(m => (roofShape === 'flat' ? coveringTypes.includes(m.type) : (coveringChoice === 'tile' ? coveringTypes.includes(m.type) : m.type === activeCoveringType)))
                .map(item => (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    selected={selections[`${roofType}_${item.type}`]?.id === item.id}
                    onPress={() => handleMaterialSelect(roofType, item.type, item, coveringGroup?.groupName || 'Roof Covering', coveringTypes)}
                  />
                ))}
              {(roofShape === 'flat' ? materials.filter(m => coveringTypes.includes(m.type)).length : (coveringChoice === 'tile'
                ? materials.filter(m => coveringTypes.includes(m.type)).length
                : materials.filter(m => m.type === activeCoveringType).length)) === 0 && (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Ionicons name="alert-circle-outline" size={24} color="#94a3b8" />
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>No materials found</Text>
                  </View>
                )}
            </ScrollView>
          </View>

          {/* ════ Material Specification ════════════════════════════════════ */}
          <Text style={styles.sectionLabel}>MATERIAL SPECIFICATION ({tier})</Text>
          <View key={roofType} style={styles.layerContainer}>
            <View style={styles.layerTitleRow}>
              <View style={styles.layerTitleDot} />
              <Text style={styles.layerTitle}>{roofType}</Text>
            </View>
            {getMaterialGroupsForRoofType(roofType).map(({ groupName, types }) => {
              // Only show Protection group; Structural and Covering are handled in Steps 2 & 3
              if (groupName === 'Truss Structure' || groupName === 'Structural Support' || groupName === 'Roof Covering' || groupName === 'Slab Core') return null;

              // Filter out protection types that don't apply to this roof type
              // e.g. Waterproof Membrane is hidden for Tile roofs — underlayment only
              const hiddenTypes = HIDDEN_PROTECTION_TYPES[roofType] ?? [];
              const visibleTypes = types.filter(t => !hiddenTypes.includes(t));
              if (!visibleTypes.length) return null;

              const activeType = getActiveGroupType(roofType, groupName, visibleTypes);
              return (
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
                        {visibleTypes.map(t => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.trussTab, activeType === t && styles.trussTabActive]}
                            onPress={() => handleGroupTypeTab(roofType, groupName, t, activeType)}
                          >
                            <Text style={[styles.trussTabText, activeType === t && styles.trussTabTextActive]}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.materialRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                          {materials.filter(m => m.type === activeType).map(item => (
                            <MaterialCard
                              key={item.id}
                              item={item}
                              selected={selections[`${roofType}_${activeType}`]?.id === item.id}
                              onPress={() => handleMaterialSelect(roofType, activeType, item, groupName, visibleTypes)}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  ) : (
                    visibleTypes.map(type => (
                      <View key={type} style={styles.materialRow}>
                        <Text style={styles.materialTypeLabel}>{type}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                          {materials.filter(m => m.type === type).map(item => (
                            <MaterialCard
                              key={item.id}
                              item={item}
                              selected={selections[`${roofType}_${type}`]?.id === item.id}
                              onPress={() => handleMaterialSelect(roofType, type, item, groupName, visibleTypes)}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <TouchableOpacity style={styles.mainBtn} onPress={handleSave}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <><Text style={styles.mainBtnText}>Calculate & Save</Text><Ionicons name="calculator" size={20} color="#fff" /></>}
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
  perspectivesSection: { marginBottom: 18 },
  perspectivesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  regenerateBtnText: { fontSize: 11, color: '#315b76', fontWeight: '700' },
  perspectiveLoadingCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  perspectiveLoadingText: { fontSize: 12, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  perspectiveCard: { width: 300, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  perspectiveCardSelected: { borderColor: '#315b76', backgroundColor: '#f0f9ff', borderWidth: 2 },
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
  pitchDropdownBtn: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, paddingRight: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  pitchDropdownBtnActive: { borderColor: '#315b76', backgroundColor: '#eff6ff' },
  pitchDropdownLabel: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  pitchDropdownValue: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  pitchDropdownList: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 6, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  pitchDropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pitchDropdownItemActive: { backgroundColor: '#eff6ff' },
  pitchDropdownItemLabel: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  pitchDropdownItemDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  layerContainer: { marginBottom: 24 },
  layerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  layerTitleDot: { width: 4, height: 16, backgroundColor: '#315b76', borderRadius: 2 },
  layerTitle: { fontSize: 14, fontWeight: '800', color: '#315b76' },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8, paddingLeft: 2 },
  groupHeaderText: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.3 },
  trussTabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trussTab: { flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  trussTabActive: { backgroundColor: '#f0f9ff', borderColor: '#315b76', borderWidth: 2 },
  trussTabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  trussTabTextActive: { color: '#315b76' },
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
  shapeCardSmall: { minWidth: 150, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#e2e8f0', position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 8 },
  shapeIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  shapeLabel: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 3 },
  shapeSubtitle: { fontSize: 11, color: '#94a3b8', lineHeight: 15 },
  shapeCheckBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  structuralRow: { flexDirection: 'row', gap: 10 },
  structuralCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  structuralCardLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  structuralDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  coveringCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  coveringLabel: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  perspCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  perspTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, flex: 1 },
  perspTypeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  hierChain: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  hierItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hierItemText: { fontSize: 9, fontWeight: '700', color: '#334155', flexShrink: 1, maxWidth: 80 },
  reasoningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
  reasoningText: { fontSize: 10, color: '#64748b', fontStyle: 'italic', flex: 1, lineHeight: 13 },
  autoCalcInfo: { flexDirection: 'row', gap: 10, backgroundColor: '#f0f9ff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#bae6fd', alignItems: 'center', marginTop: 10 },
  autoCalcText: { flex: 1, fontSize: 12, color: '#0369a1', lineHeight: 18, fontWeight: '500' },
});
