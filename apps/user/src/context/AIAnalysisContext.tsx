/**
 * AI Analysis Context
 * Manages AI-generated analysis results and project insights across the app
 * Includes both in-memory and persistent local database caching
 * to prevent repeated AI calls for the same floor plans
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { imageCacheService, localDatabaseService, type CachedAnalysis } from '@archlens/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RoomMetadata {
  name: string;
  length: number;
  width: number;
  area?: number;
  roomType: "standard" | "balcony" | "wash_area";
  wallMetadata: {
    mainWallRatio: number;    // Load-Bearing wall proportion (0.0-1.0)
    partitionWallRatio: number; // Partition wall proportion (0.0-1.0)
  };
  openingPercentage: number;   // Window/door percentage of perimeter (0-100)
  features?: string[];
}

export interface AIAnalysisResult {
  id: string;
  type: 'floor_plan' | 'cost_estimate' | 'materials';
  timestamp: number;
  data: {
    rooms: RoomMetadata[];
    totalArea: number;
    summary?: string;
  };
  metadata?: {
    roomCount?: number;
    totalArea?: number;
    confidence?: number;
    isCached?: boolean;
    fromCache?: boolean;
    isPersistent?: boolean; // True if from local database
    imageName?: string;
  };
  imageHash?: string;
  imageName?: string;
}

export interface ActiveProject {
  id: string;
  name: string;
  totalArea: number;
  userId: string;
  status: string;
  rooms?: any[];
  [key: string]: any;
}

export interface AIAnalysisContextType {
  analyses: AIAnalysisResult[];
  activeProject: ActiveProject | null;
  setActiveProject: (project: ActiveProject | null) => void;
  addAnalysis: (analysis: AIAnalysisResult) => void;
  removeAnalysis: (id: string) => void;
  clearAnalyses: () => void;
  getLatestAnalysis: (type?: string) => AIAnalysisResult | null;
  // Cache-related methods
  getCachedFloorPlanAnalysis: (imageData: string) => AIAnalysisResult | null;
  getCachedFloorPlanByImageName: (imageName: string) => Promise<AIAnalysisResult | null>;
  cacheFloorPlanAnalysis: (imageData: string, analysisResult: AIAnalysisResult, imageName?: string) => Promise<void>;
  getCacheStats: () => any;
  clearCache: () => void;
  // Local database methods
  getLocalDatabaseStats: () => Promise<any>;
  clearLocalDatabase: () => Promise<void>;
  exportLocalDatabase: () => Promise<string | null>;
  importLocalDatabase: (jsonData: string) => Promise<boolean>;
  searchLocalDatabase: (searchTerm: string) => Promise<AIAnalysisResult[]>;
}

const AIAnalysisContext = createContext<AIAnalysisContextType | undefined>(undefined);

export const AIAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analyses, setAnalyses] = useState<AIAnalysisResult[]>([]);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize local database on mount
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const initialized = await localDatabaseService.initialize(AsyncStorage);
        setDbInitialized(initialized);
        if (initialized) {
          console.log('Local database initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize local database:', error);
      }
    };

    initializeDb();
  }, []);

  const addAnalysis = (analysis: AIAnalysisResult) => {
    setAnalyses(prev => [analysis, ...prev]);
  };

  const removeAnalysis = (id: string) => {
    setAnalyses(prev => prev.filter(analysis => analysis.id !== id));
  };

  const clearAnalyses = () => {
    setAnalyses([]);
  };

  const getLatestAnalysis = (type?: string): AIAnalysisResult | null => {
    if (type) {
      return analyses.find(a => a.type === type as any) || null;
    }
    return analyses.length > 0 ? analyses[0] : null;
  };

  /**
   * Check cache for previous analysis of the same floor plan (in-memory)
   */
  const getCachedFloorPlanAnalysis = (imageData: string): AIAnalysisResult | null => {
    const cached = imageCacheService.getCachedAnalysis(imageData);
    if (!cached) return null;

    // Convert cached analysis to AIAnalysisResult format
    return {
      id: cached.id,
      type: 'floor_plan',
      timestamp: cached.timestamp,
      data: cached.analysisData,
      metadata: {
        roomCount: cached.analysisData.rooms.length,
        totalArea: cached.analysisData.totalArea,
        confidence: cached.confidence,
        fromCache: true,
        isPersistent: false,
        imageName: cached.imageName,
      },
      imageHash: cached.imageHash,
      imageName: cached.imageName,
    };
  };

  /**
   * Check cache for previous analysis by image name (persistent local database)
   */
  const getCachedFloorPlanByImageName = async (imageName: string): Promise<AIAnalysisResult | null> => {
    if (!dbInitialized) return null;

    try {
      // First check in-memory cache
      const inMemoryCache = imageCacheService.getCachedAnalysisByImageName(imageName);
      if (inMemoryCache) {
        return {
          id: inMemoryCache.id,
          type: 'floor_plan',
          timestamp: inMemoryCache.timestamp,
          data: inMemoryCache.analysisData,
          metadata: {
            roomCount: inMemoryCache.analysisData.rooms.length,
            totalArea: inMemoryCache.analysisData.totalArea,
            confidence: inMemoryCache.confidence,
            fromCache: true,
            isPersistent: false,
            imageName: inMemoryCache.imageName,
          },
          imageHash: inMemoryCache.imageHash,
          imageName: inMemoryCache.imageName,
        };
      }

      // Then check persistent database
      const dbEntry = await localDatabaseService.getAnalysisByImageName(imageName);
      if (dbEntry) {
        return {
          id: `db-${Date.now()}`,
          type: 'floor_plan',
          timestamp: dbEntry.timestamp,
          data: dbEntry.analysisData,
          metadata: {
            roomCount: dbEntry.analysisData.rooms.length,
            totalArea: dbEntry.analysisData.totalArea,
            confidence: dbEntry.confidence,
            fromCache: true,
            isPersistent: true,
            imageName: dbEntry.imageName,
          },
          imageName: dbEntry.imageName,
        };
      }

      return null;
    } catch (error) {
      console.error('Error retrieving cached floor plan:', error);
      return null;
    }
  };

  /**
   * Cache floor plan analysis result in both in-memory and persistent storage
   * Also persists to AsyncStorage for cross-session availability
   */
  const cacheFloorPlanAnalysis = async (
    imageData: string,
    analysisResult: AIAnalysisResult,
    imageName?: string
  ) => {
    const name = imageName || analysisResult.metadata?.imageName || 'unknown';

    // Save to in-memory cache
    imageCacheService.setCachedAnalysis(
      imageData,
      {
        rooms: analysisResult.data.rooms || [],
        totalArea: analysisResult.data.totalArea || 0,
        summary: analysisResult.data.summary,
      },
      analysisResult.metadata?.confidence,
      name
    );

    // Save to persistent local database
    if (dbInitialized) {
      try {
        await localDatabaseService.saveAnalysisByImageName(
          name,
          {
            rooms: analysisResult.data.rooms || [],
            totalArea: analysisResult.data.totalArea || 0,
            summary: analysisResult.data.summary,
          },
          analysisResult.metadata?.confidence
        );
      } catch (error) {
        console.warn('Failed to save to persistent database:', error);
      }
    }

    // Persist analysis results to AsyncStorage for cross-session availability
    try {
      const cacheKey = `floor_plan_analysis_${name}`;
      const cacheData = {
        id: analysisResult.id,
        timestamp: analysisResult.timestamp,
        data: analysisResult.data,
        metadata: analysisResult.metadata,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Floor plan analysis cached in AsyncStorage: ${cacheKey}`);
    } catch (error) {
      console.warn('Failed to save to AsyncStorage:', error);
    }
  };

  /**
   * Get cache statistics (in-memory)
   */
  const getCacheStats = () => {
    return imageCacheService.getCacheStats();
  };

  /**
   * Get local database statistics
   */
  const getLocalDatabaseStats = async () => {
    if (!dbInitialized) return null;
    return localDatabaseService.getDatabaseStats();
  };

  /**
   * Clear all cached analyses (in-memory)
   */
  const clearCache = () => {
    imageCacheService.clearCache();
  };

  /**
   * Clear all data from local database
   */
  const clearLocalDatabase = async () => {
    if (!dbInitialized) return;
    await localDatabaseService.clearAllData();
  };

  /**
   * Export local database as JSON for backup
   */
  const exportLocalDatabase = async (): Promise<string | null> => {
    if (!dbInitialized) return null;
    return localDatabaseService.exportDatabase();
  };

  /**
   * Import local database from JSON
   */
  const importLocalDatabase = async (jsonData: string): Promise<boolean> => {
    if (!dbInitialized) return false;
    return localDatabaseService.importDatabase(jsonData);
  };

  /**
   * Search local database by image name pattern
   */
  const searchLocalDatabase = async (searchTerm: string): Promise<AIAnalysisResult[]> => {
    if (!dbInitialized) return [];

    try {
      const results = await localDatabaseService.searchAnalyses(searchTerm);
      return results.map(entry => ({
        id: `search-${Date.now()}`,
        type: 'floor_plan' as const,
        timestamp: entry.timestamp,
        data: entry.analysisData,
        metadata: {
          roomCount: entry.analysisData.rooms.length,
          totalArea: entry.analysisData.totalArea,
          confidence: entry.confidence,
          fromCache: true,
          isPersistent: true,
          imageName: entry.imageName,
        },
        imageName: entry.imageName,
      }));
    } catch (error) {
      console.error('Error searching database:', error);
      return [];
    }
  };

  return (
    <AIAnalysisContext.Provider
      value={{
        analyses,
        activeProject,
        setActiveProject,
        addAnalysis,
        removeAnalysis,
        clearAnalyses,
        getLatestAnalysis,
        getCachedFloorPlanAnalysis,
        getCachedFloorPlanByImageName,
        cacheFloorPlanAnalysis,
        getCacheStats,
        clearCache,
        getLocalDatabaseStats,
        clearLocalDatabase,
        exportLocalDatabase,
        importLocalDatabase,
        searchLocalDatabase,
      }}
    >
      {children}
    </AIAnalysisContext.Provider>
  );
};

export const useAIAnalysis = () => {
  const context = useContext(AIAnalysisContext);
  if (!context) {
    throw new Error('useAIAnalysis must be used within AIAnalysisProvider');
  }
  return context;
};

