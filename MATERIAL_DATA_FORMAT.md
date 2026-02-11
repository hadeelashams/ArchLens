# Material Data Format for Admin Setup

## Overview
The WallScreen calculation engine uses specific material properties to accurately calculate quantities and costs. Here's the exact format admin needs to add to the Firestore `materials` collection.

---

## 1. BRICKS (Load-Bearing & Partition)

### Required Fields:
```json
{
  "id": "unique_material_id",
  "name": "Material Brand Name (e.g., 'Wienerberger Common Brick')",
  "category": "Wall",
  "subCategory": "Load Bearing",  // or "Non-Load Bearing"
  "type": "Brick",
  "dimensions": "9x4.25x3",  // FORMAT: Length x Width x Height (in INCHES)
  "unit": "Nos",
  "pricePerUnit": 8.50,  // Price per individual brick (in ₹)
  "imageUrl": "https://...",
  "notes": "Standard ceramic brick for masonry"
}
```

### Important Notes on Dimensions:
- **Format**: `Length x Width x Height` (MUST be in INCHES, NOT cm)
- **Order Matters**: 
  - **Length**: Face dimension along wall direction
  - **Width**: Thickness of brick (9" for load-bearing, 4.5" for partition)
  - **Height**: Vertical face dimension
- **Example for Standard Indian Brick**:
  - Common: `9x4.25x3` (9" length, 4.25" thickness, 3" height)
  - Load-bearing blocks: `12x6x4`
  - Partition: `6x4x3`

### Calculation Impact:
```javascript
// The app uses these dimensions to calculate:
const brickVolume = (length × width × height) in inches → converted to m³
const faceArea = (length × height) in inches → for total bricks needed
const mortarVoid = space between bricks (depends on joint thickness)
```

---

## 2. CEMENT (Mortar Cement)

### Required Fields:
```json
{
  "id": "cement_001",
  "name": "Cement Brand (e.g., 'Ultratech Cement')",
  "category": "Materials",
  "type": "Cement",
  "unit": "Bags",  // Always in bags (50kg per bag standard)
  "pricePerUnit": 450,  // Price per 50kg bag (in ₹)
  "quantity_per_unit": 50,  // kg per bag
  "imageUrl": "https://...",
  "notes": "OPC 53 Grade Cement"
}
```

### Calculation Impact:
```javascript
// Cement is calculated volumetrically:
const cementVolume_m3 = mortar_volume_m3 × (cementParts / totalParts) × 1.33
const cementBags = Math.ceil(cementVolume_m3 × 28.8)
// 28.8 = standard bags per m³ of cement
// Final cost = cementBags × pricePerUnit
```

---

## 3. SAND (Mortar Sand)

### Required Fields:
```json
{
  "id": "sand_001",
  "name": "Sand Type (e.g., 'Washed River Sand')",
  "category": "Materials",
  "type": "Sand",
  "unit": "cft",  // CRITICAL: Can be "cft", "Ton", or "kg"
  "pricePerUnit": 2.50,  // Price per cft (in ₹)
  "imageUrl": "https://...",
  "notes": "M Sand, well-graded"
}
```

### Unit Options & Conversions:
The app automatically converts sand quantity based on the `unit` field:

| Unit | Conversion | Calculation |
|------|-----------|-------------|
| `"cft"` (cubic feet) | 1 m³ = 35.3147 cft | `sandVol_m3 × 35.3147` |
| `"Ton"` (metric) | 1 m³ sand ≈ 1.6 Ton | `(sandVol_m3 × 1600) / 1000` |
| `"kg"` | 1 m³ sand ≈ 1600 kg | `sandVol_m3 × 1600` |

### Calculation Impact:
```javascript
// Sand volume is calculated:
const sandVolume_m3 = mortar_volume_m3 × (sandParts / totalParts) × 1.33

// Then converted based on unit:
if (unit.includes('cft')) {
  finalSandQty = sandVolume_m3 * 35.3147;  // in cft
} else if (unit.includes('ton')) {
  finalSandQty = (sandVolume_m3 * 1600) / 1000;  // in Tons
} else if (unit.includes('kg')) {
  finalSandQty = sandVolume_m3 * 1600;  // in kg
}
// Final cost = finalSandQty × pricePerUnit
```

---

## 4. MORTAR SPECIFICATIONS (Reference - Built-in to App)

These are the mortar ratios used for cement:sand calculations:

```javascript
WALL_TYPE_SPECS = {
  'Load Bearing': {
    cementMortar: 1,    // 1 part cement
    sandMortar: 3       // 3 parts sand (1:3 ratio)
  },
  'Non-Load Bearing': {
    cementMortar: 1,
    sandMortar: 4       // 1:4 for partition walls
  }
}
```

---

## Complete Example Data Set

### Firestore Collection: `materials`

```json
// LOAD-BEARING BRICK
{
  "id": "brick_lb_001",
  "name": "Wienerberger Common Brick",
  "category": "Wall",
  "subCategory": "Load Bearing",
  "type": "Brick",
  "dimensions": "9x4.25x3",
  "unit": "Nos",
  "pricePerUnit": 8.50,
  "imageUrl": "https://example.com/brick1.jpg",
  "notes": "Standard Indian clay brick"
}

// PARTITION BRICK
{
  "id": "brick_pb_001",
  "name": "AAC Light Block (4.5\" partition)",
  "category": "Wall",
  "subCategory": "Non-Load Bearing",
  "type": "Block",
  "dimensions": "6x4.5x3",
  "unit": "Nos",
  "pricePerUnit": 45.00,
  "imageUrl": "https://example.com/aac1.jpg",
  "notes": "Autoclaved Aerated Concrete"
}

// CEMENT
{
  "id": "cement_001",
  "name": "Ultratech OPC 53 Grade",
  "category": "Materials",
  "type": "Cement",
  "unit": "Bags",
  "pricePerUnit": 450,
  "quantity_per_unit": 50,
  "imageUrl": "https://example.com/cement1.jpg",
  "notes": "50kg bag, OPC 53 Grade"
}

// SAND (cft pricing)
{
  "id": "sand_001",
  "name": "Washed River Sand",
  "category": "Materials",
  "type": "Sand",
  "unit": "cft",
  "pricePerUnit": 2.50,
  "imageUrl": "https://example.com/sand1.jpg",
  "notes": "Well-graded M sand"
}

// SAND (Ton pricing)
{
  "id": "sand_002",
  "name": "Machine Sand (Bulk - Ton)",
  "category": "Materials",
  "type": "Sand",
  "unit": "Ton",
  "pricePerUnit": 800,  // per metric ton
  "imageUrl": "https://example.com/sand2.jpg",
  "notes": "Machine crushed sand, sold in bulk by ton"
}
```

---

## Calculation Flow Example

### Scenario:
- **Building dimensions**: 1500 sq.ft total area
- **Height**: 10.5 ft
- **Wall composition**: 70% Load-bearing, 30% Partition
- **Openings**: 20% (doors/windows)
- **Joint thickness**: 0.375" (3/8")
- **Selected Materials**:
  - Load-bearing: Wienerberger Common (9×4.25×3)
  - Partition: AAC Block (6×4.5×3)
  - Cement: Ultratech (₹450/bag)
  - Sand: River Sand (₹2.50/cft)

