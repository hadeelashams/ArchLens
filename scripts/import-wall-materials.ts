#!/usr/bin/env node
// filepath: scripts/import-wall-materials.ts
// Run: npx ts-node scripts/import-wall-materials.ts

import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, '../firebase-service-account.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
} catch (error) {
  console.error('❌ Firebase initialization failed. Make sure firebase-service-account.json exists.');
  process.exit(1);
}

const db = admin.firestore();

// =================== WALL MATERIALS DATA ===================

const wallMaterialsData = [
  // ===== LOAD BEARING MATERIALS =====
  
  // CLAY BRICKS
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // FLY ASH BRICKS
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // CONCRETE BLOCKS
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // NATURAL STONE
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // ===== NON-LOAD BEARING / PARTITION MATERIALS =====

  // AAC BLOCKS
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // HOLLOW BLOCKS
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // ===== MORTAR MATERIALS - CEMENT =====

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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // ===== MORTAR MATERIALS - SAND =====

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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// =================== IMPORT FUNCTION ===================

async function importWallMaterials() {
  try {
    console.log('\n🚀 Starting Wall Materials Import...\n');
    console.log(`📋 Total materials to import: ${wallMaterialsData.length}`);

    const batch = db.batch();
    let count = 0;

    for (const material of wallMaterialsData) {
      const docRef = db.collection('materials').doc();
      batch.set(docRef, material);
      count++;
      console.log(`✅ ${count}. ${material.name} (₹${material.pricePerUnit}/${material.unit})`);
    }

    // Commit the batch
    await batch.commit();

    console.log('\n' + '='.repeat(60));
    console.log(`✨ SUCCESS! Imported ${count} wall materials to Firestore`);
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Load Bearing Bricks: 3`);
    console.log(`   Load Bearing Blocks: 4`);
    console.log(`   Natural Stone: 2`);
    console.log(`   Partition Blocks (AAC): 2`);
    console.log(`   Partition Blocks (Hollow): 2`);
    console.log(`   Cement (Mortar): 3`);
    console.log(`   Sand (Mortar): 3`);
    console.log(`   TOTAL: 19 materials\n`);

    console.log('🎯 Next Steps:');
    console.log('   1. Open User App → WallScreen');
    console.log('   2. Tap "Select Load-Bearing Material"');
    console.log('   3. See all 19 new materials with images, prices, and dimensions\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import Failed:', error);
    console.error('\nTroubleshooting:');
    console.error('   1. Check firebase-service-account.json exists');
    console.error('   2. Verify Firebase project is set up correctly');
    console.error('   3. Check network connection to Firebase');
    process.exit(1);
  }
}

// =================== RUN IMPORT ===================

importWallMaterials();
