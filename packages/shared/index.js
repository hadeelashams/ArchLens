// packages/shared/index.js
export * from './firebase';
export * from './firestore-service';
export * from './gemini-service';
export * from './constants';
export * from './constructionStructure';
export * from './cache-service'; // <--- MAKE SURE THIS LINE EXISTS
export * from './local-db-service'; // <--- Local database service for persistent caching
export { WALL_MATERIALS_SEED_DATA } from './wallMaterialsSeedData'; // <--- Wall materials for admin seeding
export { ROOFING_MATERIALS_SEED_DATA } from './roofingMaterialsSeedData'; // <--- Roofing materials for admin seeding
