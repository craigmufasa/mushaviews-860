import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, PropertyFilter } from '@/types/property';
import * as FirebaseProperties from '@/firebase/properties';
import { Platform } from 'react-native';

interface OfflineData {
  properties: Property[];
  lastSync: number;
  isOfflineMode: boolean;
}

interface PropertyState {
  properties: Property[];
  favoriteIds: string[];
  recentlyViewed: string[];
  filter: PropertyFilter;
  isLoading: boolean;
  error: string | null;
  
  // Offline capabilities
  offlineData: OfflineData;
  isOfflineMode: boolean;
  lastSyncTime: number;
  pendingUploads: Array<{
    id: string;
    type: 'add' | 'update' | 'delete';
    data: any;
    timestamp: number;
  }>;
  
  // Performance optimization
  imageCache: Map<string, string>;
  compressionLevel: 'low' | 'medium' | 'high';
  adaptiveLoading: boolean;
  
  // Actions
  toggleFavorite: (id: string) => void;
  addToRecentlyViewed: (id: string) => void;
  updateFilter: (filter: Partial<PropertyFilter>) => void;
  resetFilter: () => void;
  getFilteredProperties: () => Property[];
  isFavorite: (id: string) => boolean;
  
  // Firebase actions with offline support
  fetchProperties: (forceRefresh?: boolean) => Promise<void>;
  fetchSellerProperties: (sellerId: string) => Promise<Property[]>;
  addProperty: (property: Omit<Property, 'id'>, images: string[]) => Promise<Property>;
  updateProperty: (id: string, property: Partial<Property>, newImages?: string[]) => Promise<Property>;
  deleteProperty: (id: string) => Promise<boolean>;
  getPropertyById: (id: string) => Promise<Property | null>;
  
  // Offline management
  enableOfflineMode: () => Promise<void>;
  enableOnlineMode: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
  clearOfflineData: () => void;
  
  // Performance optimization
  setCompressionLevel: (level: 'low' | 'medium' | 'high') => void;
  toggleAdaptiveLoading: () => void;
  preloadImages: (properties: Property[]) => Promise<void>;
  clearImageCache: () => void;
  
  clearError: () => void;
}

// Compression utilities
const compressPropertyData = (property: Property, level: 'low' | 'medium' | 'high'): Property => {
  const compressed = { ...property };
  
  switch (level) {
    case 'low':
      // Keep only essential data
      return {
        id: compressed.id,
        sellerId: compressed.sellerId,
        title: compressed.title,
        address: compressed.address,
        city: compressed.city,
        state: compressed.state,
        price: compressed.price,
        beds: compressed.beds,
        baths: compressed.baths,
        sqm: compressed.sqm,
        type: compressed.type,
        status: compressed.status,
        images: compressed.images.slice(0, 3), // Limit to 3 images
        has3DTour: compressed.has3DTour,
        has3DModel: compressed.has3DModel,
      } as Property;
      
    case 'medium':
      // Include more data but compress arrays
      return {
        ...compressed,
        images: compressed.images.slice(0, 5), // Limit to 5 images
        features: compressed.features?.slice(0, 5) || [], // Limit features
        description: compressed.description?.substring(0, 200) || '', // Truncate description
      };
      
    case 'high':
      // Keep all data
      return compressed;
      
    default:
      return compressed;
  }
};

