/**
 * Gemini AI Service
 * Provides AI-powered capabilities using Firebase Gemini API
 * Supports text generation, analysis, and multi-turn conversations
 * Includes automatic fallback to alternative models on rate limits
 */

import { geminiModel, GEMINI_MODELS, MODEL_NAMES, createGeminiModel, ai } from './firebase';

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

// Track current model being used
let currentModelIndex = 0;
let currentModel = geminiModel;

/**
 * Switch to the next available fallback model
 * This is done transparently when rate limits are hit
 */
const switchToNextModel = async () => {
  if (currentModelIndex < GEMINI_MODELS.length - 1) {
    currentModelIndex++;
    const nextModel = GEMINI_MODELS[currentModelIndex];
    
    try {
      currentModel = createGeminiModel(ai, nextModel);
      console.log(`ℹ️ Switched to ${MODEL_NAMES[nextModel]} due to rate limit`);
      return true;
    } catch (error) {
      console.warn(`Failed to switch to ${nextModel}:`, error);
      return false;
    }
  }
  return false;
};

/**
 * Reset to primary model (can be called after successful request or on app restart)
 */
export const resetToPrimaryModel = () => {
  if (currentModelIndex > 0) {
    currentModelIndex = 0;
    currentModel = geminiModel;
    console.log(`✓ Reset to primary model: ${MODEL_NAMES[GEMINI_MODELS[0]]}`);
  }
};

/**
 * Get current model name being used
 */
export const getCurrentModel = (): string => {
  return GEMINI_MODELS[currentModelIndex];
};

/**
 * Get current model display name
 */
export const getCurrentModelName = (): string => {
  return MODEL_NAMES[getCurrentModel()];
};

