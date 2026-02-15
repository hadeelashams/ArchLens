/**
 * Check what materials are in Firestore
 * Shows all materials grouped by category and subCategory
 */

const admin = require('firebase-admin');
const path = require('path');

// Try to load service account key
let serviceAccount;
try {
  serviceAccount = require('./firebase-key.json');
} catch (err) {
  console.error('❌ firebase-key.json not found. Make sure it exists in project root.');
  console.log('📝 To get your service account key:');
  console.log('   1. Go to Firebase Console');
  console.log('   2. Project Settings → Service Accounts');
  console.log('   3. Click "Generate New Private Key"');
  console.log('   4. Save as firebase-key.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkMaterials() {
  try {
    console.log('\n📊 Checking materials in Firestore...\n');

    const snapshot = await db.collection('materials').get();
    const materials = {
      'Load Bearing': [],
      'Non-Load Bearing': [],
      'Partition Wall': [],
      'Mortar': [],
      'Other': []
    };

    console.log(`Found ${snapshot.docs.length} total materials\n`);

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const subCat = data.subCategory || 'Other';
      
      if (materials[subCat]) {
        materials[subCat].push({
          name: data.name,
          type: data.type,
          category: data.category
        });
      } else {
        materials['Other'].push({
          name: data.name,
          type: data.type,
          subCategory: subCat,
          category: data.category
        });
      }
    });

    // Display results
    console.log('═'.repeat(60));
    console.log('MATERIALS BY SUBCATEGORY');
    console.log('═'.repeat(60));

    Object.keys(materials).forEach((subCat) => {
      const items = materials[subCat];
      if (items.length > 0) {
        console.log(`\n📦 ${subCat} (${items.length})`);
        console.log('─'.repeat(60));
        items.forEach((item) => {
          console.log(`  • ${item.name} [Type: ${item.type}]`);
        });
      }
    });

    console.log('\n═'.repeat(60));
    console.log('\n✅ Database Check Complete\n');

    // Summary
    const nonLoadBearing = materials['Non-Load Bearing'].length;
    const partitionWall = materials['Partition Wall'].length;
    
    if (nonLoadBearing > 0 && partitionWall === 0) {
      console.log('⚠️  ISSUE DETECTED:');
      console.log(`   • Found ${nonLoadBearing} "Non-Load Bearing" materials`);
      console.log(`   • Found 0 "Partition Wall" materials`);
      console.log('\n💡 FIX: Run one of these commands:');
      console.log('   node scripts/import-wall-materials.js  (Fresh import)');
      console.log('   node fix-partition-wall-category.js    (Update existing)');
    } else if (partitionWall > 0) {
      console.log(`✅ GOOD: Found ${partitionWall} "Partition Wall" materials`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMaterials();