### Step-by-Step Calculation:

```
1. Wall Face Area
   runningLength = 1500 × 0.55 = 825 ft (with shared wall adjustment)
   wallFaceArea = 825 × 10.5 = 8,662.5 sq.ft
   netWallFaceArea = 8,662.5 × (1 - 0.20) = 6,930 sq.ft
   netWallFaceArea_m² = 6,930 / 10.764 = 643.6 m²

2. Split by Wall Type
   LB FaceArea = 643.6 × 0.70 = 450.52 m²
   Partition FaceArea = 643.6 × 0.30 = 193.08 m²

3. Volume from Face Area
   LB Volume = 450.52 × (9×12/12 × 0.3048) = 450.52 × 0.229 = 103.2 m³
   Partition Volume = 193.08 × (4.5×12/12 × 0.3048) = 193.08 × 0.1143 = 22.06 m³

4. Brick Quantities (depends on brick dimensions)
   LB Bricks: Calculate based on (L×H) face area per brick
   Partition Bricks: Calculate based on (L×H) face area per brick

5. Mortar Calculation
   LB Mortar = LB mortarVolume × 1.33 (dry factor)
   Partition Mortar = Partition mortarVolume × 1.33
   
   LB Cement = LB_mortar × (1/4) = X m³ → Y bags @ 28.8 bags/m³
   LB Sand = LB_mortar × (3/4) = Z m³ → Z × 35.3147 cft @ ₹2.50/cft

6. Total Cost
   LB Bricks Cost = LB_Qty × ₹8.50
   Partition Bricks Cost = Partition_Qty × ₹45
   Cement Cost = Y bags × ₹450
   Sand Cost = cft × ₹2.50
   TOTAL = All costs combined
```

---

## Admin Checklist

### For Each Material, Ensure:
✅ **ID**: Unique identifier  
✅ **Name**: Clear brand/product name  
✅ **Category**: "Wall" for bricks, "Materials" for cement/sand  
✅ **Type**: "Brick", "Block", "Stone", "Cement", "Sand"  
✅ **Unit**: "Nos" (bricks), "Bags" (cement), "cft"/"Ton"/"kg" (sand)  
✅ **Dimensions**: Format `Length x Width x Height` **in INCHES** (for bricks only)  
✅ **Price Per Unit**: Accurate unit cost in ₹  
✅ **Sub Category**: "Load Bearing" or "Non-Load Bearing" (for bricks)

### Critical Points:
⚠️ **Brick dimensions MUST be in INCHES**, not centimeters  
⚠️ **Dimensions order is critical**: Length × Width × Height  
⚠️ **Sand unit must match pricing** (if ₹2.50/cft, unit MUST be "cft")  
⚠️ **Cement is always in bags** (50kg standard)  
⚠️ **Joint thickness** (0.375" standard) increases mortar calculation

---

## Testing Your Data

To verify materials are correctly set up:
1. Select a brick with clear dimensions (e.g., 9×4.25×3)
2. Navigate to Wall Screen
3. Verify brick quantity and mortar calculations match expected values
4. Check that costs align with unit prices

If calculations seem wrong, check:
- Are dimensions in **INCHES**?
- Is the dimensions format correct: **L × W × H**?
- Is sand unit matching the price (cft vs Ton)?
- Are mortar specs correct for wall type?
