# Material Selection System - Database & Data Updates Guide

## Overview
This guide explains what database and data updates are needed to fully support the new material selection system features.

---

## 1. Material Document Schema Enhancements

### Required New Fields

Add these fields to all material documents in Firestore to maximize the system's capabilities:

```javascript
// New Fields to Add to Each Material Document

{
  // Existing Fields (keep these)
  id: string,
  name: string,
  category: string,
  subCategory: string,
  brand: string,
  type: string,
  pricePerUnit: number,
  unit: string,
  dimensions: string,
  imageUrl: string,
  availability: string,
  rating: number,
  reviews: number,
  discount: number,

  // ===== NEW FIELDS FOR MATERIAL SELECTION SYSTEM =====

  // 1. FINISHING REQUIREMENTS (Critical for cost calculation)
  requiresPlastering: boolean,
    // true = needs plaster (default for rough bricks)
    // false = can be exposed (Wire-cut bricks, Pressed blocks)
    // Example: 
    //   Wire-cut Bricks: false
    //   Standard Red Bricks: true (unless high quality)
    //   Interlocking Blocks: false

  finishRoughness: enum('high' | 'medium' | 'low'),
    // Determines plaster cost:
    // 'high' (rough): ₹45/sqft (needs multiple layers)
    // 'medium' (semi-finished): ₹30/sqft
    // 'low' (fine): ₹20/sqft
    // Examples:
    //   Standard Red Brick: 'high'
    //   Pressed Brick: 'medium'
    //   Wire-cut with good finish: 'low'

  // 2. LABOR-SAVING PROPERTIES
  mortarRequired: boolean,
    // true = needs mortar between joints (standard bricks)
    // false = interlocking, no mortar needed
    // Labor savings: 15-20% reduction in time
    // Examples:
    //   Red Bricks: true
    //   Interlocking Soil Blocks: false
    //   Hollow Blocks: true

  laborSavingsPercent: number,
    // Indicates labor cost reduction vs. standard brick
    // Range: 0-100 (percentage)
    // Examples:
    //   Standard Red Brick: 0
    //   Interlocking Blocks: 25-35
    //   AAC Blocks (3"): 20-25
    //   Pressure Blocks with guide pins: 15-20

  // 3. THERMAL & SUSTAINABILITY PROPERTIES
  thermalInsulation: number,
    // Thermal resistance value (approximate R-value or U-value)
    // Used for FUTURE enhancement: AC cost savings
    // Range: 0-5 (higher = more insulating)
    // Examples:
    //   Dense Clay Brick: 0.5
    //   Hollow Concrete Block: 1.5
    //   AAC Block: 2.5
    //   Lightweight Concrete: 2.0

  // 4. TIER & CATEGORY FILTERS
  suitableTiers: array(enum('Economy' | 'Standard' | 'Luxury')),
    // Which project tiers is this material appropriate for
    // Examples:
    //   Interlocking Blocks: ['Economy']
    //   Red Clay Bricks: ['Standard']
    //   Marble/Premium Bricks: ['Luxury']
    //   AAC Blocks: ['Standard', 'Luxury']

  surfaceFinishOptions: array(string),
    // What finish types work without major modifications
    // Examples:
    //   ['Plastered', 'Painted']
    //   ['Exposed', 'Painted']
    //   ['Exposed']

  // 5. CUSTOM DESCRIPTIONS (For AI & UI)
  laborSavingsDescription: string,
    // Marketing message about labor savings
    // Example: "Zero mortar needed - Install 30% faster!"

  thermalBenefitsDescription: string,
    // Thermal efficiency message
    // Example: "Superior thermal resistance - Lower AC costs"

  emojiCategory: string,
    // For UI display
    // Examples: '🧱' (brick), '📦' (block), '♻️' (sustainable)
}
```

### Complete Material Document Example

```javascript
{
  id: "mat_001_red_brick_standard",
  name: "Premium Red Clay Brick",
  category: "Wall",
  subCategory: "Load Bearing",
  brand: "BrickWorks India",
  type: "Brick Wall",
  pricePerUnit: 12.50,
  unit: "Nos",
  dimensions: "9 x 4.5 x 3",
  imageUrl: "https://...",
  availability: "In Stock",
  rating: 4.5,
  reviews: 234,
  discount: 5,

  // NEW FIELDS
  requiresPlastering: true,
  finishRoughness: "high",
  mortarRequired: true,
  laborSavingsPercent: 0,
  thermalInsulation: 0.5,
  suitableTiers: ["Standard", "Luxury"],
  surfaceFinishOptions: ["Plastered", "Painted"],
  laborSavingsDescription: "Standard installation time - No special techniques needed",
  thermalBenefitsDescription: "Traditional thermal mass provides passive cooling",
  emojiCategory: "🧱"
}
```

