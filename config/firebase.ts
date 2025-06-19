import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

export { auth, db, storage };
export default app;