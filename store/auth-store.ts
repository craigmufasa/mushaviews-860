import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/user';
import { auth, db } from '@/config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  hasSelectedRole: boolean;
  isInitialized: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  upgradeToSeller: () => Promise<boolean>;
  toggleSellerMode: () => Promise<boolean>;
  continueAsGuest: () => void;
  checkAuth: () => Promise<boolean>;
  setHasSelectedRole: (value: boolean) => void;
  clearError: () => void;
  initializeAuthListener: () => () => void;
  setInitialized: (value: boolean) => void;
}

// Helper to remove undefined values from objects before saving to Firestore
const removeUndefinedValues = (obj: any): any => {
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

// Helper to convert Firebase user to our User type
const convertFirebaseUser = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: firebaseUser.uid,
        name: userData.name || firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
        isSeller: userData.isSeller || false,
        sellerModeActive: userData.sellerModeActive || false,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        role: userData.role || 'buyer',
      };
    } else {
      // Create user document if it doesn't exist
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        isSeller: false,
        sellerModeActive: false,
        createdAt: new Date().toISOString(),
        role: 'buyer',
      };
      
      // Only add photoURL if it exists
      if (firebaseUser.photoURL) {
        newUser.photoURL = firebaseUser.photoURL;
      }
      
      // Remove undefined values before saving to Firestore
      const cleanUserData = removeUndefinedValues({
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      await setDoc(doc(db, 'users', firebaseUser.uid), cleanUserData);
      
      return newUser;
    }
  } catch (error) {
    console.error('Error converting Firebase user:', error);
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isGuest: false,
      hasSelectedRole: false,
      isInitialized: false,
      
      setUser: (user: User | null) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          isGuest: user?.id === 'guest'
        });
      },
      
      setInitialized: (value: boolean) => {
        set({ isInitialized: value });
      },
      
      login: async (email: string, password: string) => {
        if (!auth) {
          set({ error: 'Firebase not initialized' });
          return false;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          const userData = await convertFirebaseUser(firebaseUser);
          if (!userData) {
            throw new Error('Failed to load user profile');
          }
          
          set({ 
            user: userData, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
          });
          return true;
        } catch (error: any) {
          console.error('Login error:', error);
          let errorMessage = 'Failed to login';
          
          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage = 'No account found with this email address';
              break;
            case 'auth/wrong-password':
              errorMessage = 'Incorrect password';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Invalid email address';
              break;
            case 'auth/user-disabled':
              errorMessage = 'This account has been disabled';
              break;
            case 'auth/too-many-requests':
              errorMessage = 'Too many failed attempts. Please try again later';
              break;
            default:
              errorMessage = error.message || 'Failed to login';
          }
          
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          return false;
        }
      },
      
      signup: async (email: string, password: string, name: string) => {
        if (!auth) {
          set({ error: 'Firebase not initialized' });
          return false;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          // Update Firebase Auth profile
          await updateProfile(firebaseUser, {
            displayName: name
          });
          
          const newUser: User = {
            id: firebaseUser.uid,
            name,
            email: email.toLowerCase(),
            isSeller: false,
            sellerModeActive: false,
            createdAt: new Date().toISOString(),
            role: 'buyer',
          };
          
          // Save user profile to Firestore (remove undefined values)
          const cleanUserData = removeUndefinedValues({
            ...newUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          
          await setDoc(doc(db, 'users', firebaseUser.uid), cleanUserData);
          
          set({ 
            user: newUser, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
          });
          return true;
        } catch (error: any) {
          console.error('Signup error:', error);
          let errorMessage = 'Failed to sign up';
          
          switch (error.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'An account with this email already exists';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Invalid email address';
              break;
            case 'auth/weak-password':
              errorMessage = 'Password should be at least 6 characters';
              break;
            case 'auth/operation-not-allowed':
              errorMessage = 'Email/password accounts are not enabled';
              break;
            default:
              errorMessage = error.message || 'Failed to sign up';
          }
          
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          return false;
        }
      },
      
      logout: async () => {
        if (!auth) {
          set({ error: 'Firebase not initialized' });
          return;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          await signOut(auth);
          
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            isGuest: false,
            hasSelectedRole: false,
          });
        } catch (error: any) {
          console.error('Logout error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to logout' 
          });
        }
      },
      
      resetPassword: async (email: string) => {
        if (!auth) {
          set({ error: 'Firebase not initialized' });
          return false;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          await sendPasswordResetEmail(auth, email);
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          console.error('Reset password error:', error);
          let errorMessage = 'Failed to reset password';
          
          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage = 'No account found with this email address';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Invalid email address';
              break;
            default:
              errorMessage = error.message || 'Failed to reset password';
          }
          
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          return false;
        }
      },
      
      updateProfile: async (data: Partial<User>) => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          const { user } = state;
          if (!user || user.id === 'guest') {
            throw new Error('User not authenticated');
          }
          
          const updatedUser = { ...user, ...data };
          
          // Remove undefined values before updating Firestore
          const cleanData = removeUndefinedValues({
            ...data,
            updatedAt: serverTimestamp(),
          });
          
          // Update Firestore document
          await updateDoc(doc(db, 'users', user.id), cleanData);
          
          // Update Firebase Auth profile if name changed
          if (data.name && auth?.currentUser) {
            await updateProfile(auth.currentUser, {
              displayName: data.name
            });
          }
          
          set({ 
            user: updatedUser, 
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          console.error('Update profile error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to update profile' 
          });
          return false;
        }
      },
      
      upgradeToSeller: async () => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          const { user } = state;
          if (!user || user.id === 'guest') {
            throw new Error('User not authenticated');
          }
          
          const updatedUser = { 
            ...user, 
            isSeller: true, 
            sellerModeActive: true,
            role: 'both' as const
          };
          
          await updateDoc(doc(db, 'users', user.id), { 
            isSeller: true, 
            sellerModeActive: true,
            role: 'both',
            updatedAt: serverTimestamp(),
          });
          
          set({ 
            user: updatedUser, 
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          console.error('Upgrade to seller error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to upgrade to seller' 
          });
          return false;
        }
      },
      
      toggleSellerMode: async () => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          const { user } = state;
          if (!user || !user.isSeller || user.id === 'guest') {
            throw new Error('User is not a seller');
          }
          
          const updatedUser = { 
            ...user, 
            sellerModeActive: !user.sellerModeActive 
          };
          
          await updateDoc(doc(db, 'users', user.id), { 
            sellerModeActive: !user.sellerModeActive,
            updatedAt: serverTimestamp(),
          });
          
          set({ user: updatedUser, isLoading: false });
          return true;
        } catch (error: any) {
          console.error('Toggle seller mode error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to toggle seller mode' 
          });
          return false;
        }
      },
      
      continueAsGuest: () => {
        set({
          user: {
            id: 'guest',
            name: 'Guest',
            email: '',
            isSeller: false,
            sellerModeActive: false,
            createdAt: new Date().toISOString(),
            role: 'buyer',
          },
          isAuthenticated: true,
          isGuest: true,
          hasSelectedRole: false,
        });
      },
      
      checkAuth: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const state = get();
          if (state.user && !state.isGuest) {
            set({ isLoading: false });
            return true;
          } else {
            set({ 
              user: null, 
              isAuthenticated: false, 
              isLoading: false,
              isGuest: false,
              hasSelectedRole: false
            });
            return false;
          }
        } catch (error: any) {
          console.error('Check auth error:', error);
          set({ 
            user: null,
            isAuthenticated: false,
            isLoading: false, 
            error: error.message || 'Failed to check authentication',
            isGuest: false,
            hasSelectedRole: false
          });
          return false;
        }
      },
      
      initializeAuthListener: () => {
        if (!auth) {
          console.error('Firebase auth not initialized');
          return () => {};
        }
        
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          const state = get();
          
          if (firebaseUser) {
            try {
              const userData = await convertFirebaseUser(firebaseUser);
              if (userData) {
                set({ 
                  user: userData, 
                  isAuthenticated: true, 
                  isLoading: false,
                  isGuest: false,
                  isInitialized: true
                });
              }
            } catch (error) {
              console.error('Error in auth state change:', error);
              set({ 
                user: null, 
                isAuthenticated: false, 
                isLoading: false,
                isGuest: false,
                isInitialized: true
              });
            }
          } else if (!state.isGuest) {
            set({ 
              user: null, 
              isAuthenticated: false, 
              isLoading: false,
              isGuest: false,
              hasSelectedRole: false,
              isInitialized: true
            });
          } else {
            set({ isInitialized: true });
          }
        });
        
        return unsubscribe;
      },
      
      setHasSelectedRole: (value: boolean) => {
        set({ hasSelectedRole: value });
      },
      
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        hasSelectedRole: state.hasSelectedRole,
      }),
    }
  )
);