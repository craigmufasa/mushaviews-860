import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4JfWvsw3cem_8XThLOXa76WqTNG2BapY",
  authDomain: "musha-views.firebaseapp.com",
  projectId: "musha-views",
  storageBucket: "musha-views.firebasestorage.app",
  messagingSenderId: "9639081594",
  appId: "1:9639081594:web:fde69a60cf2ed0d5702dc3",
  measurementId: "G-RRFG7DKZVM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with proper persistence and typing
let auth: Auth;

try {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // For React Native, use initializeAuth with AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: AsyncStorage as any
    });
  }
} catch (error: any) {
  // If already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    // Fallback to getAuth if initializeAuth fails
    console.warn('Failed to initialize auth with persistence, falling back to getAuth:', error);
    auth = getAuth(app);
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

export { auth, db, storage };
export default app;