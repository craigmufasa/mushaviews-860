import { Platform } from 'react-native';

// For React Native, we use @react-native-firebase
// For web, we use the web Firebase SDK
let firebaseApp: any = null;
let auth: any = null;
let firestore: any = null;
let storage: any = null;

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4JfWvsw3cem_8XThLOXa76WqTNG2BapY",
  authDomain: "musha-views.firebaseapp.com",
  projectId: "musha-views",
  storageBucket: "musha-views.appspot.com",
  messagingSenderId: "9639081594",
  appId: "1:9639081594:web:fde69a60cf2ed0d5702dc3",
  measurementId: "G-RRFG7DKZVM"
};

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initializeFirebase = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  try {
    console.log('Initializing Firebase for platform:', Platform.OS);

    if (Platform.OS === 'web') {
      // Web Firebase SDK
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getAuth } = await import('firebase/auth');
      const { getFirestore } = await import('firebase/firestore');
      const { getStorage } = await import('firebase/storage');

      if (getApps().length === 0) {
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        firebaseApp = getApp();
      }

      auth = getAuth(firebaseApp);
      firestore = getFirestore(firebaseApp);
      storage = getStorage(firebaseApp);
    } else {
      // React Native Firebase
      const rnFirebaseApp = await import('@react-native-firebase/app');
      const rnAuth = await import('@react-native-firebase/auth');
      const rnFirestore = await import('@react-native-firebase/firestore');
      const rnStorage = await import('@react-native-firebase/storage');

      // Check if Firebase is already initialized
      if (rnFirebaseApp.default().apps.length === 0) {
        firebaseApp = await rnFirebaseApp.default().initializeApp(firebaseConfig);
      } else {
        firebaseApp = rnFirebaseApp.default();
      }

      auth = rnAuth.default();
      firestore = rnFirestore.default();
      storage = rnStorage.default();
    }

    isInitialized = true;
    console.log('Firebase initialized successfully for', Platform.OS);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    isInitialized = false;
    throw error;
  }
};

export const getFirebaseInitialization = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = initializeFirebase();
  }
  return initializationPromise;
};

export const getFirebaseApp = async () => {
  await getFirebaseInitialization();
  if (!firebaseApp) {
    throw new Error('Firebase app not initialized');
  }
  return firebaseApp;
};

export const getFirebaseAuth = async () => {
  await getFirebaseInitialization();
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }
  return auth;
};

export const getFirebaseDb = async () => {
  await getFirebaseInitialization();
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }
  return firestore;
};

export const getFirebaseStorage = async () => {
  await getFirebaseInitialization();
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }
  return storage;
};

export const isFirebaseInitialized = (): boolean => {
  return isInitialized;
};

export const isDemoMode = false;

export const getFirebaseConfig = () => ({
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  isOfflineEnabled: true,
  platform: Platform.OS,
  isInitialized,
});

// Legacy exports for backward compatibility
export { firebaseApp as app, firestore as db, storage, auth };