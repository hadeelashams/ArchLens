import React, { useMemo, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const FT_TO_M = 0.3048;           
const CEMENT_BAGS_PER_M3 = 28.8;
const DRY_VOL_MULTIPLIER_CONCRETE = 1.54; // 54% bulkage for dry mix
const DRY_VOL_MULTIPLIER_MORTAR = 1.33;   // 33% for mortar
const MASONRY_MORTAR_RATIO = 0.30;        // 30% of stone volume is mortar
const MARKET_RATE_AGGREGATE = 1450;       // ₹ per m³

export default function FoundationCost({ route, navigation }: any) {
  const { 
    projectId, 
    area, 
    foundationConfig, 
    selections, 
    numFootings,
    lengthFt,
    widthFt,
    depthFt,
    pccThicknessFt,
    tier 
  } = route.params;

  const [saving, setSaving] = useState(false);

  // Helper to safely get material data from selections
  const getMat = (layer: string, type: string) => {
    const key = `${layer}_${type}`;
    const item = selections[key];
    return {
      price: item ? parseFloat(item.pricePerUnit) : 0,
      name: item ? item.name : 'Not Selected',
      exists: !!item
    };
  };

  const getAggSize = (layer: string) => selections[layer] || '20 mm';

  const calculation = useMemo(() => {
    let items: any[] = [];
    
    // 1. DIMENSIONS & CONVERSION
    const n = parseInt(numFootings) || 0;
    const l_m = parseFloat(lengthFt) * FT_TO_M;
    const w_m = parseFloat(widthFt) * FT_TO_M;
    const total_depth_m = parseFloat(depthFt) * FT_TO_M;
    const pcc_h_m = parseFloat(pccThicknessFt) * FT_TO_M;
    
    // Height available for structure after PCC is laid
    const structural_h_m = total_depth_m - pcc_h_m;

    // 2. PCC BASE CALCULATION (Mix 1:4:8)
    if (foundationConfig.hasPCC) {
      const volPCC = n * l_m * w_m * pcc_h_m;
      const dryVol = volPCC * DRY_VOL_MULTIPLIER_CONCRETE;
      const cementBags = Math.ceil((dryVol * (1/13)) * CEMENT_BAGS_PER_M3);
      const sandM3 = dryVol * (4/13);
      const aggM3 = dryVol * (8/13);

      const matCem = getMat('PCC Base', 'Cement');
      const matSand = getMat('PCC Base', 'Sand');

      items.push({
        category: 'PCC Base',
        name: `Cement (${matCem.name})`,
        desc: 'Base Mix 1:4:8',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.price || 420,
        total: cementBags * (matCem.price || 420)
      });

      items.push({
        category: 'PCC Base',
        name: `Sand (${matSand.name})`,
        desc: 'PCC Grade Sand',
        qty: sandM3.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1500,
        total: sandM3 * (matSand.price || 1500)
      });

      items.push({
        category: 'PCC Base',
        name: `Aggregates (${getAggSize('PCC Base')})`,
        desc: 'Coarse Aggregate',
        qty: aggM3.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: aggM3 * MARKET_RATE_AGGREGATE
      });
    }

    // 3. MAIN LAYER (RCC vs STONE)
    if (foundationConfig.mainLayer === 'RCC Footing') {
      // Logic: Trapezoidal Footing (avg 1.5ft height) + Neck Column (remaining depth)
      const footingH_m = 0.45; // 1.5ft
      const pedestalH_m = Math.max(0, structural_h_m - footingH_m);
      
      const volFooting = n * l_m * w_m * footingH_m;
      const volPedestal = n * (0.3 * 0.45) * pedestalH_m; // Standard 9"x18" neck column
      const totalRCCVol = volFooting + volPedestal;

      const dryVol = totalRCCVol * DRY_VOL_MULTIPLIER_CONCRETE;
      const cementBags = Math.ceil((dryVol * (1/5.5)) * CEMENT_BAGS_PER_M3); // M20 Mix
      const sandM3 = dryVol * (1.5/5.5);
      const aggM3 = dryVol * (3/5.5);
      const steelKg = totalRCCVol * 95; // Avg reinforcement density

      const matCem = getMat('RCC Footing', 'Cement');
      const matSteel = getMat('RCC Footing', 'Steel (TMT Bar)');
      const matSand = getMat('RCC Footing', 'Sand');

      items.push({
        category: 'RCC Footing',
        name: `Cement (${matCem.name})`,
        desc: 'M20 Grade (Footing + Neck)',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.price || 450,
        total: cementBags * (matCem.price || 450)
      });

      items.push({
        category: 'RCC Footing',
        name: `Steel (${matSteel.name})`,
        desc: 'Mesh & Starter Bars',
        qty: Math.ceil(steelKg),
        unit: 'kg',
        rate: matSteel.price || 75,
        total: steelKg * (matSteel.price || 75)
      });

      items.push({
        category: 'RCC Footing',
        name: `Sand (${matSand.name})`,
        desc: 'Concrete M-Sand',
        qty: sandM3.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1600,
        total: sandM3 * (matSand.price || 1600)
      });

      items.push({
        category: 'RCC Footing',
        name: `Aggregates (${getAggSize('RCC Footing')})`,
        desc: 'Crushed Stone',
        qty: aggM3.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: aggM3 * MARKET_RATE_AGGREGATE
      });

    } else if (foundationConfig.mainLayer === 'Stone Masonry') {
      const volMasonry = n * l_m * w_m * structural_h_m;
      const stoneM3 = volMasonry * 1.15; // 15% wastage/voids
      const mortarVol = volMasonry * MASONRY_MORTAR_RATIO;
      const dryMortar = mortarVol * DRY_VOL_MULTIPLIER_MORTAR;
      const cementBags = Math.ceil((dryMortar * (1/7)) * CEMENT_BAGS_PER_M3); // 1:6 Mix
      const sandM3 = dryMortar * (6/7);

      const matStone = getMat('Stone Masonry', 'Size Stone');
      const matCem = getMat('Stone Masonry', 'Cement');
      const matSand = getMat('Stone Masonry', 'Sand');

      items.push({
        category: 'Stone Masonry',
        name: `Size Stone (${matStone.name})`,
        desc: 'Main Foundation Body',
        qty: stoneM3.toFixed(1),
        unit: 'm³',
        rate: matStone.price || 1100,
        total: stoneM3 * (matStone.price || 1100)
      });

      items.push({
        category: 'Stone Masonry',
        name: `Cement (${matCem.name})`,
        desc: 'Mortar Mix 1:6',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.price || 420,
        total: cementBags * (matCem.price || 420)
      });

      items.push({
        category: 'Stone Masonry',
        name: `Sand (${matSand.name})`,
        desc: 'Masonry Sand',
        qty: sandM3.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1500,
        total: sandM3 * (matSand.price || 1500)
      });
    }

    // 4. PLINTH BEAM CALCULATION
    if (foundationConfig.includePlinth) {
      const perimeterM = (Math.sqrt(area) * 4) * 1.2; // perimeter + 20% for internal walls
      const volPlinth = perimeterM * 0.23 * 0.30; // 9" x 12" beam
      const dryVol = volPlinth * DRY_VOL_MULTIPLIER_CONCRETE;
      
      const cementBags = Math.ceil((dryVol * (1/5.5)) * CEMENT_BAGS_PER_M3);
      const sandM3 = dryVol * (1.5/5.5);
      const aggM3 = dryVol * (3/5.5);
      const steelKg = volPlinth * 110;

      // Fallback: If Plinth specific brand not selected, use RCC Footing brand
      const matCem = getMat('Plinth Beam', 'Cement').exists ? getMat('Plinth Beam', 'Cement') : getMat('RCC Footing', 'Cement');
      const matSteel = getMat('Plinth Beam', 'Steel (TMT Bar)').exists ? getMat('Plinth Beam', 'Steel (TMT Bar)') : getMat('RCC Footing', 'Steel (TMT Bar)');
      const matSand = getMat('Plinth Beam', 'Sand').exists ? getMat('Plinth Beam', 'Sand') : getMat('RCC Footing', 'Sand');

      items.push({
        category: 'Plinth Beam',
        name: 'Plinth Materials',
        desc: `Cem (${matCem.name}) & Agg/Sand`,
        qty: volPlinth.toFixed(1),
        unit: 'm³',
        rate: 3800, // Aggregate + Sand + Cement weighted avg per m3
        total: (cementBags * matCem.price) + (sandM3 * (matSand.price || 1600)) + (aggM3 * MARKET_RATE_AGGREGATE)
      });

      items.push({
        category: 'Plinth Beam',
        name: `Plinth Steel (${matSteel.name})`,
        desc: 'Main & Stirrup Bars',
        qty: Math.ceil(steelKg),
        unit: 'kg',
        rate: matSteel.price || 78,
        total: steelKg * (matSteel.price || 78)
      });
    }

    const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
    return { items, grandTotal };

  }, [area, numFootings, lengthFt, widthFt, depthFt, pccThicknessFt, selections, foundationConfig]);

  const handleSaveEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    setSaving(true);
    try {
      await addDoc(collection(db, 'estimates'), {
        projectId,
        userId: auth.currentUser.uid,
        itemName: `Foundation Materials (${foundationConfig.mainLayer})`,
        category: 'Foundation',
        totalCost: calculation.grandTotal,
        lineItems: calculation.items,
        area: parseFloat(area),
        specifications: {
          depth: depthFt,
          footingCount: numFootings,
          method: foundationConfig.mainLayer,
          plinth: foundationConfig.includePlinth
        },
        createdAt: serverTimestamp()
      });
      Alert.alert("Success", "Estimate saved successfully.");
      navigation.navigate('ConstructionLevel', { projectId, totalArea: area }); 
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Material Cost</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{tier || 'Standard'}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* SUMMARY CARD (DARK STYLE) */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryLabel}>ESTIMATED MATERIAL COST</Text>
                <Text style={styles.summaryTotal}>₹{Math.round(calculation.grandTotal).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>{foundationConfig.mainLayer}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              <View style={styles.specItem}>
                <Ionicons name="apps-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{numFootings} Nos</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="resize-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{lengthFt}x{widthFt} ft</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="arrow-down-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{depthFt}' Depth</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>
          
          {/* BREAKDOWN TABLE */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, {flex: 2}]}>Material</Text>
              <Text style={[styles.th, {flex: 1, textAlign: 'center'}]}>Qty</Text>
              <Text style={[styles.th, {flex: 1.2, textAlign: 'right'}]}>Cost</Text>
            </View>

            {calculation.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={{flex: 2}}>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
                <View style={{flex: 1, alignItems: 'center'}}>
                  <Text style={styles.itemQty}>{item.qty} <Text style={styles.itemUnit}>{item.unit}</Text></Text>
                </View>
                <View style={{flex: 1.2, alignItems: 'flex-end'}}>
                  <Text style={styles.itemPrice}>₹{Math.round(item.total).toLocaleString()}</Text>
                  <Text style={styles.itemRate}>@ {Math.round(item.rate)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              This estimate includes <Text style={{fontWeight: 'bold'}}>Material Only</Text> (Dry Volume + 5% wastage). Excavation labor, shuttering, and curing water costs are excluded.
            </Text>
          </View>
          
          <View style={{height: 100}} />
        </ScrollView>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSaveEstimate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.saveBtnText}>Save Material Estimate</Text>
              <Ionicons name="save-outline" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 20 },

  // Summary Card
  summaryCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 25, marginBottom: 25, elevation: 8 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  summaryTotal: { color: '#fff', fontSize: 28, fontWeight: '800' },
  methodBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  methodBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specText: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5 },
  
  // Table Style
  table: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  categoryLabel: { fontSize: 9, fontWeight: '800', color: '#315b76', textTransform: 'uppercase', marginBottom: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  itemDesc: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  itemUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  itemRate: { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  disclaimer: { flexDirection: 'row', gap: 10, backgroundColor: '#E0F2FE', padding: 15, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  disclaimerText: { flex: 1, fontSize: 11, color: '#0369a1', lineHeight: 16 },

  saveBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});