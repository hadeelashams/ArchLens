import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, CONSTRUCTION_HIERARCHY, auth, createDocument, loadWallRecommendation } from '@archlens/shared';
import { collection, query, onSnapshot, serverTimestamp, doc, getDoc } from 'firebase/firestore';

// ─── Engineering Constants ────────────────────────────────────────────────────
const SQ_M_PER_SQ_FT = 0.092903;
const INT_THICKNESS_MM = 12, INT_RATIO = 6;
const EXT_THICKNESS_MM = 20, EXT_RATIO = 4;
const CEMENT_DENSITY_KG_M3 = 1440, BAG_WEIGHT_KG = 50, SHRINKAGE = 1.3, CFT_PER_M3 = 35.3147;
const GYPSUM_KG_PER_M2 = 1.5, PUTTY_KG_PER_M2 = 1.2, GYPSUM_BAG_KG = 25, PUTTY_BAG_KG = 20;
const SAND_BULKING_FACTOR = 1.15; // 15% bulking for onsite sand grading

type PlasteringLevel = 'full' | 'skim' | 'none';
interface PlasteringRule { level: PlasteringLevel; reason: string; recommendation: string; }

const RULES = [
  { match: 'aac', level: 'none', recommendation: 'Internal: Gypsum / External: Thin Cement', reason: 'AAC blocks are factory-smooth but porous. Internal faces need 6-8mm Gypsum/Putty. External faces MUST have thin cement plaster for weather protection.' },
  { match: 'interlocking', level: 'none', recommendation: 'Internal: Putty / External: Thin Cement', reason: 'Interlocking walls are uniform. Internal needs only putty. External MUST be cement-plastered for moisture protection.' },
  { match: ['fly ash', 'flyash'], level: 'skim', recommendation: 'Thin Skim Coat (6-10 mm)', reason: 'Fly-ash bricks are relatively smooth—a thin skim is sufficient for internal faces.' },
  { match: 'hollow', level: 'skim', recommendation: 'Thin Skim / Light Plaster', reason: 'Hollow blocks have manageable surfaces—light coating is typically sufficient.' },
  { match: 'brick', level: 'full', recommendation: 'Full Sand-Cement Plaster', reason: 'Clay bricks are rough/porous—full sand-cement plaster is mandatory for both faces.' },
  { match: 'stone', level: 'full', recommendation: 'Full Sand-Cement Plaster', reason: 'Stone masonry is highly irregular—full thick-coat plaster is mandatory.' },
  { match: 'block', level: 'skim', recommendation: 'Thin Skim / Light Plaster', reason: 'Concrete blocks have moderately smooth surfaces—light internal plaster is sufficient.' },
];

function getPlasteringRule(material: any): PlasteringRule {
  if (!material) return { level: 'full', reason: 'No data found — defaulting to full plaster.', recommendation: 'Full Sand-Cement Plaster' };
  const str = `${material.type} ${material.grade} ${material.name}`.toLowerCase();
  return (RULES.find(r => Array.isArray(r.match) ? r.match.some(m => str.includes(m)) : str.includes(r.match)) as any)
    || { level: 'full', reason: 'Unknown material — defaulting to full plaster for safety.', recommendation: 'Full Sand-Cement Plaster' };
}

// ─── Helper: Get allowed plaster methods based on rule level and face type ──
function getAllowedMethods(ruleLevel: PlasteringLevel, faceType: 'internal' | 'external'): Array<'traditional' | 'gypsum' | 'putty'> {
  if (ruleLevel === 'full') return ['traditional']; // Mandatory full plaster for both faces
  if (ruleLevel === 'none') {
    return faceType === 'internal' ? ['gypsum', 'putty'] : ['traditional']; // Internal: gypsum/putty, External: MUST be cement
  }
  if (ruleLevel === 'skim') {
    return faceType === 'internal' ? ['gypsum', 'putty', 'traditional'] : ['traditional']; // Both can use traditional, internal can also use gypsum/putty
  }
  return ['traditional']; // Fallback
}

