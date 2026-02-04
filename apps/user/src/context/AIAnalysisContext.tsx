/**
 * AI Analysis Context
 * Manages AI-generated analysis results and project insights across the app
 * Includes caching to prevent repeated AI calls for the same floor plans
 */

import React, { createContext, useContext, useState } from 'react';
import { imageCacheService, type CachedAnalysis } from '@archlens/shared';

export interface AIAnalysisResult {
  id: string;
  type: 'floor_plan' | 'cost_estimate' | 'materials';
  timestamp: number;
  data: Record<string, any>;
  metadata?: {
    roomCount?: number;
    totalArea?: number;
    confidence?: number;
    isCached?: boolean;
    fromCache?: boolean;
  };
  imageHash?: string;
}

interface AIAnalysisContextType {
  analyses: AIAnalysisResult[];
  addAnalysis: (analysis: AIAnalysisResult) => void;
  removeAnalysis: (id: string) => void;
  clearAnalyses: () => void;
  getLatestAnalysis: (type?: string) => AIAnalysisResult | null;
  // Cache-related methods
  getCachedFloorPlanAnalysis: (imageData: string) => AIAnalysisResult | null;
  cacheFloorPlanAnalysis: (imageData: string, analysisResult: AIAnalysisResult) => void;
  getCacheStats: () => any;
  clearCache: () => void;
}

const AIAnalysisContext = createContext<AIAnalysisContextType | undefined>(undefined);

export const AIAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analyses, setAnalyses] = useState<AIAnalysisResult[]>([]);

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
   * Check cache for previous analysis of the same floor plan
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
      },
      imageHash: cached.imageHash,
    };
  };

  /**
   * Cache floor plan analysis result
   */
  const cacheFloorPlanAnalysis = (imageData: string, analysisResult: AIAnalysisResult) => {
    imageCacheService.setCachedAnalysis(
      imageData,
      {
        rooms: analysisResult.data.rooms || [],
        totalArea: analysisResult.data.totalArea || 0,
        summary: analysisResult.data.summary,
      },
      analysisResult.metadata?.confidence
    );
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = () => {
    return imageCacheService.getCacheStats();
  };

  /**
   * Clear all cached analyses
   */
  const clearCache = () => {
    imageCacheService.clearCache();
  };

  return (
    <AIAnalysisContext.Provider
      value={{
        analyses,
        addAnalysis,
        removeAnalysis,
        clearAnalyses,
        getLatestAnalysis,
        getCachedFloorPlanAnalysis,
        cacheFloorPlanAnalysis,
        getCacheStats,
        clearCache,
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
