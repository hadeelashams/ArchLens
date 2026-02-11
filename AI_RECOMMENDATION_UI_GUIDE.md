# AI Recommendation Visual Guide for Users

## How Users Identify AI Recommendations

### 1. **AI TRIGGER BUTTON** (Top Section)
```
┌─────────────────────────────────────────────────┐
│  ✨ AI Auto-Select Standard Materials          │  ← Purple button with sparkles icon
│                                                 │
│  💡 AI will analyze your floor plan and        │  ← Advice box appears AFTER clicking
│  recommend materials optimized for your         │  (Only visible after AI completes)
│  Standard budget tier.                          │
└─────────────────────────────────────────────────┘
```

**Visual Indicators:**
- **Button Color:** Purple/Violet (#8b5cf6)
- **Icon:** White sparkles (✨) on the left
- **Text:** "AI Auto-Select [Tier] Materials"
- **State:** Shows loading spinner while AI is thinking
- **Advice:** Appears in light purple box (#ede9fe) with engineering tip

---

### 2. **LOAD-BEARING WALLS CARD** (After AI Selection)
```
┌──────────────────────────────────────────────────┐
│ Load-Bearing Walls ═══════════════════ [9 inch] │
│ 60% of structure                                 │
│                                                  │
│ ✓ Selected: Premium Red Brick [✨ AI Rec]      │
│                                  ↑              │
│                          Purple badge appears   │
│                          when this material      │
│                          was AI-selected        │
│                                                  │
│ [≡≡≡ Horizontal Scroll of Materials ≡≡≡]       │
│  [Material 1] [Material 2] [Material 3]...      │
│                                                  │
│ 2,450 units needed                              │
└──────────────────────────────────────────────────┘
```

**Visual Indicators for AI Recommendation:**
- **Checkmark:** Green ✓ before "Selected"
- **Material Name:** Shows what was selected
- **Purple Badge:** `✨ AI Recommended` appears to the RIGHT of selection
  - Background Color: Purple (#8b5cf6)
  - Icon: White sparkles
  - Text: White "AI Recommended"
  - Size: Compact, 10px font
- **When It Appears:** Only when that specific material was AI-selected
- **When It Disappears:** If user taps a different material in the scroll

---

### 3. **PARTITION WALLS CARD** (Same Pattern)
```
┌──────────────────────────────────────────────────┐
│ Partition Walls ════════════════════ [4.5 inch] │
│ 40% of structure                                 │
│                                                  │
│ ✓ Selected: Clay Block Standard [✨ AI Rec]    │
│                                  ↑              │
│                          Purple badge when AI   │
│                          picked this material   │
│                                                  │
│ [≡≡≡ Horizontal Scroll of Materials ≡≡≡]       │
│  [Material A] [Material B] [Material C]...      │
│                                                  │
│ 1,820 units needed                              │
└──────────────────────────────────────────────────┘
```

**Same visual pattern as Load-Bearing card**

---

## User Experience Flow

### Step 1: User Sees AI Button
```
User opens WallScreen
        ↓
Sees purple "AI Auto-Select Standard Materials" button
        ↓
(Optional: Has option to use AI or manually select)
```

### Step 2: User Clicks AI Button
```
User taps "AI Auto-Select Standard Materials"
        ↓
Button shows spinning loader ⟳
        ↓
AI analyzes available materials (typically 2-5 seconds)
```

### Step 3: AI Applies Recommendations
```
AI returns analysis
        ↓
✓ Purple "AI Recommended" badges appear on:
  - Load-Bearing material card
  - Partition material card
  - (Cement and Sand in Mortar section)
        ↓
💡 Blue advice box shows engineering tip
        ↓
Quantities update automatically
```

### Step 4: User Can Override
```
If user doesn't like AI choice:
        ↓
Tap ANY material in the horizontal scroll
        ↓
That material becomes selected
        ↓
Purple "AI Recommended" badge DISAPPEARS (because user changed it)
        ↓
Quantities recalculate
        ↓
Save with custom selection
```

---

## Visual Color Scheme for AI Elements

| Element | Color | Hex Code | Meaning |
|---------|-------|----------|---------|
| AI Button Background | Purple | #8b5cf6 | "This is AI-powered" |
| AI Button Text | White | #ffffff | "Clickable action" |
| Sparkles Icon | White | #ffffff | "Magic/AI feature" |
| Advice Box Background | Light Purple | #ede9fe | "Information box" |
| Advice Box Border | Purple | #8b5cf6 | "Links to AI" |
| Advice Text | Dark Purple | #6d28d9 | "Important tip" |
| AI Badge Background | Purple | #8b5cf6 | "AI-selected this" |
| AI Badge Text | White | #ffffff | "Confirmation" |
| Selection Text | Green | #10b981 | "Selected & confirmed" |

---

## Key UI Changes Summary

### 1. **AI Trigger Section** (NEW)
```jsx
Location: Top of material selection screen (after metadata info)
Shows:
  - Purple sparkles button
  - Advice box (after AI completion)
Purpose: Entry point for AI recommendations
```

### 2. **Material Selection Row** (ENHANCED)
```jsx
Location: Inside each material card (Load-Bearing, Partition)
Changes:
  OLD: ✓ Selected: Material Name
  NEW: ✓ Selected: Material Name [✨ AI Recommended]
                                  ↑ Only shows if AI picked it
```

### 3. **Advice Display** (NEW)
```jsx
Location: Below AI button
Shows: 💡 [Engineering advice from AI]
Color: Light purple background with dark purple text
Example: "Premium materials offer 25+ year durability with 
         minimal maintenance in Standard tier."
```

---

## UI Identification Checklist for Users

When checking if a material was AI-recommended:

✅ **Look for:** Purple "AI Recommended" badge next to material name
✅ **Location:** Right side of the selection text in material cards
✅ **Icon:** White sparkles (✨) inside the badge
✅ **Color:** Purple background (#8b5cf6)
✅ **Text:** Says exactly "AI Recommended"

❌ **If badge is NOT visible:** User manually selected this material (or AI wasn't used)

---

## Example Scenario

**Scenario: User uploads floor plan with Standard tier**

1. User sees purple button: "✨ AI Auto-Select Standard Materials"
2. Clicks button → loading spinner appears
3. After 3 seconds, AI completes:
   - Load-Bearing section shows: ✓ Selected: Red Brick Premium [✨ AI Recommended]
   - Partition section shows: ✓ Selected: Clay Block [✨ AI Recommended]
   - Mortar section shows: ✓ Selected: OPC Cement [✨ AI Recommended]
   - Advice box displays: "💡 Red brick offers superior durability and costs 15% less for Standard tier"
   - All quantities update

4. User likes Load-Bearing brick, but wants to change Partition:
   - Scrolls to see other partition options
   - Taps "Autoclaved Concrete Block"
   - ✨ AI badge disappears from old selection (Partition)
   - New selection is now just: ✓ Selected: Autoclaved Concrete Block (no badge)

5. User saves estimate with mixed selections:
   - Load-Bearing: AI Recommended (red badge visible)
   - Partition: Manual override (no badge)
   - Cement & Sand: AI Recommended (badges visible)

---

## Visual Mockup: Complete Material Card

```
╔════════════════════════════════════════════════════════╗
║ Load-Bearing Walls                        [9 inch] 🔴  ║
║ 60% of structure                                       ║
║ ────────────────────────────────────────────────────── ║
║ ✓ Selected: Premium Red Brick    [✨ AI Recommended]   ║
║          (Green text)            (Purple badge)        ║
║ ────────────────────────────────────────────────────── ║
║                                                        ║
║ ┌──────────────────────────────────────────────────┐  ║
║ │ [Brick 1]  [Brick 2]  [Brick 3]  [Brick 4] →   │  ║
║ │  IMG       IMG       IMG       IMG              │  ║
║ │  Name      Name      Name      Name             │  ║
║ │  ₹450/Pc   ₹520/Pc   ₹380/Pc   ₹600/Pc         │  ║
║ │           (Selected with blue border)           │  ║
║ └──────────────────────────────────────────────────┘  ║
║                                                        ║
║ 2,450 units needed                                    ║
╚════════════════════════════════════════════════════════╝
```

---

## Testing AI Recommendations Visually

To verify AI recommendations working correctly:

1. ✅ Click "AI Auto-Select [Tier] Materials" button
2. ✅ Wait for AI to process (shows loading state)
3. ✅ Check Load-Bearing card → should show purple [✨ AI Recommended] badge
4. ✅ Check Partition card → should show purple [✨ AI Recommended] badge
5. ✅ Check advice box → should display engineering tip
6. ✅ Change a material → badge should disappear from that card
7. ✅ Save estimate → should save with correct selections

---

## Browser/App Developer Testing

If you want to see the exact data flow:

**In Console (React Native Debugger):**
```javascript
// View AI recommendations state
aiRecommendations = {
  loadBearingBrick: "brick-premium-red",
  partitionBrick: "clay-block-standard",
  cement: "opc-cement-53",
  sand: "regular-sand"
}

// When user changes a material
loadBearingBrick.id → changes from "brick-premium-red" to something else
// → Badge disappears because:
// aiRecommendations.loadBearingBrick !== new loadBearingBrick.id
```

