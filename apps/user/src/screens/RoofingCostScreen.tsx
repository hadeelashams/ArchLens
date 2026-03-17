import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// ─── ENGINEERING CONSTANTS ─────────────────────────────────────────────────
const FT2_TO_M2 = 0.0929;         // 1 sq ft → m²
const FT_TO_M = 0.3048;         // 1 ft → m
const FT3_TO_M3 = 0.028317;       // 1 cu ft → m³
const CFT_PER_M3 = 35.3147;        // m³ → cu ft
const CEMENT_BAGS_PER_M3 = 28.8;     // bags of 50 kg per m³ cement
const DRY_VOL_CONC = 1.54;           // dry volume multiplier for concrete
const DRY_VOL_MORT = 1.33;           // dry volume multiplier for mortar
// SLOPE_FACTOR is now computed dynamically from pitchRatio; 1.15 kept as default
const DEFAULT_SLOPE_FACTOR = 1.15;   // fallback for ~20° pitched roof (about 4.3:12 pitch)

// Market fallback rates (₹) – used if no seeded material is selected
const FALLBACK = {
  CEMENT: 420,
  SAND: 40,    // per cft
  AGGREGATE: 42,    // per cft
  STEEL: 72,    // per kg
  TILE_CLAY: 22,    // per Nos
  TILE_CONCRETE: 28,
  TILE_SLATE: 85,
  TRUSS_STEEL: 75,    // per kg
  TRUSS_TIMBER: 380,   // per kg
  GI_SHEET: 65,    // per kg
  ALUM_SHEET: 185,   // per kg
  POLY_SHEET: 320,   // per Nos
  MEMBRANE: 1800,  // per roll
  UNDERLAYMENT: 1200,  // per roll
  FELT: 950,   // per roll
  WATERPROOF: 450,   // per kg/litre (standard crystalline or liquid membrane)
  BRICKS: 8,     // per Nos (parapet)
  // ── Slab system materials (always FALLBACK – no user material selection for slab types)
  FILLER_BLOCK: 18,  // per Nos (clay/terracotta filler block ~200×200mm)
  PRECAST_UNIT: 850,  // per m² (precast panel supply + install)
  HOLLOW_CORE: 950,  // per m² (hollow core unit supply + install)
  PT_STRAND: 120,  // per kg (ASTM A416 grade 270, 15.2mm dia)
  NON_SHRINK_GROUT: 28, // per kg
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
  /** true when no matching selection was found and a FALLBACK constant was used */
  isFallback?: boolean;
}

const row = (
  category: string,
  name: string,
  desc: string,
  qty: number,
  unit: string,
  rate: number,
  isFallback = false,
): CalcItem => ({ category, name, desc, qty: parseFloat(qty.toFixed(2)), unit, rate, total: Math.round(qty * rate), isFallback });

