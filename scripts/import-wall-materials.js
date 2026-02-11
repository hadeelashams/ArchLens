#!/usr/bin/env node
// filepath: scripts/import-wall-materials.js
// Run: node scripts/import-wall-materials.js

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

console.log('\n🔧 Initializing Firebase Admin SDK...\n');

// Try to load service account
let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || 
                        path.join(__dirname, '../firebase-service-account.json');

// If not found, try alternative paths
if (!fs.existsSync(serviceAccountPath)) {
  const alternativePaths = [
    path.join(__dirname, '../firebase-key.json'),
    path.join(__dirname, '../../firebase-service-account.json'),
    path.join(process.cwd(), 'firebase-service-account.json'),
  ];
  
  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      serviceAccountPath = altPath;
      break;
    }
  }
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase service account file not found!');
  console.error('\nExpected at one of:');
  console.error(`  - ${path.join(__dirname, '../firebase-service-account.json')}`);
  console.error(`  - ${path.join(process.cwd(), 'firebase-service-account.json')}`);
  console.error('\n📥 To fix:');
  console.error('  1. Download firebase-service-account.json from Firebase Console');
  console.error('  2. Place it in the project root directory');
  console.error('  3. Run this script again\n');
  process.exit(1);
}

try {
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  
  console.log('✅ Firebase Admin SDK initialized\n');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// =================== WALL MATERIALS DATA ===================

const wallMaterialsData = [
  // ===== LOAD BEARING MATERIALS =====
  
  {
    name: "Wienerberger First Class Clay Brick",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Brick",
    grade: "First Class",
    dimensions: "9x4.25x3",
    pricePerUnit: 8.50,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1587324372056-2381fbc3e37f?w=400",
    availability: "In Stock",
    rating: 4.5,
    reviews: 245,
    description: "Standard Indian clay brick for load bearing walls",
  },
  {
    name: "MTC Premium Red Clay Brick",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Brick",
    grade: "First Class",
    dimensions: "9x4.25x3",
    pricePerUnit: 8.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400",
    availability: "In Stock",
    rating: 4.3,
    reviews: 189,
    description: "Traditional Indian clay brick by Mangalore Tile Company",
  },
  {
    name: "JCW Traditional Red Brick",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Brick",
    grade: "First Class",
    dimensions: "9x4.25x3",
    pricePerUnit: 7.50,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400",
    availability: "In Stock",
    rating: 4.2,
    reviews: 156,
    description: "Handmade clay brick by Jaipur Clay Works",
  },
  {
    name: "Ultratech Fly Ash Brick",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Block",
    grade: "75mm",
    dimensions: "9x4.25x3",
    pricePerUnit: 6.50,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400",
    availability: "In Stock",
    rating: 4.4,
    reviews: 312,
    description: "Lightweight fly ash brick, 75mm thickness",
  },
  {
    name: "India Blocks Fly Ash Brick",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Block",
    grade: "75mm",
    dimensions: "9x4.25x3",
    pricePerUnit: 6.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400",
    availability: "In Stock",
    rating: 4.3,
    reviews: 278,
    description: "Eco-friendly fly ash brick, fire-resistant",
  },
  {
    name: "Shree Cements Concrete Block",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Block",
    grade: "2500 PSI",
    dimensions: "15x7.5x7.5",
    pricePerUnit: 35.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400",
    availability: "In Stock",
    rating: 4.6,
    reviews: 425,
    description: "Standard concrete block, 2500 PSI strength",
  },
  {
    name: "ACC Concrete Block",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Block",
    grade: "2500 PSI",
    dimensions: "15x7.5x7.5",
    pricePerUnit: 38.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400",
    availability: "In Stock",
    rating: 4.7,
    reviews: 523,
    description: "Standard concrete block, durable construction",
  },
  {
    name: "Premium Granite Stone Block",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Stone",
    grade: "Premium",
    dimensions: "12x6x6",
    pricePerUnit: 180.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.8,
    reviews: 89,
    description: "Premium natural granite for load bearing walls",
  },
  {
    name: "Natural Limestone Block",
    category: "Wall",
    subCategory: "Load Bearing",
    type: "Stone",
    grade: "Standard",
    dimensions: "12x6x6",
    pricePerUnit: 120.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.5,
    reviews: 67,
    description: "Durable natural limestone for wall construction",
  },
  {
    name: "Ultratech AAC Block 100mm",
    category: "Wall",
    subCategory: "Non-Load Bearing",
    type: "Block",
    grade: "AAC 600",
    dimensions: "24x4x7.5",
    pricePerUnit: 45.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.7,
    reviews: 612,
    description: "Lightweight AAC block, 600 kg/m³ density",
  },
  {
    name: "Bilcon AAC Block",
    category: "Wall",
    subCategory: "Non-Load Bearing",
    type: "Block",
    grade: "AAC 700",
    dimensions: "24x4x7.5",
    pricePerUnit: 42.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.6,
    reviews: 534,
    description: "High quality AAC block for partition walls",
  },
  {
    name: "Standard Hollow Concrete Block",
    category: "Wall",
    subCategory: "Non-Load Bearing",
    type: "Block",
    grade: "Standard",
    dimensions: "15x7.5x7.5",
    pricePerUnit: 18.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.3,
    reviews: 289,
    description: "Lightweight hollow block for partition walls",
  },
  {
    name: "Interlocking Hollow Block",
    category: "Wall",
    subCategory: "Non-Load Bearing",
    type: "Block",
    grade: "Interlocking",
    dimensions: "15x7.5x7.5",
    pricePerUnit: 22.00,
    unit: "Nos (Numbers)",
    imageUrl: "https://images.unsplash.com/photo-1581092162562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.5,
    reviews: 367,
    description: "Interlocking hollow block, easy to install",
  },
  {
    name: "UltraTech PPC Cement",
    category: "Wall",
    subCategory: "Mortar",
    type: "Cement",
    grade: "PPC",
    pricePerUnit: 480.00,
    unit: "Bag (50kg)",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400",
    availability: "In Stock",
    rating: 4.8,
    reviews: 1240,
    description: "Pozzolana Portland Cement (PPC) 50kg bag",
  },
  {
    name: "Ambuja Cement OPC 53",
    category: "Wall",
    subCategory: "Mortar",
    type: "Cement",
    grade: "OPC 53",
    pricePerUnit: 510.00,
    unit: "Bag (50kg)",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400",
    availability: "In Stock",
    rating: 4.7,
    reviews: 987,
    description: "OPC 53 Grade cement, high strength",
  },
  {
    name: "JK Cement PPC",
    category: "Wall",
    subCategory: "Mortar",
    type: "Cement",
    grade: "PPC",
    pricePerUnit: 495.00,
    unit: "Bag (50kg)",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400",
    availability: "In Stock",
    rating: 4.6,
    reviews: 756,
    description: "PPC Grade cement 50kg bag",
  },
  {
    name: "Manufactured River Sand (M-Sand)",
    category: "Wall",
    subCategory: "Mortar",
    type: "Sand",
    grade: "M-Sand",
    pricePerUnit: 420.00,
    unit: "Cubic Feet (cft)",
    imageUrl: "https://images.unsplash.com/photo-1581092161562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.4,
    reviews: 534,
    description: "Clean manufactured sand for mortar",
  },
  {
    name: "Natural River Sand",
    category: "Wall",
    subCategory: "Mortar",
    type: "Sand",
    grade: "Fine",
    pricePerUnit: 380.00,
    unit: "Cubic Feet (cft)",
    imageUrl: "https://images.unsplash.com/photo-1581092161562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.3,
    reviews: 612,
    description: "Fine natural river sand, dust-free",
  },
  {
    name: "Premium Desert Sand",
    category: "Wall",
    subCategory: "Mortar",
    type: "Sand",
    grade: "Premium",
    pricePerUnit: 450.00,
    unit: "Cubic Feet (cft)",
    imageUrl: "https://images.unsplash.com/photo-1581092161562-40038f456362?w=400",
    availability: "In Stock",
    rating: 4.6,
    reviews: 445,
    description: "High quality premium desert sand",
  },
];

// =================== IMPORT FUNCTION ===================

async function importWallMaterials() {
  try {
    console.log('\n🚀 Starting Wall Materials Import...\n');
    console.log(`📋 Total materials to import: ${wallMaterialsData.length}`);
    console.log(''.padStart(60, '='));

    const batch = db.batch();
    let count = 0;

    for (const material of wallMaterialsData) {
      const docRef = db.collection('materials').doc();
      batch.set(docRef, {
        ...material,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
      console.log(`✅ ${count.toString().padStart(2)}. ${material.name.padEnd(40)} ₹${material.pricePerUnit.toFixed(2)} / ${material.unit}`);
    }

    console.log(''.padStart(60, '='));
    console.log('\n⏳ Committing batch to Firestore...\n');

    // Commit the batch
    await batch.commit();

    console.log(''.padStart(60, '='));
    console.log('✨ SUCCESS! Imported 19 wall materials to Firestore');
    console.log(''.padStart(60, '='));
    console.log('\n📊 Summary:');
    console.log('   Load Bearing Bricks: 3');
    console.log('   Load Bearing Blocks: 4');
    console.log('   Natural Stone: 2');
    console.log('   Partition Blocks (AAC): 2');
    console.log('   Partition Blocks (Hollow): 2');
    console.log('   Cement (Mortar): 3');
    console.log('   Sand (Mortar): 3');
    console.log('   ─────────────────────');
    console.log('   TOTAL: 19 materials ✓\n');

    console.log('🎯 Next Steps:');
    console.log('   1. Go to User App → WallScreen');
    console.log('   2. Tap "Select Load-Bearing Material"');
    console.log('   3. See all 19 new materials with:');
    console.log('      ✓ Product images');
    console.log('      ✓ Material names');
    console.log('      ✓ Prices per unit');
    console.log('      ✓ Dimensions (e.g., 9×4.25×3)');
    console.log('      ✓ Ratings & reviews');
    console.log('      ✓ Availability status\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import Failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Verify firebase-service-account.json exists in project root');
    console.error('   2. Check Firebase project ID matches config');
    console.error('   3. Ensure you have "Cloud Firestore Editor" permissions');
    console.error('   4. Check internet connection to Firebase\n');
    process.exit(1);
  }
}

// =================== RUN IMPORT ===================

importWallMaterials();
