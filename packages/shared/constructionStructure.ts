// packages/shared/constructionStructure.ts

export const CONSTRUCTION_HIERARCHY = {
  'Foundation': {
    label: "Foundation",
    types: {
      'RCC': ["Concrete", "Steel"],
      'PCC': ["Concrete"],
      'Stone Masonry': ["Stone", "Cement", "Sand"],
    },
  },
  'Wall': {
    label: "Wall",
    classifications: {
      'Load Bearing': {
        types: ["Brick Wall", "Stone Masonry", "Solid Block"],
      },
      'Non-Load Bearing': {
        types: ["Brick Wall", "Concrete Block", "AAC", "Gypsum Board"],
      },
    },
  },
  'Roof': {
    label: "Roof",
    styles: {
      'Flat': ["Concrete", "Steel"],
      'Sloped': ["Roof Tile", "Slate"],
      'Curved': ["Sheet Metal"],
    },
  },
  'Flooring': {
    label: "Flooring",
    areas: {
      'Living': ["Tile", "Wooden", "Stone"],
      'Bedroom': ["Vinyl Floor", "Tile", "Wood"],
      'Kitchen': ["Anti-skid Tile", "Ceramic", "Vitrified"],
      'Bathroom': ["Anti-skid Tile", "Matte Tile"],
      'Balcony': ["Anti-skid Tile", "Outdoor Tile", "Stone"],
    },
  },
  'Wall Finishing': {
    label: "Wall Finishing",
    finishingTypes: {
      'Wall Paper': ["Vinyl", "Fabric", "Paper"],
      'Paneling': ["PVC", "3D", "Wood"],
      'Tile': ["Marble", "Ceramic", "Granite"],
      'Paint': ["Emulsion", "Distemper"],
    },
  },
} as const;