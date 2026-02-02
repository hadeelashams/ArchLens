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
const DRY_VOL_MULTIPLIER_CONCRETE = 1.54; 
const DRY_VOL_MULTIPLIER_MORTAR = 1.33;   
const MASONRY_MORTAR_RATIO = 0.30;        

// --- MATERIAL DENSITIES (kg/m³) ---
const DENSITY = {
  SAND: 1600,
  AGGREGATE: 1550,
  STEEL: 7850,
  STONE: 2600, // Granite/Basalt
  CEMENT: 1440
};

const CFT_PER_M3 = 35.3147;

// --- MARKET RATES (Fallback pricing) ---
const MARKET_RATE_AGGREGATE = 2200; // ₹ per m³

// --- ASSUMED DIMENSIONS (Documented Defaults) ---
const ASSUMED_SPECS = {
  FOOTING_HEIGHT_M: 0.45,       // ~1.5 ft depth for the trapezoidal base
  PEDESTAL_L_M: 0.45,           // 18 inches neck column length
  PEDESTAL_W_M: 0.23,           // 9 inches neck column width
  PLINTH_BEAM_W_M: 0.23,        // 9 inches width
  PLINTH_BEAM_D_M: 0.30,        // 12 inches depth
  STEEL_DENSITY_RCC: 95,        // kg/m³ of concrete
  STEEL_DENSITY_PLINTH: 110     // kg/m³ of concrete
};

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

  // Helper: Get Selected Material Safely
  const getMat = (layer: string, type: string) => {
    const key = `${layer}_${type}`;
    const item = selections[key];
    return {
      item: item || null,
      price: item && item.pricePerUnit ? parseFloat(item.pricePerUnit) : 0,
      unit: item && item.unit ? item.unit.trim().toLowerCase() : '',
      name: item ? item.name : 'Not Selected',
      exists: !!item // Explicit check for existence
    };
  };

  const getAggSize = (layer: string) => selections[layer] || '20 mm';

  /**
   * CORE CALCULATION HELPER
   * Handles unit conversion and price application consistently.
   * 
   * @param requiredQty - The engineering quantity required (e.g., 5 m³ of sand)
   * @param inputUnit - The unit of the requiredQty (e.g., 'm3', 'kg', 'nos')
   * @param material - The selected material object from getMat()
   * @param density - Density in kg/m³ (required for Volume <-> Weight conversion)
   * @param fallbackRate - Market rate to use if no material is selected
   */
  const calculateItem = (
    requiredQty: number,
    inputUnit: 'm3' | 'kg' | 'nos' | 'bags',
    material: any,
    density: number,
    fallbackRate: number
  ) => {
    let finalQty = requiredQty;
    let finalUnit = inputUnit === 'm3' ? 'm³' : inputUnit; // Display formatting
    
    // 1. Determine Rate
    const rateToUse = material.exists ? material.price : fallbackRate;
    const dbUnit = material.unit; // already normalized to lowercase/trimmed

    // 2. Unit Normalization & Conversion Logic
    if (inputUnit === 'm3') {
      // Input is Volume, check DB Unit
      if (dbUnit.includes('cft') || dbUnit.includes('cubic feet')) {
        finalQty = requiredQty * CFT_PER_M3;
        finalUnit = 'cft';
      } 
      else if (dbUnit.includes('kg')) {
        finalQty = requiredQty * density;
        finalUnit = 'kg';
      }
      else if (dbUnit.includes('ton') || dbUnit.includes('tonne')) {
        finalQty = (requiredQty * density) / 1000;
        finalUnit = 'Ton';
      }
      else if (dbUnit.includes('brass')) {
        finalQty = (requiredQty * CFT_PER_M3) / 100;
        finalUnit = 'Brass';
      }
      // If DB unit is empty or matches m3, keep as is
    } 
    else if (inputUnit === 'kg') {
      // Input is Weight, check DB Unit
      if (dbUnit.includes('ton') || dbUnit.includes('tonne')) {
        finalQty = requiredQty / 1000;
        finalUnit = 'Ton';
      }
      // If DB unit is kg, keep as is
    }

    // 3. Rounding
    // Qty: 2 decimals for accuracy, Price: Integer for currency
    const roundedQty = parseFloat(finalQty.toFixed(2));
    const totalCost = Math.round(roundedQty * rateToUse);

    return {
      qty: roundedQty,
      unit: finalUnit, // The unit matching the price
      rate: rateToUse,
      total: totalCost,
      name: material.name
    };
  };

  const calculation = useMemo(() => {
    let items: any[] = [];
    
    // --- 1. GEOMETRY INPUTS ---
    const n = parseInt(numFootings) || 0;
    const l_m = parseFloat(lengthFt) * FT_TO_M;
    const w_m = parseFloat(widthFt) * FT_TO_M;
    const total_depth_m = parseFloat(depthFt) * FT_TO_M;
    const pcc_h_m = parseFloat(pccThicknessFt) * FT_TO_M;
    
    // Calculate remaining structural height
    const structural_h_m = Math.max(0, total_depth_m - pcc_h_m);

    // --- 2. PCC BASE (Mix 1:4:8) ---
    if (foundationConfig.hasPCC) {
      const volPCC = n * l_m * w_m * pcc_h_m;
      const dryVol = volPCC * DRY_VOL_MULTIPLIER_CONCRETE;
      
      // Cement
      const cementBags = Math.ceil((dryVol * (1/13)) * CEMENT_BAGS_PER_M3);
      const matCem = getMat('PCC Base', 'Cement');
      items.push({
        category: 'PCC Base',
        name: `Cement (${matCem.name})`,
        desc: 'Base Mix 1:4:8',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : 420,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : 420))
      });

      // Sand
      const sandM3 = dryVol * (4/13);
      const matSand = getMat('PCC Base', 'Sand');
      const sandCost = calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, 1500);
      items.push({ ...sandCost, category: 'PCC Base', desc: 'PCC Grade Sand' });

      // Aggregate (Assuming standard m3 rate if not selected)
      const aggM3 = dryVol * (8/13);
      const aggLabel = `Aggregates (${getAggSize('PCC Base')})`;
      items.push({
        category: 'PCC Base',
        name: aggLabel,
        desc: 'Coarse Aggregate',
        qty: parseFloat(aggM3.toFixed(2)),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: Math.round(aggM3 * MARKET_RATE_AGGREGATE)
      });
    }

    // --- 3. MAIN LAYER ---
    if (foundationConfig.mainLayer === 'RCC Footing') {
      // Split into Footing Base and Neck Column (Pedestal)
      // Uses ASSUMED_SPECS constants instead of magic numbers
      const pedestalH_m = Math.max(0, structural_h_m - ASSUMED_SPECS.FOOTING_HEIGHT_M);
      
      const volFooting = n * l_m * w_m * ASSUMED_SPECS.FOOTING_HEIGHT_M;
      const volPedestal = n * ASSUMED_SPECS.PEDESTAL_L_M * ASSUMED_SPECS.PEDESTAL_W_M * pedestalH_m;
      const totalRCCVol = volFooting + volPedestal;
      const dryVol = totalRCCVol * DRY_VOL_MULTIPLIER_CONCRETE;

      // Cement (M20 Mix 1:1.5:3 approx)
      const cementBags = Math.ceil((dryVol * (1/5.5)) * CEMENT_BAGS_PER_M3);
      const matCem = getMat('RCC Footing', 'Cement');
      items.push({
        category: 'RCC Footing',
        name: `Cement (${matCem.name})`,
        desc: 'M20 Grade Mix',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : 450,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : 450))
      });

      // Steel
      const steelKg = totalRCCVol * ASSUMED_SPECS.STEEL_DENSITY_RCC;
      const matSteel = getMat('RCC Footing', 'Steel (TMT Bar)');
      const steelCost = calculateItem(steelKg, 'kg', matSteel, DENSITY.STEEL, 75);
      items.push({ ...steelCost, category: 'RCC Footing', desc: 'Mesh & Starter Bars' });

      // Sand
      const sandM3 = dryVol * (1.5/5.5);
      const matSand = getMat('RCC Footing', 'Sand');
      const sandCost = calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, 1600);
      items.push({ ...sandCost, category: 'RCC Footing', desc: 'Concrete M-Sand' });

      // Aggregate
      const aggM3 = dryVol * (3/5.5);
      items.push({
        category: 'RCC Footing',
        name: `Aggregates (${getAggSize('RCC Footing')})`,
        desc: 'Crushed Stone',
        qty: parseFloat(aggM3.toFixed(2)),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: Math.round(aggM3 * MARKET_RATE_AGGREGATE)
      });

    } else if (foundationConfig.mainLayer === 'Stone Masonry') {
      const volMasonry = n * l_m * w_m * structural_h_m;
      
      // Stone
      const stoneM3 = volMasonry * 1.15; // +15% for wastage/packing
      const matStone = getMat('Stone Masonry', 'Size Stone');
      // Note: Size Stone usually sold by Tractor Load (approx volume) or Number, but here converting based on unit
      const stoneCost = calculateItem(stoneM3, 'm3', matStone, DENSITY.STONE, 1100);
      items.push({ ...stoneCost, category: 'Stone Masonry', desc: 'Foundation Body' });

      // Mortar
      const mortarVol = volMasonry * MASONRY_MORTAR_RATIO;
      const dryMortar = mortarVol * DRY_VOL_MULTIPLIER_MORTAR;
      
      // Cement (1:6)
      const cementBags = Math.ceil((dryMortar * (1/7)) * CEMENT_BAGS_PER_M3);
      const matCem = getMat('Stone Masonry', 'Cement');
      items.push({
        category: 'Stone Masonry',
        name: `Cement (${matCem.name})`,
        desc: 'Mortar Mix 1:6',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : 420,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : 420))
      });

      // Sand
      const sandM3 = dryMortar * (6/7);
      const matSand = getMat('Stone Masonry', 'Sand');
      const sandCost = calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, 1500);
      items.push({ ...sandCost, category: 'Stone Masonry', desc: 'Masonry Sand' });
    }

    // --- 4. PLINTH BEAM ---
    if (foundationConfig.includePlinth) {
      // Estimate Perimeter: SQRT(Area) * 4 sides * 1.2 multiplier for internal walls
      const perimeterM = (Math.sqrt(area) * 4) * 1.2;
      const volPlinth = perimeterM * ASSUMED_SPECS.PLINTH_BEAM_W_M * ASSUMED_SPECS.PLINTH_BEAM_D_M;
      const dryVol = volPlinth * DRY_VOL_MULTIPLIER_CONCRETE;
      
      // Fallback Logic for Brands
      const matCem = getMat('Plinth Beam', 'Cement').exists ? getMat('Plinth Beam', 'Cement') : getMat('RCC Footing', 'Cement');
      const matSteel = getMat('Plinth Beam', 'Steel (TMT Bar)').exists ? getMat('Plinth Beam', 'Steel (TMT Bar)') : getMat('RCC Footing', 'Steel (TMT Bar)');
      const matSand = getMat('Plinth Beam', 'Sand').exists ? getMat('Plinth Beam', 'Sand') : getMat('RCC Footing', 'Sand');

      // Cement
      const cementBags = Math.ceil((dryVol * (1/5.5)) * CEMENT_BAGS_PER_M3);
      items.push({
        category: 'Plinth Beam',
        name: `Cement (${matCem.name})`,
        desc: 'M20 Grade',
        qty: cementBags,
        unit: 'Bags',
        rate: matCem.exists ? matCem.price : 450,
        total: Math.round(cementBags * (matCem.exists ? matCem.price : 450))
      });

      // Sand
      const sandM3 = dryVol * (1.5/5.5);
      const sandCost = calculateItem(sandM3, 'm3', matSand, DENSITY.SAND, 1600);
      items.push({ ...sandCost, category: 'Plinth Beam', desc: 'Concrete Sand' });

      // Aggregate
      const aggM3 = dryVol * (3/5.5);
      items.push({
        category: 'Plinth Beam',
        name: 'Aggregates',
        desc: 'Crushed Stone',
        qty: parseFloat(aggM3.toFixed(2)),
        unit: 'm³',
        rate: MARKET_RATE_AGGREGATE,
        total: Math.round(aggM3 * MARKET_RATE_AGGREGATE)
      });

      // Steel
      const steelKg = volPlinth * ASSUMED_SPECS.STEEL_DENSITY_PLINTH;
      const steelCost = calculateItem(steelKg, 'kg', matSteel, DENSITY.STEEL, 78);
      items.push({ ...steelCost, category: 'Plinth Beam', desc: 'Reinforcement' });
    }

    // Final Sum of all rounded totals
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
        totalCost: calculation.grandTotal, // Rounded Total
        lineItems: calculation.items,
        area: parseFloat(area),
        specifications: {
          depth: depthFt,
          footingCount: numFootings,
          method: foundationConfig.mainLayer,
          plinth: foundationConfig.includePlinth,
          // Save assumptions for traceability
          assumptions: ASSUMED_SPECS 
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
          
          {/* SUMMARY CARD */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryLabel}>ESTIMATED MATERIAL COST</Text>
                {/* Grand total matches sum of items due to consistent rounding */}
                <Text style={styles.summaryTotal}>₹{calculation.grandTotal.toLocaleString('en-IN')}</Text>
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
                  <Text style={styles.itemPrice}>₹{item.total.toLocaleString()}</Text>
                  <Text style={styles.itemRate}>@ {item.rate}/{item.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              Material estimate uses standard engineering densities (e.g. Steel {DENSITY.STEEL} kg/m³). Dimensions for Neck Column and Plinth are assumed based on standard residential specs.
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