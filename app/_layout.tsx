import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Slot, SplashScreen, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { colors } from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { getFirebaseInitialization } from "@/firebase/config";
import { View, Text, ActivityIndicator } from "react-native";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const { checkAuth, isAuthenticated } = useAuthStore();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error('Font loading error:', error);
    }
  }, [error]);

  useEffect(() => {
    // Initialize Firebase first, then check authentication
    const initApp = async () => {
      try {
        console.log('Initializing Firebase...');
        await getFirebaseInitialization();
        console.log('Firebase initialized successfully');
        setFirebaseReady(true);
        
        // Now check authentication
        console.log('Checking authentication...');
        await checkAuth();
        console.log('Authentication check completed');
        
      } catch (error: any) {
        console.error('Error during app initialization:', error);
        setFirebaseError(error.message || 'Failed to initialize app');
        setFirebaseReady(true); // Still allow app to continue
      }
    };
    
    initApp();
  }, []);

  useEffect(() => {
    if (loaded && firebaseReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, firebaseReady]);

  // Show loading screen while fonts or Firebase are loading
  if (!loaded || !firebaseReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: colors.background 
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ 
          marginTop: 16, 
          color: colors.text, 
          fontSize: 16 
        }}>
          {!loaded ? 'Loading fonts...' : 'Initializing app...'}
        </Text>
        {firebaseError && (
          <Text style={{ 
            marginTop: 8, 
            color: colors.error, 
            fontSize: 14,
            textAlign: 'center',
            paddingHorizontal: 20
          }}>
            {firebaseError}
          </Text>
        )}
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Slot />
      </QueryClientProvider>
    </trpc.Provider>
  );
}