/**
 * Gemini AI Service
 * Provides AI-powered capabilities using Firebase Gemini API
 * Supports text generation, analysis, and multi-turn conversations
 */

import { geminiModel } from './firebase';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

/**
 * Generate text content from a prompt
 * @param prompt - The text prompt to send to Gemini
 * @param config - Optional generation configuration
 * @returns Promise with the generated text response
 */
export const generateText = async (
  prompt: string,
  config?: GenerationConfig
): Promise<string> => {
  try {
    if (!geminiModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: config,
    });

    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error generating text with Gemini:', error);
    throw error;
  }
};

/**
 * Analyze floor plan image with Gemini
 * @param imageData - Base64 encoded image data or image URI
 * @param analysisPrompt - Custom prompt for analysis (optional)
 * @returns Promise with the analysis result
 */
export const analyzeFloorPlan = async (
  imageData: string,
  analysisPrompt?: string
): Promise<string> => {
  try {
    if (!geminiModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    // ---------------------------------------------------------
    // OPTIMIZED PROMPT FOR ARCHITECTURAL PLANS
    // ---------------------------------------------------------
    const defaultPrompt = `
      Act as a professional Quantity Surveyor and Architect. Analyze this floor plan image with high precision.
      
      The image contains specific text labels for Room Names (e.g., "Bedroom 1", "Kitchen") and Area measurements (e.g., "137 sq ft", "10'5"").
      
      Your tasks:
      1. OCR EXTRACTION: Identify every text label inside a room. Extract the Room Name and the explicit Area labeled (if present).
      2. DIMENSION ESTIMATION: 
         - If dimensions are written on the walls (e.g. 12' x 10'), use them.
         - If area is written (e.g., "100 sq ft"), estimate a logical Length and Width that equals that area (e.g., L=10, W=10).
         - If no text exists, visually estimate dimensions assuming standard door width is 3 feet.
      3. WALLS: Identify if the room is a closed space or an open space (like a Hallway).
      4. UNIT CONVERSION: Convert all dimensions to DECIMAL FEET (e.g., 10'6" becomes 10.5).

      RETURN DATA STRUCTURE (Strict JSON, no markdown):
      {
        "summary": "Brief architectural summary (e.g., 3 Bedroom, 2 Bath layout with balcony)",
        "totalArea": "Number (Sum of all room areas)",
        "rooms": [
          {
            "id": "unique_id",
            "name": "String (e.g., Master Bedroom)",
            "length": "Number (Decimal Feet, e.g., 12.5)",
            "width": "Number (Decimal Feet, e.g., 10.0)",
            "area": "Number (Square Feet)",
            "features": ["String (e.g., Walk-in Closet, En-suite)"]
          }
        ]
      }
    `;

    const prompt = analysisPrompt || defaultPrompt;

    // Convert image URI to base64 if needed
    const imageBase64 = imageData.startsWith('data:') 
      ? imageData.split(',')[1] 
      : imageData;

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const response = result.response;
    const analysisText = response.text();
    return analysisText;
  } catch (error) {
    console.error('Error analyzing floor plan with Gemini:', error);
    throw error;
  }
};

/**
 * Multi-turn conversation with Gemini
 * @param messages - Array of conversation messages
 * @param config - Optional generation configuration
 * @returns Promise with the model's response
 */
export const chat = async (
  messages: ChatMessage[],
  config?: GenerationConfig
): Promise<string> => {
  try {
    if (!geminiModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    const result = await geminiModel.generateContent({
      contents: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      generationConfig: config,
    });

    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error in chat with Gemini:', error);
    throw error;
  }
};

/**
 * Stream text generation from Gemini (returns async generator)
 * @param prompt - The text prompt to send to Gemini
 * @param config - Optional generation configuration
 * @returns Async generator yielding text chunks
 */
export const streamGenerateText = async function* (
  prompt: string,
  config?: GenerationConfig
): AsyncGenerator<string, void, unknown> {
  try {
    if (!geminiModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    const result = await geminiModel.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: config,
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error('Error streaming text from Gemini:', error);
    throw error;
  }
};

/**
 * Extract structured data from content using Gemini
 * @param content - The content to analyze
 * @param schema - Description of the desired output structure
 * @returns Promise with the structured data as JSON string
 */
export const extractStructuredData = async (
  content: string,
  schema: string
): Promise<string> => {
  try {
    if (!geminiModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    const prompt = `Extract the following information from the provided content and return it as JSON:

Schema: ${schema}

Content:
${content}

IMPORTANT: Return ONLY valid JSON with no markdown code blocks, no formatting, and no extra text.`;

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const response = result.response;
    let jsonText = response.text();
    
    // Clean markdown code blocks if present
    jsonText = jsonText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Try to extract JSON if wrapped in other text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    return jsonText;
  } catch (error) {
    console.error('Error extracting structured data from Gemini:', error);
    throw error;
  }
};
