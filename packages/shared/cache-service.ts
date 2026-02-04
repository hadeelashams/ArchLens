/**
 * Image Analysis Cache Service
 * Caches floor plan analysis results to prevent repeated AI calls for the same image
 */

export interface CachedAnalysis {
  id: string;
  imageHash: string;
  timestamp: number;
  analysisData: {
    rooms: any[];
    totalArea: number;
    summary?: string;
  };
  confidence?: number;
}

class ImageCacheService {
  private cache: Map<string, CachedAnalysis> = new Map();
  private maxCacheSize = 10; // Store up to 10 analyses
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
   * Check if analysis exists in cache
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
   * Store analysis result in cache
   */
  setCachedAnalysis(
    imageData: string,
    analysisData: { rooms: any[]; totalArea: number; summary?: string },
    confidence?: number
  ): CachedAnalysis {
    const hash = this.generateImageHash(imageData);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    const cached: CachedAnalysis = {
      id: `cache-${Date.now()}`,
      imageHash: hash,
      timestamp: Date.now(),
      analysisData,
      confidence,
    };

    this.cache.set(hash, cached);
    return cached;
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
        rooms: c.analysisData.rooms.length,
        totalArea: c.analysisData.totalArea,
        age: Date.now() - c.timestamp,
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
}

export const imageCacheService = new ImageCacheService();
