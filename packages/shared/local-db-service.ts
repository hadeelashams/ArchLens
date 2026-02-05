/**
 * Local Database Service
 * Provides persistent local storage for image analysis cache using AsyncStorage
 * Stores and retrieves cached analysis data with image names as primary identifiers
 */

import type { ImageCacheEntry, CachedAnalysis } from './cache-service';

export interface LocalDbConfig {
  maxCacheSize?: number;
  cacheDurationHours?: number;
  enableAutoSync?: boolean;
}

class LocalDatabaseService {
  private isInitialized = false;
  private maxCacheSize: number;
  private cacheDuration: number; // in milliseconds
  private storageKey = '@archlens_image_analysis_db';
  private indexKey = '@archlens_image_analysis_index';
  private asyncStorage: any = null; // Will be injected

  constructor(config: LocalDbConfig = {}) {
    this.maxCacheSize = config.maxCacheSize || 100; // Larger for persistent storage
    this.cacheDuration = (config.cacheDurationHours || 30 * 24) * 60 * 60 * 1000; // 30 days default
  }

  /**
   * Initialize the database with AsyncStorage reference
   * Must be called before using the service
   */
  async initialize(asyncStorageInstance: any): Promise<boolean> {
    try {
      this.asyncStorage = asyncStorageInstance;
      await this.loadIndex();
      this.isInitialized = true;
      console.log('Local database service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize local database:', error);
      return false;
    }
  }

  /**
   * Load the index from storage
   */
  private async loadIndex(): Promise<string[]> {
    try {
      if (!this.asyncStorage) return [];
      const indexData = await this.asyncStorage.getItem(this.indexKey);
      return indexData ? JSON.parse(indexData) : [];
    } catch (error) {
      console.warn('Error loading index:', error);
      return [];
    }
  }

  /**
   * Save the index to storage
   */
  private async saveIndex(index: string[]): Promise<void> {
    try {
      if (!this.asyncStorage) return;
      await this.asyncStorage.setItem(this.indexKey, JSON.stringify(index));
    } catch (error) {
      console.warn('Error saving index:', error);
    }
  }

  /**
   * Store analysis result by image name in persistent storage
   */
  async saveAnalysisByImageName(
    imageName: string,
    analysisData: any,
    confidence?: number
  ): Promise<boolean> {
    try {
      if (!this.asyncStorage) {
        console.warn('AsyncStorage not initialized');
        return false;
      }

      const now = new Date().toISOString();
      const entry: ImageCacheEntry = {
        imageName,
        timestamp: Date.now(),
        analysisData,
        confidence,
        createdAt: now,
        updatedAt: now,
      };

      // Create unique key for this image
      const key = `${this.storageKey}_${this.escapeKey(imageName)}`;

      // Save the entry
      await this.asyncStorage.setItem(key, JSON.stringify(entry));

      // Update index
      const index = await this.loadIndex();
      if (!index.includes(imageName)) {
        index.push(imageName);
        // Keep only recent entries
        if (index.length > this.maxCacheSize) {
          const removed = index.shift();
          if (removed) {
            const removedKey = `${this.storageKey}_${this.escapeKey(removed)}`;
            await this.asyncStorage.removeItem(removedKey);
          }
        }
        await this.saveIndex(index);
      }

      console.log(`Saved analysis for image: ${imageName}`);
      return true;
    } catch (error) {
      console.error('Error saving analysis:', error);
      return false;
    }
  }

