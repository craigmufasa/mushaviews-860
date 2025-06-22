import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { User } from '@/types/user';
import { Platform } from 'react-native';

// Helper to convert Firebase user to our User type
const convertFirebaseUser = async (firebaseUser: FirebaseUser): Promise<User> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    // Get additional user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    const userData = userDoc.data();

    return {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || userData?.name || 'User',
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || userData?.photoURL || undefined,
      isSeller: userData?.isSeller || false,
      sellerModeActive: userData?.sellerModeActive || false,
      createdAt: userData?.createdAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error converting Firebase user:', error);
    // Return basic user data if Firestore fails
    return {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'User',
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || undefined,
      isSeller: false,
      sellerModeActive: false,
      createdAt: new Date().toISOString(),
    };
  }
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<User> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return await convertFirebaseUser(userCredential.user);
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  if (Platform.OS !== 'web') {
    throw new Error('Google sign-in is currently only available on web');
  }

  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if this is a new user and create profile
    const user = await convertFirebaseUser(userCredential.user);
    
    // Create user document if it doesn't exist
    if (db) {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.id), {
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          isSeller: false,
          sellerModeActive: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    
    return user;
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw new Error(error.message || 'Failed to sign in with Google');
  }
};

// Sign up with email and password
export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  if (!auth || !db) {
    throw new Error('Firebase not initialized');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's display name
    await updateProfile(userCredential.user, { displayName: name });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      name,
      email,
      isSeller: false,
      sellerModeActive: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return await convertFirebaseUser(userCredential.user);
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to create account');
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

// Reset password
export const resetPassword = async (email: string): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw new Error(error.message || 'Failed to send reset email');
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  if (!auth) {
    return null;
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      if (firebaseUser) {
        try {
          const user = await convertFirebaseUser(firebaseUser);
          resolve(user);
        } catch (error) {
          console.error('Error converting Firebase user:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
};

// Update user profile with better error handling
export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<User> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    
    // Check if document exists first
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      // Create the document if it doesn't exist
      console.log('Creating new user document for:', userId);
      await setDoc(userDocRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Update existing document
      console.log('Updating existing user document for:', userId);
      await updateDoc(userDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    }
    
    // Get updated user data
    const updatedUserDoc = await getDoc(userDocRef);
    if (!updatedUserDoc.exists()) {
      throw new Error('User document not found after update');
    }
    
    const userData = updatedUserDoc.data();
    return {
      id: userId,
      name: userData.name,
      email: userData.email,
      photoURL: userData.photoURL || undefined,
      isSeller: userData.isSeller,
      sellerModeActive: userData.sellerModeActive,
      createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt,
    };
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
};

// Upgrade user to seller
export const upgradeToSeller = async (userId: string): Promise<User> => {
  return await updateUserProfile(userId, { 
    isSeller: true, 
    sellerModeActive: true 
  });
};