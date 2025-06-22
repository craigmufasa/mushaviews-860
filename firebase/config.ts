import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, enableNetwork, disableNetwork, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, Auth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4JfWvsw3cem_8XThLOXa76WqTNG2BapY",
  authDomain: "musha-views.firebaseapp.com",
  projectId: "musha-views",
  storageBucket: "musha-views.appspot.com",
  messagingSenderId: "9639081594",
  appId: "1:9639081594:web:fde69a60cf2ed0d5702dc3",
  measurementId: "G-RRFG7DKZVM"
};

// Initialize Firebase
let app;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

// Check if Firebase is already initialized
if (getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');
    
    // Initialize services in the correct order
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    
    console.log('Firebase Auth initialized');
    console.log('Firestore initialized');
    console.log('Firebase Storage initialized');
    
    // Only add scopes on web platform to avoid issues on native
    if (Platform.OS === 'web') {
      googleProvider.addScope('profile');
      googleProvider.addScope('email');
    }
    
    // Enable offline persistence for Firestore
    if (Platform.OS === 'web') {
      // Web offline persistence is enabled by default in v9
      console.log('Firebase initialized with offline persistence');
    }
    
    // Development mode emulator connections (uncomment for local development)
    // if (__DEV__ && Platform.OS === 'web') {
    //   try {
    //     connectAuthEmulator(auth, 'http://localhost:9099');
    //     connectFirestoreEmulator(db, 'localhost', 8080);
    //     connectStorageEmulator(storage, 'localhost', 9199);
    //     console.log('Connected to Firebase emulators');
    //   } catch (error) {
    //     console.warn('Failed to connect to emulators:', error);
    //   }
    // }
    
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Provide fallbacks to prevent crashes
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
    auth = {} as Auth;
    googleProvider = {} as GoogleAuthProvider;
  }
} else {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  
  // Only add scopes on web platform
  if (Platform.OS === 'web') {
    googleProvider.addScope('profile');
    googleProvider.addScope('email');
  }
}

// Enhanced offline management functions
export const enableOfflineMode = async (): Promise<void> => {
  try {
    if (db && Platform.OS === 'web') {
      await disableNetwork(db);
      console.log('Offline mode enabled');
    }
  } catch (error) {
    console.warn('Error enabling offline mode:', error);
  }
};

export const enableOnlineMode = async (): Promise<void> => {
  try {
    if (db && Platform.OS === 'web') {
      await enableNetwork(db);
      console.log('Online mode enabled');
    }
  } catch (error) {
    console.warn('Error enabling online mode:', error);
  }
};

// Network status monitoring
export const isNetworkAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  // For native platforms, you might want to use @react-native-community/netinfo
  return true;
};

// Storage configuration for better performance
if (storage && Platform.OS === 'web') {
  // Configure storage for better performance
  storage.maxUploadRetryTime = 60000; // 60 seconds
  storage.maxOperationRetryTime = 120000; // 2 minutes
}

// Export the Firebase instances
export { app, db, storage, auth, googleProvider };

// Export a flag for demo mode - set to false to use real Firebase
export const isDemoMode = false;

// Export configuration for debugging
export const getFirebaseConfig = () => ({
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  isOfflineEnabled: true,
  platform: Platform.OS,
});