  /**
   * Retrieve analysis result by image name
   */
  async getAnalysisByImageName(imageName: string): Promise<ImageCacheEntry | null> {
    try {
      if (!this.asyncStorage) return null;

      const key = `${this.storageKey}_${this.escapeKey(imageName)}`;
      const data = await this.asyncStorage.getItem(key);

      if (!data) {
        return null;
      }

      const entry: ImageCacheEntry = JSON.parse(data);

      // Check if expired
      const now = Date.now();
      if (now - entry.timestamp > this.cacheDuration) {
        // Remove expired entry
        await this.removeAnalysisByImageName(imageName);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Error retrieving analysis:', error);
      return null;
    }
  }

  /**
   * Remove analysis by image name
   */
  async removeAnalysisByImageName(imageName: string): Promise<boolean> {
    try {
      if (!this.asyncStorage) return false;

      const key = `${this.storageKey}_${this.escapeKey(imageName)}`;
      await this.asyncStorage.removeItem(key);

      // Update index
      const index = await this.loadIndex();
      const filtered = index.filter(name => name !== imageName);
      await this.saveIndex(filtered);

      return true;
    } catch (error) {
      console.error('Error removing analysis:', error);
      return false;
    }
  }

  /**
   * Search for cached analyses by pattern
   */
  async searchAnalyses(searchPattern: string): Promise<ImageCacheEntry[]> {
    try {
      if (!this.asyncStorage) return [];

      const index = await this.loadIndex();
      const matching: ImageCacheEntry[] = [];
      const searchLower = searchPattern.toLowerCase();

      for (const imageName of index) {
        if (imageName.toLowerCase().includes(searchLower)) {
          const entry = await this.getAnalysisByImageName(imageName);
          if (entry) {
            matching.push(entry);
          }
        }
      }

      return matching;
    } catch (error) {
      console.error('Error searching analyses:', error);
      return [];
    }
  }

  /**
   * Get all cached analyses
   */
  async getAllAnalyses(): Promise<ImageCacheEntry[]> {
    try {
      if (!this.asyncStorage) return [];

      const index = await this.loadIndex();
      const allEntries: ImageCacheEntry[] = [];

      for (const imageName of index) {
        const entry = await this.getAnalysisByImageName(imageName);
        if (entry) {
          allEntries.push(entry);
        }
      }

      return allEntries;
    } catch (error) {
      console.error('Error retrieving all analyses:', error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    totalImages: number;
    totalRooms: number;
    totalArea: number;
    averageAreaPerRoom: number;
    oldestEntry?: string;
    newestEntry?: string;
    capacityUsed: string;
  }> {
    try {
      const allEntries = await this.getAllAnalyses();

      const totalRooms = allEntries.reduce(
        (sum, entry) => sum + (entry.analysisData.rooms?.length || 0),
        0
      );

      const totalArea = allEntries.reduce(
        (sum, entry) => sum + (entry.analysisData.totalArea || 0),
        0
      );

      const timestamps = allEntries.map(e => new Date(e.createdAt).getTime());
      const oldestEntry = timestamps.length > 0
        ? new Date(Math.min(...timestamps)).toISOString()
        : undefined;

      const newestEntry = timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : undefined;

      return {
        totalImages: allEntries.length,
        totalRooms,
        totalArea: Math.round(totalArea * 100) / 100,
        averageAreaPerRoom: totalRooms > 0 ? Math.round((totalArea / totalRooms) * 100) / 100 : 0,
        oldestEntry,
        newestEntry,
        capacityUsed: `${((allEntries.length / this.maxCacheSize) * 100).toFixed(1)}%`,
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        totalImages: 0,
        totalRooms: 0,
        totalArea: 0,
        averageAreaPerRoom: 0,
        capacityUsed: '0%',
      };
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllData(): Promise<boolean> {
    try {
      if (!this.asyncStorage) return false;

      const index = await this.loadIndex();
      for (const imageName of index) {
        const key = `${this.storageKey}_${this.escapeKey(imageName)}`;
        await this.asyncStorage.removeItem(key);
      }

      await this.asyncStorage.removeItem(this.indexKey);
      console.log('All cached data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  /**
   * Export database as JSON
   */
  async exportDatabase(): Promise<string | null> {
    try {
      const allEntries = await this.getAllAnalyses();
      return JSON.stringify(allEntries, null, 2);
    } catch (error) {
      console.error('Error exporting database:', error);
      return null;
    }
  }

  /**
   * Import database from JSON
   */
  async importDatabase(jsonData: string): Promise<boolean> {
    try {
      if (!this.asyncStorage) return false;

      const entries: ImageCacheEntry[] = JSON.parse(jsonData);
      await this.clearAllData();

      for (const entry of entries) {
        await this.saveAnalysisByImageName(
          entry.imageName,
          entry.analysisData,
          entry.confidence
        );
      }

      console.log(`Imported ${entries.length} entries`);
      return true;
    } catch (error) {
      console.error('Error importing database:', error);
      return false;
    }
  }

  /**
   * Escape AsyncStorage key (remove special characters)
   */
  private escapeKey(key: string): string {
    return key
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 100); // Limit key length
  }

  /**
   * Verify database integrity and clean expired entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      if (!this.asyncStorage) return 0;

      const index = await this.loadIndex();
      let removedCount = 0;
      const now = Date.now();

      for (const imageName of [...index]) {
        const entry = await this.getAnalysisByImageName(imageName);
        if (!entry && index.includes(imageName)) {
          // Entry was expired and removed
          removedCount++;
        }
      }

      console.log(`Cleaned up ${removedCount} expired entries`);
      return removedCount;
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
      return 0;
    }
  }

  /**
   * Get status and information about the service
   */
  getStatus(): {
    initialized: boolean;
    maxCacheSize: number;
    cacheDurationDays: number;
    hasAsyncStorage: boolean;
  } {
    return {
      initialized: this.isInitialized,
      maxCacheSize: this.maxCacheSize,
      cacheDurationDays: Math.round(this.cacheDuration / (24 * 60 * 60 * 1000)),
      hasAsyncStorage: this.asyncStorage !== null,
    };
  }
}

export const localDatabaseService = new LocalDatabaseService();
