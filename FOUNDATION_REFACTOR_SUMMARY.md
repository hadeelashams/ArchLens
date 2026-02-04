# FoundationSelection.tsx - Refactoring Summary

## Overview
Refactored the foundation selection screen to properly separate **RCC Isolated Footing** and **Stone Masonry Continuous Wall** foundation systems with context-appropriate inputs and layer definitions.

---

## Key Changes

### 1. **Foundation Type Separation**
- Added `foundationType` state: `'RCC'` | `'StoneMasonry'`
- Top-level UI selector to switch between systems
- **Each system has different input requirements and layers**

### 2. **RCC Isolated Footing System**
**Inputs:**
- `footingCount` - Number of individual footings
- `footingLength` & `footingWidth` - Individual footing dimensions (ft)
- `rccExcavationDepth` - Excavation depth specific to RCC system (ft)
- `pccThickness` - Optional PCC base thickness (ft)

**Materials & Layers:**
- PCC Base (optional - controlled by `hasPCC` toggle)
- RCC Footing (main load-bearing layer)
- Plinth Beam (optional - controlled by `includePlinth` toggle)

**Auto-calculation:**
- Footing count auto-calculated from area (1 footing per ~165 sq.ft)

### 3. **Stone Masonry Continuous Foundation System**
**Inputs:**
- `wallPerimeter` - Total perimeter of continuous wall foundation (ft)
- `trenchWidth` - Width of the trench for masonry (ft)
- `masonryExcavationDepth` - Excavation depth specific to masonry system (ft)
- `masonryThickness` - Thickness of masonry wall (ft)

**Materials & Layers:**
- Stone Masonry (only layer - no PCC, no plinth options)
- Cement, Sand, Stone materials only

**Auto-calculation:**
- Wall perimeter auto-calculated from area (assumes square plot)

### 4. **Optional PCC Base**
- **Before:** PCC forced for all systems with `hasPCC: true` hard-coded
- **After:** PCC is truly optional
  - Only shown for RCC system
  - Controlled by `hasPCC` toggle
  - Stone masonry system does NOT use PCC

### 5. **Layer-Specific Excavation Depths**
- **Before:** Single `depth` variable applied uniformly
- **After:** Separate excavation depths per system:
  - `rccExcavationDepth` - For RCC footings
  - `masonryExcavationDepth` - For continuous masonry walls
- Proper quantity calculations can now apply different depths per layer

### 6. **System-Specific Layer Definitions**
```typescript
// RCC System
const RCC_LAYERS = {
  'PCC Base': ['Cement', 'Sand'],
  'RCC Footing': ['Cement', 'Steel (TMT Bar)', 'Sand'],
  'Plinth Beam': ['Cement', 'Steel (TMT Bar)', 'Sand']
};

// Stone Masonry System
const MASONRY_LAYERS = {
  'Stone Masonry': ['Cement', 'Sand', 'Stone']
};
```

### 7. **Conditional Rendering**
- **RCC System:** Shows footing count, footing size, RCC excavation depth, PCC thickness, PCC toggle, Plinth toggle
- **Masonry System:** Shows wall perimeter, trench width, masonry excavation depth, masonry thickness
- Material sections dynamically render based on active layers per system

### 8. **Updated Data Passing to FoundationCost**
```typescript
// RCC System Navigation
{
  foundationType: 'RCC',
  foundationConfig: {
    hasPCC,
    includePlinth,
    footingCount,
    footingLength,
    footingWidth,
    pccThickness,
    rccExcavationDepth
  }
}

// Stone Masonry Navigation
{
  foundationType: 'StoneMasonry',
  foundationConfig: {
    wallPerimeter,
    trenchWidth,
    masonryExcavationDepth,
    masonryThickness
  }
}
```

### 9. **Material Specification as Construction Behavior**
- Material selections now include **specifications**
- Aggregate selections are layer-specific
- Cost calculation engine can now:
  - Use footing count × footing area × excavation depth for RCC
  - Use wall perimeter × trench width × excavation depth for masonry
  - Apply material rates per unit (sq.ft, cu.ft, etc.)
  - **UI choices now reflect real construction logic**

---

## State Variables

### Foundation Type Control
- `foundationType: 'RCC' | 'StoneMasonry'`

### RCC-Specific
- `footingCount` - Count of individual footings
- `footingLength` - Length per footing (ft)
- `footingWidth` - Width per footing (ft)
- `rccExcavationDepth` - Excavation depth (ft)
- `pccThickness` - PCC base thickness (ft)
- `hasPCC` - Toggle PCC inclusion
- `includePlinth` - Toggle plinth beam inclusion

### Masonry-Specific
- `wallPerimeter` - Total perimeter (ft)
- `trenchWidth` - Trench width (ft)
- `masonryExcavationDepth` - Excavation depth (ft)
- `masonryThickness` - Wall thickness (ft)

### Shared
- `selections` - Material selections per layer/type
- `aggSelections` - Aggregate size selections per layer
- `tier` - Economy/Standard/Luxury

---

## Impact on FoundationCost Screen

The FoundationCost screen should now:
1. **Check `foundationType`** to determine calculation method
2. **For RCC:**
   - Calculate excavation volume: `footingCount × footingLength × footingWidth × rccExcavationDepth`
   - Include PCC volume if `hasPCC: true`
   - Include plinth volume if `includePlinth: true`
3. **For Stone Masonry:**
   - Calculate excavation volume: `wallPerimeter × trenchWidth × masonryExcavationDepth`
   - Calculate masonry volume: `wallPerimeter × masonryThickness × (height based on excavation depth)`
4. **Apply material rates** based on selections
5. **Result**: Accurate, system-appropriate cost estimates

---

## UI/UX Improvements
- Clear visual separation between foundation types
- Context-aware inputs prevent user confusion
- Relevant toggles only appear for applicable systems
- Auto-calculations reduce manual input burden
- Section labels clarify what each group of inputs represents
- Material layer organization matches system logic

