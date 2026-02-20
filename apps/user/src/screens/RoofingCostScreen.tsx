import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// ─── ENGINEERING CONSTANTS ─────────────────────────────────────────────────
const FT2_TO_M2    = 0.0929;         // 1 sq ft → m²
const FT_TO_M      = 0.3048;         // 1 ft → m
const FT3_TO_M3    = 0.028317;       // 1 cu ft → m³
const CFT_PER_M3   = 35.3147;        // m³ → cu ft
const CEMENT_BAGS_PER_M3 = 28.8;     // bags of 50 kg per m³ cement
const DRY_VOL_CONC = 1.54;           // dry volume multiplier for concrete
const DRY_VOL_MORT = 1.33;           // dry volume multiplier for mortar
const SLOPE_FACTOR = 1.15;           // area increase for ~20° pitched roof

// Market fallback rates (₹) – used if no seeded material is selected
const FALLBACK = {
  CEMENT:      420,
  SAND:        40,    // per cft
  AGGREGATE:   42,    // per cft
  STEEL:       72,    // per kg
  TILE_CLAY:   22,    // per Nos
  TILE_CONCRETE:28,
  TILE_SLATE:  85,
  TRUSS_STEEL: 75,    // per kg
  TRUSS_TIMBER:380,   // per kg
  GI_SHEET:    65,    // per kg
  ALUM_SHEET:  185,   // per kg
  POLY_SHEET:  320,   // per Nos
  MEMBRANE:    1800,  // per roll
  UNDERLAYMENT:1200,  // per roll
  FELT:        950,   // per roll
  WATERPROOF:  850,   // per litre/kg
  BRICKS:      8,     // per Nos (parapet)
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
interface CalcItem {
  category: string;
  name: string;
  desc: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
}

const row = (
  category: string,
  name: string,
  desc: string,
  qty: number,
  unit: string,
  rate: number
): CalcItem => ({ category, name, desc, qty: parseFloat(qty.toFixed(2)), unit, rate, total: Math.round(qty * rate) });

/** Convert raw m³ to the unit the seeded material is sold in. */
const toSoldUnit = (
  volM3: number,
  dbUnit: string,
  densityKgM3: number
): { qty: number; unit: string } => {
  const u = dbUnit.toLowerCase();
  if (u.includes('cft') || u.includes('cubic'))  return { qty: volM3 * CFT_PER_M3,          unit: 'cft' };
  if (u.includes('brass'))                        return { qty: (volM3 * CFT_PER_M3) / 100,  unit: 'Brass' };
  if (u.includes('ton'))                          return { qty: (volM3 * densityKgM3) / 1000,unit: 'Ton' };
  if (u.includes('kg'))                           return { qty: volM3 * densityKgM3,          unit: 'kg' };
  return { qty: volM3 * CFT_PER_M3, unit: 'cft' };
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function RoofingCostScreen({ route, navigation }: any) {
  const {
    projectId,
    tier         = 'Standard',
    roofType     = 'Sloped Roof - Tile',
    roofArea     = '1000',
    slabThickness= '0.5',        // ft (RCC only)
    openingDeduction = '5',      // %
    hasWaterproofing = true,     // bool (RCC only)
    hasParapet       = false,    // bool (RCC only)
    parapetHeight    = '3',      // ft
    parapetThickness = '0.75',   // ft
    selections   = {},           // Record<layerKey_type, materialObject>
  } = route.params || {};

  const [saving, setSaving] = useState(false);

  // ── Helper: get selected material for a given type ──────────────────────
  const getMat = (type: string, subCat?: string): { item: any; price: number; unit: string; name: string; exists: boolean } => {
    // Try layerName_type key first
    const key = subCat ? `${subCat}_${type}` : `${roofType}_${type}`;
    const item = selections[key] || null;
    return {
      item,
      price: item?.pricePerUnit ? parseFloat(item.pricePerUnit) : 0,
      unit:  item?.unit ?? '',
      name:  item?.name ?? 'Not Selected',
      exists: !!item,
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  //  ENGINEERING CALCULATION
  // ════════════════════════════════════════════════════════════════════════
  const calculation = useMemo(() => {
    const items: CalcItem[] = [];

    const grossAreaFt2  = parseFloat(roofArea) || 0;
    const dedFrac       = (parseFloat(openingDeduction) || 0) / 100;
    const netAreaFt2    = grossAreaFt2 * (1 - dedFrac);
    const netAreaM2     = netAreaFt2 * FT2_TO_M2;

    // ────────────────────────────────────────────
    //  A.  RCC SLAB
    // ────────────────────────────────────────────
    if (roofType === 'RCC Slab') {
      const thickFt   = parseFloat(slabThickness) || 0.5;
      const slabVolM3 = netAreaM2 * (thickFt * FT_TO_M);
      const dryVol    = slabVolM3 * DRY_VOL_CONC;

      // M20 mix ratio 1 : 1.5 : 3  (total parts = 5.5)
      // --- Cement ---
      const cementVolM3 = dryVol * (1 / 5.5);
      const cementBags  = Math.ceil(cementVolM3 * CEMENT_BAGS_PER_M3);
      const matCem      = getMat('Cement');
      items.push(row(
        'RCC Slab – Core',
        `Cement (${matCem.name})`,
        'M20 Mix 1:1.5:3',
        cementBags,
        'Bags (50kg)',
        matCem.exists ? matCem.price : FALLBACK.CEMENT,
      ));

      // --- Steel (TMT Bar) ---
      const steelKg  = slabVolM3 * 80; // 80 kg/m³ typical for roof slab
      const matSteel = getMat('Steel (TMT Bar)');
      const steelRate = matSteel.exists ? matSteel.price : FALLBACK.STEEL;
      const steelConv = matSteel.exists && matSteel.unit.toLowerCase().includes('ton')
        ? { qty: steelKg / 1000, unit: 'Ton' }
        : { qty: steelKg,         unit: 'Kg' };
      items.push(row('RCC Slab – Core', `Steel TMT (${matSteel.name})`, 'Reinforcement @80 kg/m³', steelConv.qty, steelConv.unit, steelRate));

      // --- Sand ---
      const sandVolM3 = dryVol * (1.5 / 5.5);
      const matSand   = getMat('Sand');
      const sandConv  = toSoldUnit(sandVolM3, matSand.exists ? matSand.unit : 'cft', 1600);
      items.push(row('RCC Slab – Core', `Sand (${matSand.name})`, 'Fine Aggregate', sandConv.qty, sandConv.unit,
        matSand.exists ? matSand.price : FALLBACK.SAND));

      // --- Aggregate ---
      const aggVolM3 = dryVol * (3 / 5.5);
      const matAgg   = getMat('Aggregate');
      const aggConv  = toSoldUnit(aggVolM3, matAgg.exists ? matAgg.unit : 'cft', 1550);
      items.push(row('RCC Slab – Core', `Aggregate (${matAgg.name})`, 'Coarse Aggregate 20mm', aggConv.qty, aggConv.unit,
        matAgg.exists ? matAgg.price : FALLBACK.AGGREGATE));

      // --- Waterproofing Chemical ---
      if (hasWaterproofing) {
        // 2 kg/m² application rate, 2 coats
        const wpQtyKg = netAreaM2 * 2 * 2;
        const matWP   = getMat('Waterproofing Chemical');
        const wpUnit  = matWP.exists ? matWP.unit : 'Litre';
        items.push(row(
          'RCC Slab – Waterproofing',
          `Waterproofing Chemical (${matWP.name})`,
          '2 coats @2 kg/m²',
          wpQtyKg,
          wpUnit,
          matWP.exists ? matWP.price : FALLBACK.WATERPROOF,
        ));
      }

      // --- Parapet Wall (Brick) ---
      if (hasParapet) {
        const pH_ft   = parseFloat(parapetHeight)    || 3;
        const pT_ft   = parseFloat(parapetThickness) || 0.75;
        // Approx perimeter = 4 × sqrt(area) × 1.05 (openings accounted)
        const perimFt = 4 * Math.sqrt(grossAreaFt2) * 1.05;
        const wallVolFt3 = perimFt * pH_ft * pT_ft;
        const wallVolM3  = wallVolFt3 * FT3_TO_M3;

        // Bricks: ~500 nos/m³ + 5% wastage
        const bricksNos = Math.ceil(wallVolM3 * 500 * 1.05);
        const matBrick  = getMat('Brick Wall', 'Parapet Wall') || getMat('Block Wall', 'Parapet Wall');
        items.push(row(
          'Parapet Wall',
          `Bricks (${matBrick.exists ? matBrick.name : 'Standard Clay Brick'})`,
          `${perimFt.toFixed(0)} ft perimeter × ${pH_ft} ft ht`,
          bricksNos,
          'Nos',
          matBrick.exists ? matBrick.price : FALLBACK.BRICKS,
        ));

        // Mortar 1:6 for parapet
        const mortarM3  = wallVolM3 * 0.30;
        const dryMort   = mortarM3 * DRY_VOL_MORT;
        const pCem = Math.ceil((dryMort * (1 / 7)) * CEMENT_BAGS_PER_M3);
        items.push(row('Parapet Wall', 'Cement (Mortar 1:6)', 'Brickwork mortar', pCem, 'Bags (50kg)', FALLBACK.CEMENT));
        const pSandM3 = dryMort * (6 / 7);
        items.push(row('Parapet Wall', 'Sand', 'Masonry sand', pSandM3 * CFT_PER_M3, 'cft', FALLBACK.SAND));
      }
    }

    // ────────────────────────────────────────────
    //  B.  SLOPED ROOF – TILE
    // ────────────────────────────────────────────
    else if (roofType === 'Sloped Roof - Tile') {
      const slopedAreaM2 = netAreaM2 * SLOPE_FACTOR;

      // --- TRUSS STRUCTURE (Steel or Timber) ---
      const matSteel  = getMat('Steel Truss');
      const matTimber = getMat('Timber/Wood Truss');
      // Use whichever is selected; prefer steel truss first
      if (matSteel.exists) {
        const steelKg = slopedAreaM2 * 12; // 12 kg/m² standard steel truss
        items.push(row('Truss Structure', `Steel Truss (${matSteel.name})`, '@12 kg/m² of roof area', steelKg, 'Kg', matSteel.price));
      } else if (matTimber.exists) {
        const timberKg = slopedAreaM2 * 8; // ~8 kg/m² timber density estimate
        items.push(row('Truss Structure', `Timber Truss (${matTimber.name})`, '@8 kg/m² of roof area', timberKg, 'Kg', matTimber.price));
      } else {
        // Fallback: assume steel truss
        const steelKg = slopedAreaM2 * 12;
        items.push(row('Truss Structure', 'Steel Truss (Not Selected)', '@12 kg/m²', steelKg, 'Kg', FALLBACK.TRUSS_STEEL));
      }

      // --- ROOF COVERING ---
      // Clay Roof Tile: 16×10 in, effective coverage ~0.065 m²/tile (with 3" overlap)
      // Concrete Roof Tile: 20×12 in, effective coverage ~0.10 m²/tile
      // Slate Tile: 24×14 in, effective coverage ~0.13 m²/tile
      const matClay     = getMat('Clay Roof Tile');
      const matConcrete = getMat('Concrete Roof Tile');
      const matSlate    = getMat('Slate Tile');
      const WASTAGE     = 1.10; // 10%

      if (matClay.exists) {
        const qty = Math.ceil((slopedAreaM2 / 0.065) * WASTAGE);
        items.push(row('Roof Covering', `Clay Tile (${matClay.name})`, '~15 tiles/m² + 10% wastage', qty, 'Nos', matClay.price));
      } else if (matConcrete.exists) {
        const qty = Math.ceil((slopedAreaM2 / 0.10) * WASTAGE);
        items.push(row('Roof Covering', `Concrete Tile (${matConcrete.name})`, '~10 tiles/m² + 10% wastage', qty, 'Nos', matConcrete.price));
      } else if (matSlate.exists) {
        const qty = Math.ceil((slopedAreaM2 / 0.13) * WASTAGE);
        items.push(row('Roof Covering', `Slate Tile (${matSlate.name})`, '~8 tiles/m² + 10% wastage', qty, 'Nos', matSlate.price));
      } else {
        const qty = Math.ceil((slopedAreaM2 / 0.065) * WASTAGE);
        items.push(row('Roof Covering', 'Clay Tile (Not Selected)', '~15 tiles/m²', qty, 'Nos', FALLBACK.TILE_CLAY));
      }

      // --- PROTECTION (Underlayment + Membrane) ---
      // Each roll = 1m × 50m = 50 m²
      const rolls = Math.ceil((slopedAreaM2 * 1.1) / 50);

      const matUnder = getMat('Roofing Underlayment');
      const matMembrane = getMat('Waterproof Membrane');

      if (matUnder.exists) {
        items.push(row('Protection', `Underlayment (${matUnder.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', matUnder.price));
      } else if (matMembrane.exists) {
        items.push(row('Protection', `Waterproof Membrane (${matMembrane.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', matMembrane.price));
      } else {
        items.push(row('Protection', 'Roofing Underlayment (Not Selected)', '50m² per roll', rolls, 'Rolls', FALLBACK.UNDERLAYMENT));
      }
    }

    // ────────────────────────────────────────────
    //  C.  SLOPED ROOF – SHEET
    // ────────────────────────────────────────────
    else if (roofType === 'Sloped Roof - Sheet') {
      const slopedAreaM2 = netAreaM2 * SLOPE_FACTOR;
      const WASTAGE = 1.10;

      // --- ROOF COVERING ---
      const matGI   = getMat('Galvanized Iron Sheet');
      const matAlum = getMat('Aluminium Sheet');
      const matPoly = getMat('Polycarbonate Sheet');

      if (matGI.exists) {
        // Sheet: 1m × 3m = 3 m², effective with 10% lap = 2.7 m²
        // Density 0.45mm GI: 1 × 3 × 0.00045 × 7850 ≈ 10.6 kg/sheet
        const sheets = Math.ceil((slopedAreaM2 / 2.7) * WASTAGE);
        const totalKg = parseFloat((sheets * 10.6).toFixed(1));
        items.push(row('Roof Covering', `GI Sheet (${matGI.name})`, `${sheets} sheets (1m×3m), 0.45mm`, totalKg, 'Kg', matGI.price));
      } else if (matAlum.exists) {
        // Aluminium 0.8mm: 1 × 3 × 0.0008 × 2700 ≈ 6.5 kg/sheet
        const sheets = Math.ceil((slopedAreaM2 / 2.7) * WASTAGE);
        const totalKg = parseFloat((sheets * 6.5).toFixed(1));
        items.push(row('Roof Covering', `Aluminium Sheet (${matAlum.name})`, `${sheets} sheets (1m×3m), 0.8mm`, totalKg, 'Kg', matAlum.price));
      } else if (matPoly.exists) {
        // Polycarbonate 1m × 2m = 2 m², effective = 1.8 m²
        const sheets = Math.ceil((slopedAreaM2 / 1.8) * WASTAGE);
        items.push(row('Roof Covering', `Polycarbonate Sheet (${matPoly.name})`, `${sheets} sheets (1m×2m), 6mm`, sheets, 'Nos', matPoly.price));
      } else {
        const sheets = Math.ceil((slopedAreaM2 / 2.7) * WASTAGE);
        const totalKg = parseFloat((sheets * 10.6).toFixed(1));
        items.push(row('Roof Covering', 'GI Sheet (Not Selected)', `${sheets} sheets estimate`, totalKg, 'Kg', FALLBACK.GI_SHEET));
      }

      // --- PROTECTION (Anti-condensation Felt / Membrane) ---
      const rolls = Math.ceil((slopedAreaM2 * 1.1) / 50);
      const matFelt     = getMat('Anti-condensation Felt');
      const matMembrane = getMat('Waterproof Membrane');

      if (matFelt.exists) {
        items.push(row('Protection', `Anti-condensation Felt (${matFelt.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', matFelt.price));
      } else if (matMembrane.exists) {
        items.push(row('Protection', `Waterproof Membrane (${matMembrane.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', matMembrane.price));
      } else {
        items.push(row('Protection', 'Anti-condensation Felt (Not Selected)', '50m² per roll', rolls, 'Rolls', FALLBACK.FELT));
      }
    }

    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    return { items, grandTotal };
  }, [roofType, roofArea, slabThickness, openingDeduction, hasWaterproofing, hasParapet, parapetHeight, parapetThickness, selections]);



  // ─── SAVE TO FIRESTORE ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!auth.currentUser) return Alert.alert('Error', 'User not authenticated.');
    setSaving(true);
    try {
      await addDoc(collection(db, 'estimates'), {
        projectId,
        userId: auth.currentUser.uid,
        itemName: `Roofing Materials (${roofType})`,
        category: 'Roof',
        roofType,
        totalCost: calculation.grandTotal,
        lineItems: calculation.items,
        area: parseFloat(roofArea),
        tier,
        createdAt: serverTimestamp(),
      });
      Alert.alert('✅ Saved!', 'Roofing estimate saved successfully.');
      navigation.navigate('ProjectSummary', { projectId });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  const netAreaFt2   = parseFloat(roofArea) * (1 - (parseFloat(openingDeduction) || 0) / 100);
  const slopedAreaM2display = roofType !== 'RCC Slab' ? (netAreaFt2 * FT2_TO_M2 * SLOPE_FACTOR).toFixed(1) : null;

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
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* SUMMARY CARD */}
          <View style={styles.summaryCard}>
            {/* Label + Total + Badge row */}
            <Text style={styles.summaryLabel}>ESTIMATED MATERIAL COST</Text>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTotal}>₹{calculation.grandTotal.toLocaleString('en-IN')}</Text>
              <View style={styles.methodBadge}>
                <Text style={styles.methodBadgeText}>{roofType}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Stat boxes */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Plan Area</Text>
                <Text style={styles.summaryItemValue}>{roofArea} <Text style={styles.summaryItemUnit}>ft²</Text></Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Net Area</Text>
                <Text style={styles.summaryItemValue}>{netAreaFt2.toFixed(0)} <Text style={styles.summaryItemUnit}>ft²</Text></Text>
              </View>
              <View style={styles.summaryDivider} />
              {roofType === 'RCC Slab' ? (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Thickness</Text>
                  <Text style={styles.summaryItemValue}>{slabThickness} <Text style={styles.summaryItemUnit}>ft</Text></Text>
                </View>
              ) : (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Sloped Area</Text>
                  <Text style={styles.summaryItemValue}>{slopedAreaM2display} <Text style={styles.summaryItemUnit}>m²</Text></Text>
                </View>
              )}
            </View>
          </View>

          {/* MATERIAL BREAKDOWN */}
          <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Material</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Cost</Text>
            </View>

            {calculation.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.itemQty}>{item.qty.toLocaleString('en-IN')}</Text>
                  <Text style={styles.itemUnit}>{item.unit}</Text>
                </View>
                <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>₹{item.total.toLocaleString('en-IN')}</Text>
                  <Text style={styles.itemRate}>@ ₹{item.rate}/{item.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* DISCLAIMER */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              {roofType === 'RCC Slab'
                ? 'M20 concrete (1:1.5:3), steel @80 kg/m³, dry vol factor 1.54. 2026 avg market rates applied.'
                : roofType === 'Sloped Roof - Tile'
                  ? 'Slope factor 1.15 (≈20°). Tile qty includes 10% wastage. Protection rolls cover 50 m² each.'
                  : 'Slope factor 1.15 (≈20°). Sheet qty includes 10% wastage + lap allowance. Rolls cover 50 m² each.'}
              {' '}Actual site requirements may vary by ±10–15%.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={styles.saveBtnText}>Save Material Estimate</Text>
                <Ionicons name="save-outline" size={20} color="#fff" />
              </>
          }
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea:        { flex: 1 },
  scroll:          { padding: 20 },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  tierBadge:       { backgroundColor: '#315b76', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText:        { color: '#fff', fontSize: 12, fontWeight: '800' },

  summaryCard:      { backgroundColor: '#1e293b', borderRadius: 24, padding: 25, marginBottom: 25, elevation: 8 },
  summaryLabel:     { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  summaryHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryTotal:     { color: '#fff', fontSize: 28, fontWeight: '900' },
  methodBadge:      { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: 130 },
  methodBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  divider:          { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 18 },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem:      { alignItems: 'center', flex: 1 },
  summaryItemValue: { fontSize: 16, color: '#fff', fontWeight: '800' },
  summaryItemUnit:  { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  summaryItemLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.3 },
  summaryDivider:   { width: 1, height: 36, backgroundColor: '#334155' },

  sectionTitle:    { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5 },
  table:           { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader:     { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:              { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableRow:        { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  categoryLabel:   { fontSize: 9, fontWeight: '800', color: '#315b76', textTransform: 'uppercase', marginBottom: 2 },
  itemName:        { fontSize: 12, fontWeight: '700', color: '#334155' },
  itemDesc:        { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  itemQty:         { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  itemUnit:        { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  itemPrice:       { fontSize: 14, fontWeight: '700', color: '#10b981' },
  itemRate:        { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  disclaimer:      { flexDirection: 'row', gap: 10, backgroundColor: '#E0F2FE', padding: 15, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  disclaimerText:  { flex: 1, fontSize: 11, color: '#0369a1', lineHeight: 16 },

  saveBtn:         { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 5 },
  saveBtnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
