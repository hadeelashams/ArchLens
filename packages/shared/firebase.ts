import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  initializeAuth,
  getAuth,
  browserLocalPersistence
} from 'firebase/auth';
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

export { app, auth, db };
export default app;