// Network detection
const isOnline = (): boolean => {
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  // For native platforms, assume online unless explicitly set offline
  return true;
};

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set, get) => ({
      properties: [],
      favoriteIds: [],
      recentlyViewed: [],
      filter: {},
      isLoading: false,
      error: null,
      
      // Offline state
      offlineData: {
        properties: [],
        lastSync: 0,
        isOfflineMode: false,
      },
      isOfflineMode: false,
      lastSyncTime: 0,
      pendingUploads: [],
      
      // Performance state
      imageCache: new Map(),
      compressionLevel: 'medium',
      adaptiveLoading: true,

      toggleFavorite: (id: string) => {
        set((state) => {
          const isFavorite = state.favoriteIds.includes(id);
          return {
            favoriteIds: isFavorite
              ? state.favoriteIds.filter((favId) => favId !== id)
              : [...state.favoriteIds, id],
          };
        });
      },

      addToRecentlyViewed: (id: string) => {
        set((state) => {
          const filtered = state.recentlyViewed.filter((viewedId) => viewedId !== id);
          return {
            recentlyViewed: [id, ...filtered].slice(0, 10),
          };
        });
      },

      updateFilter: (filter: Partial<PropertyFilter>) => {
        set((state) => ({
          filter: { ...state.filter, ...filter },
        }));
      },

      resetFilter: () => {
        set({ filter: {} });
      },

      getFilteredProperties: () => {
        const { properties, filter, compressionLevel } = get();
        
        let filteredProperties = properties.filter((property) => {
          // Price filter
          if (filter.priceMin && property.price < filter.priceMin) return false;
          if (filter.priceMax && property.price > filter.priceMax) return false;
          
          // Beds filter
          if (filter.bedsMin && property.beds < filter.bedsMin) return false;
          
          // Baths filter
          if (filter.bathsMin && property.baths < filter.bathsMin) return false;
          
          // Property type filter
          if (filter.type && filter.type.length > 0 && !filter.type.includes(property.type)) return false;
          
          // Status filter
          if (filter.status && filter.status.length > 0 && !filter.status.includes(property.status as any)) return false;
          
          // 3D Tour filter
          if (filter.has3DTour && !property.has3DTour) return false;
          
          // 3D Model filter
          if (filter.has3DModel && !property.has3DModel) return false;
          
          return true;
        });
        
        // Apply compression based on current level
        return filteredProperties.map(property => 
          compressPropertyData(property, compressionLevel)
        );
      },

      isFavorite: (id: string) => {
        return get().favoriteIds.includes(id);
      },

      clearError: () => {
        set({ error: null });
      },
      
      // Enhanced Firebase actions with offline support
      fetchProperties: async (forceRefresh = false) => {
        const state = get();
        
        // If offline mode and we have cached data, use it
        if (state.isOfflineMode && state.offlineData.properties.length > 0 && !forceRefresh) {
          set({ 
            properties: state.offlineData.properties,
            isLoading: false 
          });
          return;
        }
        
        // Check if we should use cached data based on last sync time
        const now = Date.now();
        const cacheValidTime = 5 * 60 * 1000; // 5 minutes
        
        if (!forceRefresh && 
            state.offlineData.properties.length > 0 && 
            (now - state.lastSyncTime) < cacheValidTime) {
          set({ 
            properties: state.offlineData.properties,
            isLoading: false 
          });
          return;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          // Check network connectivity
          if (!isOnline()) {
            throw new Error('No internet connection');
          }
          
          const properties = await FirebaseProperties.getProperties();
          
          // Apply compression based on current level
          const compressedProperties = properties.map(property => 
            compressPropertyData(property, state.compressionLevel)
          );
          
          set({ 
            properties: compressedProperties,
            offlineData: {
              properties: compressedProperties,
              lastSync: now,
              isOfflineMode: false,
            },
            lastSyncTime: now,
            isLoading: false 
          });
          
          // Preload images if adaptive loading is enabled
          if (state.adaptiveLoading) {
            get().preloadImages(compressedProperties.slice(0, 10)); // Preload first 10
          }
          
        } catch (error: any) {
          console.error('Error fetching properties:', error);
          
          // If we have offline data, use it
          if (state.offlineData.properties.length > 0) {
            set({ 
              properties: state.offlineData.properties,
              isLoading: false,
              error: 'Using offline data - ' + (error.message || 'Network error')
            });
          } else {
            set({ 
              isLoading: false, 
              error: error.message || 'Failed to fetch properties' 
            });
          }
        }
      },
      
      fetchSellerProperties: async (sellerId: string) => {
        set({ isLoading: true, error: null });
        try {
          const properties = await FirebaseProperties.getSellerProperties(sellerId);
          const state = get();
          
          // Apply compression
          const compressedProperties = properties.map(property => 
            compressPropertyData(property, state.compressionLevel)
          );
          
          set({ isLoading: false });
          return compressedProperties;
        } catch (error: any) {
          console.error('Error fetching seller properties:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to fetch seller properties' 
          });
          return [];
        }
      },
      
      addProperty: async (property: Omit<Property, 'id'>, images: string[]) => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          // If offline, queue for later upload
          if (!isOnline() || state.isOfflineMode) {
            const tempId = `temp_${Date.now()}`;
            const tempProperty = {
              id: tempId,
              ...property,
              images: images,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Property;
            
            // Add to pending uploads
            const pendingUpload = {
              id: tempId,
              type: 'add' as const,
              data: { property, images },
              timestamp: Date.now(),
            };
            
            set((state) => ({
              properties: [...state.properties, tempProperty],
              pendingUploads: [...state.pendingUploads, pendingUpload],
              isLoading: false
            }));
            
            return tempProperty;
          }
          
          // Online - upload with progress tracking
          const newProperty = await FirebaseProperties.addProperty(
            property, 
            images,
            (progress) => {
              // Could emit progress events here
              console.log('Upload progress:', progress);
            }
          );
          
          const compressedProperty = compressPropertyData(newProperty, state.compressionLevel);
          
          set((state) => ({ 
            properties: [...state.properties, compressedProperty],
            isLoading: false 
          }));
          
          return compressedProperty;
        } catch (error: any) {
          console.error('Error adding property:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to add property' 
          });
          throw error;
        }
      },
      
      updateProperty: async (id: string, property: Partial<Property>, newImages?: string[]) => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          // If offline, queue for later upload
          if (!isOnline() || state.isOfflineMode) {
            const pendingUpload = {
              id,
              type: 'update' as const,
              data: { property, newImages },
              timestamp: Date.now(),
            };
            
            // Update local copy
            set((state) => ({
              properties: state.properties.map(p => 
                p.id === id ? { ...p, ...property, updatedAt: new Date() } : p
              ),
              pendingUploads: [...state.pendingUploads, pendingUpload],
              isLoading: false
            }));
            
            return { id, ...property } as Property;
          }
          
          // Online - upload with progress tracking
          const updatedProperty = await FirebaseProperties.updateProperty(
            id, 
            property, 
            newImages,
            (progress) => {
              console.log('Update progress:', progress);
            }
          );
          
          const compressedProperty = compressPropertyData(updatedProperty, state.compressionLevel);
          
          set((state) => ({ 
            properties: state.properties.map(p => 
              p.id === id ? compressedProperty : p
            ),
            isLoading: false 
          }));
          
          return compressedProperty;
        } catch (error: any) {
          console.error('Error updating property:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to update property' 
          });
          throw error;
        }
      },
      
      deleteProperty: async (id: string) => {
        const state = get();
        set({ isLoading: true, error: null });
        
        try {
          // If offline, queue for later deletion
          if (!isOnline() || state.isOfflineMode) {
            const pendingUpload = {
              id,
              type: 'delete' as const,
              data: {},
              timestamp: Date.now(),
            };
            
            set((state) => ({
              properties: state.properties.filter(p => p.id !== id),
              favoriteIds: state.favoriteIds.filter(favId => favId !== id),
              recentlyViewed: state.recentlyViewed.filter(viewedId => viewedId !== id),
              pendingUploads: [...state.pendingUploads, pendingUpload],
              isLoading: false
            }));
            
            return true;
          }
          
          await FirebaseProperties.deleteProperty(id);
          
          set((state) => ({ 
            properties: state.properties.filter(p => p.id !== id),
            favoriteIds: state.favoriteIds.filter(favId => favId !== id),
            recentlyViewed: state.recentlyViewed.filter(viewedId => viewedId !== id),
            isLoading: false 
          }));
          
          return true;
        } catch (error: any) {
          console.error('Error deleting property:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to delete property' 
          });
          return false;
        }
      },

      getPropertyById: async (id: string) => {
        const state = get();
        
        // First check local cache
        const localProperty = state.properties.find(p => p.id === id);
        if (localProperty) {
          return localProperty;
        }
        
        // Check offline data
        const offlineProperty = state.offlineData.properties.find(p => p.id === id);
        if (offlineProperty && (!isOnline() || state.isOfflineMode)) {
          return offlineProperty;
        }
        
        // Fetch from Firebase if online
        try {
          if (!isOnline()) {
            throw new Error('Property not available offline');
          }
          
          const property = await FirebaseProperties.getPropertyById(id);
          if (property) {
            const compressedProperty = compressPropertyData(property, state.compressionLevel);
            
            // Update local cache
            set((state) => ({
              properties: state.properties.some(p => p.id === id) 
                ? state.properties.map(p => p.id === id ? compressedProperty : p)
                : [...state.properties, compressedProperty]
            }));
            
            return compressedProperty;
          }
          return null;
        } catch (error: any) {
          console.error('Error getting property by ID:', error);
          return null;
        }
      },
      
      // Offline management
      enableOfflineMode: async () => {
        try {
          await FirebaseProperties.enableOfflineMode();
          set({ isOfflineMode: true });
        } catch (error) {
          console.error('Error enabling offline mode:', error);
        }
      },
      
      enableOnlineMode: async () => {
        try {
          await FirebaseProperties.enableOnlineMode();
          set({ isOfflineMode: false });
          
          // Sync pending uploads
          await get().syncOfflineData();
        } catch (error) {
          console.error('Error enabling online mode:', error);
        }
      },
      
      syncOfflineData: async () => {
        const state = get();
        
        if (!isOnline() || state.pendingUploads.length === 0) {
          return;
        }
        
        set({ isLoading: true, error: null });
        
        try {
          // Process pending uploads
          for (const upload of state.pendingUploads) {
            try {
              switch (upload.type) {
                case 'add':
                  await FirebaseProperties.addProperty(upload.data.property, upload.data.images);
                  break;
                case 'update':
                  await FirebaseProperties.updateProperty(upload.id, upload.data.property, upload.data.newImages);
                  break;
                case 'delete':
                  await FirebaseProperties.deleteProperty(upload.id);
                  break;
              }
            } catch (error) {
              console.error('Error syncing upload:', upload.id, error);
              // Continue with other uploads
            }
          }
          
          // Clear pending uploads
          set({ pendingUploads: [], isLoading: false });
          
          // Refresh data
          await get().fetchProperties(true);
          
        } catch (error: any) {
          console.error('Error syncing offline data:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to sync offline data' 
          });
        }
      },
      
      clearOfflineData: () => {
        set({
          offlineData: {
            properties: [],
            lastSync: 0,
            isOfflineMode: false,
          },
          pendingUploads: [],
          lastSyncTime: 0,
        });
      },
      
      // Performance optimization
      setCompressionLevel: (level: 'low' | 'medium' | 'high') => {
        set({ compressionLevel: level });
      },
      
      toggleAdaptiveLoading: () => {
        set((state) => ({ adaptiveLoading: !state.adaptiveLoading }));
      },
      
      preloadImages: async (properties: Property[]) => {
        const state = get();
        
        if (!state.adaptiveLoading || !isOnline()) {
          return;
        }
        
        const imageUrls = properties
          .flatMap(p => p.images || [])
          .slice(0, 20); // Limit to 20 images
        
        const newCache = new Map(state.imageCache);
        
        for (const url of imageUrls) {
          if (!newCache.has(url)) {
            try {
              if (Platform.OS === 'web') {
                const img = new Image();
                img.src = url;
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  setTimeout(reject, 5000); // 5 second timeout
                });
                newCache.set(url, url);
              }
            } catch (error) {
              console.warn('Failed to preload image:', url);
            }
          }
        }
        
        set({ imageCache: newCache });
      },
      
      clearImageCache: () => {
        set({ imageCache: new Map() });
      },
    }),
    {
      name: 'property-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favoriteIds: state.favoriteIds,
        recentlyViewed: state.recentlyViewed,
        filter: state.filter,
        offlineData: state.offlineData,
        lastSyncTime: state.lastSyncTime,
        pendingUploads: state.pendingUploads,
        compressionLevel: state.compressionLevel,
        adaptiveLoading: state.adaptiveLoading,
      }),
    }
  )
);