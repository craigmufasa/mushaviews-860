import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  error: string | null;
  isInitialized: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setGuest: (isGuest: boolean) => void;
  upgradeToSeller: () => Promise<boolean>;
  toggleSellerMode: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  initializeAuthListener: () => () => void;
  
  // Internal actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
}

const convertFirebaseUser = (firebaseUser: FirebaseUser, additionalData?: Partial<User>): User => {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    name: firebaseUser.displayName || additionalData?.name || '',
    photoURL: firebaseUser.photoURL || undefined,
    isSeller: additionalData?.isSeller || false,
    sellerModeActive: additionalData?.sellerModeActive || false,
    createdAt: additionalData?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isGuest: false,
      error: null,
      isInitialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          const user = convertFirebaseUser(firebaseUser, userData);
          
          set({ 
            user, 
            isLoading: false, 
            isGuest: false,
            error: null 
          });
          
          return true;
        } catch (error: any) {
          console.error('Login error:', error);
          let errorMessage = 'An error occurred during login';
          
          if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
          } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
          } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later';
          }
          
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          
          return false;
        }
      },

      signup: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          // Create user document in Firestore - only include defined values
          const userData: any = {
            name,
            email,
            isSeller: false,
            sellerModeActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Only include photoURL if it exists and is not null/undefined
          if (firebaseUser.photoURL) {
            userData.photoURL = firebaseUser.photoURL;
          }
          
          await setDoc(doc(db, 'users', firebaseUser.uid), userData);
          
          const user = convertFirebaseUser(firebaseUser, userData);
          
          set({ 
            user, 
            isLoading: false, 
            isGuest: false,
            error: null 
          });
          
          return true;
        } catch (error: any) {
          console.error('Signup error:', error);
          let errorMessage = 'An error occurred during signup';
          
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists';
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
          } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
          }
          
          set({ 
            isLoading: false, 
            error: errorMessage 
          });
          
          return false;
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ 
            user: null, 
            isGuest: false,
            error: null 
          });
        } catch (error) {
          console.error('Logout error:', error);
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setGuest: (isGuest: boolean) => {
        set({ isGuest, user: null });
      },

      upgradeToSeller: async () => {
        const { user } = get();
        if (!user) return false;
        
        set({ isLoading: true, error: null });
        
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            isSeller: true,
            sellerModeActive: true,
            updatedAt: new Date().toISOString(),
          });
          
          set({ 
            user: { 
              ...user, 
              isSeller: true, 
              sellerModeActive: true,
              updatedAt: new Date().toISOString(),
            },
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error('Error upgrading to seller:', error);
          set({ 
            isLoading: false, 
            error: 'Failed to upgrade account' 
          });
          return false;
        }
      },

      toggleSellerMode: async () => {
        const { user } = get();
        if (!user?.isSeller) return false;
        
        set({ isLoading: true, error: null });
        
        try {
          const newSellerModeActive = !user.sellerModeActive;
          const userRef = doc(db, 'users', user.id);
          
          await updateDoc(userRef, {
            sellerModeActive: newSellerModeActive,
            updatedAt: new Date().toISOString(),
          });
          
          set({ 
            user: { 
              ...user, 
              sellerModeActive: newSellerModeActive,
              updatedAt: new Date().toISOString(),
            },
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error('Error toggling seller mode:', error);
          set({ 
            isLoading: false, 
            error: 'Failed to switch modes' 
          });
          return false;
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        
        try {
          // Wait for auth state to be determined
          await new Promise<void>((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
              unsubscribe();
              resolve();
            });
          });
        } catch (error) {
          console.error('Error checking auth:', error);
        } finally {
          set({ isLoading: false, isInitialized: true });
        }
      },

      initializeAuthListener: () => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          const { setUser, setLoading } = get();
          
          if (firebaseUser) {
            try {
              // Get additional user data from Firestore
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              const userData = userDoc.exists() ? userDoc.data() : {};
              
              const user = convertFirebaseUser(firebaseUser, userData);
              setUser(user);
            } catch (error) {
              console.error('Error fetching user data:', error);
              setUser(null);
            }
          } else {
            setUser(null);
          }
          
          set({ isInitialized: true });
        });

        return unsubscribe;
      },

      // Internal actions
      setUser: (user: User | null) => set({ user }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error }),
      setInitialized: (isInitialized: boolean) => set({ isInitialized }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        user: state.user,
        isGuest: state.isGuest,
      }),
    }
  )
);