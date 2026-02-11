# Firebase Automatic Import - Setup Instructions

## 🚀 Quick Start (3 Steps)

### Step 1: Get Firebase Service Account Key
```bash
# Go to: Firebase Console
# → Project Settings → Service Accounts → Generate New Private Key
# → Save as: firebase-service-account.json
# → Place in project root: d:\ArchLens\
```

### Step 2: Install Dependencies
```bash
cd d:\ArchLens
npm install --save-dev firebase-admin
```

### Step 3: Run Import Script
```bash
node scripts/import-wall-materials.js
```

---

## 📥 Detailed: Get Firebase Service Account

### 1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com
   - Select your ArchLens project

### 2. **Navigate to Service Accounts**
   ```
   Project Settings (⚙️) 
   → Service Accounts Tab
   → Node.js radio button
   → "Generate New Private Key"
   ```

### 3. **Download & Place File**
   - A JSON file downloads automatically
   - Rename it to: `firebase-service-account.json`
   - Place it in: `d:\ArchLens\` (project root)

### 4. **Verify File Location**
```bash
# Windows PowerShell
Test-Path "d:\ArchLens\firebase-service-account.json"
# Should return: True
```

---

## 📦 Install Firebase Admin SDK

```bash
# Navigate to project
cd d:\ArchLens

# Install firebase-admin
npm install --save-dev firebase-admin

# Or if you prefer yarn
yarn add --dev firebase-admin
```

---

## ▶️ Run the Import Script

### Option A: Direct Node Command
```bash
cd d:\ArchLens
node scripts/import-wall-materials.js
```

### Option B: Using npm script (Recommended)
Add to `package.json`:
```json
{
  "scripts": {
    "import:wall-materials": "node scripts/import-wall-materials.js"
  }
}
```

Then run:
```bash
npm run import:wall-materials
```

---

## 📊 Expected Output

When successful, you'll see:
```
🔧 Initializing Firebase Admin SDK...

✅ Firebase Admin SDK initialized

🚀 Starting Wall Materials Import...

📋 Total materials to import: 19
============================================================
✅ 1.  Wienerberger First Class Clay Brick         ₹8.50 / Nos (Numbers)
✅ 2.  MTC Premium Red Clay Brick                 ₹8.00 / Nos (Numbers)
✅ 3.  JCW Traditional Red Brick                  ₹7.50 / Nos (Numbers)
✅ 4.  Ultratech Fly Ash Brick                    ₹6.50 / Nos (Numbers)
✅ 5.  India Blocks Fly Ash Brick                 ₹6.00 / Nos (Numbers)
✅ 6.  Shree Cements Concrete Block              ₹35.00 / Nos (Numbers)
✅ 7.  ACC Concrete Block                        ₹38.00 / Nos (Numbers)
✅ 8.  Premium Granite Stone Block               ₹180.00 / Nos (Numbers)
✅ 9.  Natural Limestone Block                   ₹120.00 / Nos (Numbers)
✅ 10. Ultratech AAC Block 100mm                 ₹45.00 / Nos (Numbers)
✅ 11. Bilcon AAC Block                          ₹42.00 / Nos (Numbers)
✅ 12. Standard Hollow Concrete Block            ₹18.00 / Nos (Numbers)
✅ 13. Interlocking Hollow Block                 ₹22.00 / Nos (Numbers)
✅ 14. UltraTech PPC Cement                     ₹480.00 / Bag (50kg)
✅ 15. Ambuja Cement OPC 53                     ₹510.00 / Bag (50kg)
✅ 16. JK Cement PPC                            ₹495.00 / Bag (50kg)
✅ 17. Manufactured River Sand (M-Sand)         ₹420.00 / Cubic Feet (cft)
✅ 18. Natural River Sand                       ₹380.00 / Cubic Feet (cft)
✅ 19. Premium Desert Sand                      ₹450.00 / Cubic Feet (cft)
============================================================

⏳ Committing batch to Firestore...