/**
 * Retry helper with exponential backoff AND model fallback for rate-limited API calls
 * Automatically retries on 429 (overloaded) errors with increasing delays
 * Falls back to alternative models if primary model is rate-limited
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is429Error = errorMessage.includes('429') || 
                         errorMessage.includes('quota') || 
                         errorMessage.includes('GEMINI_DEVELOPER_OVERLOADED');

      // If rate-limited or quota exceeded and there are fallback models available, try switching
      if (is429Error && currentModelIndex < GEMINI_MODELS.length - 1) {
        const switched = await switchToNextModel();
        if (switched) {
          // Try again with new model
          attempt--; // Don't count this as a retry attempt
          continue;
        }
      }

      // On quota error with no fallback models, throw quota error
      if (errorMessage.includes('quota') && currentModelIndex >= GEMINI_MODELS.length - 1) {
        const quotaError = new Error('AI_QUOTA_EXCEEDED');
        (quotaError as any).originalError = error;
        throw quotaError;
      }

      if (!is429Error || attempt === maxRetries) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.warn(`API overloaded (429). Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

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
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      const result = await currentModel.generateContent({
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
  });
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
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      // ---------------------------------------------------------
      // DEEP METADATA EXTRACTION PROMPT FOR ARCHITECTURAL PLANS
      // This prompt identifies construction specifications from visual cues
      // ---------------------------------------------------------
      const defaultPrompt = `
        Act as an expert Draughtsman and Quantity Surveyor. Analyze this floor plan for detailed construction specifications.
        
        The image contains specific text labels for Room Names (e.g., "Bedroom 1", "Kitchen") and Area measurements (e.g., "137 sq ft", "10'5"").
        
        Your expert tasks:
        1. OCR EXTRACTION: Identify every text label inside a room. Extract the Room Name and the explicit Area labeled (if present).
        2. DIMENSION ESTIMATION: 
           - If dimensions are written on the walls (e.g. 12' x 10'), use them.
           - If area is written (e.g., "100 sq ft"), estimate a logical Length and Width that equals that area (e.g., L=10, W=10).
           - If no text exists, visually estimate dimensions assuming standard door width is 3 feet.
        3. WALL CLASS DETECTION (CRITICAL): 
           - THICK LINES (bold/prominent): These are Load-Bearing walls. Mark these rooms with HIGH mainWallRatio (0.7-0.9).
           - THIN LINES (regular/light): These are Partition walls. Mark with HIGH partitionWallRatio (0.5-0.8).
           - Most rooms will have a MIX: mainWallRatio + partitionWallRatio should sum to ~1.0 for a realistic structure.
           - Example: A bedroom with 2 thick external walls and 2 thin partition walls = mainWallRatio: 0.6, partitionWallRatio: 0.4.
        4. OPENING PERCENTAGE (DOORS & WINDOWS):
           - Count visible windows and doors (include sliding doors, balcony doors, French doors).
           - Calculate: openingPercentage = (Total opening width / Perimeter) * 100.
           - Typical ranges: 15% (minimal), 25% (standard), 35% (open plan).
           - Living rooms and bedrooms often have 20-30% openings; bathrooms 5-15%.
        5. ROOM TYPE CLASSIFICATION:
           - "standard": Normal enclosed room (Bedroom, Living, Kitchen, etc.)
           - "balcony": Outdoor space with parapet. Use 3.5 ft height for calculations.
           - "wash_area": Bathroom, Toilet, Laundry (small, utility spaces).
        6. UNIT CONVERSION: Convert all dimensions to DECIMAL FEET (e.g., 10'6" becomes 10.5).
        7. OVERALL WALL COMPOSITION: After analyzing all rooms, calculate the overall percentages:
           - Average load-bearing wall percentage across the entire floor plan
           - Average partition wall percentage
           - Average opening percentage

        RETURN DATA STRUCTURE (Strict JSON, no markdown):
        {
          "summary": "Brief architectural summary (e.g., 3 Bedroom, 2 Bath with balcony, modern open-plan)",
          "totalArea": "Number (Sum of all room areas in sq ft)",
          "wallComposition": {
            "loadBearingPercentage": "Number 0-100 (overall % of load-bearing walls)",
            "partitionPercentage": "Number 0-100 (overall % of partition walls)",
            "openingPercentage": "Number 0-100 (overall % of wall area with openings)",
            "averageWallThickness": "Number in inches (weighted average, typically 6-9 inches)",
            "confidence": "Number 0-100 (confidence in analysis)"
          },
          "rooms": [
            {
              "id": "unique_room_id",
              "name": "String (e.g., Master Bedroom)",
              "length": "Number (Decimal Feet, e.g., 12.5)",
              "width": "Number (Decimal Feet, e.g., 10.0)",
              "area": "Number (Square Feet)",
              "roomType": "standard | balcony | wash_area",
              "wallMetadata": {
                "mainWallRatio": "Number 0.0-1.0 (proportion of Load-Bearing walls, e.g., 0.7)",
                "partitionWallRatio": "Number 0.0-1.0 (proportion of Partition walls, e.g., 0.3)"
              },
              "openingPercentage": "Number 0-100 (percentage of perimeter with windows/doors, e.g., 25)",
              "features": ["String (e.g., Walk-in Closet, En-suite, Sliding Door)"]
            }
          ]
        }
      `;

      const prompt = analysisPrompt || defaultPrompt;

      // Convert image URI to base64 if needed
      const imageBase64 = imageData.startsWith('data:') 
        ? imageData.split(',')[1] 
        : imageData;

      const result = await currentModel.generateContent({
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
  });
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
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      const result = await currentModel.generateContent({
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
  });
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
    if (!currentModel) {
      throw new Error('Gemini model not initialized. Check Firebase configuration.');
    }

    const result = await currentModel.generateContentStream({
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
  return retryWithBackoff(async () => {
    try {
      if (!geminiModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      const prompt = `Extract the following information from the provided content and return it as JSON:

Schema: ${schema}

Content:
${content}

IMPORTANT: Return ONLY valid JSON with no markdown code blocks, no formatting, and no extra text.`;

      const result = await currentModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      let jsonText = response.text();
      
      // Robust JSON extraction: Clean the response with regex to handle various text-wrapped formats
      // (e.g., "Here is your JSON: {...}" or markdown code fences)
      jsonText = jsonText.trim();
      
      // Step 1: Remove markdown code blocks if present (e.g., ```json ... ```)
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Step 2: Extract JSON using regex - catches JSON between first { and last }
      // This handles cases where AI returns explanatory text like "Here is your JSON: {...}"
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      return jsonText;
    } catch (error) {
      console.error('Error extracting structured data from Gemini:', error);
      throw error;
    }
  });
};

/**
 * Get AI Recommendations for Materials based on project context
 * Works for any category (Wall, Foundation, Flooring, Roofing, etc.)
 * Returns recommended materials with engineering advice
 * 
 * @param category - Component category (e.g., "Wall", "Foundation", "Flooring")
 * @param tier - Budget tier ("Economy", "Standard", "Luxury")
 * @param area - Built-up area in square feet
 * @param availableMaterials - Array of all available materials
 * @returns Promise with recommendations array and engineering advice
 */
