import { Platform } from 'react-native';
import { getFirebaseAuth, getFirebaseDb } from './config';
import { User } from '@/types/user';

// Helper to convert Firebase user to our User type
const convertFirebaseUser = async (firebaseUser: any): Promise<User> => {
  try {
    const db = await getFirebaseDb();
    
    let userData: any = {};
    
    if (Platform.OS === 'web') {
      // Web Firestore
      const { doc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      userData = userDoc.exists() ? userDoc.data() : {};
    } else {
      // React Native Firestore
      const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      userData = userDoc.exists ? userDoc.data() : {};
    }

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

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const auth = await getFirebaseAuth();
    let userCredential: any;

    if (Platform.OS === 'web') {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } else {
      userCredential = await auth.signInWithEmailAndPassword(email, password);
    }

    return await convertFirebaseUser(userCredential.user);
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

export const signInWithGoogle = async (): Promise<User> => {
  if (Platform.OS !== 'web') {
    throw new Error('Google sign-in is currently only available on web');
  }

  try {
    const auth = await getFirebaseAuth();
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    const userCredential = await signInWithPopup(auth, provider);
    const user = await convertFirebaseUser(userCredential.user);
    
    // Create user document if it doesn't exist
    try {
      const db = await getFirebaseDb();
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
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
    } catch (dbError) {
      console.error('Error creating user document:', dbError);
    }
    
    return user;
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw new Error(error.message || 'Failed to sign in with Google');
  }
};

export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  try {
    const auth = await getFirebaseAuth();
    const db = await getFirebaseDb();
    let userCredential: any;

    if (Platform.OS === 'web') {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name,
        email,
        isSeller: false,
        sellerModeActive: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: name });
      
      await db.collection('users').doc(userCredential.user.uid).set({
        name,
        email,
        isSeller: false,
        sellerModeActive: false,
        createdAt: db.FieldValue.serverTimestamp(),
        updatedAt: db.FieldValue.serverTimestamp(),
      });
    }
    
    return await convertFirebaseUser(userCredential.user);
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to create account');
  }
};

export const signOut = async (): Promise<void> => {
  try {
    const auth = await getFirebaseAuth();
    
    if (Platform.OS === 'web') {
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(auth);
    } else {
      await auth.signOut();
    }
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const auth = await getFirebaseAuth();
    
    if (Platform.OS === 'web') {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
    } else {
      await auth.sendPasswordResetEmail(email);
    }
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw new Error(error.message || 'Failed to send reset email');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const auth = await getFirebaseAuth();
    
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
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
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<User> => {
  try {
    const db = await getFirebaseDb();
    
    if (Platform.OS === 'web') {
      const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', userId);
      
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userDocRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      }
      
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
    } else {
      const userDocRef = db.collection('users').doc(userId);
      
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        await userDocRef.set({
          ...data,
          createdAt: db.FieldValue.serverTimestamp(),
          updatedAt: db.FieldValue.serverTimestamp(),
        });
      } else {
        await userDocRef.update({
          ...data,
          updatedAt: db.FieldValue.serverTimestamp(),
        });
      }
      
      const updatedUserDoc = await userDocRef.get();
      if (!updatedUserDoc.exists) {
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
    }
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
};

export const upgradeToSeller = async (userId: string): Promise<User> => {
  return await updateUserProfile(userId, { 
    isSeller: true, 
    sellerModeActive: true 
  });
};