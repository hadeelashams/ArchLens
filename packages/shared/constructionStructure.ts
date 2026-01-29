// packages/shared/constructionStructure.ts

export const MATERIAL_UNITS = [
  "Bag (50kg)",
  "Kg",
  "Ton",
  "Cubic Feet (cft)",
  "Brass",
  "Square Feet (sq.ft)",
  "Nos (Numbers)",
  "Litre",
  "Box",
  "Meter",
  "Bundle"
] as const;

export const CONSTRUCTION_HIERARCHY = {
  'Foundation': {
    label: "Foundation",
    // Standardized Key: subCategories (Represents Construction Method)
    subCategories: {
      'RCC': ["Cement", "Steel (TMT Bar)", "Sand","Aggregate"],
      'PCC': ["Cement","Sand","Aggregate"],
      'Stone Masonry': ["Stone", "Cement", "Sand"],
    },
  },
  'Wall': {
    label: "Wall",
    subCategories: {
      'Load Bearing': ["Red Brick", "Fly Ash Brick", "Solid Concrete Block", "Stone Masonry"],
      'Non-Load Bearing': ["AAC Block", "Hollow Concrete Block", "Gypsum Board", "Glass Block"],
      'Partition': ["Plywood", "Fiber Cement Board", "Glass"],
    },
  },
  'Roof': {
    label: "Roof",
    subCategories: {
      'RCC Slab': ["Cement", "Steel (TMT Bar)", "Sand", "Waterproofing Chemical"],
      'Sloped Roof': ["Clay Roof Tile", "Concrete Roof Tile", "Slate", "Timber/Wood", "Steel Truss"],
      'Metal Sheet': ["Galvanized Iron Sheet", "Polycarbonate Sheet", "Aluminium Sheet"],
    },
  },
  'Flooring': {
    label: "Flooring",
    subCategories: {
      'Living/Dining': ["Vitrified Tile", "Italian Marble", "Granite", "Teak Wood", "Engineered Wood"],
      'Bedroom': ["Vitrified Tile", "Wooden Laminate", "Vinyl Flooring"],
      'Kitchen': ["Anti-skid Ceramic Tile", "Vitrified Tile", "Quartz", "Granite"],
      'Bathroom': ["Anti-skid Ceramic Tile", "Porcelain Tile", "Epoxy Grout"],
      'Outdoor/Balcony': ["Natural Stone", "Terracotta Tile", "WPC Decking", "Grass Pavers"],
    },
  },
  'Wall Finishing': {
    label: "Wall Finishing",
    subCategories: {
      'Paint': ["Interior Emulsion", "Exterior Emulsion", "Primer", "Putty", "Distemper", "Texture Paint"],
      'Cladding': ["Wall Tiles", "Natural Stone", "HPL Sheets"],
      'Paneling': ["PVC Panel", "WPC Panel", "Charcoal Sheet", "Veneer"],
      'Wallpaper': ["Vinyl Wallpaper", "Fabric Wallpaper", "3D Wallpaper"],
    },
  },
} as const;