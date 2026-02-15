/**
 * Fix Partition Wall Category in Firestore
 * Changes all "Non-Load Bearing" materials to "Partition Wall"
 * Run this in Firebase Console or with: node fix-partition-wall-category.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-key.json'); // You may need to adjust this path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project.firebaseio.com',
});

const db = admin.firestore();

async function fixPartitionWallCategory() {
  try {
    console.log('🔧 Starting to fix Partition Wall categories...\n');

    // Get all materials with "Non-Load Bearing"
    const snapshot = await db
      .collection('materials')
      .where('subCategory', '==', 'Non-Load Bearing')
      .get();

    console.log(`📊 Found ${snapshot.docs.length} materials with "Non-Load Bearing"\n`);

    if (snapshot.docs.length === 0) {
      console.log('✅ No materials to update. Database is already clean!');
      process.exit(0);
    }

    // Update each document
    let updated = 0;
    for (const doc of snapshot.docs) {
      const materialName = doc.data().name;
      
      await doc.ref.update({
        subCategory: 'Partition Wall'
      });
      
      console.log(`✅ Updated: ${materialName}`);
      updated++;
    }

    console.log(`\n✨ SUCCESS! Updated ${updated} materials from "Non-Load Bearing" to "Partition Wall"\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixPartitionWallCategory();
