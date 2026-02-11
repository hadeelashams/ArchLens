// filepath: add-wall-materials.js
// Run this in Firebase Console to bulk import wall materials

const wallMaterialsData = [
  // ===== LOAD BEARING MATERIALS =====
  
  // SECTION 1: Clay Bricks
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
    description: "Standard Indian clay brick for load bearing walls"
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
    description: "Traditional Indian clay brick by Mangalore Tile Company"
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
    description: "Handmade clay brick by Jaipur Clay Works"
  },
  
  // SECTION 2: Fly Ash Bricks
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
    description: "Lightweight fly ash brick, 75mm thickness"
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
    description: "Eco-friendly fly ash brick, fire-resistant"
  },
  
  // SECTION 3: Concrete Blocks
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
    description: "Standard concrete block, 2500 PSI strength"
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
    description: "Standard concrete block, durable construction"
  },
  
  // SECTION 4: Natural Stone
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
    description: "Premium natural granite for load bearing walls"
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
    description: "Durable natural limestone for wall construction"
  },
  
  // ===== NON-LOAD BEARING / PARTITION MATERIALS =====
  
  // SECTION 5: AAC Blocks
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
    description: "Lightweight AAC block, 600 kg/m³ density"
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
    description: "High quality AAC block for partition walls"
  },
  
  // SECTION 6: Hollow Blocks
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
    description: "Lightweight hollow block for partition walls"
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
    description: "Interlocking hollow block, easy to install"
  },
  
  // ===== MORTAR MATERIALS =====
  
  // SECTION 7: Cement
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
    description: "Pozzolana Portland Cement (PPC) 50kg bag"
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
    description: "OPC 53 Grade cement, high strength"
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
    description: "PPC Grade cement 50kg bag"
  },
  
  // SECTION 8: Sand
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
    description: "Clean manufactured sand for mortar"
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
    description: "Fine natural river sand, dust-free"
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
    description: "High quality premium desert sand"
  }
];

// Export for use in admin panel
module.exports = wallMaterialsData;

// ============ FIREBASE IMPORT INSTRUCTIONS ============
/*

TO IMPORT THESE MATERIALS TO FIRESTORE:

METHOD 1 - Using Admin Panel:
1. Go to Admin Dashboard → Materials
2. Click "Add New Material" for each item
3. Fill in the form with the data above
4. Click Save

METHOD 2 - Using Firebase Console:
1. Go to Firebase Console → Firestore Database
2. Create new documents in 'materials' collection
3. Copy-paste each object from wallMaterialsData array

METHOD 3 - Using CLI Script:
- Requires: Firebase Admin SDK
- Run: node import-wall-materials.js
- This will bulk import all materials

MAPPING TO ADMIN FORM:
- name → Product Display Name
- category → Root Category
- subCategory → Classification/Method
- type → Material Type
- grade → Specification/Grade
- dimensions → Block Dimensions (L x W x H in inches)
- pricePerUnit → Market Price (₹)
- unit → Unit (Strict Selection)
- imageUrl → Image URL
- availability → Availability Status
- rating → Customer Rating
- reviews → Number of Reviews
- description → Additional Description

*/
