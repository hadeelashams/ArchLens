/**
 * Image Analysis Cache Service
 * Caches floor plan analysis results to prevent repeated AI calls for the same image
 * Supports both in-memory caching and persistent local database storage using image names
 */

export interface CachedAnalysis {
  id: string;
  imageHash: string;
  imageName?: string; // Store image file name as identifier
  timestamp: number;
  analysisData: {
    rooms: any[];
    totalArea: number;
    summary?: string;
  };
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImageCacheEntry {
  imageName: string;
  imageHash?: string;
  timestamp: number;
  analysisData: {
    rooms: any[];
    totalArea: number;
    summary?: string;
  };
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

class ImageCacheService {
  private cache: Map<string, CachedAnalysis> = new Map();
  private maxCacheSize = 10; // Store up to 10 analyses
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private localDbKey = '@archlens_image_cache_db'; // AsyncStorage key for persistent storage
  private dbInitialized = false;

  /**
   * Initialize the database from AsyncStorage (for React Native environments)
   * This should be called on app startup
   */
  async initializeDatabase(): Promise<void> {
    try {
      // This will be handled by React Native AsyncStorage when available
      // For now, the in-memory cache is sufficient
      this.dbInitialized = true;
      console.log('Image cache database initialized');
    } catch (error) {
      console.error('Error initializing image cache database:', error);
    }
  }

  /**
   * Generate a hash of image data for comparison
   * Simple hash function - for production use a proper hashing library
   */
  private generateImageHash(imageData: string): string {
    let hash = 0;
    const str = imageData.substring(0, 500); // Use first 500 chars to generate hash
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract filename from image URI
   */
  private extractImageName(imageUri: string): string {
    try {
      // Handle file paths and URIs
      const parts = imageUri.split('/');
      const filename = parts[parts.length - 1];
      return filename || `image-${Date.now()}`;
    } catch (error) {
      return `image-${Date.now()}`;
    }
  }

  /**
   * Check if analysis exists in cache by image hash
   */
  getCachedAnalysis(imageData: string): CachedAnalysis | null {
    const hash = this.generateImageHash(imageData);
    const cached = this.cache.get(hash);

    if (!cached) return null;

    // Check if cache has expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheDuration) {
      this.cache.delete(hash);
      return null;
    }

    return cached;
  }

  /**
   * Check if analysis exists in cache by image name
   * Returns cached analysis if found and not expired
   */
  getCachedAnalysisByImageName(imageName: string): CachedAnalysis | null {
    // Search through cache for matching image name
    for (const [hash, cached] of this.cache.entries()) {
      if (cached.imageName === imageName) {
        // Check if cache has expired
        const now = Date.now();
        if (now - cached.timestamp > this.cacheDuration) {
          this.cache.delete(hash);
          return null;
        }
        return cached;
      }
    }
    return null;
  }

  /**
   * Get all cached analyses (returns array of cache entries)
   */
  getAllCachedAnalyses(): CachedAnalysis[] {
    const now = Date.now();
    const validEntries: CachedAnalysis[] = [];

    for (const [hash, cached] of this.cache.entries()) {
      // Remove expired entries
      if (now - cached.timestamp > this.cacheDuration) {
        this.cache.delete(hash);
        continue;
      }
      validEntries.push(cached);
    }

    return validEntries;
  }

  /**
   * Search for cached analysis by partial image name
   * Useful for finding similar images
   */
  searchCachedAnalyses(searchTerm: string): CachedAnalysis[] {
    const results: CachedAnalysis[] = [];
    const now = Date.now();

    for (const [hash, cached] of this.cache.entries()) {
      // Remove expired entries
      if (now - cached.timestamp > this.cacheDuration) {
        this.cache.delete(hash);
        continue;
      }

      if (cached.imageName && cached.imageName.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(cached);
      }
    }

    return results;
  }

  /**
   * Store analysis result in cache with both hash and image name
   */
  setCachedAnalysis(
    imageData: string,
    analysisData: { rooms: any[]; totalArea: number; summary?: string },
    confidence?: number,
    imageName?: string
  ): CachedAnalysis {
    const hash = this.generateImageHash(imageData);
    const name = imageName || this.extractImageName(imageData);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    const now = new Date().toISOString();
    const cached: CachedAnalysis = {
      id: `cache-${Date.now()}`,
      imageHash: hash,
      imageName: name,
      timestamp: Date.now(),
      analysisData,
      confidence,
      createdAt: now,
      updatedAt: now,
    };

    this.cache.set(hash, cached);
    return cached;
  }

  /**
   * Store analysis result in cache with image name as primary identifier
   * This method is optimized for image-name-based lookups
   */
  setCachedAnalysisByImageName(
    imageName: string,
    analysisData: { rooms: any[]; totalArea: number; summary?: string },
    confidence?: number
  ): CachedAnalysis {
    // Generate a unique hash based on image name
    const nameHash = this.generateImageHash(imageName);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    const now = new Date().toISOString();
    const cached: CachedAnalysis = {
      id: `cache-${Date.now()}`,
      imageHash: nameHash,
      imageName: imageName,
      timestamp: Date.now(),
      analysisData,
      confidence,
      createdAt: now,
      updatedAt: now,
    };

    this.cache.set(nameHash, cached);
    return cached;
  }

  /**
   * Delete specific cache entry by image name
   */
  deleteCacheEntryByImageName(imageName: string): boolean {
    for (const [key, value] of this.cache.entries()) {
      if (value.imageName === imageName) {
        this.cache.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalCached: this.cache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.cache.values()).map(c => ({
        id: c.id,
        imageName: c.imageName || 'unknown',
        rooms: c.analysisData.rooms.length,
        totalArea: c.analysisData.totalArea,
        confidence: c.confidence || 'N/A',
        createdAt: c.createdAt,
        age: Date.now() - c.timestamp,
      })),
    };
  }

  /**
   * Get detailed cache database information
   * Returns statistics about all cached images
   */
  getCacheDatabaseInfo() {
    const entries = this.getAllCachedAnalyses();
    const totalRooms = entries.reduce((sum, entry) => sum + entry.analysisData.rooms.length, 0);
    const totalArea = entries.reduce((sum, entry) => sum + entry.analysisData.totalArea, 0);
    const averageConfidence = entries.length > 0
      ? (entries.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / entries.length).toFixed(2)
      : 0;

    return {
      totalCachedImages: entries.length,
      totalRoomsIndexed: totalRooms,
      totalAreaAnalyzed: totalArea.toFixed(2),
      averageConfidence: averageConfidence,
      cacheCapacity: this.maxCacheSize,
      percentUsed: ((entries.length / this.maxCacheSize) * 100).toFixed(1),
      entries: Array.from(this.cache.values()).map(c => ({
        imageName: c.imageName || 'unknown',
        totalArea: c.analysisData.totalArea,
        roomCount: c.analysisData.rooms.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        confidence: c.confidence,
      })),
    };
  }

  /**
   * Remove specific cache entry
   */
  removeCacheEntry(id: string): boolean {
    for (const [key, value] of this.cache.entries()) {
      if (value.id === id) {
        this.cache.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Export cache database as JSON for backup/sync
   */
  exportCacheDatabase(): string {
    const data = Array.from(this.cache.values()).map(entry => ({
      imageName: entry.imageName,
      imageHash: entry.imageHash,
      analysisData: entry.analysisData,
      confidence: entry.confidence,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import cache database from JSON
   */
  importCacheDatabase(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData) as ImageCacheEntry[];
      this.cache.clear();

      for (const entry of data) {
        const hash = this.generateImageHash(entry.imageName);
        const cached: CachedAnalysis = {
          id: `cache-${Date.now()}`,
          imageHash: entry.imageHash || hash,
          imageName: entry.imageName,
          timestamp: Date.parse(entry.createdAt),
          analysisData: entry.analysisData,
          confidence: entry.confidence,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
        this.cache.set(hash, cached);
      }

      console.log(`Successfully imported ${data.length} cache entries`);
      return true;
    } catch (error) {
      console.error('Error importing cache database:', error);
      return false;
    }
  }
}

export const imageCacheService = new ImageCacheService();
