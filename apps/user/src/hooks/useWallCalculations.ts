/**
 * useWallCalculations
 *
 * Custom hook that owns every piece of business logic for the Wall screen:
 *  - Firestore material fetching
 *  - AI wall-composition detection & metadata extraction from rooms
 *  - Default material selection by tier
 *  - System cost + budget-violation tracking
 *  - Brick/mortar quantity calculation (useMemo)
 *  - AI perspective generation & application
 *  - Helpers: calculateSystemCost, getFilteredMaterials, getTierBudgetPerMaterial
 *
 * The screen itself only holds pure-UI state (dropdowns, modals, filter chips).
 */

import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { collection, query, onSnapshot } from 'firebase/firestore';
import {
  db,
  detectWallComposition,
  getWallPerspectives,
  WallPerspective,
} from '@archlens/shared';
import {
  IN_TO_FT,
  CEMENT_BAGS_PER_M3,
  DRY_VOL_MULTIPLIER,
  SAND_DENSITY_KG_M3,
  CFT_PER_M3,
  MORTAR_WASTAGE_FACTOR,
  TIER_BUDGETS,
} from '../constants/wallConstants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WallCalculationResult {
  loadBearingQty: number;
  partitionQty:   number;
  cementQty:      number;
  sandQty:        number;
}

export interface SystemCosts  { loadBearing: number; partition: number }
export interface BudgetViolation { violated: boolean; difference: number }
export interface BudgetViolations { loadBearing: BudgetViolation; partition: BudgetViolation }

// ─── Hook input ───────────────────────────────────────────────────────────────