export const getComponentRecommendation = async (
  category: string,
  tier: string,
  area: number,
  availableMaterials: any[]
) => {
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      // Simplify material list for AI to reduce token cost
      // Only include materials from the specified category
      const relevantMaterials = availableMaterials.filter(m => m.category === category);
      
      // Create STRICT separate lists by type so AI cannot confuse cement with sand
      const cementMaterials = relevantMaterials.filter(m => m.type === 'Cement');
      const sandMaterials = relevantMaterials.filter(m => m.type === 'Sand');

      const materialsSummary = relevantMaterials
        .map(m => `ID: ${m.id}, Name: ${m.name}, Price: ₹${m.pricePerUnit}, Type: ${m.type}, SubCategory: ${m.subCategory || 'N/A'}, Dimensions: ${m.dimensions || 'N/A'}`)
        .join("\n");

      const cementSummary = cementMaterials.length > 0 
        ? `\n\n=== CEMENT ONLY (type:Cement) - Use ONLY these IDs for the Cement recommendation ===\n${cementMaterials.map(m => `ID: ${m.id}, Name: ${m.name}, Price: ₹${m.pricePerUnit} per ${m.unit}`).join('\n')}\n=== END CEMENT LIST ===`
        : '';

      const sandSummary = sandMaterials.length > 0
        ? `\n\n=== SAND ONLY (type:Sand) - Use ONLY these IDs for the Sand recommendation ===\n${sandMaterials.map(m => `ID: ${m.id}, Name: ${m.name}, Price: ₹${m.pricePerUnit} per ${m.unit}`).join('\n')}\n=== END SAND LIST ===`
        : '';

      // Enhanced prompt for Economy tier with cost-per-unit and finished-wall-cost optimization
      const prompt = `
Act as a Civil Engineer and Construction Expert. Recommend the best materials from the list below for ${category} construction.

PROJECT CONTEXT:
- Category: ${category}
- Budget Tier: ${tier}
- Built-up Area: ${area} sq ft
- Tier Preference: ${tier === 'Economy' ? 'MOST COST-EFFECTIVE with emphasis on TOTAL PROJECT COST, not just price per unit. Larger blocks/bricks = fewer joints = less mortar = lower total cost even if per-unit price is higher' : tier === 'Standard' ? 'Balanced quality and cost' : 'Premium quality materials'}

AVAILABLE MATERIALS:
${materialsSummary}
${cementSummary}
${sandSummary}

EXPERT RECOMMENDATION RULES:
1. For "Wall" category: Recommend BOTH Load-Bearing AND Partition bricks + Cement + Sand
2. CEMENT RULE: The "Cement" recommendation ID MUST come ONLY from the "CEMENT ONLY" list above. NEVER use a Sand material ID for Cement.
3. SAND RULE: The "Sand" recommendation ID MUST come ONLY from the "SAND ONLY" list above. NEVER use a Cement material ID for Sand.
4. For Economy tier ONLY:
   - PRIORITIZE "Finished Wall Cost" = (quantity needed) × (price per unit)
   - Recommend AAC blocks (24x3" or similar) over traditional clay bricks for partitions because:
     * Larger size = fewer bricks needed per unit area
     * 80% less mortar required due to fewer joints
     * Faster construction (less labor cost)
     * Example: 24"×3" AAC block covers MORE area than 9"×3" clay brick with 80% less cement/sand
   - Recommend Fly Ash bricks over Red Clay for load-bearing sections (15-20% cost savings, same strength)
   - NOTE: A ₹45 per-unit AAC block is CHEAPER in total project cost than ₹8 per-unit clay brick because you need 5x fewer blocks
5. For Standard/Luxury: Focus on quality, then cost
6. Match materials to the specified ${tier} budget tier
7. Consider the ${area} sq ft area and wall requirements in your recommendations
8. Prioritize durability and professional construction practices
9. For Cement & Sand in Economy tier, recommend leaner mixes (1:6 for partitions, 1:4 for load-bearing)

Return ONLY valid JSON (no markdown, no explanatory text). CRITICAL: The "id" field MUST be an actual material ID from the lists, never a description or placeholder:
{
  "recommendations": [
    {
      "type": "Load-Bearing Brick",
      "id": "material_id_here",
      "reason": "Brief explanation why this material optimizes cost or quality for ${tier}"
    },
    {
      "type": "Partition Brick",
      "id": "material_id_here",
      "reason": "Brief explanation - emphasize cost-per-sqft or total project savings if Economy"
    },
    {
      "type": "Cement",
      "id": "material_id_here",
      "reason": "Brief explanation - MUST be from available cement list"
    },
    {
      "type": "Sand",
      "id": "material_id_here",
      "reason": "Brief explanation - MUST be from available sand list"
    }
  ],
  "advice": "${tier === 'Economy' ? 'One cost-saving engineering tip for Economy tier wall construction (e.g., 80% less mortar with AAC blocks, Fly Ash savings, leaner mixes)' : 'One practical engineering tip for ' + tier + ' tier wall construction'}",
  "costSavingsRecommendation": "${tier === 'Economy' ? 'Explain why recommended materials save money (e.g., Fly Ash saves 20% vs clay, AAC uses 80% less mortar)' : 'Cost-effectiveness note for ' + tier + ' tier'}",
  "estimatedCost": "Brief cost estimate note for ${area} sq ft area"
}
      `;

      const result = await currentModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      const responseText = response.text();
      
      // Robust JSON extraction
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsedResult = JSON.parse(jsonText);
      return parsedResult;
    } catch (error) {
      console.error('Error getting component recommendations from Gemini:', error);
      throw error;
    }
  });
};

