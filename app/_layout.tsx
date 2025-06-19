import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Slot, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { usePropertyStore } from "@/store/property-store";
import { View, Text } from "react-native";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { checkAuth, initializeAuthListener, isInitialized } = useAuthStore();
  const { initializePropertyListener } = usePropertyStore();
  const [appReady, setAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error('Font loading error:', error);
    }
  }, [error]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for fonts to load
        if (!loaded) {
          return;
        }

        console.log('Initializing Firebase app...');
        
        // Initialize Firebase auth listener first
        const unsubscribeAuth = initializeAuthListener();
        
        // Wait a bit for Firebase to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialize property listener
        const unsubscribeProperties = initializePropertyListener();
        
        // Check authentication
        await checkAuth();
        
        console.log('Firebase app initialization completed');
        setAppReady(true);
        
        // Cleanup function
        return () => {
          unsubscribeAuth();
          unsubscribeProperties();
        };
      } catch (error: any) {
        console.error('Error initializing Firebase app:', error);
        setInitError(error.message || 'Failed to initialize app');
        // Continue anyway to prevent app from being stuck
        setAppReady(true);
      }
    };
    
    const cleanup = initializeApp();
    
    // Return cleanup function
    return () => {
      if (cleanup instanceof Promise) {
        cleanup.then(cleanupFn => {
          if (typeof cleanupFn === 'function') {
            cleanupFn();
          }
        });
      }
    };
  }, [loaded, checkAuth, initializeAuthListener, initializePropertyListener]);

  useEffect(() => {
    if (appReady && isInitialized) {
      console.log('App ready, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [appReady, isInitialized]);

  // Show loading screen while initializing
  if (!appReady || !isInitialized) {
    return null;
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Initialization Error
        </Text>
        <Text style={{ textAlign: 'center', color: '#666' }}>
          {initError}
        </Text>
      </View>
    );
  }

  return <Slot />;
}