interface UseWallCalculationsParams {
  totalArea:       number;
  rooms:           any[];
  tier:            string;
  wallComposition: any;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallCalculations({
  totalArea,
  rooms,
  tier,
  wallComposition,
}: UseWallCalculationsParams) {

  // ── Data & loading ──────────────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [materials,  setMaterials]  = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});

  // ── Material selections ─────────────────────────────────────────────────────
  const [loadBearingBrick,    setLoadBearingBrick]    = useState<any>(null);
  const [partitionBrick,      setPartitionBrick]      = useState<any>(null);

  // ── Dimension inputs ────────────────────────────────────────────────────────
  const [height,               setHeight]               = useState('10.5');
  const [wallThickness,        setWallThickness]        = useState('');
  const [jointThickness,       setJointThickness]       = useState('0.375');
  const [openingDeduction,     setOpeningDeduction]     = useState('');
  const [partitionWallThickness, setPartitionWallThickness] = useState(4.5);

  // ── Wall composition metadata (from AI) ────────────────────────────────────
  const [avgOpeningPercentage,  setAvgOpeningPercentage]  = useState(0);
  const [avgMainWallRatio,      setAvgMainWallRatio]      = useState(0);
  const [avgPartitionWallRatio, setAvgPartitionWallRatio] = useState(0);
  const [isDetectingComposition, setIsDetectingComposition] = useState(false);
  const [compositionDetected,    setCompositionDetected]    = useState(false);

  // ── AI recommendation metadata ──────────────────────────────────────────────
  const [aiAdvice,          setAiAdvice]          = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, string | null>>({
    loadBearingBrick: null,
    partitionBrick:   null,
    cement:           null,
    sand:             null,
  });
  const [aiInsights, setAiInsights] = useState<{
    costSavingsPercent?: number;
    reason?:             string;
    materialChoice?:     string;
  } | null>(null);

  // ── Finish preference ───────────────────────────────────────────────────────
  const [finishPreference, setFinishPreference] = useState<'Plastered' | 'Exposed' | null>(null);

  // ── AI perspectives ─────────────────────────────────────────────────────────
  const [aiPerspectives,     setAiPerspectives]     = useState<WallPerspective[]>([]);
  const [selectedPerspectiveId, setSelectedPerspectiveId] = useState<string | null>(null);
  const [isPerspectiveLoading,  setIsPerspectiveLoading]  = useState(false);

  // ── Selection-mode tracking ─────────────────────────────────────────────────
  const [materialSelectionMode, setMaterialSelectionMode] = useState<Record<string, 'ai' | 'manual'>>({
    loadBearing: 'manual',
    partition:   'manual',
  });

  // ── Derived costs / violations ──────────────────────────────────────────────
  const [systemCosts, setSystemCosts] = useState<SystemCosts>({ loadBearing: 0, partition: 0 });
  const [budgetViolations, setBudgetViolations] = useState<BudgetViolations>({
    loadBearing: { violated: false, difference: 0 },
    partition:   { violated: false, difference: 0 },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1.  Fetch all materials from Firestore (single subscription)
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMaterials(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // 1.5  Detect / apply wall composition
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // ── Case A: pre-computed composition passed in from floor-plan analysis ──
    if (wallComposition && typeof wallComposition === 'object') {
      const lb  = Math.round(parseFloat(wallComposition.loadBearingPercentage));
      const pt  = Math.round(parseFloat(wallComposition.partitionPercentage));
      const op  = Math.round(parseFloat(wallComposition.openingPercentage));
      const tck = parseFloat(wallComposition.averageWallThickness);

      if (!isNaN(lb) && !isNaN(pt) && !isNaN(op) && lb >= 0 && pt >= 0) {
        setAvgMainWallRatio(lb / 100);
        setAvgPartitionWallRatio(pt / 100);
        setAvgOpeningPercentage(op);
        setCompositionDetected(true);
        setWallThickness(
          !isNaN(tck) && tck > 0
            ? tck.toFixed(2)
            : ((lb / 100 * 9) + (pt / 100 * 4.5)).toFixed(2)
        );
        setOpeningDeduction(op.toString());
      }
      return; // skip AI call
    }

    // ── Case B: detect from room data via AI ───────────────────────────────
    if (rooms?.length > 0 && totalArea > 0) {
      setIsDetectingComposition(true);
      detectWallComposition(rooms, totalArea)
        .then((composition: any) => {
          const lb = Math.round(parseFloat(composition.loadBearingPercentage));
          const pt = Math.round(parseFloat(composition.partitionPercentage));
          const op = Math.round(parseFloat(composition.openingPercentage));

          if (isNaN(lb) || isNaN(pt) || isNaN(op))
            throw new Error('AI returned invalid numeric values');
          if (lb < 0 || lb > 100 || pt < 0 || pt > 100)
            throw new Error('AI returned out-of-range percentages');
          if (lb + pt === 0)
            throw new Error('AI returned zero total wall percentage');

          setAvgMainWallRatio(lb / 100);
          setAvgPartitionWallRatio(pt / 100);
          setAvgOpeningPercentage(op);
          setCompositionDetected(true);
          setWallThickness(((lb / 100 * 9) + ((100 - lb) / 100 * 4.5)).toFixed(2));
          setOpeningDeduction(op.toString());
        })
        .catch((error: any) => {
          setCompositionDetected(false);
          Alert.alert(
            'AI Analysis Required',
            `Wall composition detection failed: ${error?.message || 'Unknown error'}. Please try again.`,
            [{ text: 'OK' }],
          );
        })
        .finally(() => setIsDetectingComposition(false));
    }
  }, [rooms, totalArea, wallComposition]);

  // ════════════════════════════════════════════════════════════════════════════
  // 1.6  Extract metadata averages from per-room AI analysis
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (wallComposition || !rooms?.length) return;

    let totalMain = 0, totalPartition = 0, totalOpening = 0, count = 0;
    rooms.forEach((room: any) => {
      if (room.wallMetadata) {
        totalMain      += room.wallMetadata.mainWallRatio;
        totalPartition += room.wallMetadata.partitionWallRatio;
        count++;
      }
      if (room.openingPercentage) totalOpening += room.openingPercentage;
    });

    if (count > 0) {
      const avgMain      = totalMain / count;
      const avgPartition = totalPartition / count;
      const avgOpening   = Math.round(totalOpening / rooms.length);

      setAvgMainWallRatio(avgMain);
      setAvgPartitionWallRatio(avgPartition);
      setAvgOpeningPercentage(avgOpening);
      setWallThickness(((avgMain * 9) + (avgPartition * 4.5)).toFixed(2));
      setOpeningDeduction(avgOpening.toString());
    }
  }, [rooms, wallComposition]);

