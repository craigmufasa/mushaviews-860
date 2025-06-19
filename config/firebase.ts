import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

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

// Initialize Auth with proper typing
let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // For React Native, use initializeAuth
    auth = initializeAuth(app);
  }
} catch (error) {
  // If auth is already initialized, get the existing instance
  auth = getAuth(app);
}

// Initialize Firestore
const db = getFirestore(app);

export { auth, db };
export default app;