============================================================
✨ SUCCESS! Imported 19 wall materials to Firestore
============================================================

📊 Summary:
   Load Bearing Bricks: 3
   Load Bearing Blocks: 4
   Natural Stone: 2
   Partition Blocks (AAC): 2
   Partition Blocks (Hollow): 2
   Cement (Mortar): 3
   Sand (Mortar): 3
   ─────────────────────
   TOTAL: 19 materials ✓

🎯 Next Steps:
   1. Go to User App → WallScreen
   2. Tap "Select Load-Bearing Material"
   3. See all 19 new materials with:
      ✓ Product images
      ✓ Material names
      ✓ Prices per unit
      ✓ Dimensions (e.g., 9×4.25×3)
      ✓ Ratings & reviews
      ✓ Availability status
```

---

## ❌ Troubleshooting

### Error: "firebase-service-account.json not found"

**Solution:**
1. Download file from Firebase Console
2. Save to: `d:\ArchLens\firebase-service-account.json`
3. Verify file exists before running script

### Error: "Cannot find module 'firebase-admin'"

**Solution:**
```bash
npm install --save-dev firebase-admin
```

### Error: "Permission denied"

**Solution:**
Make sure you have Cloud Firestore Editor role in Firebase Console

### Error: "Network/Connection failed"

**Solution:**
- Check internet connection
- Verify Firebase project is active
- Check firewall/antivirus blocking connection

---

## ✅ Verify Import Was Successful

### In Firebase Console:
```
Firebase Console
→ Firestore Database
→ "materials" Collection
→ Should see 19+ documents
```

### In App (User):
```
User App
→ Project → Wall Construction
→ Tap "Select Load-Bearing Material"
→ Should display all 19 materials with images & prices
```

---

## 🔄 Re-import (If Needed)

To delete and re-import:

```bash
# Delete all "Wall" materials first
firebase firestore:delete materials \
  --recursive \
  --path "materials" \
  --filter-field="category" \
  --filter-op="==" \
  --filter-value="Wall"

# Then run import again
node scripts/import-wall-materials.js
```

Or delete in Firebase Console manually and run script again.

---

## 📋 Script Features

✅ **Batch Operations** - All 19 materials imported in single batch (faster)
✅ **Error Handling** - Comprehensive error messages
✅ **Progress Display** - Shows each material as imported
✅ **Timestamp** - Auto-adds createdAt/updatedAt
✅ **Validation** - Checks for service account file
✅ **Formatted Output** - Easy to read success/error messages

---

## 🎯 What Gets Imported

Each material includes:
- ✅ Name (e.g., "Wienerberger First Class Clay Brick")
- ✅ Category ("Wall")
- ✅ SubCategory ("Load Bearing", "Non-Load Bearing", "Mortar")
- ✅ Type ("Brick", "Block", "Stone", "Cement", "Sand")
- ✅ Grade/Spec (e.g., "First Class", "2500 PSI", "PPC")
- ✅ Dimensions (e.g., "9x4.25x3" in inches)
- ✅ Price Per Unit (₹)
- ✅ Unit (Nos, Bag, cft, etc.)
- ✅ Image URL (Unsplash images)
- ✅ Rating (4.2-4.8 stars)
- ✅ Reviews (67-1240 reviews)
- ✅ Availability Status
- ✅ Description

---

## 🚀 One-Command Setup (All-in-One)

```bash
# From d:\ArchLens directory
npm install --save-dev firebase-admin && node scripts/import-wall-materials.js
```

This will:
1. Install firebase-admin
2. Run the import script
3. Add all 19 materials to Firestore

---

## 📞 Support

If you encounter issues:

1. **Check file exists:** `d:\ArchLens\firebase-service-account.json`
2. **Check permissions:** Firebase Console → IAM
3. **Check connection:** `ping firebase.google.com`
4. **Check script:** Review `scripts/import-wall-materials.js`

Run script with debug info:
```bash
NODE_DEBUG=firebase node scripts/import-wall-materials.js
```

