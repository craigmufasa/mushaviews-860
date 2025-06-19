import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, PropertyFilter } from '@/types/property';
import { db, storage } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';

interface PropertyState {
  properties: Property[];
  favoriteIds: string[];
  recentlyViewed: string[];
  filter: PropertyFilter;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  toggleFavorite: (id: string) => void;
  addToRecentlyViewed: (id: string) => void;
  updateFilter: (filter: Partial<PropertyFilter>) => void;
  resetFilter: () => void;
  getFilteredProperties: () => Property[];
  isFavorite: (id: string) => boolean;
  
  // Firebase property management
  fetchProperties: (forceRefresh?: boolean) => Promise<void>;
  fetchSellerProperties: (sellerId: string) => Promise<Property[]>;
  addProperty: (property: Omit<Property, 'id'>, images: string[]) => Promise<Property>;
  updateProperty: (id: string, property: Partial<Property>, newImages?: string[]) => Promise<Property>;
  deleteProperty: (id: string) => Promise<boolean>;
  getPropertyById: (id: string) => Promise<Property | null>;
  initializePropertyListener: () => () => void;
  
  clearError: () => void;
}

// Helper to upload property images to Firebase Storage
const uploadPropertyImages = async (images: string[], propertyId: string): Promise<string[]> => {
  const uploadPromises = images.map(async (imageUri, index) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const imageRef = ref(storage, `properties/${propertyId}/image_${index}_${Date.now()}`);
      await uploadBytes(imageRef, blob);
      return await getDownloadURL(imageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  });
  return Promise.all(uploadPromises);
};

// Helper to delete property images from Firebase Storage
const deletePropertyImages = async (imageUrls: string[]): Promise<void> => {
  const deletePromises = imageUrls.map(async (url) => {
    try {
      const imageRef = ref(storage, url);
      await deleteObject(imageRef);
    } catch (error) {
      console.warn('Failed to delete image:', url, error);
    }
  });
  await Promise.all(deletePromises);
};

// Helper to convert Firestore document to Property
const convertFirestoreProperty = (doc: any): Property => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Property;
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
        const { properties, filter } = get();
        
        return properties.filter((property) => {
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
      },

      isFavorite: (id: string) => {
        return get().favoriteIds.includes(id);
      },

      clearError: () => {
        set({ error: null });
      },
      
      fetchProperties: async (forceRefresh = false) => {
        set({ isLoading: true, error: null });
        
        try {
          const propertiesRef = collection(db, 'properties');
          const q = query(propertiesRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          
          const properties: Property[] = [];
          querySnapshot.forEach((doc) => {
            properties.push(convertFirestoreProperty(doc));
          });
          
          set({ 
            properties,
            isLoading: false 
          });
          
        } catch (error: any) {
          console.error('Error fetching properties:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Failed to fetch properties' 
          });
        }
      },
      
      fetchSellerProperties: async (sellerId: string) => {
        set({ isLoading: true, error: null });
        try {
          const propertiesRef = collection(db, 'properties');
          const q = query(
            propertiesRef, 
            where('sellerId', '==', sellerId),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          
          const sellerProperties: Property[] = [];
          querySnapshot.forEach((doc) => {
            sellerProperties.push(convertFirestoreProperty(doc));
          });
          
          set({ isLoading: false });
          return sellerProperties;
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
        set({ isLoading: true, error: null });
        
        try {
          // First, add the property to get an ID
          const propertiesRef = collection(db, 'properties');
          const docRef = await addDoc(propertiesRef, {
            ...property,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            images: [], // Will be updated after image upload
          });
          
          // Upload images to Firebase Storage
          const uploadedImageUrls = await uploadPropertyImages(images, docRef.id);
          
          // Update the property with image URLs
          await updateDoc(docRef, {
            images: uploadedImageUrls
          });
          
          const newProperty: Property = {
            id: docRef.id,
            ...property,
            images: uploadedImageUrls,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({ 
            properties: [newProperty, ...state.properties],
            isLoading: false 
          }));
          
          return newProperty;
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
        set({ isLoading: true, error: null });
        
        try {
          const propertyRef = doc(db, 'properties', id);
          const propertyDoc = await getDoc(propertyRef);
          
          if (!propertyDoc.exists()) {
            throw new Error('Property not found');
          }
          
          const currentData = convertFirestoreProperty(propertyDoc);
          let imageUrls = currentData.images;
          
          // If new images are provided, upload them and delete old ones
          if (newImages && newImages.length > 0) {
            // Delete old images
            await deletePropertyImages(currentData.images);
            
            // Upload new images
            imageUrls = await uploadPropertyImages(newImages, id);
          }
          
          const updateData = {
            ...property,
            images: imageUrls,
            updatedAt: serverTimestamp(),
          };
          
          await updateDoc(propertyRef, updateData);
          
          const updatedProperty = {
            ...currentData,
            ...property,
            images: imageUrls,
            updatedAt: new Date(),
          };
          
          set((state) => ({ 
            properties: state.properties.map(p => 
              p.id === id ? updatedProperty : p
            ),
            isLoading: false 
          }));
          
          return updatedProperty;
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
        set({ isLoading: true, error: null });
        
        try {
          const propertyRef = doc(db, 'properties', id);
          const propertyDoc = await getDoc(propertyRef);
          
          if (propertyDoc.exists()) {
            const propertyData = convertFirestoreProperty(propertyDoc);
            
            // Delete property images from Firebase Storage
            await deletePropertyImages(propertyData.images);
            
            // Delete property document from Firestore
            await deleteDoc(propertyRef);
          }
          
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
        try {
          const propertyRef = doc(db, 'properties', id);
          const propertyDoc = await getDoc(propertyRef);
          
          if (propertyDoc.exists()) {
            return convertFirestoreProperty(propertyDoc);
          }
          return null;
        } catch (error: any) {
          console.error('Error getting property by ID:', error);
          return null;
        }
      },

      initializePropertyListener: () => {
        const propertiesRef = collection(db, 'properties');
        const q = query(propertiesRef, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const updatedProperties: Property[] = [];
          querySnapshot.forEach((doc) => {
            updatedProperties.push(convertFirestoreProperty(doc));
          });
          
          set({ properties: updatedProperties });
        }, (error) => {
          console.error('Error in property listener:', error);
          set({ error: 'Failed to sync properties' });
        });
        
        return unsubscribe;
      },
    }),
    {
      name: 'property-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favoriteIds: state.favoriteIds,
        recentlyViewed: state.recentlyViewed,
        filter: state.filter,
      }),
    }
  )
);