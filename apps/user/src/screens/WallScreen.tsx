import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, TextInput, Image, ActivityIndicator, 
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- WALL TYPE DEFINITIONS WITH MORTAR SPECIFICATIONS ---
type WallType = 'SolidBrick' | 'HollowBlock' | 'Composite';

const WALL_TYPE_SPECS: Record<WallType, {
  label: string;
  mortarRatio: number;       // mortar as % of total wall volume
  cementMortar: number;      // parts cement in mortar mix
  sandMortar: number;        // parts sand in mortar mix
  bricksPerCuFt: number;     // bricks per cubic foot (CORRECTED)
  description: string;
}> = {
  'SolidBrick': {
    label: 'Solid Brick',
    mortarRatio: 0.25,        
    cementMortar: 1,
    sandMortar: 6,            // 1:6 mix
    bricksPerCuFt: 5.0,       // 5 bricks per 1 cu.ft (standard 500 per 100 cu.ft)
    description: 'Traditional solid clay bricks'
  },
  'HollowBlock': {
    label: 'Hollow Block',
    mortarRatio: 0.15,        // Less mortar needed for larger blocks
    cementMortar: 1,
    sandMortar: 5,            
    bricksPerCuFt: 1.1,       // ~1.1 blocks per 1 cu.ft
    description: 'Lightweight hollow concrete blocks'
  },
  'Composite': {
    label: 'Composite (Mixed)',
    mortarRatio: 0.20,        
    cementMortar: 1,
    sandMortar: 5.5,          
    bricksPerCuFt: 3.0,
    description: 'Mix of solid and hollow units'
  }
};

