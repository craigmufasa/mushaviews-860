import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  hasSelectedRole: boolean;
  
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
}

// Mock user database
const mockUsers: { [email: string]: { password: string; user: User } } = {};

// Helper to generate user ID
const generateUserId = () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isGuest: false,
      hasSelectedRole: false,
      
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
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user exists in mock database
          const userData = mockUsers[email.toLowerCase()];
          if (!userData) {
            throw new Error('No account found with this email address');
          }
          
          if (userData.password !== password) {
            throw new Error('Incorrect password');
          }
          
          set({ 
            user: userData.user, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
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
      
      signup: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user already exists
          if (mockUsers[email.toLowerCase()]) {
            throw new Error('An account with this email already exists');
          }
          
          if (password.length < 6) {
            throw new Error('Password should be at least 6 characters');
          }
          
          // Create new user
          const newUser: User = {
            id: generateUserId(),
            name,
            email: email.toLowerCase(),
            isSeller: false,
            sellerModeActive: false,
            createdAt: new Date().toISOString(),
          };
          
          // Store in mock database
          mockUsers[email.toLowerCase()] = {
            password,
            user: newUser
          };
          
          set({ 
            user: newUser, 
            isAuthenticated: true, 
            isLoading: false, 
            isGuest: false,
            hasSelectedRole: false,
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
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            isGuest: false,
            hasSelectedRole: false,
          });
        } catch (error: any) {
          console.error('Logout error in store:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to logout' 
          });
        }
      },
      
      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user exists
          if (!mockUsers[email.toLowerCase()]) {
            throw new Error('No account found with this email address');
          }
          
          // In a real app, this would send an email
          console.log('Password reset email sent to:', email);
          
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
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Update user data
          const updatedUser = { ...user, ...data };
          
          // Update in mock database if user exists
          if (user.email && mockUsers[user.email]) {
            mockUsers[user.email].user = updatedUser;
          }
          
          set({ 
            user: updatedUser, 
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          console.error('Update profile error in store:', error);
          
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
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Update user to seller
          const updatedUser = { 
            ...user, 
            isSeller: true, 
            sellerModeActive: true 
          };
          
          // Update in mock database if user exists
          if (user.email && mockUsers[user.email]) {
            mockUsers[user.email].user = updatedUser;
          }
          
          set({ 
            user: updatedUser, 
            isLoading: false,
          });
          return true;
        } catch (error: any) {
          console.error('Upgrade to seller error in store:', error);
          
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
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const updatedUser = { 
            ...user, 
            sellerModeActive: !user.sellerModeActive 
          };
          
          // Update in mock database if user exists
          if (user.email && mockUsers[user.email]) {
            mockUsers[user.email].user = updatedUser;
          }
          
          set({ user: updatedUser, isLoading: false });
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
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
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