// ─── Helper: Get default method based on rule level and face type ──
function getDefaultMethod(ruleLevel: PlasteringLevel, faceType: 'internal' | 'external'): 'traditional' | 'gypsum' | 'putty' {
  if (ruleLevel === 'full') return 'traditional';
  if (ruleLevel === 'none') return faceType === 'internal' ? 'gypsum' : 'traditional';
  if (ruleLevel === 'skim') return faceType === 'internal' ? 'gypsum' : 'traditional';
  return 'traditional';
}

// ─── Helpers ────────────────────────────────────────────────────────
const calcTrad = (area: number, thick: number, ratio: number) => {
  const vol = (area * SQ_M_PER_SQ_FT * thick) / 1000 * SHRINKAGE;
  const cKg = (vol / (1 + ratio)) * CEMENT_DENSITY_KG_M3;
  // Apply bulking factor to sand to prevent 10-15% estimation lag on site
  const sandM3 = (vol * ratio / (1 + ratio)) * SAND_BULKING_FACTOR;
  return { bags: Math.ceil(cKg / BAG_WEIGHT_KG), sand: Math.ceil(sandM3 * CFT_PER_M3) };
};

const calcBags = (area: number, kgPerM2: number, bagKg: number) => Math.ceil((area * SQ_M_PER_SQ_FT * kgPerM2) / bagKg);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PlasteringScreen({ route, navigation }: any) {
  const { totalArea = 1000, projectId, tier = 'Standard', wallComposition } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [selectedWallMaterials, setSelectedWallMaterials] = useState<any>({
    loadBearingBrick: wallComposition?.loadBearingBrick || null,
    partitionBrick: wallComposition?.partitionBrick || null
  });

  // Separate internal and external areas for load-bearing and partition walls
  const [lbInternalArea, setLbInternalArea] = useState(String(Math.round(totalArea * 2.5)));
  const [lbExternalArea, setLbExternalArea] = useState(String(Math.round(totalArea * 1.0)));
  const [pbInternalArea, setPbInternalArea] = useState(String(Math.round(totalArea * 1.0)));
  const [pbExternalArea, setPbExternalArea] = useState('0');

  // Separate internal and external methods for load-bearing and partition walls
  const [lbInternalMethod, setLbInternalMethod] = useState<'traditional' | 'gypsum' | 'putty'>('traditional');
  const [lbExternalMethod, setLbExternalMethod] = useState<'traditional' | 'gypsum' | 'putty'>('traditional');
  const [pbInternalMethod, setPbInternalMethod] = useState<'traditional' | 'gypsum' | 'putty'>('traditional');
  const [pbExternalMethod, setPbExternalMethod] = useState<'traditional' | 'gypsum' | 'putty'>('traditional');

  const [intThickness, setIntThickness] = useState(String(INT_THICKNESS_MM));
  const [extThickness, setExtThickness] = useState(String(EXT_THICKNESS_MM));

  const [modal, setModal] = useState<{ visible: boolean; key: string | null; isWall: boolean }>({ visible: false, key: null, isWall: false });

  // Init data
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'materials')), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    if (projectId && !wallComposition?.loadBearingBrick) {
      loadWallRecommendation(projectId).then(async (saved) => {
        if (!saved) return;
        const fetch = async (id: string) => id ? (await getDoc(doc(db, 'materials', id))).data() : null;
        const lb = await fetch(saved.loadBearingBrickId), pb = await fetch(saved.partitionBrickId);
        if (lb || pb) setSelectedWallMaterials({ loadBearingBrick: lb, partitionBrick: pb });
      });
    }
    return unsub;
  }, [projectId]);

  // Method update on material change - set methods based on rule constraints
  useEffect(() => {
    const lbRule = getPlasteringRule(selectedWallMaterials.loadBearingBrick);
    const pbRule = getPlasteringRule(selectedWallMaterials.partitionBrick);

    // Set internal methods (constrained by rule)
    setLbInternalMethod(getDefaultMethod(lbRule.level, 'internal'));
    setPbInternalMethod(getDefaultMethod(pbRule.level, 'internal'));

    // Set external methods (constrained by rule)
    setLbExternalMethod(getDefaultMethod(lbRule.level, 'external'));
    setPbExternalMethod(getDefaultMethod(pbRule.level, 'external'));
  }, [selectedWallMaterials]);

  // Default material selections
  useEffect(() => {
    if (!materials.length) return;
    const byTier = (f: (m: any) => boolean) => [...materials.filter(f)].sort((a, b) => tier === 'Economy' ? a.pricePerUnit - b.pricePerUnit : b.pricePerUnit - a.pricePerUnit)[0] || null;

    setSelections(prev => ({
      ...prev,
      Cement: wallComposition?.cement || prev.Cement || byTier(m => m.type === 'Cement' || (m.subCategory === 'Mortar' && m.type === 'Cement')),
      Sand: wallComposition?.sand || prev.Sand || byTier(m => m.type === 'Sand'),
      Gypsum: prev.Gypsum || byTier(m => `${m.type}${m.name}`.toLowerCase().includes('gypsum')),
      Putty: prev.Putty || byTier(m => `${m.type}${m.name}`.toLowerCase().includes('putty')),
    }));
  }, [materials, tier, wallComposition]);

  const lbRule = useMemo(() => getPlasteringRule(selectedWallMaterials.loadBearingBrick), [selectedWallMaterials.loadBearingBrick]);
  const pbRule = useMemo(() => getPlasteringRule(selectedWallMaterials.partitionBrick), [selectedWallMaterials.partitionBrick]);

  const calc = useMemo(() => {
    const lbInt = parseFloat(lbInternalArea) || 0;
    const lbExt = parseFloat(lbExternalArea) || 0;
    const pbInt = parseFloat(pbInternalArea) || 0;
    const pbExt = parseFloat(pbExternalArea) || 0;

    if (lbInt <= 0 && lbExt <= 0 && pbInt <= 0 && pbExt <= 0) return null;

    let res = { cement: 0, sand: 0, gypsum: 0, putty: 0, areaSqm: 0 };

    // Process each wall type and face separately
    const process = (area: number, method: string, thickness: number, ratio: number) => {
      if (area <= 0) return;
      res.areaSqm += area * SQ_M_PER_SQ_FT;

      if (method === 'gypsum') res.gypsum += calcBags(area, GYPSUM_KG_PER_M2, GYPSUM_BAG_KG);
      else if (method === 'putty') res.putty += calcBags(area, PUTTY_KG_PER_M2, PUTTY_BAG_KG);
      else {
        const { bags, sand } = calcTrad(area, thickness, ratio);
        res.cement += bags;
        res.sand += sand;
      }
    };

    // Load-bearing walls: internal (with INT_THICKNESS and INT_RATIO) and external (with EXT_THICKNESS and EXT_RATIO)
    process(lbInt, lbInternalMethod, parseFloat(intThickness), INT_RATIO);
    process(lbExt, lbExternalMethod, parseFloat(extThickness), EXT_RATIO);

    // Partition walls: internal and external (note: partition walls often don't have external plaster in practice)
    process(pbInt, pbInternalMethod, parseFloat(intThickness), INT_RATIO);
    process(pbExt, pbExternalMethod, parseFloat(extThickness), EXT_RATIO);

    const costs = {
      cement: res.cement * (selections.Cement?.pricePerUnit || 0),
      sand: res.sand * (selections.Sand?.pricePerUnit || 0),
      gypsum: res.gypsum * (res.gypsum > 0 ? (selections.Gypsum?.pricePerUnit || 0) : 0),
      putty: res.putty * (res.putty > 0 ? (selections.Putty?.pricePerUnit || 0) : 0)
    };
    return { ...res, totalCost: Object.values(costs).reduce((a, b) => a + b, 0), breakdown: costs };
  }, [lbInternalArea, lbInternalMethod, lbExternalArea, lbExternalMethod, pbInternalArea, pbInternalMethod, pbExternalArea, pbExternalMethod, intThickness, extThickness, selections]);

  const handleSave = async () => {
    if (!auth.currentUser || !projectId || !calc || calc.totalCost === 0) return Alert.alert('Error', 'Invalid data.');
    setSaving(true);
    try {
      const items = [
        { key: 'Cement', desc: 'Cement (Plaster)', qty: calc.cement, unit: 'Bags' },
        { key: 'Sand', desc: 'Plastering Sand', qty: calc.sand, unit: 'cft' },
        { key: 'Gypsum', desc: 'Gypsum Skim Coat', qty: calc.gypsum, unit: 'Bags' },
        { key: 'Putty', desc: 'Wall Putty', qty: calc.putty, unit: 'Bags' }
      ].filter(i => i.qty > 0).map(i => ({
        name: selections[i.key]?.name || i.key, desc: i.desc, qty: i.qty, unit: i.unit,
        total: (calc.breakdown as any)[i.key.toLowerCase()], rate: selections[i.key]?.pricePerUnit || 0
      }));

      await createDocument('estimates', {
        projectId, userId: auth.currentUser.uid, itemName: 'Plastering', category: CONSTRUCTION_HIERARCHY['Plastering']?.category || 'Finishing',
        totalCost: calc.totalCost, lineItems: items, specifications: {
          loadBearing: { internalArea: lbInternalArea, externalArea: lbExternalArea, internalMethod: lbInternalMethod, externalMethod: lbExternalMethod },
          partition: { internalArea: pbInternalArea, externalArea: pbExternalArea, internalMethod: pbInternalMethod, externalMethod: pbExternalMethod },
          tier, intThickness, extThickness
        }, createdAt: serverTimestamp(),
      });
      Alert.alert('Saved!', 'Successful.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setSaving(false); }
  };

  const filteredMaterials = useMemo(() => {
    if (!modal.key) return [];
    const kw = modal.key.toLowerCase();
    return materials.filter(m => {
      const t = (m.type || '').toLowerCase(), n = (m.name || '').toLowerCase(), sc = (m.subCategory || '').toLowerCase();
      return modal.isWall ? (t.includes('brick') || t.includes('block') || sc.includes('masonry')) : (t.includes(kw) || n.includes(kw));
    });
  }, [materials, modal]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color="#315b76" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Plastering</Text>
          <View style={[styles.tierBadge, { backgroundColor: tier === 'Economy' ? '#10b981' : tier === 'Standard' ? '#3b82f6' : '#8b5cf6' }]}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <WallSection
            label="1. LOAD-BEARING WALLS"
            material={selectedWallMaterials.loadBearingBrick}
            rule={lbRule}
            isPartition={false}
            internalArea={lbInternalArea}
            setInternalArea={setLbInternalArea}
            externalArea={lbExternalArea}
            setExternalArea={setLbExternalArea}
            internalMethod={lbInternalMethod}
            setInternalMethod={setLbInternalMethod}
            externalMethod={lbExternalMethod}
            setExternalMethod={setLbExternalMethod}
            onSelect={() => setModal({ visible: true, key: 'Load-Bearing', isWall: true })}
          />
          <WallSection
            label="2. PARTITION WALLS"
            material={selectedWallMaterials.partitionBrick}
            rule={pbRule}
            isPartition={true}
            internalArea={pbInternalArea}
            setInternalArea={setPbInternalArea}
            externalArea={pbExternalArea}
            setExternalArea={setPbExternalArea}
            internalMethod={pbInternalMethod}
            setInternalMethod={setPbInternalMethod}
            externalMethod={pbExternalMethod}
            setExternalMethod={setPbExternalMethod}
            onSelect={() => setModal({ visible: true, key: 'Partition', isWall: true })}
          />

          {/* Show traditional thicknesses if any face uses traditional plaster */}
          {(lbInternalMethod === 'traditional' || lbExternalMethod === 'traditional' || pbInternalMethod === 'traditional') && (
            <>
              <Text style={styles.sectionLabel}>TRADITIONAL PLASTER SPECS</Text>
              <View style={styles.inputCard}>
                <View style={[styles.inputRow, { gap: 10 }]}>
                  <View style={{ flex: 1 }}><Text style={styles.inputLabel}>Internal (mm)</Text><TextInput style={styles.input} value={intThickness} onChangeText={setIntThickness} keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.inputLabel}>External (mm)</Text><TextInput style={styles.input} value={extThickness} onChangeText={setExtThickness} keyboardType="decimal-pad" /></View>
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>MATERIAL SELECTION</Text>
          {(lbInternalMethod === 'traditional' || lbExternalMethod === 'traditional' || pbInternalMethod === 'traditional') && (
            <>
              <MaterialSelector label="Cement" selection={selections.Cement} onPress={() => setModal({ visible: true, key: 'Cement', isWall: false })} />
              <MaterialSelector label="Sand" selection={selections.Sand} onPress={() => setModal({ visible: true, key: 'Sand', isWall: false })} />
            </>
          )}
          {(lbInternalMethod === 'gypsum' || pbInternalMethod === 'gypsum' || lbExternalMethod === 'gypsum') && (
            <MaterialSelector label="Gypsum" selection={selections.Gypsum} onPress={() => setModal({ visible: true, key: 'Gypsum', isWall: false })} />
          )}
          {(lbInternalMethod === 'putty' || pbInternalMethod === 'putty' || lbExternalMethod === 'putty') && (
            <MaterialSelector label="Putty" selection={selections.Putty} onPress={() => setModal({ visible: true, key: 'Putty', isWall: false })} />
          )}

          {calc && calc.totalCost > 0 && (
            <LinearGradient colors={['#315b76', '#2a4179']} style={styles.costCard}>
              <View style={styles.costRow}><Text style={styles.costTitle}>Total Cost</Text><Text style={styles.costValue}>₹{calc.totalCost.toLocaleString('en-IN')}</Text></View>
              <View style={styles.costDivider} />
              {calc.cement > 0 && <CostLine label="Cement" qty={`${calc.cement} bags`} amount={calc.breakdown.cement} />}
              {calc.sand > 0 && <CostLine label="Sand" qty={`${calc.sand} cft`} amount={calc.breakdown.sand} />}
              {calc.gypsum > 0 && <CostLine label="Gypsum" qty={`${calc.gypsum} bags`} amount={calc.breakdown.gypsum} />}
              {calc.putty > 0 && <CostLine label="Putty" qty={`${calc.putty} bags`} amount={calc.breakdown.putty} />}
              <View style={styles.costMeta}><Ionicons name="information-circle-outline" size={12} color="#94a3b8" /><Text style={styles.costMetaText}>Area: {Math.round(calc.areaSqm)} m²</Text></View>
            </LinearGradient>
          )}
          <View style={{ height: 110 }} />
        </ScrollView>

        <TouchableOpacity style={[styles.saveBtn, (saving || !calc || calc.totalCost === 0) && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving || !calc || calc.totalCost === 0}>
          {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Estimate</Text></>}
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={modal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Select {modal.key}</Text><TouchableOpacity onPress={() => setModal({ ...modal, visible: false })}><Ionicons name="close" size={24} color="#1e293b" /></TouchableOpacity></View>
            <FlatList
              data={filteredMaterials}
              keyExtractor={i => i.id}
              ListEmptyComponent={<View style={styles.emptyModal}><Ionicons name="alert-circle-outline" size={32} color="#cbd5e1" /><Text style={styles.emptyModalText}>No materials found.</Text></View>}
              renderItem={({ item }) => {
                const isSelected = modal.isWall ? (modal.key === 'Load-Bearing' ? selectedWallMaterials.loadBearingBrick?.id === item.id : selectedWallMaterials.partitionBrick?.id === item.id) : selections[modal.key!]?.id === item.id;
                return (
                  <TouchableOpacity style={[styles.modalItem, isSelected && styles.modalItemSelected]} onPress={() => {
                    if (modal.isWall) setSelectedWallMaterials((p: any) => ({ ...p, [modal.key === 'Load-Bearing' ? 'loadBearingBrick' : 'partitionBrick']: item }));
                    else setSelections((p: any) => ({ ...p, [modal.key!]: item }));
                    setModal({ ...modal, visible: false });
                  }}>
                    <View style={{ flex: 1 }}><Text style={[styles.modalItemName, isSelected && { color: '#315b76' }]}>{item.name}</Text><Text style={styles.modalItemMeta}>{item.grade || item.type} · {item.unit}</Text></View>
                    <Text style={[styles.modalItemPrice, isSelected && { color: '#315b76' }]}>₹{item.pricePerUnit}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#315b76" style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────
const WallSection = ({ label, material, rule, isPartition, internalArea, setInternalArea, externalArea, setExternalArea, internalMethod, setInternalMethod, externalMethod, setExternalMethod, onSelect }: any) => {
  const levelColors: any = { full: '#fee2e2', skim: '#fef3c7', none: '#dcfce7' }, dotColors: any = { full: '#ef4444', skim: '#f59e0b', none: '#22c55e' };

  // For partition walls, always include 'traditional' (sand-cement) as an option for internal faces since both sides are internal
  // For load-bearing walls, always include 'gypsum' and 'putty' as options for internal faces for flexibility
  const internalAllowedMethods = isPartition
    ? [...new Set([...getAllowedMethods(rule.level, 'internal'), 'traditional'])]
    : [...new Set([...getAllowedMethods(rule.level, 'internal'), 'gypsum', 'putty'])];
  const externalAllowedMethods = getAllowedMethods(rule.level, 'external');

  const methodConfig = [
    { k: 'traditional', l: 'Sand-Cement', i: 'layers-outline' },
    { k: 'gypsum', l: 'Gypsum Skim', i: 'color-wand-outline' },
    { k: 'putty', l: 'Wall Putty', i: 'brush-outline' }
  ] as const;

  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.wallConfigCard}>
        <TouchableOpacity style={styles.wallMaterialSelector} onPress={onSelect}>
          <View style={{ flex: 1 }}><Text style={styles.wallTypeLabel}>Wall Material</Text><Text style={styles.wallMaterialName}>{material?.name ?? 'Tap to select'}</Text></View>
          <Ionicons name="chevron-forward" size={16} color="#315b76" />
        </TouchableOpacity>
        <View style={[styles.assessmentBanner, { backgroundColor: levelColors[rule.level], marginTop: 10, marginBottom: 15 }]}>
          <View style={[styles.assessmentDot, { backgroundColor: dotColors[rule.level] }]} />
          <Text style={styles.assessmentReason}>{rule.recommendation}: {rule.reason}</Text>
        </View>

        {/* Internal Face Finish */}
        <View style={{ marginBottom: isPartition ? 0 : 18 }}>
          <Text style={[styles.inputLabel, { marginBottom: 6 }]}>Internal Face Finish</Text>
          <TextInput style={styles.input} value={internalArea} onChangeText={setInternalArea} keyboardType="decimal-pad" placeholder="Area (sq.ft)" />
          <View style={styles.methodRow}>
            {methodConfig.filter(m => (internalAllowedMethods as any).includes(m.k)).map(m => (
              <TouchableOpacity key={m.k} style={[styles.methodCard, internalMethod === m.k && styles.methodCardActive]} onPress={() => setInternalMethod(m.k as any)}>
                <Ionicons name={m.i as any} size={16} color={internalMethod === m.k ? '#315b76' : '#64748b'} />
                <Text style={[styles.methodLabel, internalMethod === m.k && styles.methodLabelActive]}>{m.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* External Face Finish - Only for Load-Bearing Walls */}
        {!isPartition && (
          <View>
            <Text style={[styles.inputLabel, { marginBottom: 6 }]}>External Face Finish</Text>
            <TextInput style={styles.input} value={externalArea} onChangeText={setExternalArea} keyboardType="decimal-pad" placeholder="Area (sq.ft)" />
            <View style={styles.methodRow}>
              {methodConfig.filter(m => (externalAllowedMethods as any).includes(m.k)).map(m => (
                <TouchableOpacity key={m.k} style={[styles.methodCard, externalMethod === m.k && styles.methodCardActive]} onPress={() => setExternalMethod(m.k as any)}>
                  <Ionicons name={m.i as any} size={16} color={externalMethod === m.k ? '#315b76' : '#64748b'} />
                  <Text style={[styles.methodLabel, externalMethod === m.k && styles.methodLabelActive]}>{m.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </>
  );
};

const MaterialSelector = ({ label, selection, onPress }: any) => (
  <TouchableOpacity style={styles.selectorCard} onPress={onPress} activeOpacity={0.7}>
    <View style={{ flex: 1 }}><Text style={styles.selectorLabel}>{label}</Text><Text style={styles.selectorName}>{selection?.name ?? 'Tap to select'}</Text>{selection && <Text style={styles.selectorPrice}>₹{selection.pricePerUnit} / {selection.unit}</Text>}</View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </TouchableOpacity>
);

const CostLine = ({ label, qty, amount }: any) => (
  <View style={styles.costLine}><Text style={styles.costLineLabel}>{label}</Text><Text style={styles.costLineQty}>{qty}</Text><Text style={styles.costLineAmount}>₹{amount.toLocaleString('en-IN')}</Text></View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 18, marginBottom: 10, textTransform: 'uppercase' },
  assessmentBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 10 },
  assessmentDot: { width: 8, height: 8, borderRadius: 4 },
  assessmentReason: { fontSize: 11, fontWeight: '600', color: '#444', flex: 1 },
  methodRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  methodCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#e2e8f0' },
  methodCardActive: { borderColor: '#315b76', backgroundColor: '#f0f9ff' },
  methodLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  methodLabelActive: { color: '#315b76', fontWeight: '700' },
  wallConfigCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 16 },
  wallMaterialSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  wallTypeLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },
  wallMaterialName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  inputCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  inputRow: { flexDirection: 'row' },
  inputLabel: { fontSize: 10, color: '#64748b', fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10, fontSize: 14, fontWeight: '700', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  sideRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  sideChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  sideChipActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  sideChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  sideChipTextActive: { color: '#fff' },
  costCard: { borderRadius: 16, padding: 16, marginTop: 20 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costTitle: { fontSize: 12, fontWeight: '700', color: '#fff', opacity: 0.8 },
  costValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  costDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 12 },
  costMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  costMetaText: { fontSize: 10, color: '#94a3b8' },
  saveBtn: { backgroundColor: '#315b76', margin: 20, borderRadius: 15, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  modalItemSelected: { backgroundColor: '#f0f9ff' },
  modalItemName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  modalItemMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  modalItemPrice: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  emptyModal: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyModalText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  selectorCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  selectorLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' },
  selectorName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  selectorPrice: { fontSize: 11, color: '#10b981', fontWeight: '700', marginTop: 2 },
  costLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  costLineLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', flex: 1 },
  costLineQty: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginRight: 12 },
  costLineAmount: { fontSize: 13, fontWeight: '700', color: '#fff' },
});