export default function WallScreen({ route, navigation }: any) {
  const { totalArea, rooms, projectId, tier } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  
  const [wallType, setWallType] = useState<WallType>('SolidBrick');
  
  const defaultHeight = tier === 'Luxury' ? '11' : tier === 'Standard' ? '10.5' : '10';
  const [height, setHeight] = useState(defaultHeight);
  const [thickness, setThickness] = useState('0.75'); 

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('category', 'in', ['Wall', 'General']));
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(data);
      
      const initialSels: any = {};
      const filteredByTier = (category: string) => {
        let items = data.filter(m => m.category === category);
        if (tier === 'Economy') {
          return items.sort((a, b) => parseFloat(a.pricePerUnit || 0) - parseFloat(b.pricePerUnit || 0)).slice(0, Math.max(1, items.length / 3));
        } else if (tier === 'Luxury') {
          return items.sort((a, b) => parseFloat(b.pricePerUnit || 0) - parseFloat(a.pricePerUnit || 0)).slice(0, Math.max(1, items.length / 3));
        }
        return items;
      };

      const brickOptions = filteredByTier('Wall');
      if (brickOptions.length > 0) initialSels['Bricks'] = brickOptions[0];
      
      const cement = data.find(m => m.type === 'Cement' || m.name.toLowerCase().includes('cement'));
      if (cement) initialSels['Cement'] = cement;

      const sand = data.find(m => m.type === 'Sand' || m.name.toLowerCase().includes('sand'));
      if (sand) initialSels['Sand'] = sand;
      
      setSelections(initialSels);
      setLoading(false);
    });
    return unsub;
  }, [tier]);

  const calculation = useMemo(() => {
    const h = parseFloat(height) || 0;
    const t = parseFloat(thickness) || 0;
    const spec = WALL_TYPE_SPECS[wallType];

    if (h <= 0 || t <= 0) return { brickQty: 0, cementBags: 0, sandKg: 0, totalCost: 0, costBreakdown: { bricks: 0, cement: 0, sand: 0 } };

    // 1. RUNNING LENGTH CALCULATION
    let totalRunningLength = 0;
    if (rooms && Array.isArray(rooms) && rooms.length > 0) {
      totalRunningLength = rooms.reduce((acc: number, room: any) => acc + (2 * (parseFloat(room.length || 0) + parseFloat(room.width || 0))), 0);
    } else {
      totalRunningLength = 4 * Math.sqrt(totalArea || 1000);
    }

    // Adjustment for shared walls and openings (Doors/Windows)
    const adjustedRunningLength = totalRunningLength * 0.70; 
    const wallVolumeCuFt = adjustedRunningLength * h * t;

    // 2. BRICK/BLOCK QUANTITY
    const brickQty = Math.round(wallVolumeCuFt * spec.bricksPerCuFt);

    // 3. MORTAR CALCULATION
    const wetMortarVolume = wallVolumeCuFt * spec.mortarRatio;
    // Dry volume factor (1.33 for shrinkage) + 10% wastage ≈ 1.45
    const dryMortarVolume = wetMortarVolume * 1.45;
    
    const totalParts = spec.cementMortar + spec.sandMortar;
    const cementVolumeCuFt = (dryMortarVolume / totalParts) * spec.cementMortar;
    const sandVolumeCuFt = (dryMortarVolume / totalParts) * spec.sandMortar;

    // 4. CONVERT TO UNITS
    // 1 Bag cement = 1.25 Cu.Ft
    const cementBags = Math.ceil(cementVolumeCuFt / 1.25);
    const sandKg = Math.round(sandVolumeCuFt * 100); // 1 Cuft Sand ≈ 100kg

    // 5. COSTS
    const brickUnitPrice = parseFloat(selections['Bricks']?.pricePerUnit) || 0;
    const cementUnitPrice = parseFloat(selections['Cement']?.pricePerUnit) || 0;
    const sandUnitPrice = parseFloat(selections['Sand']?.pricePerUnit) || 0;

    const brickCost = brickUnitPrice * brickQty;
    const cementCost = cementUnitPrice * cementBags;
    
    const sandUnit = (selections['Sand']?.unit || '').toLowerCase();
    let sandCost = 0;
    if (sandUnit.includes('ton')) sandCost = sandUnitPrice * (sandKg / 1000);
    else if (sandUnit.includes('cft')) sandCost = sandUnitPrice * sandVolumeCuFt;
    else sandCost = sandUnitPrice * sandKg;

    return {
      brickQty,
      cementBags,
      sandKg,
      brickBrand: selections['Bricks']?.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      sandBrand: selections['Sand']?.name || 'Not Selected',
      mortarRatio: (spec.mortarRatio * 100).toFixed(0),
      mortarMix: `1:${spec.sandMortar}`,
      totalCost: Math.round(brickCost + cementCost + sandCost),
      costBreakdown: {
        bricks: Math.round(brickCost),
        cement: Math.round(cementCost),
        sand: Math.round(sandCost)
      }
    };
  }, [height, thickness, selections, rooms, totalArea, wallType]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#315b76" /></View>;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tier} Wall Setup</Text>
          <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>WALL TYPE</Text>
          <View style={styles.wallTypeContainer}>
            {(Object.keys(WALL_TYPE_SPECS) as WallType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.wallTypeTab, wallType === type && styles.wallTypeTabActive]}
                onPress={() => setWallType(type)}
              >
                <Ionicons 
                  name={type === 'SolidBrick' ? 'cube' : type === 'HollowBlock' ? 'albums' : 'layers'} 
                  size={16} 
                  color={wallType === type ? '#fff' : '#64748b'} 
                />
                <Text style={[styles.wallTypeText, wallType === type && styles.wallTypeTextActive]}>
                  {WALL_TYPE_SPECS[type].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{WALL_TYPE_SPECS[wallType].description}</Text>
            <Text style={styles.infoSubtext}>Mortar Mix: {calculation.mortarMix}</Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.sectionLabel}>WALL DIMENSIONS</Text>
            <View style={styles.row}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Height (ft)</Text>
                <TextInput 
                  style={styles.input} 
                  value={height} 
                  onChangeText={setHeight} 
                  keyboardType="numeric" 
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>Thickness (ft)</Text>
                <TextInput 
                  style={styles.input} 
                  value={thickness} 
                  onChangeText={setThickness} 
                  keyboardType="numeric" 
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>SELECT BRICKS / BLOCKS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll}>
            {materials.filter(m => m.category === 'Wall').map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.brandCard, selections['Bricks']?.id === item.id && styles.activeBrand]}
                onPress={() => setSelections({...selections, 'Bricks': item})}
              >
                <View style={styles.imagePlaceholder}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.brandImg} /> : <Ionicons name="cube" size={24} color="#cbd5e1" />}
                </View>
                <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.brandPrice}>₹{item.pricePerUnit}/{item.unit}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>MORTAR MATERIALS</Text>
          <View style={styles.materialGrid}>
            <View style={styles.materialCard}>
              <Text style={styles.materialLabel}>Cement</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{selections['Cement']?.name || 'Select'}</Text>
                <Ionicons name="chevron-down" size={16} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.cementBags} Bags</Text>
              <Text style={styles.materialPrice}>₹{calculation.costBreakdown.cement}</Text>
            </View>

            <View style={styles.materialCard}>
              <Text style={styles.materialLabel}>Sand</Text>
              <View style={styles.materialSelector}>
                <Text style={styles.materialValue} numberOfLines={1}>{selections['Sand']?.name || 'Select'}</Text>
                <Ionicons name="chevron-down" size={16} color="#315b76" />
              </View>
              <Text style={styles.materialQty}>{calculation.sandKg} kg</Text>
              <Text style={styles.materialPrice}>₹{calculation.costBreakdown.sand}</Text>
            </View>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>CALCULATED REQUIREMENTS</Text>
            
            <View style={styles.resultRow}>
              <Text style={styles.resLabel}>Bricks/Blocks ({calculation.brickBrand})</Text>
              <Text style={styles.resVal}>{calculation.brickQty} Nos</Text>
            </View>
            
            <View style={styles.resultRow}>
              <Text style={styles.resLabel}>Cement ({calculation.cementBrand})</Text>
              <Text style={styles.resVal}>{calculation.cementBags} Bags</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resLabel}>Sand ({calculation.sandBrand})</Text>
              <Text style={styles.resVal}>{calculation.sandKg} kg</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resLabel}>Mortar Ratio</Text>
              <Text style={styles.resVal}>{calculation.mortarRatio}% (Mix {calculation.mortarMix})</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.costBreakdown}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Bricks:</Text>
                <Text style={styles.costVal}>₹{calculation.costBreakdown.bricks.toLocaleString()}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Cement:</Text>
                <Text style={styles.costVal}>₹{calculation.costBreakdown.cement.toLocaleString()}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Sand:</Text>
                <Text style={styles.costVal}>₹{calculation.costBreakdown.sand.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Wall Cost</Text>
              <Text style={styles.totalVal}>₹{calculation.totalCost.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('EstimateResult', { 
            projectId, 
            wallData: calculation,
            wallType,
            materials: selections,
            totalArea,
            tier
          })}
        >
          <Text style={styles.mainBtnText}>Update Estimate</Text>
          <Ionicons name="calculator" size={20} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 5 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 20 },
  wallTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  wallTypeTab: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  wallTypeTabActive: { backgroundColor: '#315b76', borderColor: '#315b76' },
  wallTypeText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  wallTypeTextActive: { color: '#fff' },
  infoCard: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#0284c7' },
  infoText: { fontSize: 12, fontWeight: '600', color: '#0369a1' },
  infoSubtext: { fontSize: 10, color: '#0284c7', marginTop: 4 },
  inputCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', gap: 15 },
  inputBox: { flex: 1 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  brandScroll: { marginBottom: 30 },
  brandCard: { width: 130, backgroundColor: '#fff', padding: 10, borderRadius: 15, marginRight: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  activeBrand: { borderColor: '#315b76', backgroundColor: '#eff6ff' },
  imagePlaceholder: { width: '100%', height: 70, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandImg: { width: '100%', height: '100%', borderRadius: 10 },
  brandName: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  brandPrice: { fontSize: 11, color: '#10b981', fontWeight: 'bold', marginTop: 2 },
  materialGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  materialCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  materialLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  materialSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8 },
  materialValue: { fontSize: 12, fontWeight: '600', color: '#1e293b', flex: 1 },
  materialQty: { fontSize: 13, fontWeight: '800', color: '#315b76', marginBottom: 4 },
  materialPrice: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  resultCard: { backgroundColor: '#1e293b', padding: 25, borderRadius: 25, elevation: 5, marginBottom: 20 },
  resultHeader: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1, textTransform: 'uppercase' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  resLabel: { color: '#cbd5e1', fontSize: 13 },
  resVal: { color: '#fff', fontWeight: '700', fontSize: 13 },
  costBreakdown: { marginVertical: 10 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { color: '#cbd5e1', fontSize: 12 },
  costVal: { color: '#4ade80', fontWeight: '700', fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  totalVal: { color: '#4ade80', fontSize: 22, fontWeight: '800' },
  mainBtn: { backgroundColor: '#315b76', margin: 20, padding: 18, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, elevation: 5 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});