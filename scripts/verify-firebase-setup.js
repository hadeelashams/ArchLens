#!/usr/bin/env node
// filepath: scripts/verify-firebase-setup.js
// Run: node scripts/verify-firebase-setup.js

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Firebase Setup Verification\n');
console.log(''.padStart(60, '='));

let allGood = true;

// =================== CHECK 1: Service Account File ===================

console.log('\n✓ Check 1: Firebase Service Account');
console.log('  Looking for: firebase-service-account.json');

const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  console.log('  ✅ Found at:', serviceAccountPath);
  
  try {
    const serviceAccount = require(serviceAccountPath);
    
    // Verify required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    
    if (missingFields.length === 0) {
      console.log('  ✅ All required fields present');
      console.log('  ✅ Project ID:', serviceAccount.project_id);
      console.log('  ✅ Service Account Email:', serviceAccount.client_email.substring(0, 30) + '...');
    } else {
      console.log('  ❌ Missing fields:', missingFields.join(', '));
      allGood = false;
    }
  } catch (error) {
    console.log('  ❌ Invalid JSON:', error.message);
    allGood = false;
  }
} else {
  console.log('  ❌ NOT FOUND!');
  console.log('\n  📥 How to fix:');
  console.log('     1. Go to: Firebase Console → Project Settings');
  console.log('     2. Click: Service Accounts → Generate New Private Key');
  console.log('     3. Save file as: firebase-service-account.json');
  console.log('     4. Place in: d:\\ArchLens\\');
  allGood = false;
}

// =================== CHECK 2: firebase-admin Module ===================

console.log('\n✓ Check 2: firebase-admin Package');

try {
  const admin = require('firebase-admin');
  console.log('  ✅ firebase-admin is installed');
  console.log('  ✅ Version:', require('firebase-admin/package.json').version);
} catch (error) {
  console.log('  ❌ firebase-admin NOT installed');
  console.log('\n  📥 How to fix:');
  console.log('     Run: npm install --save-dev firebase-admin');
  allGood = false;
}

// =================== CHECK 3: Node.js version ===================

console.log('\n✓ Check 3: Node.js Version');

const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion >= 12) {
  console.log('  ✅ Node.js version:', nodeVersion);
} else {
  console.log('  ⚠️  Node.js version:', nodeVersion, '(Recommended: 14+)');
}

// =================== CHECK 4: Import Script ===================

console.log('\n✓ Check 4: Import Script');

const scriptPath = path.join(__dirname, 'import-wall-materials.js');

if (fs.existsSync(scriptPath)) {
  console.log('  ✅ Script found:', scriptPath);
  const stats = fs.statSync(scriptPath);
  console.log('  ✅ File size:', (stats.size / 1024).toFixed(2), 'KB');
} else {
  console.log('  ❌ Script NOT found at:', scriptPath);
  allGood = false;
}

// =================== CHECK 5: Network Connectivity ===================

console.log('\n✓ Check 5: Network Connectivity (Optional Test)');
console.log('  Attempting to connect to Firebase...');

try {
  const admin = require('firebase-admin');
  const serviceAccount = require(serviceAccountPath);
  
  const testApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, 'test-app');
  
  setTimeout(async () => {
    try {
      await testApp.firestore().collection('_test').doc('_connectivity').get();
      console.log('  ✅ Connected to Firestore successfully');
      testApp.delete();
    } catch (error) {
      if (error.code === 'PERMISSION_DENIED') {
        console.log('  ⚠️  Permission denied (may need IAM configuration)');
        console.log('     This is okay - you might just need Firestore Editor role');
      } else {
        console.log('  ⚠️  Connection test inconclusive:', error.code);
      }
      testApp.delete();
    }
  }, 1000);
} catch (error) {
  console.log('  ⚠️  Could not test connection:', error.message);
}

// =================== SUMMARY ===================

setTimeout(() => {
  console.log('\n' + ''.padStart(60, '='));
  
  if (allGood) {
    console.log('✅ SETUP VERIFIED - Ready to import!\n');
    console.log('🚀 Run import command:');
    console.log('   node scripts/import-wall-materials.js\n');
  } else {
    console.log('❌ ISSUES FOUND - Fix above before importing\n');
    console.log('📋 Required:');
    console.log('   1. firebase-service-account.json file');
    console.log('   2. firebase-admin package installed\n');
    console.log('📥 See: FIREBASE_IMPORT_SETUP.md for detailed instructions\n');
  }
  
  console.log(''.padStart(60, '=') + '\n');
  process.exit(allGood ? 0 : 1);
}, 2000);