// ─── Wall Perspectives ───────────────────────────────────────────────────────

/**
 * Represents one AI-generated material perspective for the Wall component.
 * Each perspective is a fully self-consistent "approach" within a given tier.
 */
export interface WallPerspective {
  id: string;               // 'A', 'B', 'C'
  title: string;            // e.g. "Lowest Cost"
  subtitle: string;         // e.g. "Functional & budget-friendly"
  description: string;      // 2 sentences about the approach
  tags: string[];           // e.g. ["Budget-Friendly", "Fast Build"]
  finishType: 'Plastered' | 'Exposed';
  loadBearingBrickId: string;
  partitionBrickId: string;
  cementId: string;
  sandId: string;
  reasoning: string;        // engineering reasoning
}

/**
 * Generate 2–3 distinct Wall material perspectives for a given tier.
 * The AI automatically decides the "intent" differences (cost-focused,
 * aesthetics-focused, balanced, etc.) — the user never has to name them.
 */
export const getWallPerspectives = async (
  tier: string,
  area: number,
  availableMaterials: any[]
): Promise<WallPerspective[]> => {
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      const wallMaterials = availableMaterials.filter(m => m.category === 'Wall');
      const cementMaterials = availableMaterials.filter(m => m.type === 'Cement');
      const sandMaterials = availableMaterials.filter(m => m.type === 'Sand');

      const wallSummary = wallMaterials
        .map(m => `ID:${m.id} | ${m.name} | ₹${m.pricePerUnit}/${m.unit} | SubCat:${m.subCategory || 'N/A'} | Dim:${m.dimensions || 'N/A'}`)
        .join('\n');

      const cementSummary = cementMaterials
        .map(m => `ID:${m.id} | ${m.name} | ₹${m.pricePerUnit}/${m.unit}`)
        .join('\n');

      const sandSummary = sandMaterials
        .map(m => `ID:${m.id} | ${m.name} | ₹${m.pricePerUnit}/${m.unit}`)
        .join('\n');

      const tierGuidance: Record<string, string> = {
        Economy: `
Generate 3 perspectives that are genuinely different within the Economy budget:
- Option A "Lowest Cost Functional": prioritise minimum ₹ per sqft. Use traditional clay bricks or CHB. Plastered finish.
- Option B "Economy Aesthetic": use AAC blocks for partition (fewer joints = less mortar = better surface). Exposed or Plastered finish that looks better.
- Option C "Fast Build Economy": fly ash bricks (load-bearing) + thin-set AAC (partition). Faster labour, still economical.`,
        Standard: `
Generate 3 perspectives within Standard budget:
- Option A "Balanced Value": fly ash bricks + AAC partition, plaster finish.
- Option B "Structural Focus": high-strength bricks for load-bearing, AAC partition, plaster.
- Option C "Modern Aesthetic": AAC throughout, clean finish, exposed feature option.`,
        Luxury: `
Generate 3 perspectives within Luxury budget:
- Option A "Premium Traditional": top-grade clay or facing bricks, premium plaster.
- Option B "Modern Luxury": AAC blocks + stone accent panels, exposed finish.
- Option C "Sustainable Luxury": eco-friendly blocks, minimal mortar joints, exposed finish.`,
      };

      const prompt = `
Act as a Senior Civil Engineer with 20+ years of residential construction experience.
For a ${tier} tier project (${area} sq ft), generate 3 distinct Wall construction perspectives.
Each perspective is a DIFFERENT approach within the same tier budget.

${tierGuidance[tier] || tierGuidance['Standard']}

AVAILABLE WALL MATERIALS (use only these IDs):
=== WALL (load-bearing subCat "Load Bearing", partition subCat "Partition Wall"/"Partition"/"Non-Load Bearing") ===
${wallSummary}

=== CEMENT (use only these IDs for cementId) ===
${cementSummary}

=== SAND (use only these IDs for sandId) ===
${sandSummary}

RULES:
1. Every ID MUST be an actual ID from the lists above — never a placeholder or made-up string.
2. loadBearingBrickId MUST have subCategory "Load Bearing".
3. partitionBrickId MUST have subCategory "Partition Wall", "Partition", or "Non-Load Bearing".
4. cementId MUST come from the CEMENT list. sandId MUST come from the SAND list.
5. title ≤ 4 words. subtitle ≤ 8 words. description = 1–2 sentences.
6. tags = 2–3 concise labels.
7. finishType must be exactly "Plastered" or "Exposed".
8. reasoning = 1 sentence of engineering justification.

Return ONLY valid JSON (no markdown, no explanation):
{
  "perspectives": [
    {
      "id": "A",
      "title": "...",
      "subtitle": "...",
      "description": "...",
      "tags": ["...", "..."],
      "finishType": "Plastered",
      "loadBearingBrickId": "real_id_here",
      "partitionBrickId": "real_id_here",
      "cementId": "real_id_here",
      "sandId": "real_id_here",
      "reasoning": "..."
    },
    { "id": "B", ... },
    { "id": "C", ... }
  ]
}
      `;

      const result = await currentModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const responseText = result.response.text();
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];

      const parsed = JSON.parse(jsonText);
      const perspectives: WallPerspective[] = parsed.perspectives || [];

      // Validate each perspective has real material IDs
      const allIds = new Set(availableMaterials.map(m => m.id));
      const valid = perspectives.filter(p =>
        allIds.has(p.loadBearingBrickId) &&
        allIds.has(p.partitionBrickId) &&
        allIds.has(p.cementId) &&
        allIds.has(p.sandId)
      );

      if (valid.length === 0) {
        throw new Error('AI returned no valid perspectives with real material IDs');
      }

      return valid;
    } catch (error) {
      console.error('Error generating wall perspectives:', error);
      throw error;
    }
  });
};

