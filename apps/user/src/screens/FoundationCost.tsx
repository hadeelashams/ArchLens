import React, { useMemo, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, SafeAreaView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared'; // Adjust import based on your project structure
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const FT_TO_M = 0.3048;           
const DRY_MIX_FACTOR = 1.54;      
const STEEL_DENSITY_KG_M3 = 7850; 
const MASONRY_MORTAR_RATIO = 0.30; // 30% of masonry volume is mortar
const MARKET_RATE_AGGREGATE = 1400; // ₹ per m³ (Default fallback)
const MARKET_RATE_EXCAVATION = 450; // ₹ per m³
const MARKET_RATE_LABOR_MASONRY = 3500; // ₹ per m³
const MARKET_RATE_LABOR_RCC = 4200; // ₹ per m³ (includes shuttering)

export default function FoundationCost({ route, navigation }: any) {
  const { 
    projectId, 
    area, 
    foundationConfig, // { mainLayer, includePlinth, hasPCC }
    selections,       // { 'RCC Footing_Cement': {price...}, 'RCC Footing': '20mm' ... }
    numFootings,
    lengthFt,
    widthFt,
    depthFt,
    pccThicknessFt
  } = route.params;

  const [saving, setSaving] = useState(false);

  // Helper to get Price and Name safely
  const getMat = (layer: string, type: string) => {
    const key = `${layer}_${type}`;
    const item = selections[key];
    return {
      price: item ? parseFloat(item.pricePerUnit) : 0,
      name: item ? item.name : 'Not Selected',
      valid: !!item
    };
  };

  const getAggSize = (layer: string) => {
    return selections[layer] || '20 mm';
  };

  const calculation = useMemo(() => {
    let items = [];
    let grandTotal = 0;

    // 1. DIMENSIONS & CONVERSION
    const n = parseInt(numFootings) || 0;
    const l_m = parseFloat(lengthFt) * FT_TO_M;
    const w_m = parseFloat(widthFt) * FT_TO_M;
    const d_m = parseFloat(depthFt) * FT_TO_M;
    const pcc_th_m = parseFloat(pccThicknessFt) * FT_TO_M;
    
    // Total Excavation
    // Formula: Count * (L + 0.6m working space) * (W + 0.6m) * Depth
    const volExcavation = n * (l_m + 0.6) * (w_m + 0.6) * d_m;
    
    items.push({
      category: 'Site Work',
      name: "Earthwork Excavation",
      desc: `${n} pits x ${d_m.toFixed(1)}m depth`,
      qty: volExcavation.toFixed(1),
      unit: "m³",
      rate: MARKET_RATE_EXCAVATION,
      total: volExcavation * MARKET_RATE_EXCAVATION
    });

    // 2. PCC BASE CALCULATION
    if (foundationConfig.hasPCC) {
      const volPCC = n * l_m * w_m * pcc_th_m;
      
      // Mix Ratio 1:4:8 (Cement:Sand:Agg) -> Sum = 13
      const dryVol = volPCC * 1.54;
      const cementVol = dryVol * (1/13);
      const sandVol = dryVol * (4/13);
      const aggVol = dryVol * (8/13);
      
      const matCement = getMat('PCC Base', 'Cement');
      const matSand = getMat('PCC Base', 'Sand');
      const aggSize = getAggSize('PCC Base');

      // Cement Bags (1 bag = 0.035 m3 approx, but usually calculated by volume density 1440kg/m3 / 50kg)
      // Approx 28.8 bags per m3 of cement volume
      const cementBags = Math.ceil(cementVol * 28.8);

      items.push({
        category: 'PCC Layer',
        name: `Cement (${matCement.name})`,
        desc: 'For PCC 1:4:8 Base',
        qty: cementBags,
        unit: 'Bags',
        rate: matCement.price || 400,
        total: cementBags * (matCement.price || 400)
      });

      items.push({
        category: 'PCC Layer',
        name: `Sand (${matSand.name})`,
        desc: 'River/M-Sand',
        qty: sandVol.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1500,
        total: sandVol * (matSand.price || 1500)
      });

      items.push({
        category: 'PCC Layer',
        name: `Aggregate (${aggSize})`,
        desc: 'Coarse Aggregate',
        qty: aggVol.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: aggVol * MARKET_RATE_AGGREGATE
      });
    }

    // 3. MAIN LAYER (RCC vs STONE)
    const layerHeight = 0.45; // Approx 1.5ft footing height
    const volMain = n * l_m * w_m * layerHeight;

    if (foundationConfig.mainLayer === 'RCC Footing') {
      // RCC M20 (1:1.5:3) -> Sum = 5.5
      const dryVol = volMain * 1.54;
      const cementVol = dryVol * (1/5.5);
      const sandVol = dryVol * (1.5/5.5);
      const aggVol = dryVol * (3/5.5);
      
      // Steel @ 0.8% of Volume approx or 80kg/m3
      const steelKg = volMain * 80; 

      const matCement = getMat('RCC Footing', 'Cement');
      const matSteel = getMat('RCC Footing', 'Steel (TMT Bar)');
      const matSand = getMat('RCC Footing', 'Sand');
      const aggSize = getAggSize('RCC Footing');

      items.push({
        category: 'RCC Footing',
        name: `Cement (${matCement.name})`,
        desc: 'M20 Grade Mix',
        qty: Math.ceil(cementVol * 28.8),
        unit: 'Bags',
        rate: matCement.price || 450,
        total: Math.ceil(cementVol * 28.8) * (matCement.price || 450)
      });

      items.push({
        category: 'RCC Footing',
        name: `Steel (${matSteel.name})`,
        desc: 'Footing Mesh (Fe550)',
        qty: steelKg.toFixed(0),
        unit: 'kg',
        rate: matSteel.price || 75,
        total: steelKg * (matSteel.price || 75)
      });

      items.push({
        category: 'RCC Footing',
        name: `Aggregate (${aggSize})`,
        desc: 'Crushed Stone',
        qty: aggVol.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: aggVol * MARKET_RATE_AGGREGATE
      });

      items.push({
        category: 'RCC Footing',
        name: `Sand (${matSand.name})`,
        desc: 'Concrete Sand',
        qty: sandVol.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1600,
        total: sandVol * (matSand.price || 1600)
      });

      // Labor
      items.push({
        category: 'RCC Footing',
        name: 'Labor & Shuttering',
        desc: 'Placement, Bending, Casting',
        qty: volMain.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_LABOR_RCC,
        total: volMain * MARKET_RATE_LABOR_RCC
      });

    } else if (foundationConfig.mainLayer === 'Stone Masonry') {
      // Stone Masonry Logic
      // Mortar 1:6 (Cement:Sand)
      const mortarVol = volMain * MASONRY_MORTAR_RATIO;
      const stoneVol = volMain * 1.1; // Bulk volume of stone (including voids before packing)

      const dryMortar = mortarVol * 1.33; // Mortar bulking
      const cementVol = dryMortar * (1/7);
      const sandVol = dryMortar * (6/7);

      const matStone = getMat('Stone Masonry', 'Size Stone');
      const matCement = getMat('Stone Masonry', 'Cement');
      const matSand = getMat('Stone Masonry', 'Sand');

      items.push({
        category: 'Stone Masonry',
        name: `Size Stone (${matStone.name})`,
        desc: 'Hard Granite/Basalt',
        qty: stoneVol.toFixed(1),
        unit: 'm³',
        rate: matStone.price || 900,
        total: stoneVol * (matStone.price || 900)
      });

      items.push({
        category: 'Stone Masonry',
        name: `Cement (${matCement.name})`,
        desc: 'Mortar 1:6',
        qty: Math.ceil(cementVol * 28.8),
        unit: 'Bags',
        rate: matCement.price || 420,
        total: Math.ceil(cementVol * 28.8) * (matCement.price || 420)
      });

      items.push({
        category: 'Stone Masonry',
        name: `Sand (${matSand.name})`,
        desc: 'Masonry Sand',
        qty: sandVol.toFixed(1),
        unit: 'm³',
        rate: matSand.price || 1500,
        total: sandVol * (matSand.price || 1500)
      });

      items.push({
        category: 'Stone Masonry',
        name: 'Mason Labor',
        desc: 'Skilled Masonry Work',
        qty: volMain.toFixed(1),
        unit: 'm³',
        rate: MARKET_RATE_LABOR_MASONRY,
        total: volMain * MARKET_RATE_LABOR_MASONRY
      });
    }

    // 4. PLINTH BEAM (If Selected)
    if (foundationConfig.includePlinth) {
      // Heuristic: Approx 1.2x Perimeter for grid beams
      // Plinth Dimensions: 0.23m x 0.3m (9"x12") standard
      const approxPerimeter = Math.sqrt(area) * 4; 
      const plinthLengthM = approxPerimeter * 1.25; // Add 25% for internal beams
      const volPlinth = plinthLengthM * 0.23 * 0.30;

      // M20 Concrete
      const dryVol = volPlinth * 1.54;
      const cementVol = dryVol * (1/5.5);
      const sandVol = dryVol * (1.5/5.5);
      const aggVol = dryVol * (3/5.5);
      
      // Heavy Steel for Beams (110kg/m3)
      const steelKg = volPlinth * 110;

      const matCement = getMat('Plinth Beam', 'Cement');
      const matSteel = getMat('Plinth Beam', 'Steel (TMT Bar)');
      const matSand = getMat('Plinth Beam', 'Sand');
      const aggSize = getAggSize('Plinth Beam');

      // Add as a Lump Sum group or detailed? Detailed.
      items.push({
        category: 'Plinth Beam',
        name: 'Plinth Concrete Materials',
        desc: `Cem/Sand/Agg (${aggSize})`,
        qty: volPlinth.toFixed(1),
        unit: 'm³',
        rate: 5500, // Composite material rate for estimation
        total: volPlinth * 5500
      });

      items.push({
        category: 'Plinth Beam',
        name: `Plinth Steel (${matSteel.name})`,
        desc: 'Main bars & Stirrups',
        qty: steelKg.toFixed(0),
        unit: 'kg',
        rate: matSteel.price || 75,
        total: steelKg * (matSteel.price || 75)
      });
    }

    // Calculate Grand Total
    grandTotal = items.reduce((sum, i) => sum + i.total, 0);

    return { items, grandTotal };

  }, [area, numFootings, lengthFt, widthFt, depthFt, pccThicknessFt, selections, foundationConfig]);

  const handleSaveEstimate = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'estimates'), {
        projectId,
        userId: auth.currentUser.uid,
        title: `${foundationConfig.mainLayer} System`,
        category: 'Foundation',
        totalCost: calculation.grandTotal,
        lineItems: calculation.items,
        area: parseFloat(area),
        specifications: {
          depth: depthFt,
          footingCount: numFootings,
          plinthIncluded: foundationConfig.includePlinth
        },
        createdAt: serverTimestamp()
      });
      
      Alert.alert("Success", "Estimate saved to project dashboard.");
      navigation.navigate('ProjectSummary', { projectId }); // Assuming you have this screen
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cost Estimation</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryLabel}>ESTIMATED COST</Text>
                <Text style={styles.summaryTotal}>₹{Math.round(calculation.grandTotal).toLocaleString()}</Text>
              </View>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>{foundationConfig.mainLayer}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.specRow}>
              <View style={styles.specItem}>
                <Ionicons name="scan-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{area} Sq.ft</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="apps-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{numFootings} Footings</Text>
              </View>
              <View style={styles.specItem}>
                <Ionicons name="arrow-down-outline" size={14} color="#94a3b8" />
                <Text style={styles.specText}>{depthFt}' Depth</Text>
              </View>
            </View>
          </View>

          {/* Detailed BOQ */}
          <Text style={styles.sectionTitle}>BILL OF QUANTITIES</Text>
          
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, {flex: 2}]}>Item Description</Text>
              <Text style={[styles.th, {flex: 1, textAlign: 'center'}]}>Qty</Text>
              <Text style={[styles.th, {flex: 1.2, textAlign: 'right'}]}>Amount</Text>
            </View>

            {calculation.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={{flex: 2}}>
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

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="alert-circle-outline" size={18} color="#64748b" />
            <Text style={styles.disclaimerText}>
              Rates are derived from selected materials and standard market labor costs. Actuals may vary by +/- 10% based on site conditions.
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
              <Text style={styles.saveBtnText}>Save to Project</Text>
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
  
  scroll: { padding: 20 },

  summaryCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 25, elevation: 5 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  summaryTotal: { color: '#fff', fontSize: 28, fontWeight: '800' },
  methodBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  methodBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specText: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5 },

  table: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  
  tableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 2 },
  itemDesc: { fontSize: 11, color: '#94a3b8' },
  itemQty: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  itemUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  itemRate: { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  disclaimer: { flexDirection: 'row', gap: 10, backgroundColor: '#FFF7ED', padding: 15, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#FFEDD5' },
  disclaimerText: { flex: 1, fontSize: 11, color: '#C2410C', lineHeight: 16 },

  saveBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});