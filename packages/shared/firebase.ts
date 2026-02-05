import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  initializeAuth,
  getAuth,
  browserLocalPersistence
} from 'firebase/auth';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
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

// 4. Initialize Gemini AI with Model Fallback Strategy
let ai: any = null;
let geminiModel: any = null;

// Model priority list - tries primary first, then falls back to secondaries
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',  // Primary: Lite version for higher rate limits
  'gemini-3-flash-preview',    // Fallback: Latest with extended thinking
  'gemini-flash-latest',       // Fallback: Stable latest
  'gemini-2.5-flash',          // Fallback: Previous stable
];

// Map of model names to display names
const MODEL_NAMES: Record<string, string> = {
  'gemini-3-flash-preview': 'Gemini 3.0 Flash Preview',
  'gemini-flash-latest': 'Gemini Flash Latest',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-flash-lite-latest': 'Gemini Flash Lite',
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
 * Initialize Gemini AI with primary model
 * Fallback models are used automatically on rate limit/overload errors
 */
try {
  // Initialize Firebase AI backend with Gemini
  ai = getAI(app, { backend: new GoogleAIBackend() });
  
  // Initialize primary model
  geminiModel = createGeminiModel(ai, GEMINI_MODELS[0]);
  
  console.log(`✓ Gemini AI initialized with ${MODEL_NAMES[GEMINI_MODELS[0]]}`);
} catch (error) {
  console.warn('Gemini AI initialization warning:', error);
}

export { app, auth, db, ai, geminiModel, GEMINI_MODELS, MODEL_NAMES, createGeminiModel };
export default app;