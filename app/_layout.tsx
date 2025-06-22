import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Slot, SplashScreen, useRouter } from "expo-router";
import { useEffect } from "react";
import { colors } from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { app } from "@/firebase/config";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const { checkAuth, isAuthenticated } = useAuthStore();
  
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  useEffect(() => {
    // Check authentication status when app loads
    const initAuth = async () => {
      try {
        // Ensure Firebase is initialized
        if (!app) {
          console.error("Firebase app not initialized");
        }
        
        // Check if user is already authenticated
        await checkAuth();
      } catch (error) {
        console.error("Error checking authentication:", error);
      }
    };
    
    initAuth();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Slot />
      </QueryClientProvider>
    </trpc.Provider>
  );
}