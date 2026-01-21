/**
 * Hook for AI-powered cost estimation and analysis
 * Provides functions to generate cost estimates and project insights using Gemini AI
 */

import { useState } from 'react';
import { generateText, extractStructuredData } from '@archlens/shared';

export interface CostEstimate {
  lowRange: number;
  highRange: number;
  confidence: number;
  breakdown: {
    labor: number;
    materials: number;
    equipment: number;
    contingency: number;
  };
  timeline: string;
  recommendations: string[];
}

export const useAICostEstimation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateProjectCost = async (projectDescription: string): Promise<CostEstimate | null> => {
    try {
      setLoading(true);
      setError(null);

      const prompt = `Provide a detailed cost estimation for the following construction project:

${projectDescription}

Include:
1. Low and high range estimates in USD
2. Confidence level (0-100%)
3. Cost breakdown (labor, materials, equipment, contingency)
4. Estimated timeline
5. 3-5 key recommendations for cost optimization`;

      const response = await generateText(prompt, {
        temperature: 0.6,
        maxOutputTokens: 800,
      });

      // Extract structured data
      const schema = `{
        "lowRange": "number (USD)",
        "highRange": "number (USD)",
        "confidence": "number (0-100)",
        "breakdown": {
          "labor": "number (percentage)",
          "materials": "number (percentage)",
          "equipment": "number (percentage)",
          "contingency": "number (percentage)"
        },
        "timeline": "string (estimated duration)",
        "recommendations": ["string"]
      }`;

      const structuredResponse = await extractStructuredData(response, schema);
      const estimate = JSON.parse(structuredResponse);

      return estimate as CostEstimate;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to estimate project cost';
      setError(errorMsg);
      console.error('Cost estimation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getSavingsSuggestions = async (projectDescription: string): Promise<string[]> => {
    try {
      setLoading(true);
      setError(null);

      const prompt = `For the following construction project, provide 5-7 specific, actionable ways to reduce costs:

${projectDescription}

Format each suggestion as:
- [Strategy Name]: [Detailed explanation]`;

      const response = await generateText(prompt, {
        temperature: 0.7,
        maxOutputTokens: 600,
      });

      // Parse suggestions from response
      const suggestions = response
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());

      return suggestions;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get savings suggestions';
      setError(errorMsg);
      console.error('Savings suggestions error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getMaterialRecommendations = async (
    roomType: string,
    budget: string
  ): Promise<Record<string, any>> => {
    try {
      setLoading(true);
      setError(null);

      const prompt = `Recommend the best materials for a ${roomType} with a ${budget} budget. Consider:
1. Durability
2. Maintenance requirements
3. Cost-effectiveness
4. Aesthetic appeal
5. Availability

Format as a list with pros and cons for each recommendation.`;

      const response = await generateText(prompt, {
        temperature: 0.5,
        maxOutputTokens: 500,
      });

      return {
        roomType,
        budget,
        recommendations: response,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get material recommendations';
      setError(errorMsg);
      console.error('Material recommendations error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    estimateProjectCost,
    getSavingsSuggestions,
    getMaterialRecommendations,
    loading,
    error,
  };
};
