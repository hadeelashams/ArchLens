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

export type WallType = 'Load Bearing' | 'Non-Load Bearing' | 'Partition Wall' | 'Partition';

export const WALL_TYPE_SPECS: Record<WallType, {
  label: string;
  mortarRatio: number;
  cementMortar: number;
  sandMortar: number;
  bricksPerCuFt: number;
  description: string;
}> = {
  'Load Bearing': {
    label: 'Load Bearing',
    mortarRatio: 0.25,
    cementMortar: 1,
    sandMortar: 6,
    bricksPerCuFt: 5.0,
    description: 'Structural walls using bricks and concrete blocks'
  },
  'Non-Load Bearing': {
    label: 'Non-Load Bearing',
    mortarRatio: 0.15,
    cementMortar: 1,
    sandMortar: 5,
    bricksPerCuFt: 1.1,
    description: 'Lightweight walls using AAC and hollow blocks'
  },
  'Partition Wall': {
    label: 'Partition Wall',
    mortarRatio: 0.15,
    cementMortar: 1,
    sandMortar: 5,
    bricksPerCuFt: 1.1,
    description: 'Partition walls using AAC blocks, hollow blocks, and other lightweight materials'
  },
  'Partition': {
    label: 'Partition',
    mortarRatio: 0.10,
    cementMortar: 1,
    sandMortar: 4,
    bricksPerCuFt: 0,
    description: 'Interior partitions using plywood and boards'
  }
};


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
      'Load Bearing': ["Brick Wall", "Block Wall", "Stone Wall"],
      'Partition': ["Brick Partition", "Block Partition", "Dry Wall", "Glass","Wood Wall"],
    },
  },
'Roof': {
    label: "Roofing",
    subCategories: {
      "Slab": {
        "Slab Core": ["RCC Solid Slab", "Filler Slab", "Precast Slab "],
        "Protection": ["Waterproofing Chemical"]
      },
      "Sloped Roof - Tile": {
        "Truss Structure": ["Steel Truss", "Timber/Wood Truss"],
        "Roof Covering": ["Clay Roof Tile", "Concrete Roof Tile", "Slate Tile"],
        "Protection": ["Roofing Underlayment", "Waterproof Membrane"]
      },
      "Sloped Roof - Sheet": {
        "Truss Structure": ["Steel Truss"],
        "Roof Covering": ["Galvanized Iron Sheet", "Aluminium Sheet", "Polycarbonate Sheet"],
        "Protection": ["Anti-condensation Felt", "Waterproof Membrane"]
      }
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