/**
 * AI Analysis Context
 * Manages AI-generated analysis results and project insights across the app
 */

import React, { createContext, useContext, useState } from 'react';

export interface AIAnalysisResult {
  id: string;
  type: 'floor_plan' | 'cost_estimate' | 'materials';
  timestamp: number;
  data: Record<string, any>;
  metadata?: {
    roomCount?: number;
    totalArea?: number;
    confidence?: number;
  };
}

interface AIAnalysisContextType {
  analyses: AIAnalysisResult[];
  addAnalysis: (analysis: AIAnalysisResult) => void;
  removeAnalysis: (id: string) => void;
  clearAnalyses: () => void;
  getLatestAnalysis: (type?: string) => AIAnalysisResult | null;
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

  return (
    <AIAnalysisContext.Provider value={{ analyses, addAnalysis, removeAnalysis, clearAnalyses, getLatestAnalysis }}>
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
