import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '@/types/user';
import * as FirebaseAuth from '@/firebase/auth';
import { isFirebaseInitialized } from '@/firebase/config';
import { Platform } from 'react-native';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  hasSelectedRole: boolean;
  
  // Offline support
  isOfflineMode: boolean;
  lastSyncTime: number;
  pendingAuthActions: Array<{
    type: 'update_profile' | 'upgrade_to_seller';
    data: any;
    timestamp: number;
  }>;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  upgradeToSeller: () => Promise<boolean>;
  toggleSellerMode: () => Promise<boolean>;
  continueAsGuest: () => void;
  checkAuth: () => Promise<boolean>;
  setHasSelectedRole: (value: boolean) => void;
  
  // Offline management
  enableOfflineMode: () => void;
  enableOnlineMode: () => Promise<void>;
  syncOfflineAuthData: () => Promise<void>;
  
  clearError: () => void;
}

// Network detection
const isOnline = (): boolean => {
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  return true; // Assume online for native unless explicitly set
};

// Helper to check if Firebase is ready
const waitForFirebase = async (maxWaitTime = 10000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (!isFirebaseInitialized() && (Date.now() - startTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return isFirebaseInitialized();
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
      
      // Offline state
      isOfflineMode: false,
      lastSyncTime: 0,
      pendingAuthActions: [],
      
      setUser: (user: User | null) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          isGuest: user?.id === 'guest'
        });
      },
      
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Check if offline
          if (!isOnline()) {
            throw new Error('Cannot login while offline. Please check your internet connection.');
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          const user = await FirebaseAuth.signIn(email, password);
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
            lastSyncTime: Date.now(),
          });
          return true;
        } catch (error: any) {
          console.error('Login error in store:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to login' 
          });
          return false;
        }
      },
      
      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Only available on web for now
          if (Platform.OS !== 'web') {
            set({ 
              isLoading: false, 
              error: 'Google sign-in is currently only available on web' 
            });
            return false;
          }
          
          if (!isOnline()) {
            throw new Error('Cannot login while offline. Please check your internet connection.');
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          const user = await FirebaseAuth.signInWithGoogle();
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
            lastSyncTime: Date.now(),
          });
          return true;
        } catch (error: any) {
          console.error('Google login error in store:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to login with Google' 
          });
          return false;
        }
      },
      
      signup: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        try {
          if (!isOnline()) {
            throw new Error('Cannot sign up while offline. Please check your internet connection.');
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          const user = await FirebaseAuth.signUp(email, password, name);
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
            lastSyncTime: Date.now(),
          });
          return true;
        } catch (error: any) {
          console.error('Signup error in store:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sign up' 
          });
          return false;
        }
      },
      
      logout: async () => {
        set({ isLoading: true, error: null });
        
        try {
          if (isOnline() && isFirebaseInitialized()) {
            await FirebaseAuth.signOut();
          }
          
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            isGuest: false,
            hasSelectedRole: false,
            pendingAuthActions: [], // Clear pending actions on logout
          });
        } catch (error: any) {
          console.error('Logout error in store:', error);
          // Even if logout fails, clear local state
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            isGuest: false,
            hasSelectedRole: false,
            pendingAuthActions: [],
            error: error.message || 'Failed to logout' 
          });
        }
      },
      
      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          if (!isOnline()) {
            throw new Error('Cannot reset password while offline. Please check your internet connection.');
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          await FirebaseAuth.resetPassword(email);
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          console.error('Reset password error in store:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to reset password' 
          });
          return false;
        }
      },
      
      updateProfile: async (data: Partial<User>) => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          const { user } = state;
          if (!user) {
            throw new Error('User not authenticated');
          }
          
          // If offline, queue the action
          if (!isOnline() || state.isOfflineMode) {
            const pendingAction = {
              type: 'update_profile' as const,
              data,
              timestamp: Date.now(),
            };
            
            // Update local user data
            const updatedUser = { ...user, ...data };
            
            set({ 
              user: updatedUser,
              pendingAuthActions: [...state.pendingAuthActions, pendingAction],
              isLoading: false 
            });
            return true;
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          const updatedUser = await FirebaseAuth.updateUserProfile(user.id, data);
          set({ 
            user: updatedUser, 
            isLoading: false,
            lastSyncTime: Date.now(),
          });
          return true;
        } catch (error: any) {
          console.error('Update profile error in store:', error);
          
          // If it's a "document not found" error, try to create the user document
          if (error.message.includes('No document to update') || error.message.includes('not-found')) {
            try {
              const { user } = state;
              if (user) {
                // Create the user document first
                const updatedUser = await FirebaseAuth.updateUserProfile(user.id, {
                  name: user.name,
                  email: user.email,
                  photoURL: user.photoURL,
                  isSeller: user.isSeller,
                  sellerModeActive: user.sellerModeActive,
                  ...data
                });
                
                set({ 
                  user: updatedUser, 
                  isLoading: false,
                  lastSyncTime: Date.now(),
                });
                return true;
              }
            } catch (createError: any) {
              console.error('Error creating user document:', createError);
              set({ 
                isLoading: false, 
                error: createError.message || 'Failed to update profile' 
              });
              return false;
            }
          }
          
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
          if (!user) {
            throw new Error('User not authenticated');
          }
          
          // If offline, queue the action
          if (!isOnline() || state.isOfflineMode) {
            const pendingAction = {
              type: 'upgrade_to_seller' as const,
              data: {},
              timestamp: Date.now(),
            };
            
            // Update local user data
            const updatedUser = { 
              ...user, 
              isSeller: true, 
              sellerModeActive: true 
            };
            
            set({ 
              user: updatedUser,
              pendingAuthActions: [...state.pendingAuthActions, pendingAction],
              isLoading: false 
            });
            return true;
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            throw new Error('Firebase is not ready. Please try again.');
          }
          
          const updatedUser = await FirebaseAuth.upgradeToSeller(user.id);
          updatedUser.sellerModeActive = true;
          set({ 
            user: updatedUser, 
            isLoading: false,
            lastSyncTime: Date.now(),
          });
          return true;
        } catch (error: any) {
          console.error('Upgrade to seller error in store:', error);
          
          // If it's a "document not found" error, try to create the user document first
          if (error.message.includes('No document to update') || error.message.includes('not-found')) {
            try {
              const { user } = state;
              if (user) {
                // Create the user document with seller status
                const updatedUser = await FirebaseAuth.updateUserProfile(user.id, {
                  name: user.name,
                  email: user.email,
                  photoURL: user.photoURL,
                  isSeller: true,
                  sellerModeActive: true,
                });
                
                set({ 
                  user: updatedUser, 
                  isLoading: false,
                  lastSyncTime: Date.now(),
                });
                return true;
              }
            } catch (createError: any) {
              console.error('Error creating seller document:', createError);
              set({ 
                isLoading: false, 
                error: createError.message || 'Failed to upgrade to seller' 
              });
              return false;
            }
          }
          
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
          if (!user || !user.isSeller) {
            throw new Error('User is not a seller');
          }
          
          const updatedUser = { 
            ...user, 
            sellerModeActive: !user.sellerModeActive 
          };
          
          // If online and Firebase is ready, update in Firebase
          if (isOnline() && !state.isOfflineMode && isFirebaseInitialized()) {
            await FirebaseAuth.updateUserProfile(user.id, { 
              sellerModeActive: updatedUser.sellerModeActive 
            });
            set({ 
              user: updatedUser, 
              isLoading: false,
              lastSyncTime: Date.now(),
            });
          } else {
            // If offline, just update locally
            set({ user: updatedUser, isLoading: false });
          }
          
          return true;
        } catch (error: any) {
          console.error('Toggle seller mode error in store:', error);
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
          },
          isAuthenticated: true,
          isGuest: true,
          hasSelectedRole: false,
        });
      },
      
      checkAuth: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // If offline, use cached user data
          if (!isOnline()) {
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
          }
          
          // Wait for Firebase to be ready
          const firebaseReady = await waitForFirebase();
          if (!firebaseReady) {
            console.warn('Firebase not ready during auth check, using cached data');
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
          }
          
          const user = await FirebaseAuth.getCurrentUser();
          if (user) {
            // Ensure sellerModeActive is set if the user is a seller
            if (user.isSeller && user.sellerModeActive === undefined) {
              user.sellerModeActive = false;
            }
            set({ 
              user, 
              isAuthenticated: true, 
              isLoading: false, 
              isGuest: false,
              hasSelectedRole: get().hasSelectedRole || false,
              lastSyncTime: Date.now(),
            });
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
          // Don't fail completely, use cached data if available
          const state = get();
          if (state.user && !state.isGuest) {
            set({ isLoading: false });
            return true;
          } else {
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
        }
      },
      
      setHasSelectedRole: (value: boolean) => {
        set({ hasSelectedRole: value });
      },
      
      // Offline management
      enableOfflineMode: () => {
        set({ isOfflineMode: true });
      },
      
      enableOnlineMode: async () => {
        set({ isOfflineMode: false });
        
        // Sync pending actions when coming back online
        if (isOnline()) {
          await get().syncOfflineAuthData();
        }
      },
      
      syncOfflineAuthData: async () => {
        const state = get();
        
        if (!isOnline() || state.pendingAuthActions.length === 0) {
          return;
        }
        
        // Wait for Firebase to be ready
        const firebaseReady = await waitForFirebase();
        if (!firebaseReady) {
          console.warn('Firebase not ready for sync, will retry later');
          return;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          const { user } = state;
          if (!user || user.id === 'guest') {
            set({ pendingAuthActions: [], isLoading: false });
            return;
          }
          
          // Process pending actions
          for (const action of state.pendingAuthActions) {
            try {
              switch (action.type) {
                case 'update_profile':
                  await FirebaseAuth.updateUserProfile(user.id, action.data);
                  break;
                case 'upgrade_to_seller':
                  await FirebaseAuth.upgradeToSeller(user.id);
                  break;
              }
            } catch (error) {
              console.error('Error syncing auth action:', action.type, error);
              // Continue with other actions
            }
          }
          
          // Clear pending actions and refresh user data
          set({ 
            pendingAuthActions: [], 
            isLoading: false,
            lastSyncTime: Date.now(),
          });
          
          // Refresh user data
          await get().checkAuth();
          
        } catch (error: any) {
          console.error('Error syncing offline auth data:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sync offline data' 
          });
        }
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
        lastSyncTime: state.lastSyncTime,
        pendingAuthActions: state.pendingAuthActions,
      }),
    }
  )
);