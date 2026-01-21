/**
 * Example usage of Gemini AI Service in ArchLens User App
 * This file demonstrates how to integrate Gemini AI capabilities
 */

import { 
  generateText, 
  analyzeFloorPlan, 
  chat, 
  streamGenerateText,
  extractStructuredData,
  ChatMessage 
} from '@archlens/shared';

/**
 * Example: Generate cost estimation description
 */
export const generateCostDescription = async (projectDetails: string): Promise<string> => {
  try {
    const prompt = `Based on the following construction project details, provide a professional cost estimation summary:

${projectDetails}

Include:
- Project scope analysis
- Key cost drivers
- Estimated price range
- Risk factors`;

    const description = await generateText(prompt, {
      temperature: 0.7,
      maxOutputTokens: 500,
    });

    return description;
  } catch (error) {
    console.error('Error generating cost description:', error);
    throw error;
  }
};

/**
 * Example: Analyze uploaded floor plan with AI
 */
export const analyzeUploadedFloorPlan = async (imageBase64: string): Promise<any> => {
  try {
    const analysis = await analyzeFloorPlan(imageBase64);
    
    // Extract structured data from analysis
    const schema = `{
      "rooms": [
        {
          "name": "string",
          "type": "string",
          "estimatedArea": "number",
          "features": ["string"]
        }
      ],
      "totalArea": "number",
      "layoutType": "string",
      "recommendations": ["string"]
    }`;

    const structuredData = await extractStructuredData(analysis, schema);
    return JSON.parse(structuredData);
  } catch (error) {
    console.error('Error analyzing floor plan:', error);
    throw error;
  }
};

/**
 * Example: Multi-turn conversation for project questions
 */
export const askProjectQuestion = async (
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> => {
  try {
    const messages: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: question }
    ];

    const response = await chat(messages);
    return response;
  } catch (error) {
    console.error('Error asking project question:', error);
    throw error;
  }
};

/**
 * Example: Stream real-time planning suggestions
 */
export async function* streamPlanningSuggestions(projectDescription: string) {
  try {
    const prompt = `Provide detailed planning suggestions for the following construction project in steps:

${projectDescription}

Provide suggestions for:
1. Material selection
2. Timeline optimization
3. Cost savings opportunities
4. Quality assurance steps`;

    for await (const chunk of streamGenerateText(prompt, {
      temperature: 0.8,
      maxOutputTokens: 1000,
    })) {
      yield chunk;
    }
  } catch (error) {
    console.error('Error streaming suggestions:', error);
    throw error;
  }
}