// ─── Foundation Perspectives ─────────────────────────────────────────────────

export interface FoundationPerspective {
  id: string;          // 'A', 'B', 'C'
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  cementId: string;
  steelId: string;
  sandId: string;
  reasoning: string;
}

export const getFoundationPerspectives = async (
  tier: string,
  area: number,
  availableMaterials: any[]
): Promise<FoundationPerspective[]> => {
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) throw new Error('Gemini model not initialized.');

      const cementMaterials = availableMaterials.filter(m => m.type === 'Cement');
      const steelMaterials  = availableMaterials.filter(m => m.type === 'Steel (TMT Bar)' || m.type === 'Steel' || m.type === 'TMT Bar');
      const sandMaterials   = availableMaterials.filter(m => m.type === 'Sand');

      const fmt = (arr: any[]) => arr.map(m => `ID:${m.id} | ${m.name} | ₹${m.pricePerUnit}/${m.unit}${m.grade ? ` | Grade:${m.grade}` : ''}`).join('\n');

      const tierGuidance: Record<string, string> = {
        Economy: `Option A: lowest cost cement (OPC 43) + Fe415 steel + coarse sand. Option B: OPC 43 + Fe415 + river sand. Option C: PPC cement + Fe415 + M-sand.`,
        Standard: `Option A: OPC 53 + Fe500 + river sand. Option B: PPC + Fe500D + M-sand. Option C: OPC 53 + Fe550 + coarse sand.`,
        Luxury: `Option A: premium OPC 53 + Fe550D + washed river sand. Option B: PPC premium + Fe550D + M-sand. Option C: OPC 53 ultra + Fe600 + premium sand.`,
      };

      const prompt = `
Act as a Senior Structural Engineer. For a ${tier} tier foundation (${area} sq ft), generate 3 distinct material perspectives.
Each selects a specific cement, steel and sand brand from the lists below.

${tierGuidance[tier] || tierGuidance['Standard']}

=== CEMENT ===
${fmt(cementMaterials)}

=== STEEL (TMT Bar) ===
${fmt(steelMaterials)}

=== SAND ===
${fmt(sandMaterials)}

RULES:
1. Every ID must be an actual ID from the lists — no placeholders.
2. title ≤ 4 words. subtitle ≤ 8 words. description = 1 sentence about structural focus.
3. tags = 2–3 concise labels. reasoning = 1 sentence.

Return ONLY valid JSON:
{
  "perspectives": [
    { "id": "A", "title": "...", "subtitle": "...", "description": "...", "tags": ["..."], "cementId": "real_id", "steelId": "real_id", "sandId": "real_id", "reasoning": "..." },
    { "id": "B", ... },
    { "id": "C", ... }
  ]
}`;

      const result = await currentModel.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      let jsonText = result.response.text().trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) jsonText = match[0];
      const parsed = JSON.parse(jsonText);
      const perspectives: FoundationPerspective[] = parsed.perspectives || [];
      const allIds = new Set(availableMaterials.map(m => m.id));
      const valid = perspectives.filter(p => allIds.has(p.cementId) && allIds.has(p.steelId) && allIds.has(p.sandId));
      if (valid.length === 0) throw new Error('AI returned no valid foundation perspectives');
      return valid;
    } catch (error) {
      console.error('Error generating foundation perspectives:', error);
      throw error;
    }
  });
};

