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

        console.log('Initializing app...');
        
        // Simple delay to ensure Firebase is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialize Firebase listeners
        let unsubscribeAuth: (() => void) | undefined;
        let unsubscribeProperties: (() => void) | undefined;
        
        try {
          unsubscribeAuth = initializeAuthListener();
          unsubscribeProperties = initializePropertyListener();
        } catch (error) {
          console.warn('Error initializing Firebase listeners:', error);
        }
        
        // Check authentication
        try {
          await checkAuth();
        } catch (error) {
          console.warn('Error checking auth:', error);
        }
        
        console.log('App initialization completed');
        setAppReady(true);
        
        // Return cleanup function
        return () => {
          try {
            if (typeof unsubscribeAuth === 'function') {
              unsubscribeAuth();
            }
            if (typeof unsubscribeProperties === 'function') {
              unsubscribeProperties();
            }
          } catch (error) {
            console.warn('Error during cleanup:', error);
          }
        };
      } catch (error: any) {
        console.error('Error initializing app:', error);
        setInitError(error.message || 'Failed to initialize app');
        // Continue anyway to prevent app from being stuck
        setAppReady(true);
      }
    };
    
    let cleanup: (() => void) | undefined;
    
    initializeApp().then((cleanupFn) => {
      cleanup = cleanupFn;
    });
    
    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
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