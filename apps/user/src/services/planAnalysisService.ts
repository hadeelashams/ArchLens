/**
 * Plan Analysis Service
 * Uses Firebase Gemini AI for floor plan analysis
 */

import { analyzeFloorPlan, extractStructuredData } from '@archlens/shared';

export interface Room {
  id: string;
  name: string;
  length: string;
  width: string;
}

export interface PlanAnalysisResponse {
  success: boolean;
  rooms: Room[];
  totalArea: number;
  confidence: number;
}

/**
 * Analyze floor plan image using Gemini AI
 * @param imageUri - Local image URI from device
 * @returns Promise with detected rooms and measurements
 */
export const analyzePlanImage = async (imageUri: string): Promise<PlanAnalysisResponse> => {
  try {
    // Convert image URI to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;

          // Analyze with Gemini AI
          const analysis = await analyzeFloorPlan(base64String);

          // Extract structured room data with simpler JSON prompt
          const prompt = `Analyze this floor plan and extract room information. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "rooms": [
    {
      "id": "room1",
      "name": "room name",
      "length": "number",
      "width": "number"
    }
  ],
  "totalArea": 0,
  "confidence": 0.8
}`;

          const structuredData = await extractStructuredData(analysis, prompt);
          
          // Clean the response: remove markdown code blocks if present
          let cleanedData = structuredData.trim();
          
          // Remove markdown code blocks
          if (cleanedData.startsWith('```')) {
            cleanedData = cleanedData.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
          }
          
          // Try to extract JSON if wrapped in other text
          const jsonMatch = cleanedData.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanedData = jsonMatch[0];
          }

          const parsedData = JSON.parse(cleanedData);

          // Ensure valid response structure
          const rooms = Array.isArray(parsedData.rooms) 
            ? parsedData.rooms.map((room: any, index: number) => ({
                id: room.id || `room-${index}`,
                name: room.name || `Room ${index + 1}`,
                length: String(room.length || '0'),
                width: String(room.width || '0'),
              }))
            : [];

          const totalArea = Number(parsedData.totalArea) || 0;
          const confidence = Math.min(1, Math.max(0, Number(parsedData.confidence) || 0.8));

          resolve({
            success: true,
            rooms,
            totalArea,
            confidence,
          });
        } catch (error) {
          console.error('Error parsing Gemini response:', error);
          reject(new Error('Failed to parse floor plan analysis'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };

      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error analyzing plan with Gemini:', error);
    throw error;
  }
};