// ─── Roofing Perspectives ─────────────────────────────────────────────────────

export interface RoofingPerspective {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  materialSelections: Record<string, string>; // materialType -> materialId
  reasoning: string;
}

export const getRoofingPerspectives = async (
  tier: string,
  area: number,
  availableMaterials: any[]
): Promise<RoofingPerspective[]> => {
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) throw new Error('Gemini model not initialized.');

      const roofingMats = availableMaterials.filter(m => ['Roofing', 'Foundation', 'Structural'].includes(m.category));
      const byType: Record<string, any[]> = {};
      roofingMats.forEach(m => {
        if (!byType[m.type]) byType[m.type] = [];
        byType[m.type].push(m);
      });

      const matSummary = Object.entries(byType)
        .map(([type, items]) =>
          `=== ${type} ===\n` + items.map(m => `ID:${m.id} | ${m.name} | ₹${m.pricePerUnit}/${m.unit}`).join('\n')
        ).join('\n\n');

      const tierGuidance: Record<string, string> = {
        Economy: `Option A: basic cement materials, standard grade. Option B: cost-efficient combo. Option C: fastest build option.`,
        Standard: `Option A: balanced quality. Option B: durability focus. Option C: thermal comfort focus.`,
        Luxury: `Option A: premium materials across all types. Option B: modern/aesthetic focus. Option C: sustainable/high-performance.`,
      };

      const types = Object.keys(byType);

      const prompt = `
Act as a Senior Civil Engineer. For a ${tier} tier RCC roof slab (${area} sq ft), generate 3 distinct material perspectives.
Each selects ONE material per type from the lists below.

${tierGuidance[tier] || tierGuidance['Standard']}

Available material types: ${types.join(', ')}

${matSummary}

RULES:
1. Every ID must be an actual ID from the lists.
2. materialSelections must contain exactly these keys: ${JSON.stringify(types)}
3. title ≤ 4 words. subtitle ≤ 8 words. description = 1 sentence on structural/aesthetic focus.
4. tags = 2–3 labels. reasoning = 1 sentence.

Return ONLY valid JSON:
{
  "perspectives": [
    { "id": "A", "title": "...", "subtitle": "...", "description": "...", "tags": ["..."], "materialSelections": ${JSON.stringify(Object.fromEntries(types.map(t => [t, 'real_id'])))}, "reasoning": "..." },
    { "id": "B", ... },
    { "id": "C", ... }
  ]
}`;

      const result = await currentModel.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      let jsonText = result.response.text().trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      const match2 = jsonText.match(/\{[\s\S]*\}/);
      if (match2) jsonText = match2[0];
      const parsed = JSON.parse(jsonText);
      const perspectives: RoofingPerspective[] = parsed.perspectives || [];
      const allIds = new Set(availableMaterials.map(m => m.id));
      const valid = perspectives.filter(p =>
        p.materialSelections && Object.values(p.materialSelections).every(id => allIds.has(id))
      );
      if (valid.length === 0) throw new Error('AI returned no valid roofing perspectives');
      return valid;
    } catch (error) {
      console.error('Error generating roofing perspectives:', error);
      throw error;
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect Wall Composition from Floor Plan Data
 * Analyzes room dimensions and layout to determine wall type proportions
 * Returns analyzed Load-Bearing, Partition, and Opening percentages
 */
export const detectWallComposition = async (
  rooms: any[],
  totalArea: number
) => {
  return retryWithBackoff(async () => {
    try {
      if (!currentModel) {
        throw new Error('Gemini model not initialized. Check Firebase configuration.');
      }

      console.log('🔍 Detecting wall composition for:', { 
        roomCount: rooms.length, 
        totalArea,
        sampleRoom: rooms[0] 
      });

      // Prepare room data summary for analysis
      const roomsSummary = rooms
        .map((r: any, i: number) => {
          const roomName = r.name || `Room ${i + 1}`;
          const roomType = r.roomType || 'standard';
          const area = parseFloat(r.area || 0);
          const length = parseFloat(r.length || 0);
          const width = parseFloat(r.width || 0);
          const openings = r.openingPercentage ? `${r.openingPercentage}%` : 'unknown';
          const wallMeta = r.wallMetadata ? `(LB: ${(r.wallMetadata.mainWallRatio * 100).toFixed(0)}%, P: ${(r.wallMetadata.partitionWallRatio * 100).toFixed(0)}%)` : '';
          
          return `${roomName} [${roomType}]: ${area.toFixed(1)} sqft (${length.toFixed(1)}' × ${width.toFixed(1)}'), Openings: ${openings} ${wallMeta}`;
        })
        .join('\n');

      const prompt = `
Act as a Structural Engineer specializing in residential construction cost estimation.

FLOOR PLAN DATA:
\`\`\`
${roomsSummary}
\`\`\`
Total Built-up Area: ${totalArea} sq.ft
Number of Rooms: ${rooms.length}

TASK: Analyze the floor plan and determine the overall wall composition percentages for construction cost estimation.

ANALYSIS GUIDELINES:
1. **Load-Bearing Walls (9" thick):**
   - All exterior perimeter walls
   - Walls separating major living spaces (bedroom-to-bedroom, bedroom-to-living room)
   - Walls running perpendicular to floor joists/beams
   - Typical range: 50-70% of total wall area

2. **Partition Walls (4.5" thick):**
   - Interior walls within rooms (closet dividers, bathroom partitions)
   - Non-structural divider walls
   - Walls parallel to structural beams
   - Typical range: 30-50% of total wall area

3. **Door/Window Openings:**
   - Consider room types: Bedrooms (20-30%), Living areas (25-35%), Bathrooms (10-20%), Corridors (10-15%)
   - If room-specific opening data exists, calculate weighted average
   - Otherwise estimate based on room count and types

CRITICAL: Ensure loadBearingPercentage + partitionPercentage = 100

Return ONLY valid JSON (no markdown, no code blocks, no explanation):
{
  "loadBearingPercentage": number,
  "partitionPercentage": number,
  "openingPercentage": number,
  "confidence": number,
  "analysis": "Brief reasoning (1-2 sentences)"
}
      `;

      const response = await currentModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const result = response.response;
      const responseText = result.text();
      
      console.log('🤖 AI Response for wall composition:', responseText.substring(0, 200));
      
      // Robust JSON extraction
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const wallComposition = JSON.parse(jsonText);
      console.log('✅ Parsed wall composition:', wallComposition);
      return wallComposition;
    } catch (error) {
      console.error('Error detecting wall composition from Gemini:', error);
      throw error;
    }
  });
};
