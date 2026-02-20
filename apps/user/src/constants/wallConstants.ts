// ─── Wall Engineering Constants ──────────────────────────────────────────────
// Single source of truth for all wall calculation constants.
// Used by useWallCalculations hook and WallCostSummaryScreen.

export const IN_TO_FT = 1 / 12;
export const FT_TO_M = 0.3048;
export const CEMENT_BAGS_PER_M3 = 28.8;   // Standard 50 kg bags per 1 m³ of cement
export const DRY_VOL_MULTIPLIER = 1.33;   // Dry volume factor for mortar
export const SAND_DENSITY_KG_M3 = 1600;   // Average density of sand (kg/m³)
export const CFT_PER_M3 = 35.3147;
export const MORTAR_WASTAGE_FACTOR = 1.15; // 15 % extra for spillage & brick frogs

export const TIER_BUDGETS: Record<string, Record<'loadBearing' | 'partition', number>> = {
  Economy:  { loadBearing: 10, partition: 8  },
  Standard: { loadBearing: 18, partition: 12 },
  Luxury:   { loadBearing: 35, partition: 25 },
};