```javascript
{
  id: "mat_002_interlocking_blocks",
  name: "Interlocking Cement Soil Blocks",
  category: "Wall",
  subCategory: "Partition",
  brand: "EcoBlocks Ltd",
  type: "Block Partition",
  pricePerUnit: 5.00,
  unit: "Nos",
  dimensions: "24 x 12 x 3",
  imageUrl: "https://...",
  availability: "In Stock",
  rating: 4.8,
  reviews: 156,
  discount: 0,

  // NEW FIELDS
  requiresPlastering: false,
  finishRoughness: "low",
  mortarRequired: false,
  laborSavingsPercent: 35,
  thermalInsulation: 1.8,
  suitableTiers: ["Economy", "Standard"],
  surfaceFinishOptions: ["Exposed", "Painted"],
  laborSavingsDescription: "Zero mortar needed - Install 30% faster! Just stack and interlock.",
  thermalBenefitsDescription: "Air pockets provide superior thermal resistance - Save on AC costs",
  emojiCategory: "📦"
}
```

---

## 2. Migration Strategy

### Phase 1: Add Fields to Firestore
Use Firestore console or Firebase Admin SDK to add default values:

```javascript
// Firebase Admin SDK script to update existing materials

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function addNewFieldsToMaterials() {
  const materialsRef = db.collection('materials');
  const snapshot = await materialsRef.get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const material = doc.data();
    
    // Determine defaults based on existing properties
    const isInterlocking = material.name.toLowerCase().includes('interlocking');
    const isWireCut = material.name.toLowerCase().includes('wire-cut');
    const isHollow = material.name.toLowerCase().includes('hollow');
    const isAAC = material.name.toLowerCase().includes('aac');

    const updates = {
      // Defaults based on material type
      requiresPlastering: !(isWireCut || isInterlocking),
      finishRoughness: isWireCut ? 'medium' : isInterlocking ? 'low' : 'high',
      mortarRequired: !isInterlocking,
      laborSavingsPercent: isInterlocking ? 30 : isAAC ? 20 : 0,
      thermalInsulation: isAAC ? 2.5 : isHollow ? 1.5 : 0.5,
      suitableTiers: determineTiers(material),
      surfaceFinishOptions: determineSurfaceOptions(material),
      laborSavingsDescription: generateDescription(material),
      thermalBenefitsDescription: generateThermalDesc(material),
      emojiCategory: '🧱'
    };

    batch.update(doc.ref, updates);
    count++;
  });

  await batch.commit();
  console.log(`Updated ${count} material documents`);
}

// Helper functions
function determineTiers(material) {
  const tiers = [];
  const price = parseFloat(material.pricePerUnit);
  
  if (price < 10) tiers.push('Economy');
  if (price < 25) tiers.push('Standard');
  tiers.push('Luxury');
  
  return tiers;
}

function determineSurfaceOptions(material) {
  const name = material.name.toLowerCase();
  
  if (name.includes('exposed') || name.includes('wire-cut')) {
    return ['Exposed', 'Painted'];
  }
  if (name.includes('interlocking')) {
    return ['Exposed', 'Painted'];
  }
  return ['Plastered', 'Painted'];
}

function generateDescription(material) {
  const name = material.name.toLowerCase();
  
  if (name.includes('interlocking')) {
    return 'Zero mortar needed - Install 30% faster!';
  }
  if (name.includes('aac')) {
    return 'Lightweight yet strong - Reduces installation time by 20%';
  }
  return 'Standard installation - Proven durability';
}

function generateThermalDesc(material) {
  const name = material.name.toLowerCase();
  
  if (name.includes('aac')) {
    return 'Excellent insulation - Lower AC bills by 15-20%';
  }
  if (name.includes('hollow')) {
    return 'Air-filled cells provide thermal resistance';
  }
  return 'Traditional thermal mass for passive cooling';
}

addNewFieldsToMaterials();
```

### Phase 2: Manual Review & Fine-tuning
1. Review updated materials in Firestore console
2. Fine-tune values for accuracy
3. Add custom descriptions for premium materials

### Phase 3: Add Images & Icons
- Add `emojiCategory` values for visual display
- Ensure `imageUrl` paths are correct

---

## 3. Query Examples

### Find Materials Suitable for Exposed Finish
```javascript
// Firebase query
materials
  .where('requiresPlastering', '==', false)
  .where('suitableTiers', 'array-contains', 'Economy')
  .orderBy('laborSavingsPercent', 'desc')
  .limit(10)
```

### Find Labor-Saving Materials for Economy Tier
```javascript
materials
  .where('suitableTiers', 'array-contains', 'Economy')
  .where('laborSavingsPercent', '>=', 20)
  .orderBy('pricePerUnit', 'asc')
```

### Find Thermally Efficient Materials
```javascript
materials
  .where('thermalInsulation', '>=', 1.5)
  .orderBy('pricePerUnit', 'asc')
```

---

## 4. Updating Material Selection Logic

### In Firestore Service
Add these helper functions:

```typescript
// packages/shared/firestore-service.ts

export async function getMaterialsByTierAndFinish(
  tier: 'Economy' | 'Standard' | 'Luxury',
  finishPreference: 'Plastered' | 'Exposed'
): Promise<Material[]> {
  let q = query(
    collection(db, 'materials'),
    where('suitableTiers', 'array-contains', tier)
  );

  if (finishPreference === 'Exposed') {
    q = query(
      collection(db, 'materials'),
      where('suitableTiers', 'array-contains', tier),
      where('surfaceFinishOptions', 'array-contains', 'Exposed')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Material[];
}

export async function getLaborSavingMaterials(
  tier: 'Economy' | 'Standard' | 'Luxury',
  minSavingsPercent: number = 15
): Promise<Material[]> {
  const q = query(
    collection(db, 'materials'),
    where('suitableTiers', 'array-contains', tier),
    where('laborSavingsPercent', '>=', minSavingsPercent),
    orderBy('laborSavingsPercent', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Material[];
}
```

---

## 5. Data Validation Rules

Add these Firestore security rules:

```javascript
match /materials/{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.isAdmin == true;

  // Validate new fields
  validate /requiresPlastering : bool;
  validate /finishRoughness : string in ['high', 'medium', 'low'];
  validate /mortarRequired : bool;
  validate /laborSavingsPercent : number >= 0 && <= 100;
  validate /thermalInsulation : number >= 0 && <= 5;
  validate /suitableTiers : list(['Economy', 'Standard', 'Luxury']);
  validate /surfaceFinishOptions : list(string);
}
```

---

## 6. Database Backup & Testing

### Before Migration
```bash
# Export current materials to backup
gcloud firestore export gs://your-bucket/materials-backup-2026-02-15
```

### Test on Development Database First
1. Create a separate Firestore database for testing
2. Apply all updates there first
3. Verify queries and calculations
4. Then apply to production

---

## 7. Example Data - Materials to Add/Update

### New Economy Materials (Labor-Saving Focus)

| Name | Price/Unit | Mortar Required | Plaster Required | Labor Savings | Suitable Tiers |
|------|-----------|----------------|--------------------|--------------|----------------|
| Interlocking Blocks 24x12x3 | ₹5 | No | No | 35% | Economy |
| AAC Blocks 24x8x3 | ₹7 | Yes | No | 25% | Economy, Standard |
| Soil Cement Blocks 23x11x7 | ₹4.50 | No | No | 40% | Economy |

### Standard Alternatives (Demand Balancing)

| Name | Price/Unit | Mortar Required | Plaster Required | Labor Savings | Suitable Tiers |
|------|-----------|----------------|--------------------|--------------|----------------|
| Hollow Concrete Blocks 9" | ₹11 | Yes | Yes | 10% | Standard |
| Wire-cut Bricks Premium | ₹14 | Yes | No | 5% | Standard, Luxury |
| Pressed Bricks Fine | ₹16 | Yes | No | 8% | Standard, Luxury |

### Luxury Options

| Name | Price/Unit | Mortar Required | Plaster Required | Labor Savings | Suitable Tiers |
|------|-----------|----------------|--------------------|--------------|----------------|
| Marble-faced Bricks | ₹45 | Yes | No | -5% | Luxury |
| Handcrafted Art Bricks | ₹50 | Yes | No | 0% | Luxury |

---

## 8. API Type Definitions

Update your type definitions:

```typescript
// packages/shared/firebase.d.ts

export interface Material {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  brand: string;
  type: string;
  pricePerUnit: number;
  unit: string;
  dimensions: string;
  imageUrl?: string;
  availability?: string;
  rating?: number;
  reviews?: number;
  discount?: number;

  // New fields
  requiresPlastering: boolean;
  finishRoughness: 'high' | 'medium' | 'low';
  mortarRequired: boolean;
  laborSavingsPercent: number;
  thermalInsulation: number;
  suitableTiers: ('Economy' | 'Standard' | 'Luxury')[];
  surfaceFinishOptions: string[];
  laborSavingsDescription?: string;
  thermalBenefitsDescription?: string;
  emojiCategory?: string;
}
```

---

## 9. Rollout Plan

### Week 1: Preparation
- Backup all data
- Prepare migration scripts
- Review and validate data

### Week 2: Development
- Test on staging environment
- Run migration scripts on test database
- Verify all queries work

### Week 3: Production
- Run migration in production (off-peak hours)
- Monitor for errors
- Update client to use new fields

### Week 4: Optimization
- Fine-tune field values based on user feedback
- Add additional custom descriptions
- Optimize queries

---

## 10. Maintenance & Updates

### Regular Tasks
- Monthly: Review popular materials and update labor savings %
- Quarterly: Update prices based on market trends
- Annually: Review thermal values and descriptions

### Monitoring Queries
```javascript
// Firebase console - Monitor material queries
- Most viewed materials
- Most selected materials by tier
- Materials with high "return to cart" rates
```

---

## Summary

**Total New Fields**: 10  
**Field Types**: 2 booleans, 1 enum, 3 numbers, 2 arrays, 2 strings  
**Backward Compatibility**: ✅ All new fields have sensible defaults  
**Migration Complexity**: Low - No changes to existing fields  
**Testing Effort**: Medium - Need to validate calculations  

---

Generated: February 15, 2026
Database Version: 1.0
Status: ✅ Ready for Implementation
