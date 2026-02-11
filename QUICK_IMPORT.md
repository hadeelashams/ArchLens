# ⚡ FIREBASE AUTO-IMPORT - QUICK GUIDE

## 🎯 In 5 Minutes: Add All 19 Wall Materials

---

## **STEP 1: Get Firebase Credentials (2 min)**

### 1️⃣ Open Firebase Console
```
https://console.firebase.google.com
→ Select your ArchLens project
```

### 2️⃣ Download Service Account Key
```
Project Settings (⚙️ icon, top left)
→ Service Accounts Tab
→ Node.js (select radio button)
→ "Generate New Private Key" (blue button)
→ JSON file downloads automatically
```

### 3️⃣ Place File in Project
```
Save file as: firebase-service-account.json
Location: d:\ArchLens\
```

**Verify:** File should be at `d:\ArchLens\firebase-service-account.json`

---

## **STEP 2: Install Dependencies (1 min)**

Open PowerShell in ArchLens folder:

```powershell
cd d:\ArchLens
npm install --save-dev firebase-admin
```

**Expected output:** Should show `added X packages`

---

## **STEP 3: Verify Setup (1 min)**

```powershell
node scripts/verify-firebase-setup.js
```

**Expected output:**
```
✓ Check 1: Firebase Service Account
  ✅ Found at: d:\ArchLens\firebase-service-account.json

✓ Check 2: firebase-admin Package
  ✅ firebase-admin is installed

✓ Check 3: Node.js Version
  ✅ Node.js version: v16.x.x

✓ Check 4: Import Script
  ✅ Script found

✅ SETUP VERIFIED - Ready to import!
```

---

## **STEP 4: Run Import (1 min)**

```powershell
node scripts/import-wall-materials.js
```

**Watch for output:**
```
🚀 Starting Wall Materials Import...
📋 Total materials to import: 19

✅ 1.  Wienerberger First Class Clay Brick  ₹8.50
✅ 2.  MTC Premium Red Clay Brick           ₹8.00
✅ 3.  JCW Traditional Red Brick            ₹7.50
... (19 materials total)

✨ SUCCESS! Imported 19 wall materials to Firestore
```

---

## **✅ That's It! Verify in App**

Go to **User App** → Open **WallScreen**:
```
1. Tap "Select Load-Bearing Material"
2. Should see all 19 materials with:
   ✓ Images
   ✓ Names
   ✓ Prices (₹8.50/brick, ₹45/block, etc.)
   ✓ Dimensions (9×4.25×3, 15×7.5×7.5, etc.)
   ✓ Ratings & Reviews
   ✓ Search & Sort functionality
```

---

## 🆘 **Issues?**

### ❌ "firebase-service-account.json not found"
**Fix:** Download from Firebase Console and place in `d:\ArchLens\`

### ❌ "Cannot find module 'firebase-admin'"
**Fix:** Run `npm install --save-dev firebase-admin`

### ❌ "Permission denied" error
**Fix:** Verify you have **Editor** role in Firebase project

### ❌ Connection timeout
**Fix:** Check internet connection, restart Firebase CLI

---

## 📊 **What Gets Added**

| Category | Count | Details |
|----------|-------|---------|
| Load Bearing Bricks | 3 | Wienerberger, MTC, JCW (₹7.50-8.50) |
| Load Bearing Blocks | 4 | Fly Ash, Concrete (₹6-38) |
| Natural Stone | 2 | Granite, Limestone (₹120-180) |
| Partition AAC | 2 | Ultratech, Bilcon (₹42-45) |
| Partition Hollow | 2 | Standard, Interlocking (₹18-22) |
| Cement | 3 | UltraTech, Ambuja, JK (₹480-510/50kg) |
| Sand | 3 | M-Sand, River, Desert (₹380-450/cft) |
| **TOTAL** | **19** | **All with images, ratings, specs** |

---

## 🎯 **Next Time You Start Dev Server**

```powershell
npm run dev:user
```

WallScreen will automatically load all 19 materials from Firestore! 🚀

---

## 📚 **Full Documentation**

If you need more details, see:
- `FIREBASE_IMPORT_SETUP.md` - Detailed setup guide
- `scripts/import-wall-materials.js` - Import script
- `scripts/verify-firebase-setup.js` - Verification script

---

**Happy building! 🏗️**
