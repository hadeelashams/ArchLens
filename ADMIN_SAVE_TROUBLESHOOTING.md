# Admin Material Save Troubleshooting Guide

## ✅ What Changed

Your admin dashboard now has:
1. **Auto-save with visual feedback** - Shows "Saving... ✅ Saved!" states
2. **Sync status indicator** - Green bar shows "Real-time sync active • X materials loaded"
3. **Better error messages** - Tells you exactly what went wrong
4. **Auto-close on success** - Modal closes and form resets after save

---

## 🔧 3-Step Verification That Data Is Saving

### Step 1: Open Browser DevTools
```
Windows: Press F12
Mac: Press Cmd + Option + I
```

### Step 2: Go to Console Tab
- Look for any **red error messages**
- Should see logs like:
  ```
  📤 Attempting to save material: {category: "Wall", subCategory: "Non-Load Bearing", ...}
  ✅ Material created with ID: abc123xyz
  📥 Received 20 materials from Firestore
  ```

### Step 3: Check Firestore Console
- Open [Firebase Console](https://console.firebase.google.com)
- Select your project
- Go to **Firestore Database** → **Collections**
- Click **materials** collection
- New documents should appear with names like "Brick Partition"

---

## 🚨 Common Issues & Fixes

### Issue 1: Shows "Save Failed ❌"

**Most Likely Cause:** Firestore security rules are too restrictive

**Fix:**
1. Go to Firebase Console → Firestore Database → **Rules** tab
2. Replace current rules with:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write materials
    match /materials/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Allow all other collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
3. Click **Publish**
4. Try saving again

---

### Issue 2: "Saved successfully" but data doesn't appear in list

**Most Likely Cause:** Real-time listener has a delay or fails silently

**Fix:**
1. Open browser console (F12)
2. Look for error: **"❌ Firestore Listener Error"**
3. If you see this error, check:
   - **Is user logged in?** Look at top-right corner of admin dashboard
   - **Internet connection?** Try refreshing the page (Ctrl+F5)
   - **Firebase initialized?** In console, type: `console.log(db)` 
     - Should show a Firebase object, not `undefined`

---

### Issue 3: Can't find browser console logs

**Solution:**

1. Don't close the modal immediately after saving
2. Look in the **Console** tab (not Network tab)
3. Filter by these keywords:
   - `❌` = errors
   - `✅` = successes
   - `📤` = save attempts
   - `📥` = received data

---

## ✨ What Successful Save Looks Like

### In Admin Dashboard:
- Button shows "💾 Save Material"
- Click it → Button becomes "Saving..."
- Wait 2-3 seconds → Button shows "✅ Saved!"
- Modal auto-closes
- Form resets to empty
- Material appears in the table immediately

### In Browser Console:
```
📤 Attempting to save material: {category: "Wall", subCategory: "Non-Load Bearing", type: "Brick Partition", name: "Brick Partition", ...}
✅ Material created with ID: d1a2b3c4e5f6
🔄 Setting up real-time listener for materials...
📥 Received 20 materials from Firestore
```

### In Firestore Console:
- Click **materials** collection
- See new document with fields:
  - `category`: "Wall"
  - `subCategory`: "Non-Load Bearing"
  - `name`: "Brick Partition"
  - `pricePerUnit`: 40
  - `createdAt`: timestamp
  - `updatedAt`: timestamp

---

## 🆘 Still Not Working?

### Quick Test Command

In admin app, open browser console and run:
```javascript
// Test if Firebase is connected
console.log('DB:', db);
console.log('Auth:', auth);
```

**Expected output:**
- `DB:` shows an object (not undefined)
- `Auth:` shows an object (not undefined)

If either shows `undefined`, Firebase isn't initialized.

---

## 🔐 Security Rules Checklist

Before saving, verify:
- ✅ User is **logged in** (see username in admin dashboard)
- ✅ Firestore **Rules** allow `write` for authenticated users
- ✅ No typos in collection name (should be exactly **"materials"**)
- ✅ No errors in browser console (F12 → Console tab)
- ✅ Internet connection is stable

---

## 📞 Debug Information to Share

If you still have issues, provide:

1. **Exact error message** from the alert box
2. **Console error** from F12 → Console tab (paste it)
3. **Firebase project ID** (found in Firebase Console)
4. **Collection structure** (firebase Console → Firestore → materials)

---

## 🚀 Alternative: Use Script Import

If the admin form keeps failing, use the automated import script instead:

```powershell
# In VS Code terminal at workspace root:
node scripts/verify-firebase-setup.js
node scripts/import-wall-materials.js
```

This imports 19 wall materials in seconds without the admin UI.

---

**Last Updated:** February 11, 2026
**Status:** All logging added, auto-save features enabled
