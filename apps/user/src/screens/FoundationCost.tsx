import React, { useMemo, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// --- ENGINEERING CONSTANTS ---
const FT_TO_M = 0.3048;           
const CEMENT_BAGS_PER_M3 = 28.8;
const DRY_VOL_MULTIPLIER_CONCRETE = 1.54; 
const DRY_VOL_MULTIPLIER_MORTAR = 1.33;   
const MASONRY_MORTAR_RATIO = 0.30; // 30% of total masonry volume is mortar

// --- MATERIAL DENSITIES (kg/m³) ---
const DENSITY = {
  SAND: 1600,
  AGGREGATE: 1550,
  STEEL: 7850,
  STONE: 2600, 
  CEMENT: 1440,
  SOIL: 1800 
};

const CFT_PER_M3 = 35.3147;

// --- REALISTIC MARKET RATES (2026 Estimates) ---
const MARKET_RATES = {
  CEMENT: 420,     
  STEEL: 72,       
  SAND: 2400,      
  AGGREGATE: 2100, 
  STONE: 1300,     
  SOIL: 550        
};

// --- ASSUMED SPECS ---
const ASSUMED_SPECS = {
  FOOTING_HEIGHT_M: 0.45,       
  PEDESTAL_L_M: 0.45,           
  PEDESTAL_W_M: 0.23,           
  PLINTH_BEAM_W_M: 0.23,        
  PLINTH_BEAM_D_M: 0.30,        
  STEEL_DENSITY_RCC: 85,        
  STEEL_DENSITY_PLINTH: 110,    
  PCC_OFFSET_M: 0.15,           
  MASONRY_MEAN_WIDTH_M: 0.60,   // ~2 ft average width for stone wall
  PLINTH_FILL_HEIGHT_M: 0.60    
};

export default function FoundationCost({ route, navigation }: any) {
  const { 
    projectId, 
    area, 
    foundationType,
    foundationConfig, 
    selections, 
    tier 
  } = route.params;

  const [saving, setSaving] = useState(false);

  // Extract parameters based on foundation type
  const getRCCParams = () => {
    if (foundationType !== 'RCC') return null;
    return {
      numFootings: foundationConfig.footingCount || 0,
      lengthFt: foundationConfig.footingLength || 4,
      widthFt: foundationConfig.footingWidth || 4,
      depthFt: foundationConfig.rccExcavationDepth || 5,
      pccThicknessFt: foundationConfig.pccThickness || 0.33,
      hasPCC: foundationConfig.hasPCC ?? true,
      includePlinth: foundationConfig.includePlinth ?? false
    };
  };

  const getMasonryParams = () => {
    if (foundationType !== 'StoneMasonry') return null;
    return {
      wallPerimeter: foundationConfig.wallPerimeter || 0,
      trenchWidth: foundationConfig.trenchWidth || 2,
      depthFt: foundationConfig.masonryExcavationDepth || 3,
      masonryThickness: foundationConfig.masonryThickness || 2
    };
  };

  // Helper: Get Selected Material Safely
  const getMat = (layer: string, type: string) => {
    const key = `${layer}_${type}`;
    const item = selections[key];
    return {
      item: item || null,
      price: item && item.pricePerUnit ? parseFloat(item.pricePerUnit) : 0,
      unit: item && item.unit ? item.unit.trim().toLowerCase() : '',
      name: item ? item.name : 'Not Selected',
      exists: !!item 
    };
  };

  const calculateItem = (
    requiredQty: number,
    inputUnit: 'm3' | 'kg' | 'nos' | 'bags',
    material: any,
    density: number,
    fallbackRate: number
  ) => {
    let finalQty = requiredQty;
    let finalUnit = inputUnit === 'm3' ? 'm³' : inputUnit; 
    
    const rateToUse = material.exists ? material.price : fallbackRate;
    const dbUnit = material.unit; 

    if (inputUnit === 'm3') {
      if (dbUnit.includes('cft') || dbUnit.includes('cubic')) {
        finalQty = requiredQty * CFT_PER_M3;
        finalUnit = 'cft';
      } 
      else if (dbUnit.includes('kg')) {
        finalQty = requiredQty * density;
        finalUnit = 'kg';
      }
      else if (dbUnit.includes('ton')) {
        finalQty = (requiredQty * density) / 1000;
        finalUnit = 'Ton';
      }
      else if (dbUnit.includes('brass')) {
        finalQty = (requiredQty * CFT_PER_M3) / 100;
        finalUnit = 'Brass';
      }
    } 
    else if (inputUnit === 'kg') {
      if (dbUnit.includes('ton')) {
        finalQty = requiredQty / 1000;
        finalUnit = 'Ton';
      }
    }

    const roundedQty = parseFloat(finalQty.toFixed(2));
    const totalCost = Math.round(roundedQty * rateToUse);

    return {
      qty: roundedQty,
      unit: finalUnit,
      rate: rateToUse,
      total: totalCost,
      name: material.name
    };
  };

  const calculation = useMemo(() => {
    let items: any[] = [];
    const inputArea = parseFloat(area) || 0;

    // --- FOUNDATION TYPE DETECTION ---
    if (foundationType === 'RCC') {
      // RCC ISOLATED FOOTING SYSTEM
      const rccParams = getRCCParams();
      if (!rccParams) return { items: [], grandTotal: 0 };

      const n = rccParams.numFootings;
      const l_m = rccParams.lengthFt * FT_TO_M;
      const w_m = rccParams.widthFt * FT_TO_M;
      const total_depth_m = rccParams.depthFt * FT_TO_M;
      const pcc_h_m = rccParams.pccThicknessFt * FT_TO_M;
      
      const structural_h_m = Math.max(0, total_depth_m - pcc_h_m);
      
      // Calculate Building Perimeter for plinth
      const approxPerimeterM = (Math.sqrt(inputArea) * 4) * 1.15 * FT_TO_M;

      // --- 2. PCC BASE (Mix 1:4:8) ---
      if (rccParams.hasPCC) {
        const pcc_l = l_m + (2 * ASSUMED_SPECS.PCC_OFFSET_M);
        const pcc_w = w_m + (2 * ASSUMED_SPECS.PCC_OFFSET_M);
        
        const volPCC = n * pcc_l * pcc_w * pcc_h_m;
        const dryVol = volPCC * DRY_VOL_MULTIPLIER_CONCRETE;
        
        const cementBags = Math.ceil((dryVol * (1/13)) * CEMENT_BAGS_PER_M3);
        const matCem = getMat('PCC Base', 'Cement');
        items.push({
          category: 'PCC Base',
          name: `Cement (${matCem.name})`,
          desc: 'Base Mix 1:4:8',
          qty: cementBags,
          unit: 'Bags',
          rate: matCem.exists ? matCem.price : MARKET_RATES.CEMENT,
          total: Math.round(cementBags * (matCem.exists ? matCem.price : MARKET_RATES.CEMENT))
        });

        const sandM3 = dryVol * (4/13);
        const matSand = getMat('PCC Base', 'Sand');
        items.push({ ...calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, MARKET_RATES.SAND), category: 'PCC Base', desc: 'PCC Sand' });

        const aggM3 = dryVol * (8/13);
        items.push({
          category: 'PCC Base',
          name: `Aggregates (${selections['PCC Base'] || '20 mm'})`,
          desc: 'Coarse Aggregate',
          qty: parseFloat(aggM3.toFixed(2)),
          unit: 'm³',
          rate: MARKET_RATES.AGGREGATE,
          total: Math.round(aggM3 * MARKET_RATES.AGGREGATE)
        });
      }

      // --- 3. RCC FOOTING ---
      const pedestalH_m = Math.max(0, structural_h_m - ASSUMED_SPECS.FOOTING_HEIGHT_M);
      const volFooting = n * l_m * w_m * ASSUMED_SPECS.FOOTING_HEIGHT_M;
      const volPedestal = n * ASSUMED_SPECS.PEDESTAL_L_M * ASSUMED_SPECS.PEDESTAL_W_M * pedestalH_m;
      const totalRCCVol = volFooting + volPedestal;
      const dryVol = totalRCCVol * DRY_VOL_MULTIPLIER_CONCRETE;

      const cementBags = Math.ceil((dryVol * (1/5.5)) * CEMENT_BAGS_PER_M3);
      const matCem = getMat('RCC Footing', 'Cement');
      items.push({
        category: 'RCC Footing',
        name: `Cement (${matCem.name})`,
        desc: 'M20 Grade Mix',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : MARKET_RATES.CEMENT,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : MARKET_RATES.CEMENT))
      });

      const steelKg = totalRCCVol * ASSUMED_SPECS.STEEL_DENSITY_RCC;
      const matSteel = getMat('RCC Footing', 'Steel (TMT Bar)');
      items.push({ ...calculateItem(steelKg, 'kg', matSteel, DENSITY.STEEL, MARKET_RATES.STEEL), category: 'RCC Footing', desc: 'Reinforcement' });

      const sandM3 = dryVol * (1.5/5.5);
      const matSand = getMat('RCC Footing', 'Sand');
      items.push({ ...calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, MARKET_RATES.SAND), category: 'RCC Footing', desc: 'Concrete Sand' });

      const aggM3 = dryVol * (3/5.5);
      items.push({
        category: 'RCC Footing',
        name: `Aggregates (${selections['RCC Footing'] || '20 mm'})`,
        desc: 'Crushed Stone',
        qty: parseFloat(aggM3.toFixed(2)),
        unit: 'm³',
        rate: MARKET_RATES.AGGREGATE,
        total: Math.round(aggM3 * MARKET_RATES.AGGREGATE)
      });

      // --- 4. PLINTH BEAM ---
      if (rccParams.includePlinth) {
        const volPlinth = approxPerimeterM * ASSUMED_SPECS.PLINTH_BEAM_W_M * ASSUMED_SPECS.PLINTH_BEAM_D_M;
        const dryVolPlinth = volPlinth * DRY_VOL_MULTIPLIER_CONCRETE;
        
        const matCem2 = getMat('Plinth Beam', 'Cement').exists ? getMat('Plinth Beam', 'Cement') : getMat('RCC Footing', 'Cement');
        const matSteel2 = getMat('Plinth Beam', 'Steel (TMT Bar)').exists ? getMat('Plinth Beam', 'Steel (TMT Bar)') : getMat('RCC Footing', 'Steel (TMT Bar)');
        const matSand2 = getMat('Plinth Beam', 'Sand').exists ? getMat('Plinth Beam', 'Sand') : getMat('RCC Footing', 'Sand');

        const cementBags2 = Math.ceil((dryVolPlinth * (1/5.5)) * CEMENT_BAGS_PER_M3);
        items.push({
          category: 'Plinth Beam',
          name: `Cement (${matCem2.name})`,
          desc: 'M20 Grade',
          qty: cementBags2,
          unit: 'Bags',
          rate: matCem2.exists ? matCem2.price : MARKET_RATES.CEMENT,
          total: Math.round(cementBags2 * (matCem2.exists ? matCem2.price : MARKET_RATES.CEMENT))
        });

        const sandM3_2 = dryVolPlinth * (1.5/5.5);
        items.push({ ...calculateItem(sandM3_2, 'm3', matSand2, DENSITY.SAND, MARKET_RATES.SAND), category: 'Plinth Beam', desc: 'Concrete Sand' });

        const aggM3_2 = dryVolPlinth * (3/5.5);
        items.push({
          category: 'Plinth Beam',
          name: 'Aggregates',
          desc: 'Crushed Stone',
          qty: parseFloat(aggM3_2.toFixed(2)),
          unit: 'm³',
          rate: MARKET_RATES.AGGREGATE,
          total: Math.round(aggM3_2 * MARKET_RATES.AGGREGATE)
        });

        const steelKg_2 = volPlinth * ASSUMED_SPECS.STEEL_DENSITY_PLINTH;
        items.push({ ...calculateItem(steelKg_2, 'kg', matSteel2, DENSITY.STEEL, MARKET_RATES.STEEL), category: 'Plinth Beam', desc: 'Reinforcement' });

        // --- 5. PLINTH FILLING ---
        const fillVolM3 = (inputArea * (FT_TO_M * FT_TO_M)) * ASSUMED_SPECS.PLINTH_FILL_HEIGHT_M;
        items.push({
          category: 'Earth Work',
          name: 'Plinth Filling Soil',
          desc: 'Backfilling',
          qty: parseFloat(fillVolM3.toFixed(2)),
          unit: 'm³',
          rate: MARKET_RATES.SOIL,
          total: Math.round(fillVolM3 * MARKET_RATES.SOIL)
        });
      }

    } else if (foundationType === 'StoneMasonry') {
      // STONE MASONRY CONTINUOUS WALL SYSTEM
      const masonryParams = getMasonryParams();
      if (!masonryParams) return { items: [], grandTotal: 0 };

      const perimeterM = masonryParams.wallPerimeter * FT_TO_M;
      const trenchWidthM = masonryParams.trenchWidth * FT_TO_M;
      const excavationDepthM = masonryParams.depthFt * FT_TO_M;
      const masonryThicknessM = masonryParams.masonryThickness * FT_TO_M;

      // --- 1. STONE MASONRY ---
      const volMasonry = perimeterM * masonryThicknessM * excavationDepthM;
      
      // Stone (Wastage factor 1.25 for irregular shapes)
      const stoneM3 = volMasonry * 1.25; 
      const matStone = getMat('Stone Masonry', 'Stone');
      items.push({ ...calculateItem(stoneM3, 'm3', matStone, DENSITY.STONE, MARKET_RATES.STONE), category: 'Stone Masonry', desc: 'Foundation Body (Stones)' });

      // --- 2. MASONRY MORTAR ---
      const mortarVol = volMasonry * MASONRY_MORTAR_RATIO;
      const dryMortar = mortarVol * DRY_VOL_MULTIPLIER_MORTAR;
      
      const cementBags = Math.ceil((dryMortar * (1/7)) * CEMENT_BAGS_PER_M3); // 1:6 Mix
      const matCem = getMat('Stone Masonry', 'Cement');
      items.push({
        category: 'Stone Masonry',
        name: `Cement (${matCem.name})`,
        desc: 'Mortar Mix 1:6',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : MARKET_RATES.CEMENT,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : MARKET_RATES.CEMENT))
      });

      const sandM3 = dryMortar * (6/7);
      const matSand = getMat('Stone Masonry', 'Sand');
      items.push({ ...calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, MARKET_RATES.SAND), category: 'Stone Masonry', desc: 'Masonry Sand' });
    }

    const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
    return { items, grandTotal };

  }, [area, foundationType, foundationConfig, selections]);

  const handleSaveEstimate = async () => {
    if (!auth.currentUser) return Alert.alert("Error", "User not authenticated.");
    setSaving(true);
    try {
      const systemName = foundationType === 'RCC' ? 'RCC Footing' : 'Stone Masonry';
      await addDoc(collection(db, 'estimates'), {
        projectId,
        userId: auth.currentUser.uid,
        itemName: `Foundation Materials (${systemName})`,
        category: 'Foundation',
        totalCost: calculation.grandTotal, 
        lineItems: calculation.items,
        area: parseFloat(area),
        foundationType,
        createdAt: serverTimestamp()
      });
      Alert.alert("Success", "Estimate saved successfully.");
      navigation.navigate('ProjectSummary', { projectId }); 
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
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryLabel}>ESTIMATED MATERIAL COST</Text>
                <Text style={styles.summaryTotal}>₹{calculation.grandTotal.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>{foundationType === 'RCC' ? 'RCC Footing' : 'Stone Masonry'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.specRow}>
              {foundationType === 'RCC' && getRCCParams() && (
                <>
                  <View style={styles.specItem}>
                    <Ionicons name="apps-outline" size={14} color="#94a3b8" />
                    <Text style={styles.specText}>{getRCCParams()?.numFootings} Nos</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Ionicons name="resize-outline" size={14} color="#94a3b8" />
                    <Text style={styles.specText}>{getRCCParams()?.lengthFt}x{getRCCParams()?.widthFt} ft</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Ionicons name="arrow-down-outline" size={14} color="#94a3b8" />
                    <Text style={styles.specText}>{getRCCParams()?.depthFt}' Depth</Text>
                  </View>
                </>
              )}
              {foundationType === 'StoneMasonry' && getMasonryParams() && (
                <>
                  <View style={styles.specItem}>
                    <Ionicons name="resize-outline" size={14} color="#94a3b8" />
                    <Text style={styles.specText}>{getMasonryParams()?.wallPerimeter.toFixed(1)} ft Perimeter</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Ionicons name="arrow-down-outline" size={14} color="#94a3b8" />
                    <Text style={styles.specText}>{getMasonryParams()?.depthFt}' Depth</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>
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
                  <Text style={styles.itemPrice}>₹{item.total.toLocaleString()}</Text>
                  <Text style={styles.itemRate}>@ {item.rate}/{item.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              Includes continuous wall calculation for Stone Masonry foundations. 2026 Avg Market Rates applied.
            </Text>
          </View>
          <View style={{height: 100}} />
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEstimate} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
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
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  scroll: { padding: 20 },
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