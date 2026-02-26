import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  initializeAuth,
  getAuth,
  browserLocalPersistence
} from 'firebase/auth';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';

// Only import AsyncStorage on React Native
let getReactNativePersistence: any = null;
let ReactNativeAsyncStorage: any = null;

if (Platform.OS !== 'web') {
  try {
    ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
    getReactNativePersistence = require('firebase/auth').getReactNativePersistence;
  } catch (e) {
    console.warn('AsyncStorage not available, auth state will not persist');
  }
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate Firebase config
const isConfigValid = Object.values(firebaseConfig).every(val => val);

if (!isConfigValid) {
  console.warn('⚠️ Firebase config is incomplete. Check your .env file.');
}

// 1. Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Auth
let auth: any;
try {
  if (Platform.OS === 'web') {
    // Web uses browser persistence
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  } else {
    // React Native with AsyncStorage persistence
    if (getReactNativePersistence && ReactNativeAsyncStorage) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
      });
    } else {
      // Fallback if AsyncStorage not available
      auth = getAuth(app);
    }
  }
} catch (error: any) {
  console.error('Auth initialization error:', error);
  auth = getAuth(app);
}

// 3. Initialize Firestore
const db = getFirestore(app);

// Get AI backend preference from environment
const AI_BACKEND = (process.env.EXPO_PUBLIC_AI_BACKEND || 'auto').toLowerCase() as 'firebase' | 'genai' | 'auto';

if (!['firebase', 'genai', 'auto'].includes(AI_BACKEND)) {
  console.warn(`⚠️ Invalid AI_BACKEND value: ${process.env.EXPO_PUBLIC_AI_BACKEND}. Using 'auto'.`);
}

// 4. Initialize Gemini AI with Model Fallback Strategy
let ai: any = null;
let geminiModel: any = null;
let directGeminiAI: GoogleGenAI | null = null;

// Firebase models - only Gemini models, Gemma not supported by Firebase
const FIREBASE_MODELS = [
  'gemini-2.5-flash',          // Primary: Best balance of speed and quality
  'gemini-flash-latest',       // Fallback: Stable latest
  'gemini-3-flash-preview',    // Fallback: Latest with extended thinking
  'gemini-2.5-flash-lite',     // Fallback: Lite version for higher rate limits
];

// Direct Google Gen AI models - supports Gemini AND Gemma
const GENAI_MODELS = [          // Fallback: Gemma model for variety
  'gemini-2.5-flash',          // Primary: Best balance
];

// Use appropriate model list based on backend
const GEMINI_MODELS = AI_BACKEND === 'genai' ? GENAI_MODELS : FIREBASE_MODELS;

// Map of model names to display names
const MODEL_NAMES: Record<string, string> = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-flash-latest': 'Gemini Flash Latest',
  'gemini-3-flash-preview': 'Gemini 3.0 Flash Preview',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemma-3-27b': 'Gemma 3 27B',
};

/**
 * Create a generative model with the specified configuration
 */
const createGeminiModel = (aiInstance: any, modelName: string) => {
  return getGenerativeModel(aiInstance, {
    model: modelName,
    generationConfig: {
      thinkingConfig: {
        thinkingBudget: 0,  // Disable extended thinking
      },
    } as any,  // Type assertion for extended generation config
  });
};

/**
 * Initialize Firebase Gemini AI (Firebase backend)
 * Only initialized in 'firebase' or 'auto' modes
 * In 'genai' exclusive mode, skipped to use only Direct Google Gen AI
 */
try {
  if (AI_BACKEND !== 'genai') {
    ai = getAI(app, { backend: new GoogleAIBackend() });
    geminiModel = createGeminiModel(ai, GEMINI_MODELS[0]);
    
    const modeLabel = AI_BACKEND === 'firebase' ? 'EXCLUSIVE' : 'PRIMARY';
    console.log(`✓ Firebase Gemini AI initialized [${modeLabel}] with ${MODEL_NAMES[GEMINI_MODELS[0]]}`);
  }
} catch (error) {
  console.warn('Firebase Gemini AI initialization warning:', error);
}

/**
 * Initialize Direct Google Gen AI SDK (for higher rate limits and as fallback)
 * In 'genai' mode: Exclusive backend with Gemma support
 * In 'auto' mode: Fallback backend when Firebase quota exceeded
 * Not used in 'firebase' exclusive mode
 */
try {
  if (AI_BACKEND !== 'firebase') {
    const genaiApiKey = process.env.EXPO_PUBLIC_GENAI_API_KEY;
    
    if (genaiApiKey) {
      directGeminiAI = new GoogleGenAI({ apiKey: genaiApiKey });
      const modeLabel = AI_BACKEND === 'genai' ? 'EXCLUSIVE' : 'FALLBACK';
      console.log(`✓ Direct Google Gen AI SDK initialized [${modeLabel}] (supports Gemma + higher rate limits)`);
    } else {
      console.warn('⚠️ EXPO_PUBLIC_GENAI_API_KEY not found. Direct Gen AI SDK will not be available.');
      if (AI_BACKEND === 'genai') {
        console.error('ERROR: AI_BACKEND is set to "genai" but EXPO_PUBLIC_GENAI_API_KEY is missing!');
      }
    }
  }
} catch (error) {
  console.warn('Direct Google Gen AI initialization warning:', error);
}

export { app, auth, db, ai, geminiModel, directGeminiAI, GEMINI_MODELS, MODEL_NAMES, createGeminiModel, AI_BACKEND };
export default app;