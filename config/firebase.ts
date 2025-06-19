import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Configure auth persistence for React Native
if (Platform.OS !== 'web') {
  // Import AsyncStorage and configure persistence only for React Native
  import('@react-native-async-storage/async-storage').then((AsyncStorage) => {
    import('firebase/auth/react-native').then(({ getReactNativePersistence, initializeAuth }) => {
      try {
        // Only initialize if not already initialized
        if (!auth.app) {
          initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage.default)
          });
        }
      } catch (error: any) {
        // Auth might already be initialized, which is fine
        if (error.code !== 'auth/already-initialized') {
          console.warn('Firebase auth initialization warning:', error);
        }
      }
    }).catch((error) => {
      console.warn('Failed to configure Firebase auth persistence:', error);
    });
  }).catch((error) => {
    console.warn('Failed to import AsyncStorage:', error);
  });
}

export { auth, db, storage };
export default app;