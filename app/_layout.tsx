import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Slot, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { usePropertyStore } from "@/store/property-store";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { checkAuth, initializeAuthListener } = useAuthStore();
  const { initializePropertyListener } = usePropertyStore();
  const [appReady, setAppReady] = useState(false);
  
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
        
        // Initialize Firebase auth listener
        const unsubscribeAuth = initializeAuthListener();
        
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
      } catch (error) {
        console.error('Error initializing Firebase app:', error);
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
    if (appReady) {
      console.log('App ready, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return <Slot />;
}