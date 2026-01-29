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

export default function WallScreen({ route, navigation }: any) {
  // FIX 1: Default to empty object to prevent destructuring crash
  const { totalArea, rooms, projectId, tier } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  
  const defaultHeight = tier === 'Luxury' ? '11' : tier === 'Standard' ? '10.5' : '10';
  const [height, setHeight] = useState(defaultHeight);
  const [thickness, setThickness] = useState('0.75'); 

  useEffect(() => {
    // Fetch materials for both Walls (Bricks) and General (Cement)
    // Or just fetch all and filter locally for simplicity
    const q = query(collection(db, 'materials'), where('category', 'in', ['Wall', 'Foundation', 'General']));
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(data);
      
      const initialSels: any = {};
      // FIX 2: Auto-select Bricks AND Cement
      const brick = data.find(m => m.category === 'Wall' && (tier === 'Economy' ? m.name.includes('Red') : m.name.includes('Block')));
      const cement = data.find(m => m.name.toLowerCase().includes('cement'));
      
      if (brick) initialSels['Bricks'] = brick;
      if (cement) initialSels['Cement'] = cement;
      
      setSelections(initialSels);
      setLoading(false);
    });
    return unsub;
  }, []);

  const calculation = useMemo(() => {
    // FIX 3: Safety check for NaN values
    const h = parseFloat(height) || 0;
    const t = parseFloat(thickness) || 0;

    const totalRunningLength = rooms?.reduce((acc: number, room: any) => {
        return acc + (2 * (parseFloat(room.length || 0) + parseFloat(room.width || 0)));
    }, 0) || (Math.sqrt(totalArea) * 4);

    // FIX 4: Adjustment Factor (0.7) to account for Shared Walls and Openings (Doors/Windows)
    // Sum of perimeters is usually ~30% more than actual wall layout
    const adjustedRunningLength = totalRunningLength * 0.75; 

    const wallSurfaceArea = adjustedRunningLength * h;
    const wallVolumeCuFt = wallSurfaceArea * t;
    
    const netVolume = wallVolumeCuFt;

    // Standard conversion: Bricks: ~500 per 100 cu.ft | Cement: ~1.2 bags per 100 cu.ft
    const brickQty = Math.round((netVolume / 100) * 500);
    const cementQty = Math.round((netVolume / 100) * 1.2);

    const brickCost = (selections['Bricks']?.pricePerUnit || 0) * brickQty;
    const cementCost = (selections['Cement']?.pricePerUnit || 0) * cementQty;

    return {
      brickQty,
      cementQty,
      brickBrand: selections['Bricks']?.name || 'Not Selected',
      cementBrand: selections['Cement']?.name || 'Not Selected',
      totalCost: brickCost + cementCost,
      netVolume: netVolume.toFixed(2)
    };
  }, [height, thickness, selections, rooms, totalArea]);

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

          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>Calculated Requirements</Text>
            <View style={styles.resultRow}>
                <Text style={styles.resLabel}>Bricks ({calculation.brickBrand})</Text>
                <Text style={styles.resVal}>{calculation.brickQty} Nos</Text>
            </View>
            <View style={styles.resultRow}>
                <Text style={styles.resLabel}>Cement ({calculation.cementBrand})</Text>
                <Text style={styles.resVal}>{calculation.cementQty} Bags</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Estimated Wall Cost</Text>
                <Text style={styles.totalVal}>₹{calculation.totalCost.toLocaleString()}</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('EstimateResult', { 
            projectId, 
            wallData: calculation,
            totalArea: totalArea,
            level: tier // FIX 5: Use 'level' to match App.tsx params
          })}
        >
          <Text style={styles.mainBtnText}>Update Estimate</Text>
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
  inputCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', gap: 15 },
  inputBox: { flex: 1 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 5 },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 15, textTransform: 'uppercase' },
  brandScroll: { marginBottom: 30 },
  brandCard: { width: 130, backgroundColor: '#fff', padding: 10, borderRadius: 15, marginRight: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  activeBrand: { borderColor: '#315b76', backgroundColor: '#eff6ff' },
  imagePlaceholder: { width: '100%', height: 70, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandImg: { width: '100%', height: '100%', borderRadius: 10 },
  brandName: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  brandPrice: { fontSize: 11, color: '#10b981', fontWeight: 'bold', marginTop: 2 },
  resultCard: { backgroundColor: '#1e293b', padding: 25, borderRadius: 25, elevation: 5 },
  resultHeader: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  resLabel: { color: '#cbd5e1', fontSize: 13 },
  resVal: { color: '#fff', fontWeight: '700', fontSize: 13 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  totalVal: { color: '#4ade80', fontSize: 20, fontWeight: '800' },
  mainBtn: { backgroundColor: '#315b76', margin: 20, padding: 18, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});