  // ════════════════════════════════════════════════════════════════════════════
  // 2.  Set default material selections by tier (runs once after materials load)
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!materials.length) return;

    const filteredByTier = (items: any[]) => {
      const sorted = [...items].sort((a, b) =>
        tier === 'Economy'
          ? parseFloat(a.pricePerUnit) - parseFloat(b.pricePerUnit)
          : parseFloat(b.pricePerUnit) - parseFloat(a.pricePerUnit)
      );
      return sorted[0] ?? items[0] ?? null;
    };

    // Load-bearing brick
    const lbOpts = materials.filter(m => m.category === 'Wall' && m.subCategory === 'Load Bearing');
    if (lbOpts.length > 0 && !loadBearingBrick) setLoadBearingBrick(filteredByTier(lbOpts));

    // Partition brick — Economy prefers 3-inch AAC blocks
    const ptOpts = materials.filter(m =>
      m.category === 'Wall' &&
      ['Partition Wall', 'Partition', 'Non-Load Bearing'].includes(m.subCategory)
    );
    if (ptOpts.length > 0 && !partitionBrick) {
      if (tier === 'Economy') {
        const aac = ptOpts
          .filter(m => m.dimensions?.includes('24x3') && m.name.toLowerCase().includes('aac'))
          .sort((a, b) => parseFloat(a.pricePerUnit) - parseFloat(b.pricePerUnit));
        if (aac.length > 0) {
          setPartitionBrick(aac[0]);
          setPartitionWallThickness(3);
        } else {
          setPartitionBrick(filteredByTier(ptOpts));
        }
      } else {
        setPartitionBrick(filteredByTier(ptOpts));
      }
    }

    // Cement & Sand
    setSelections(prev => ({
      ...prev,
      ...(!prev['Cement'] && { Cement: filteredByTier(materials.filter(m => m.type === 'Cement')) }),
      ...(!prev['Sand']   && { Sand:   filteredByTier(materials.filter(m => m.type === 'Sand'))   }),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, tier]);

  // ════════════════════════════════════════════════════════════════════════════
  // 2.5  System costs + budget-violation tracking
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loadBearingBrick || !partitionBrick || !height || !wallThickness) return;

    const h_ft  = parseFloat(height);
    const wt_in = parseFloat(wallThickness);
    if (h_ft <= 0 || wt_in <= 0) return;

    const runningLength_ft =
      rooms?.length > 0
        ? rooms.reduce((acc: number, r: any) =>
            acc + 2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0)), 0)
        : Math.max(200, 4 * Math.sqrt(totalArea || 1000));

    const netArea   = runningLength_ft * h_ft * (1 - (parseFloat(openingDeduction) || 0) / 100);
    const lbArea    = netArea * avgMainWallRatio;
    const pbArea    = netArea * avgPartitionWallRatio;

    const lbCost = _calcSystemCost(loadBearingBrick, lbArea, 'loadBearing', wt_in, partitionWallThickness, parseFloat(jointThickness), finishPreference, tier);
    const pbCost = _calcSystemCost(partitionBrick,   pbArea, 'partition',   wt_in, partitionWallThickness, parseFloat(jointThickness), finishPreference, tier);
    setSystemCosts({ loadBearing: lbCost, partition: pbCost });

    const lbBudget = TIER_BUDGETS[tier]?.loadBearing ?? 10;
    const pbBudget = TIER_BUDGETS[tier]?.partition   ?? 8;
    setBudgetViolations({
      loadBearing: { violated: parseFloat(loadBearingBrick.pricePerUnit) > lbBudget * 2, difference: Math.round((parseFloat(loadBearingBrick.pricePerUnit) - lbBudget) * 1000) },
      partition:   { violated: parseFloat(partitionBrick.pricePerUnit)   > pbBudget * 2, difference: Math.round((parseFloat(partitionBrick.pricePerUnit)   - pbBudget) * 1000) },
    });
  }, [loadBearingBrick, partitionBrick, finishPreference, height, wallThickness, openingDeduction, jointThickness, rooms, totalArea, avgMainWallRatio, avgPartitionWallRatio, partitionWallThickness, tier]);

  // ════════════════════════════════════════════════════════════════════════════
  // 3.  Quantity calculation engine  (memoised)
  // ════════════════════════════════════════════════════════════════════════════
  const calculation = useMemo((): WallCalculationResult => {
    const h_ft  = parseFloat(height) || 0;
    const wt_in = parseFloat(wallThickness) || 0;
    const ded   = (parseFloat(openingDeduction) || 0) / 100;
    const jt_in = parseFloat(jointThickness) || 0;

    if (h_ft <= 0 || wt_in <= 0 || (!loadBearingBrick && !partitionBrick))
      return { loadBearingQty: 0, partitionQty: 0, cementQty: 0, sandQty: 0 };

    const brickQty = (brick: any, faceArea: number, wallThick_in: number) => {
      if (!brick || faceArea <= 0) return 0;
      const [bL, bW, bH] = _parseDims(brick.dimensions);
      const layers     = Math.max(1, Math.round(wallThick_in / bW));
      const unitArea   = (bL + jt_in) * IN_TO_FT * (bH + jt_in) * IN_TO_FT;
      return Math.ceil((faceArea / unitArea) * layers * 1.05);
    };

    const mortarQty = (brick: any, faceArea: number, wallThick_in: number) => {
      if (!brick || faceArea <= 0) return { cementBags: 0, sandKg: 0 };
      const [bL, bW, bH] = _parseDims(brick.dimensions);
      const jt     = jt_in || 0.375;
      const layers = Math.max(1, Math.round(wallThick_in / bW));
      const bVol   = (bL * IN_TO_FT) * (bW * IN_TO_FT) * (bH * IN_TO_FT);
      const uVol   = ((bL + jt) * IN_TO_FT) * ((bW + jt) * IN_TO_FT) * ((bH + jt) * IN_TO_FT);
      const wallVol_ft3 = faceArea * (wallThick_in * IN_TO_FT) * layers;
      const mortarVol_m3 = wallVol_ft3 * ((uVol - bVol) / uVol) * DRY_VOL_MULTIPLIER * MORTAR_WASTAGE_FACTOR / CFT_PER_M3;
      return {
        cementBags: Math.ceil((mortarVol_m3 / 7) * CEMENT_BAGS_PER_M3),
        sandKg:     Math.ceil((mortarVol_m3 * 6 / 7) * SAND_DENSITY_KG_M3),
      };
    };

    const runningLen =
      rooms?.length > 0
        ? rooms.reduce((acc: number, r: any) => acc + 2 * (parseFloat(r.length || 0) + parseFloat(r.width || 0)), 0)
        : Math.max(200, 4 * Math.sqrt(totalArea || 1000));

    const net    = runningLen * h_ft * (1 - ded);
    const lbArea = net * avgMainWallRatio;
    const pbArea = net * avgPartitionWallRatio;

    const lbM = mortarQty(loadBearingBrick, lbArea, wt_in);
    const pbM = mortarQty(partitionBrick,   pbArea, partitionWallThickness);

    return {
      loadBearingQty: brickQty(loadBearingBrick, lbArea, wt_in),
      partitionQty:   brickQty(partitionBrick,   pbArea, partitionWallThickness),
      cementQty:      lbM.cementBags + pbM.cementBags,
      sandQty:        lbM.sandKg     + pbM.sandKg,
    };
  }, [height, wallThickness, jointThickness, openingDeduction, loadBearingBrick, partitionBrick, totalArea, rooms, avgMainWallRatio, avgPartitionWallRatio, partitionWallThickness]);

  // ════════════════════════════════════════════════════════════════════════════
  // 5.  AI Perspectives
  // ════════════════════════════════════════════════════════════════════════════

  const applyPerspective = (perspective: WallPerspective) => {
    setSelectedPerspectiveId(perspective.id);

    const lb   = materials.find(m => m.id === perspective.loadBearingBrickId);
    const pb   = materials.find(m => m.id === perspective.partitionBrickId);
    const cem  = materials.find(m => m.id === perspective.cementId);
    const sand = materials.find(m => m.id === perspective.sandId);

    if (lb) { setLoadBearingBrick(lb); setMaterialSelectionMode(prev => ({ ...prev, loadBearing: 'ai' })); }
    if (pb) {
      setPartitionBrick(pb);
      setMaterialSelectionMode(prev => ({ ...prev, partition: 'ai' }));
      if (pb.dimensions?.toLowerCase().includes('x3')) setPartitionWallThickness(3);
    }
    if (cem)  setSelections(prev => ({ ...prev, Cement: cem }));
    if (sand) setSelections(prev => ({ ...prev, Sand: sand }));

    setFinishPreference(perspective.finishType);
    setAiAdvice(perspective.reasoning || '');
    setAiRecommendations({
      loadBearingBrick: perspective.loadBearingBrickId,
      partitionBrick:   perspective.partitionBrickId,
      cement:           perspective.cementId,
      sand:             perspective.sandId,
    });
  };

  const loadAIPerspectives = async () => {
    if (!materials.length) return;
    setIsPerspectiveLoading(true);
    try {
      const perspectives = await getWallPerspectives(tier, totalArea, materials);
      setAiPerspectives(perspectives);
      if (perspectives.length > 0) applyPerspective(perspectives[0]);
    } catch (err: any) {
      console.error('AI Perspectives Error:', err);
    } finally {
      setIsPerspectiveLoading(false);
    }
  };

  // Auto-trigger once materials are ready
  useEffect(() => {
    if (materials.length > 0 && aiPerspectives.length === 0 && !isPerspectiveLoading) {
      loadAIPerspectives();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  // ════════════════════════════════════════════════════════════════════════════
  // Helpers exposed to UI
  // ════════════════════════════════════════════════════════════════════════════

  const calculateSystemCost = (
    material: any,
    faceArea_sqft: number,
    wallTypeKey: 'loadBearing' | 'partition',
  ): number =>
    _calcSystemCost(material, faceArea_sqft, wallTypeKey, parseFloat(wallThickness), partitionWallThickness, parseFloat(jointThickness), finishPreference, tier);

  const getFilteredMaterials = (list: any[], preference: 'Plastered' | 'Exposed' | null) => {
    if (!preference || preference === 'Plastered') return list;
    return list.filter(m =>
      m.requiresPlastering === false ||
      m.name.toLowerCase().includes('exposed') ||
      m.name.toLowerCase().includes('wire-cut') ||
      m.name.toLowerCase().includes('pressed')
    );
  };

  const getTierBudgetPerMaterial = (wallTypeKey: 'loadBearing' | 'partition'): number =>
    TIER_BUDGETS[tier]?.[wallTypeKey] ?? 10;

  const setLoadBearingBrickManual = (item: any) => {
    setLoadBearingBrick(item);
    setMaterialSelectionMode(prev => ({ ...prev, loadBearing: 'manual' }));
    setSelectedPerspectiveId(null);
  };

  const setPartitionBrickManual = (item: any) => {
    setPartitionBrick(item);
    setMaterialSelectionMode(prev => ({ ...prev, partition: 'manual' }));
    setSelectedPerspectiveId(null);
  };

  // ────────────────────────────────────────────────────────────────────────────
  return {
    // data
    loading, materials, selections, setSelections,
    // material selections
    loadBearingBrick, setLoadBearingBrick, setLoadBearingBrickManual,
    partitionBrick,   setPartitionBrick,   setPartitionBrickManual,
    // dimension inputs
    height, setHeight,
    wallThickness, setWallThickness,
    jointThickness, setJointThickness,
    openingDeduction, setOpeningDeduction,
    partitionWallThickness, setPartitionWallThickness,
    // composition metadata
    avgOpeningPercentage, avgMainWallRatio, avgPartitionWallRatio,
    isDetectingComposition, compositionDetected,
    // AI state
    aiAdvice, aiRecommendations, aiInsights,
    finishPreference, setFinishPreference,
    // perspectives
    aiPerspectives, selectedPerspectiveId,
    isPerspectiveLoading, loadAIPerspectives, applyPerspective,
    // selection mode
    materialSelectionMode,
    // calculated outputs
    calculation, systemCosts, budgetViolations,
    // helpers
    calculateSystemCost, getFilteredMaterials, getTierBudgetPerMaterial,
  };
}

// ─── Private pure helpers (not exported) ─────────────────────────────────────

function _parseDims(dimensions: string | undefined): [number, number, number] {
  const parts = dimensions?.toLowerCase().split('x').map(v => parseFloat(v.trim())) ?? [];
  return [parts[0] ?? 9, parts[1] ?? 4, parts[2] ?? 3];
}

function _calcSystemCost(
  material:       any,
  faceArea_sqft:  number,
  wallTypeKey:    'loadBearing' | 'partition',
  wallThick_in:   number,
  partThick_in:   number,
  jt_in:          number,
  finishPref:     'Plastered' | 'Exposed' | null,
  tier:           string,
): number {
  if (!material) return 0;

  const unitPrice = parseFloat(material.pricePerUnit) || 0;
  const [bL,, bH] = _parseDims(material.dimensions);
  const [, bW]    = _parseDims(material.dimensions);
  const targetThick = wallTypeKey === 'loadBearing' ? wallThick_in : partThick_in;
  const layers      = Math.max(1, Math.round(targetThick / bW));
  const unitArea    = (bL + jt_in) * IN_TO_FT * (bH + jt_in) * IN_TO_FT;
  const qty         = Math.ceil((faceArea_sqft / unitArea) * layers * 1.05);
  const materialCost = unitPrice * qty;

  let finishingCost = 0;
  const needsPlaster = !material.requiresPlastering || material.requiresPlastering === true;
  if (finishPref === 'Plastered' && needsPlaster) {
    const ppSqft = material.finishRoughness === 'high' ? 45 : material.finishRoughness === 'medium' ? 30 : 20;
    finishingCost = ppSqft * faceArea_sqft;
  }

  return Math.round(materialCost + finishingCost);
}