/** Convert raw m³ to the unit the seeded material is sold in. */
const toSoldUnit = (
  volM3: number,
  dbUnit: string,
  densityKgM3: number
): { qty: number; unit: string } => {
  const u = dbUnit.toLowerCase();
  if (u.includes('cft') || u.includes('cubic')) return { qty: volM3 * CFT_PER_M3, unit: 'cft' };
  if (u.includes('brass')) return { qty: (volM3 * CFT_PER_M3) / 100, unit: 'Brass' };
  if (u.includes('ton')) return { qty: (volM3 * densityKgM3) / 1000, unit: 'Ton' };
  if (u.includes('kg')) return { qty: volM3 * densityKgM3, unit: 'kg' };
  return { qty: volM3 * CFT_PER_M3, unit: 'cft' };
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function RoofingCostScreen({ route, navigation }: any) {
  const {
    projectId,
    tier = 'Standard',
    roofType = 'Sloped Roof - Tile',
    roofShape = 'gable',         // gable | flat | hip | shed
    roofArea = '1000',
    slabThickness = '0.5',       // ft (RCC only)
    openingDeduction = '5',     // %
    hasWaterproofing = true,    // bool (RCC only)
    hasParapet = false,         // bool (RCC only)
    parapetHeight = '3',        // ft
    parapetThickness = '0.75',  // ft
    /**
     * Rise-over-run pitch ratio, e.g. 0.5 = 6:12 pitch → slopeFactor = sqrt(1 + 0.5²) ≈ 1.118
     * If 0 / missing, DEFAULT_SLOPE_FACTOR (1.15) is used.
     */
    pitchRatio = '0',
    selections = {},            // Record<layerKey_type, materialObject>
    editEstimateId,
  } = route.params || {};

  const [saving, setSaving] = useState(false);

  // ── Derive slope factor from pitch ratio ──────────────────────────────
  const SLAB_SYSTEMS_SET = new Set(['RCC Solid Slab', 'Filler Slab', 'Precast Concrete Slab', 'Precast Slab', 'Post-Tension Slab', 'Hollow Core Slab', 'Hollow Precast Slab', 'Slab']);
  const isSlabRoof = SLAB_SYSTEMS_SET.has(roofType);

  const pitchNum = parseFloat(pitchRatio) || 0;
  // Slabs are generally flat (factor 1.0). Sloped roofs use pitch or default factor.
  const slopeFactor = isSlabRoof ? 1.0 : (pitchNum > 0 ? Math.sqrt(1 + Math.pow(pitchNum, 2)) : DEFAULT_SLOPE_FACTOR);

  // Label shown in the disclaimer
  let pitchLabel = '';
  if (isSlabRoof) {
    pitchLabel = 'Flat roof (1:50 drainage slope assumed)';
  } else {
    pitchLabel = pitchNum > 0
      ? `${Math.round(pitchNum * 12)}:12 pitch (factor ${slopeFactor.toFixed(3)})`
      : '~20° assumed (factor 1.15)';
  }

  // ── Slab sub-type resolution ─────────────────────────────────────────────
  // selectedCovering is one of: 'RCC Solid Slab', 'Filler Slab', 'Precast Slab'
  const rawSlabSub: string = roofType === 'Slab'
    ? (((route.params as any)?.selectedCovering ?? '').trim() || 'RCC Solid Slab')
    : roofType;
  // Normalise any legacy "Precast Slab " (trailing-space) values from old documents
  const slabSubType = rawSlabSub.trim().replace(/^Precast Slab$/i, 'Precast Concrete Slab');

  // ── Helper: get selected material for a given type ──────────────────────
  /**
   * Fix #1 – We try THREE keys in order:
   *   1. `${subCat}_${type}` when a sub-category is explicitly given (e.g. Parapet Wall)
   *   2. `${roofType}_${type}` – the canonical key used by handleMaterialSelect
   *   3. Suffix scan as last resort: any key ending with `_${type}` (handles mis-keyed inits)
   */
  const getMat = (type: string, subCat?: string): { item: any; price: number; unit: string; name: string; exists: boolean } => {
    const primaryKey = subCat ? `${subCat}_${type}` : `${roofType}_${type}`;
    let item: any = selections[primaryKey] ?? null;

    if (!item) {
      // Fallback: scan all selection keys for one that ends with `_${type}`
      const suffix = `_${type}`;
      const fallbackKey = Object.keys(selections).find(k => k.endsWith(suffix));
      if (fallbackKey) item = selections[fallbackKey];
    }

    return {
      item,
      price: item?.pricePerUnit ? parseFloat(item.pricePerUnit) : 0,
      unit: item?.unit ?? '',
      name: item?.name ?? 'Not Selected',
      exists: !!item,
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  //  ENGINEERING CALCULATION
  // ════════════════════════════════════════════════════════════════════════
  const calculation = useMemo(() => {
    const items: CalcItem[] = [];

    const grossAreaFt2 = parseFloat(roofArea) || 0;
    const dedFrac = (parseFloat(openingDeduction) || 0) / 100;
    const netAreaFt2 = grossAreaFt2 * (1 - dedFrac);
    const netAreaM2 = netAreaFt2 * FT2_TO_M2;

    // ────────────────────────────────────────────
    //  A.  SLAB SYSTEMS (all 5 types)
    // ────────────────────────────────────────────
    if (isSlabRoof) {
      const thickFt = parseFloat(slabThickness) || 0.5;
      const slabVolM3 = netAreaM2 * (thickFt * FT_TO_M);

      // ── A0. Structural Support (Beams/Joists) Estimation ──────────────
      const matRCCBeams = getMat('RCC Beams');
      const matSteelFrame = getMat('Structural Steel Frame');
      let beamVolM3 = 0;

      if (matRCCBeams.exists) {
        // Engineering rule: Beams add ~15% additional concrete volume to a standard slab
        beamVolM3 = slabVolM3 * 0.15;
        const beamSteelKg = beamVolM3 * 100; // standard 100kg/m3 reinforcement
        items.push(row('Structural Support', 'Steel TMT (Beams)', '@100 kg/m³ beam reinforcement', beamSteelKg, 'Kg', FALLBACK.STEEL, true));
      } else if (matSteelFrame.exists) {
        // Steel Joists/Beams support: ~15 kg/m²
        const steelKg = netAreaM2 * 15;
        items.push(row('Structural Support', `Steel Frame (${matSteelFrame.name})`, 'Primary/Secondary I-beams @15kg/m²', steelKg, 'Kg', matSteelFrame.price));
      } else {
        // Fallback: assume integrated RCC beams if none selected
        beamVolM3 = slabVolM3 * 0.12; // minimal integrated beams
        const beamSteelKg = beamVolM3 * 80;
        items.push(row('Structural Support', 'Steel TMT (Beams)', 'Assumed integrated beam steel (@80kg/m³)', beamSteelKg, 'Kg', FALLBACK.STEEL, true));
      }

      // ── A1. RCC Solid Slab / Integrated Concrete Mix Calculation ──────
      if (slabSubType.includes('RCC') || slabSubType.includes('Solid')) {
        const totalVolM3 = slabVolM3 + beamVolM3;
        const dryVol = totalVolM3 * DRY_VOL_CONC;

        // M20 mix 1:1.5:3  (parts total = 5.5)
        const cementBags = Math.ceil((dryVol * (1 / 5.5)) * CEMENT_BAGS_PER_M3);
        items.push(row('RCC Solid Slab – Core', 'Cement (M20)', 'Mix 1:1.5:3 (Slab + Beams)', cementBags, 'Bags (50kg)', FALLBACK.CEMENT, true));

        const slabSteelKg = slabVolM3 * 80;
        items.push(row('RCC Solid Slab – Core', 'Steel TMT Bars (Slab)', '@80 kg/m³ slab reinforcement', slabSteelKg, 'Kg', FALLBACK.STEEL, true));

        const sandCft = (dryVol * (1.5 / 5.5)) * CFT_PER_M3;
        items.push(row('RCC Solid Slab – Core', 'Sand (Fine Agg.)', 'Concrete mix aggregate', sandCft, 'cft', FALLBACK.SAND, true));

        const aggCft = (dryVol * (3 / 5.5)) * CFT_PER_M3;
        items.push(row('RCC Solid Slab – Core', 'Aggregate 20mm', 'Coarse aggregate for mix', aggCft, 'cft', FALLBACK.AGGREGATE, true));
      }

      // ── A2. Filler Slab ──────────────────────────────────────────────
      else if (slabSubType.includes('Filler')) {
        const grossVolM3 = slabVolM3 + beamVolM3;
        const concreteVolM3 = (slabVolM3 * 0.70) + beamVolM3;  // fillers only displace slab concrete
        const dryVol = concreteVolM3 * DRY_VOL_CONC;
        const cementBags = Math.ceil((dryVol * (1 / 5.5)) * CEMENT_BAGS_PER_M3);
        items.push(row('Filler Slab – Core', 'Cement (M20)', 'Mix 1:1.5:3, slab vol offset by fillers', cementBags, 'Bags (50kg)', FALLBACK.CEMENT, true));
        const steelKg = grossVolM3 * 55;  // slightly increased reinforcing for filler slab girders
        items.push(row('Filler Slab – Core', 'Steel TMT Bars', 'Reinforcement for slab & joists', steelKg, 'Kg', FALLBACK.STEEL, true));
        const sandCft = (dryVol * (1.5 / 5.5)) * CFT_PER_M3;
        items.push(row('Filler Slab – Core', 'Sand', 'Fine aggregate', sandCft, 'cft', FALLBACK.SAND, true));
        const aggCft = (dryVol * (3 / 5.5)) * CFT_PER_M3;
        items.push(row('Filler Slab – Core', 'Aggregate 20mm', 'Coarse aggregate', aggCft, 'cft', FALLBACK.AGGREGATE, true));
        const fillerNos = Math.ceil(slabVolM3 * 10 * (1 / (thickFt * FT_TO_M))); // Approx Nos based on volume displacement
        items.push(row('Filler Slab – Fillers', 'Filler Blocks (Clay/Terracotta)', 'Reduces dead load and concrete volume', fillerNos, 'Nos', FALLBACK.FILLER_BLOCK, true));
      }

      // ── A3. Precast Concrete Slab ─────────────────────────────────────
      else if (slabSubType.includes('Precast')) {
        items.push(row('Precast Slab – Units', 'Precast Concrete Panels', 'Supply + install, M30, pre-tensioned', netAreaM2, 'm²', FALLBACK.PRECAST_UNIT, true));
        // 50mm structural topping in M25
        const toppingVolM3 = netAreaM2 * 0.05;
        const toppingDry = toppingVolM3 * DRY_VOL_CONC;
        const toppingCementBags = Math.ceil((toppingDry * (1 / 5.5)) * CEMENT_BAGS_PER_M3);
        items.push(row('Precast Slab – Topping', 'Cement M25 (Topping)', '50mm in-situ structural topping', toppingCementBags, 'Bags (50kg)', FALLBACK.CEMENT, true));
        const groutKg = Math.ceil(netAreaM2 * 0.5);
        items.push(row('Precast Slab – Topping', 'Non-shrink Grout', 'Panel joint filling', groutKg, 'Kg', FALLBACK.NON_SHRINK_GROUT, true));
      }

      // ── A4. Post-Tension Slab ───────────────────────────────────────
      else if (slabSubType.includes('Post') || slabSubType.includes('PT')) {
        const effThickFt = thickFt * 0.75;  // PT allows ~25% thickness reduction
        const slabVolM3 = netAreaM2 * (effThickFt * FT_TO_M);
        const dryVol = slabVolM3 * DRY_VOL_CONC;
        // M30 mix (1:1:2, total parts = 4)
        const cementBags = Math.ceil((dryVol * (1 / 4)) * CEMENT_BAGS_PER_M3);
        items.push(row('PT Slab – Core', 'Cement (M30)', 'Mix 1:1:2 for PT slab', cementBags, 'Bags (50kg)', Math.round(FALLBACK.CEMENT * 1.10), true));
        const sandCft = (dryVol * (1 / 4)) * CFT_PER_M3;
        items.push(row('PT Slab – Core', 'Sand', 'Fine aggregate', sandCft, 'cft', FALLBACK.SAND, true));
        const aggCft = (dryVol * (2 / 4)) * CFT_PER_M3;
        items.push(row('PT Slab – Core', 'Aggregate 20mm', 'Coarse aggregate', aggCft, 'cft', FALLBACK.AGGREGATE, true));
        const mildSteelKg = slabVolM3 * 30;  // mild non-PT steel
        items.push(row('PT Slab – Core', 'Steel TMT Bars', '@30 kg/m³ (non-PT)', mildSteelKg, 'Kg', FALLBACK.STEEL, true));
        const ptStrandKg = netAreaM2 * 4;   // 4 kg/m² typical for PT slab
        items.push(row('PT Slab – Core', 'PT Strands (15.2mm dia)', '@4 kg/m² ASTM A416 Grade 270', ptStrandKg, 'Kg', FALLBACK.PT_STRAND, true));
      }

      // ── A5. Hollow Core Slab ────────────────────────────────────────
      else if (slabSubType.includes('Hollow')) {
        items.push(row('Hollow Core – Units', 'Hollow Core Slab Units', 'Pre-tensioned, M40, depth 200–300mm', netAreaM2, 'm²', FALLBACK.HOLLOW_CORE, true));
        // 50mm structural topping
        const toppingVolM3 = netAreaM2 * 0.05;
        const toppingDry = toppingVolM3 * DRY_VOL_CONC;
        const toppingCementBags = Math.ceil((toppingDry * (1 / 5.5)) * CEMENT_BAGS_PER_M3);
        items.push(row('Hollow Core – Topping', 'Cement M25 (Structural Topping)', '50mm in-situ topping', toppingCementBags, 'Bags (50kg)', FALLBACK.CEMENT, true));
        const groutKg = Math.ceil(netAreaM2 * 0.3);
        items.push(row('Hollow Core – Topping', 'Bearing Grout', 'Joint fill + bearing seats', groutKg, 'Kg', 32, true));
      }

      // ── Waterproofing (all slab systems) ────────────────────────────────
      if (hasWaterproofing) {
        const wpQtyKg = netAreaM2 * 1.5; // 2 coats standard consumption
        items.push(row(
          `${slabSubType} – Waterproofing`,
          'Waterproofing Chemical',
          '2 coats @1.5 kg/m² (liquid applied membrane)',
          wpQtyKg,
          'Kg',
          FALLBACK.WATERPROOF,
          true,
        ));
      }

      // ── Parapet Wall (all slab systems) ─────────────────────────────
      if (hasParapet) {
        const pH_ft = parseFloat(parapetHeight) || 3;
        const pT_ft = parseFloat(parapetThickness) || 0.75;
        const perimFt = 4.4 * Math.sqrt(grossAreaFt2) * 1.05;
        const wallVolFt3 = perimFt * pH_ft * pT_ft;
        const wallVolM3 = wallVolFt3 * FT3_TO_M3;
        const bricksNos = Math.ceil(wallVolM3 * 500 * 1.05);
        items.push(row(
          'Parapet Wall',
          'Bricks (Standard Clay)',
          `~${perimFt.toFixed(0)} ft perimeter × ${pH_ft} ft ht (4.4√A est.)`,
          bricksNos, 'Nos', FALLBACK.BRICKS, true,
        ));
        const mortarM3 = wallVolM3 * 0.30;
        const dryMort = mortarM3 * DRY_VOL_MORT;
        const pCem = Math.ceil((dryMort * (1 / 7)) * CEMENT_BAGS_PER_M3);
        items.push(row('Parapet Wall', 'Cement (Mortar 1:6)', 'Brickwork mortar', pCem, 'Bags (50kg)', FALLBACK.CEMENT, true));
        const pSandM3 = dryMort * (6 / 7);
        items.push(row('Parapet Wall', 'Sand', 'Masonry sand', pSandM3 * CFT_PER_M3, 'cft', FALLBACK.SAND, true));
      }
    }

    // ────────────────────────────────────────────
    //  B.  SLOPED ROOFS (Tile or Sheet)
    // ────────────────────────────────────────────
    else if (roofType === 'Sloped Roof - Tile' || roofType === 'Sloped Roof - Sheet') {
      const slopedAreaM2 = netAreaM2 * slopeFactor;

      // --- 1. TRUSS STRUCTURE (Steel or Timber) ---
      const matSteelTruss = getMat('Steel Truss');
      const matTimber = getMat('Timber/Wood Truss');

      if (matSteelTruss.exists) {
        const steelKg = slopedAreaM2 * 12; // 12 kg/m² standard steel truss
        const steelUnitT = matSteelTruss.unit.toLowerCase();
        const trussQty = steelUnitT.includes('ton') ? steelKg / 1000 : steelKg;
        const trussUnit = steelUnitT.includes('ton') ? 'Ton' : 'Kg';
        items.push(row('Truss Structure', `Steel Truss (${matSteelTruss.name})`, '@12 kg/m² of roof area', trussQty, trussUnit, matSteelTruss.price));
      } else if (matTimber.exists) {
        const timberKg = slopedAreaM2 * 8; // ~8 kg/m² timber density estimate
        const timberUnitT = matTimber.unit.toLowerCase();
        const timbQty = timberUnitT.includes('ton') ? timberKg / 1000 : timberKg;
        const timbUnit = timberUnitT.includes('ton') ? 'Ton' : 'Kg';
        items.push(row('Truss Structure', `Timber Truss (${matTimber.name})`, '@8 kg/m² of roof area', timbQty, timbUnit, matTimber.price));
      } else {
        // Fallback: assume steel truss
        // --- Shape & Material Load Aware Truss Density (Engineering Refinement) ---
        // 1. Base density (kg per m² of sloped area) for standard Gable tiles
        let trussDensity = 12;

        // 2. Adjust for Shape Complexity
        if (roofShape === 'hip') trussDensity = 15;   // Hip/Valley rafters add weight
        if (roofShape === 'shed') trussDensity = 8.5; // Single slope Mono-truss is lighter

        // 3. Adjust for Dead Load (Sheet vs Tile)
        // Clay tiles (~45kg/m²) vs GI Sheets (~5kg/m²) allows for significantly lighter trusses
        if (roofType === 'Sloped Roof - Sheet') {
          trussDensity *= 0.75; // 25% reduction in steel weight for light sheet loading
        }

        const steelKg = slopedAreaM2 * trussDensity;
        const note = `@${trussDensity.toFixed(1)} kg/m² (${roofShape}${roofType.includes('Sheet') ? ' + light load' : ' + tile load'})`;
        items.push(row('Truss Structure', `Steel Truss (Refined)`, note, steelKg, 'Kg', FALLBACK.TRUSS_STEEL, true));
      }

      // --- 2. COVERING & WASTAGE (Shape-Aware) ---
      // Hip roofs have significantly more cut-waste than Gable or Shed
      const SHAPE_WASTAGE = {
        hip: 1.18,   // 18% waste (diagonal cuts)
        gable: 1.08, // 8% waste
        shed: 1.05,  // 5% waste
        flat: 1.05,
      }[roofShape as keyof typeof SHAPE_WASTAGE] || 1.10;

      // ─── B-I. TILE SPECIFIC COVERING & PROTECTION ──────────────────────────
      if (roofType === 'Sloped Roof - Tile') {
        const COVERING_TYPES_TILE = [
          { type: 'Clay Roof Tile', coverage: 0.065, label: `~15 tiles/m² + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, fallbackRate: FALLBACK.TILE_CLAY },
          { type: 'Concrete Roof Tile', coverage: 0.10, label: `~10 tiles/m² + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, fallbackRate: FALLBACK.TILE_CONCRETE },
          { type: 'Slate Tile', coverage: 0.13, label: `~8 tiles/m² + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, fallbackRate: FALLBACK.TILE_SLATE },
        ];

        const selectedCoveringType: string | undefined = (route.params as any)?.selectedCovering;
        const activeCovering = selectedCoveringType
          ? COVERING_TYPES_TILE.find(c => c.type === selectedCoveringType)
          : COVERING_TYPES_TILE.find(c => getMat(c.type).exists);

        if (activeCovering) {
          const mat = getMat(activeCovering.type);
          const qty = Math.ceil((slopedAreaM2 / activeCovering.coverage) * SHAPE_WASTAGE);
          const matUnitL = mat.unit.toLowerCase();
          const coverQty = matUnitL.includes('m²') || matUnitL.includes('sqm') ? slopedAreaM2 * SHAPE_WASTAGE : qty;
          const coverUnit = matUnitL.includes('m²') || matUnitL.includes('sqm') ? 'm²' : 'Nos';
          items.push(row('Roof Covering', `${activeCovering.type} (${mat.name})`, activeCovering.label, coverQty, coverUnit, mat.price));
        } else {
          const qty = Math.ceil((slopedAreaM2 / 0.065) * SHAPE_WASTAGE);
          items.push(row('Roof Covering', 'Clay Tile (Not Selected)', `~15 tiles/m² + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, qty, 'Nos', FALLBACK.TILE_CLAY, true));
        }

        // --- RIDGE CAPPING (Shape-Aware) ---
        // Hip roofs have ridges on all 4 corners + main peak
        const RIDGE_MULT = roofShape === 'hip' ? 2.2 : (roofShape === 'shed' ? 0.2 : 1.1);
        const ridgeLengthFt = RIDGE_MULT * Math.sqrt(grossAreaFt2);
        const ridgeLengthM = ridgeLengthFt * FT_TO_M;
        const ridgeTiles = Math.ceil(ridgeLengthM / 0.35);
        items.push(row('Roof Covering', 'Ridge Capping (Tiles)', `${ridgeTiles} nos for ${roofShape} ridge (${ridgeLengthFt.toFixed(0)}ft)`, ridgeTiles, 'Nos', FALLBACK.TILE_CONCRETE, true));
        const ridgeMortarCem = Math.ceil(ridgeLengthM * 0.15);
        items.push(row('Roof Covering', 'Ridge Mortar (Cement)', 'Capping installation mortar', ridgeMortarCem, 'Bags (50kg)', FALLBACK.CEMENT, true));

        // --- PROTECTION ---
        const rolls = Math.ceil((slopedAreaM2 * 1.1) / 50);
        const PROTECTION_TYPES_TILE = [
          { type: 'Roofing Underlayment', label: 'Underlayment' },
          { type: 'Waterproof Membrane', label: 'Waterproof Membrane' },
          { type: 'Anti-condensation Felt', label: 'Anti-condensation Felt' },
        ];
        let anyProtection = false;
        PROTECTION_TYPES_TILE.forEach(({ type, label }) => {
          const mat = getMat(type);
          if (mat.exists) {
            anyProtection = true;
            items.push(row('Protection', `${label} (${mat.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', mat.price));
          }
        });
        if (!anyProtection) {
          items.push(row('Protection', 'Roofing Underlayment (Not Selected)', '50m² per roll', rolls, 'Rolls', FALLBACK.UNDERLAYMENT, true));
        }
      }

      // ─── B-II. SHEET SPECIFIC COVERING & PROTECTION ─────────────────────────
      else {
        const matGI = getMat('Galvanized Iron Sheet');
        const matAlum = getMat('Aluminium Sheet');
        const matPoly = getMat('Polycarbonate Sheet');

        const resolveSheetQty = (m: any, sheetCount: number, kgPerSheet: number, areaM2: number) => {
          const u = m.unit.toLowerCase();
          if (u.includes('kg')) return { qty: parseFloat((sheetCount * kgPerSheet).toFixed(1)), unit: 'Kg' };
          if (u.includes('ton')) return { qty: parseFloat(((sheetCount * kgPerSheet) / 1000).toFixed(3)), unit: 'Ton' };
          if (u.includes('m²') || u.includes('sqm')) return { qty: parseFloat((areaM2 * SHAPE_WASTAGE).toFixed(2)), unit: 'm²' };
          return { qty: sheetCount, unit: 'Nos' };
        };

        const selectedSheetCovering: string | undefined = (route.params as any)?.selectedCovering;
        let sheetPriced = false;

        if (!selectedSheetCovering || selectedSheetCovering === 'Galvanized Iron Sheet') {
          if (matGI.exists) {
            const sheets = Math.ceil((slopedAreaM2 / 2.7) * SHAPE_WASTAGE);
            const { qty, unit } = resolveSheetQty(matGI, sheets, 10.6, slopedAreaM2);
            items.push(row('Roof Covering', `GI Sheet (${matGI.name})`, `${sheets} sheets (1m×3m) + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, qty, unit, matGI.price));
            sheetPriced = true;
          }
        }
        if (!sheetPriced && (!selectedSheetCovering || selectedSheetCovering === 'Aluminium Sheet')) {
          if (matAlum.exists) {
            const sheets = Math.ceil((slopedAreaM2 / 2.7) * SHAPE_WASTAGE);
            const { qty, unit } = resolveSheetQty(matAlum, sheets, 6.5, slopedAreaM2);
            items.push(row('Roof Covering', `Aluminium Sheet (${matAlum.name})`, `${sheets} sheets (1m×3m), 0.8mm + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, qty, unit, matAlum.price));
            sheetPriced = true;
          }
        }
        if (!sheetPriced && (!selectedSheetCovering || selectedSheetCovering === 'Polycarbonate Sheet')) {
          if (matPoly.exists) {
            const sheets = Math.ceil((slopedAreaM2 / 1.8) * SHAPE_WASTAGE);
            const { qty, unit } = resolveSheetQty(matPoly, sheets, 2.6, slopedAreaM2);
            items.push(row('Roof Covering', `Polycarbonate Sheet (${matPoly.name})`, `${sheets} sheets (1m×2m) + ${Math.round((SHAPE_WASTAGE - 1) * 100)}% waste`, qty, unit, matPoly.price));
            sheetPriced = true;
          }
        }
        if (!sheetPriced) {
          const sheets = Math.ceil((slopedAreaM2 / 2.7) * SHAPE_WASTAGE);
          items.push(row('Roof Covering', 'GI Sheet (Not Selected)', `${sheets} sheets estimate`, parseFloat((sheets * 10.6).toFixed(1)), 'Kg', FALLBACK.GI_SHEET, true));
        }

        // --- Ridge/Edge Flashing (Shape-Aware) ---
        const FLASH_MULT = roofShape === 'hip' ? 2.5 : (roofShape === 'shed' ? 0.3 : 1.2);
        const flashLenFt = FLASH_MULT * Math.sqrt(grossAreaFt2);
        const flashLenM = flashLenFt * FT_TO_M;
        const flashKg = flashLenM * 2.5; // ~2.5 kg/m for typical flashing
        items.push(row('Roof Covering', 'Ridge/Edge Flashing', `${roofShape} capping/apron (~${flashLenFt.toFixed(0)}ft)`, flashKg, 'Kg', FALLBACK.GI_SHEET + 10, true));

        // --- PROTECTION ---
        const rolls = Math.ceil((slopedAreaM2 * 1.1) / 50);
        const PROTECTION_TYPES_SHEET = [
          { type: 'Roofing Underlayment', label: 'Underlayment' },
          { type: 'Anti-condensation Felt', label: 'Anti-condensation Felt' },
          { type: 'Waterproof Membrane', label: 'Waterproof Membrane' },
        ];
        let anyProtectionSheet = false;
        PROTECTION_TYPES_SHEET.forEach(({ type, label }) => {
          const mat = getMat(type);
          if (mat.exists) {
            anyProtectionSheet = true;
            items.push(row('Protection', `${label} (${mat.name})`, '50m² per roll, +10% overlap', rolls, 'Rolls', mat.price));
          }
        });
        if (!anyProtectionSheet) {
          items.push(row('Protection', 'Anti-condensation Felt (Not Selected)', '50m² per roll', rolls, 'Rolls', FALLBACK.FELT, true));
        }
      }
    }

    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    const fallbackCount = items.filter(i => i.isFallback).length;
    return { items, grandTotal, fallbackCount };
  }, [isSlabRoof, slabSubType, roofType, roofArea, slabThickness, openingDeduction, hasWaterproofing, hasParapet, parapetHeight, parapetThickness, selections, slopeFactor]);



  // ─── SAVE TO FIRESTORE ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!auth.currentUser) return Alert.alert('Error', 'User not authenticated.');
    setSaving(true);
    try {
      const estimatePayload = {
        projectId,
        userId: auth.currentUser.uid,
        itemName: `Roofing Materials (${roofType})`,
        category: 'Roofing',
        roofType,
        totalCost: calculation.grandTotal,
        lineItems: calculation.items,
        area: parseFloat(roofArea),
        tier,
      };
      if (editEstimateId) {
        await updateDoc(doc(db, 'estimates', editEstimateId), { ...estimatePayload, updatedAt: serverTimestamp() });
        Alert.alert('✅ Updated!', 'Roofing estimate updated successfully.');
        navigation.navigate('EstimateResult', { projectId });
      } else {
        await addDoc(collection(db, 'estimates'), { ...estimatePayload, createdAt: serverTimestamp() });
        Alert.alert('✅ Saved!', 'Roofing estimate saved successfully.');
        navigation.navigate('ProjectSummary', { projectId });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  const netAreaFt2 = parseFloat(roofArea) * (1 - (parseFloat(openingDeduction) || 0) / 100);
  const isCostSlab = isSlabRoof;
  const slopedAreaM2display = !isCostSlab ? (netAreaFt2 * FT2_TO_M2 * slopeFactor).toFixed(1) : null;

  // ── Roof shape display meta ────────────────────────────────────────────
  const ROOF_SHAPE_META: Record<string, { label: string; icon: string }> = {
    gable: { label: 'Pitched / Gable', icon: 'home-outline' },
    flat: { label: 'Flat Roof', icon: 'remove-circle-outline' },
    hip: { label: 'Hip Roof', icon: 'stats-chart-outline' },
    shed: { label: 'Shed Roof', icon: 'trending-up-outline' },
  };
  const shapeMeta = ROOF_SHAPE_META[roofShape] ?? { label: roofShape, icon: 'home-outline' };

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

            {/* Header Row: Label + Chip */}
            <View style={styles.summaryTopRow}>
              <Text style={styles.summaryLabel}>ESTIMATED MATERIAL COST</Text>

              {/* Roof shape chip */}
              <View style={styles.shapeChip}>
                <Ionicons name={shapeMeta.icon as any} size={11} color="#94a3b8" />
                <Text style={styles.shapeChipText}>{shapeMeta.label}</Text>
              </View>
            </View>

            {/* Grand total */}
            <Text style={styles.summaryTotal}>₹{calculation.grandTotal.toLocaleString('en-IN')}</Text>

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
              {isCostSlab ? (
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
              <Text style={[styles.th, { flex: 2.5 }]}>Material</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Quantity</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Cost (₹)</Text>
            </View>

            {calculation.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={{ flex: 2.5 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                <View style={{ flex: 1.5, alignItems: 'center' }}>
                  <Text style={styles.itemQty}>{item.qty.toLocaleString('en-IN')} {item.unit}</Text>
                </View>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>{item.total.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* DISCLAIMER */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
            <Text style={styles.disclaimerText}>
              {isCostSlab
                ? 'Auto-calculated from slab geometry. Waterproofing and parapet included when toggled.'
                : `Slope: ${pitchLabel}. Qty includes 10% wastage. Each protection roll covers 50 m². Parapet perimeter estimated via 4.4√A formula.`
              }
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scroll: { padding: 20 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  summaryCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 25, marginBottom: 25, elevation: 8 },
  summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  summaryTotal: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4, marginBottom: 14 },

  summaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },

  // roof shape chip
  shapeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#475569' },
  shapeChipText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryItemValue: { fontSize: 16, color: '#fff', fontWeight: '800' },
  summaryItemUnit: { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  summaryItemLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.3 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#334155' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5 },
  table: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  itemName: { fontSize: 13, fontWeight: '600', color: '#334155' },
  itemQty: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#1e293b' },

  disclaimer: { flexDirection: 'row', gap: 10, backgroundColor: '#E0F2FE', padding: 15, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  disclaimerText: { flex: 1, fontSize: 11, color: '#0369a1', lineHeight: 16 },

  saveBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.85, backgroundColor: '#315b76', padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
