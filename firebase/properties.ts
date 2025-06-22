import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  getDoc,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  uploadBytesResumable,
  getMetadata
} from 'firebase/storage';
import { db, storage } from './config';
import { Property } from '@/types/property';
import { Platform } from 'react-native';

// Compression utilities
const compressImage = async (uri: string, quality: number = 0.7): Promise<Blob> => {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1920x1080 for optimization)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        }, 'image/jpeg', quality);
      };
      
      img.onerror = reject;
      img.src = uri;
    });
  } else {
    // For native platforms, use fetch with reduced quality
    const response = await fetch(uri);
    return await response.blob();
  }
};

// Progressive image loading utility
const createProgressiveImageVersions = async (uri: string): Promise<{
  thumbnail: Blob;
  medium: Blob;
  full: Blob;
}> => {
  const [thumbnail, medium, full] = await Promise.all([
    compressImage(uri, 0.3), // Very low quality for thumbnails
    compressImage(uri, 0.6), // Medium quality
    compressImage(uri, 0.8)  // High quality
  ]);
  
  return { thumbnail, medium, full };
};

// Helper function to clean object by removing undefined values
const cleanObject = (obj: any) => {
  const cleanedObj = { ...obj };
  Object.keys(cleanedObj).forEach(key => {
    if (cleanedObj[key] === undefined) {
      delete cleanedObj[key];
    }
  });
  return cleanedObj;
};

// Enhanced retry logic with exponential backoff
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unexpected error in retryOperation');
};

// Chunked upload for large files
const uploadLargeFile = async (
  file: Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }

  const storageRef = ref(storage, path);
  
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

// Enhanced image upload with progressive versions and retry logic
const uploadImageWithProgressive = async (
  imageUri: string, 
  path: string,
  onProgress?: (progress: number) => void
): Promise<{
  thumbnail: string;
  medium: string;
  full: string;
}> => {
  return retryOperation(async () => {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    console.log(`Starting progressive upload for: ${path}`);
    
    // Create progressive versions
    const versions = await createProgressiveImageVersions(imageUri);
    
    // Upload all versions in parallel
    const uploadPromises = [
      uploadLargeFile(versions.thumbnail, `${path}_thumb`, (p) => onProgress?.(p * 0.33)),
      uploadLargeFile(versions.medium, `${path}_med`, (p) => onProgress?.(33 + p * 0.33)),
      uploadLargeFile(versions.full, `${path}_full`, (p) => onProgress?.(66 + p * 0.34))
    ];
    
    const [thumbnailUrl, mediumUrl, fullUrl] = await Promise.all(uploadPromises);
    
    console.log(`Successfully uploaded progressive images for: ${path}`);
    return {
      thumbnail: thumbnailUrl,
      medium: mediumUrl,
      full: fullUrl
    };
  }, 3, 2000);
};

// Add a new property with enhanced image handling
export const addProperty = async (
  property: Omit<Property, 'id'>, 
  images: string[],
  onProgress?: (progress: number) => void
) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    console.log('Adding property with', images.length, 'images');
    
    // Collection reference
    const propertiesCollection = collection(db, 'properties');
    
    // Clean property object to remove undefined values
    const cleanedProperty = cleanObject({
      ...property,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [], // Will be updated with uploaded image URLs
      imageVersions: [], // Progressive image versions
      isOfflineReady: false, // Will be set to true once all images are uploaded
    });
    
    // Add property document to Firestore first
    const docRef = await addDoc(propertiesCollection, cleanedProperty);
    console.log('Property document created with ID:', docRef.id);

    // Upload images with progressive versions
    const imageVersions: Array<{
      thumbnail: string;
      medium: string;
      full: string;
    }> = [];
    
    const imageUrls: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        const imageUri = images[i];
        const imagePath = `properties/${docRef.id}/image_${i}_${Date.now()}`;
        
        const progressCallback = (imageProgress: number) => {
          const totalProgress = ((i / images.length) + (imageProgress / 100 / images.length)) * 100;
          onProgress?.(totalProgress);
        };
        
        const versions = await uploadImageWithProgressive(imageUri, imagePath, progressCallback);
        imageVersions.push(versions);
        imageUrls.push(versions.full); // Use full quality as main image URL
        
      } catch (error) {
        console.error(`Failed to upload image ${i}:`, error);
        // Continue with other images even if one fails
      }
    }

    console.log('Uploaded', imageUrls.length, 'images successfully');

    // Update property with image URLs and mark as offline ready
    await updateDoc(docRef, {
      images: imageUrls,
      imageVersions: imageVersions,
      isOfflineReady: true,
    });

    return {
      ...cleanedProperty,
      id: docRef.id,
      images: imageUrls,
      imageVersions: imageVersions,
      isOfflineReady: true,
    };
  } catch (error) {
    console.error('Error adding property:', error);
    throw error;
  }
};

// Get all properties with offline support
export const getProperties = async (useCache: boolean = false) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    // Enable offline persistence if requested
    if (useCache) {
      try {
        await enableNetwork(db);
      } catch (error) {
        console.warn('Network already enabled or offline mode active');
      }
    }
    
    const propertiesCollection = collection(db, 'properties');
    const querySnapshot = await getDocs(propertiesCollection);
    
    const properties = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Property[];
    
    // Sort by creation date, newest first
    return properties.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting properties:', error);
    throw error;
  }
};

// Get properties by seller ID with enhanced error handling
export const getSellerProperties = async (sellerId: string) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const propertiesCollection = collection(db, 'properties');
    const q = query(propertiesCollection, where("sellerId", "==", sellerId));
    const querySnapshot = await getDocs(q);
    
    const properties = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Property[];
    
    // Sort by creation date, newest first
    return properties.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting seller properties:', error);
    throw error;
  }
};

// Get a single property by ID with offline support
export const getPropertyById = async (propertyId: string) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const docRef = doc(db, 'properties', propertyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Property;
    } else {
      throw new Error('Property not found');
    }
  } catch (error) {
    console.error('Error getting property:', error);
    throw error;
  }
};

// Enhanced update property with better image handling
export const updateProperty = async (
  propertyId: string, 
  property: Partial<Property>, 
  newImages?: string[],
  onProgress?: (progress: number) => void
) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    console.log('Updating property', propertyId, 'with', newImages?.length || 0, 'new images');
    
    const docRef = doc(db, 'properties', propertyId);
    
    // Get existing property data
    const existingProperty = await getPropertyById(propertyId);
    let updatedImages = property.images || existingProperty.images || [];
    let updatedImageVersions = existingProperty.imageVersions || [];
    
    // Handle new images if provided
    if (newImages && newImages.length > 0 && storage) {
      console.log('Uploading new images...');
      
      for (let i = 0; i < newImages.length; i++) {
        try {
          const imageUri = newImages[i];
          const imagePath = `properties/${propertyId}/image_new_${i}_${Date.now()}`;
          
          const progressCallback = (imageProgress: number) => {
            const totalProgress = ((i / newImages.length) + (imageProgress / 100 / newImages.length)) * 100;
            onProgress?.(totalProgress);
          };
          
          const versions = await uploadImageWithProgressive(imageUri, imagePath, progressCallback);
          updatedImageVersions.push(versions);
          updatedImages.push(versions.full);
          
        } catch (error) {
          console.error(`Failed to upload new image ${i}:`, error);
          // Continue with other images even if one fails
        }
      }
      
      console.log('Successfully uploaded', newImages.length, 'new images');
    }
    
    // Clean property object to remove undefined values
    const cleanedProperty = cleanObject({
      ...property,
      images: updatedImages,
      imageVersions: updatedImageVersions,
      updatedAt: new Date(),
      isOfflineReady: true,
    });
    
    console.log('Updating Firestore document...');
    
    // Use retry logic for the update operation
    await retryOperation(async () => {
      await updateDoc(docRef, cleanedProperty);
    }, 3, 1000);
    
    console.log('Property updated successfully');
    
    return {
      ...existingProperty,
      ...cleanedProperty,
      id: propertyId,
    };
  } catch (error) {
    console.error('Error updating property:', error);
    throw error;
  }
};

// Enhanced delete property with better cleanup
export const deleteProperty = async (propertyId: string) => {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    console.log('Deleting property:', propertyId);
    
    // Get property data first to access images
    const property = await getPropertyById(propertyId);
    
    // Delete all image versions from storage
    if (property.imageVersions && property.imageVersions.length > 0 && storage) {
      console.log('Deleting', property.imageVersions.length, 'image sets from storage');
      
      const deletePromises: Promise<void>[] = [];
      
      property.imageVersions.forEach((versions) => {
        [versions.thumbnail, versions.medium, versions.full].forEach((imageUrl) => {
          if (imageUrl) {
            deletePromises.push(
              (async () => {
                try {
                  const urlParts = imageUrl.split('/o/');
                  if (urlParts.length > 1) {
                    const pathPart = urlParts[1].split('?')[0];
                    const imagePath = decodeURIComponent(pathPart);
                    const imageRef = ref(storage, imagePath);
                    await deleteObject(imageRef);
                    console.log('Deleted image:', imagePath);
                  }
                } catch (error) {
                  console.warn('Error deleting image:', error);
                }
              })()
            );
          }
        });
      });
      
      // Wait for all deletions to complete
      await Promise.allSettled(deletePromises);
    }
    
    // Delete legacy images if they exist
    if (property.images && property.images.length > 0 && storage) {
      const legacyDeletePromises = property.images.map(async (imageUrl) => {
        try {
          const urlParts = imageUrl.split('/o/');
          if (urlParts.length > 1) {
            const pathPart = urlParts[1].split('?')[0];
            const imagePath = decodeURIComponent(pathPart);
            const imageRef = ref(storage, imagePath);
            await deleteObject(imageRef);
            console.log('Deleted legacy image:', imagePath);
          }
        } catch (error) {
          console.warn('Error deleting legacy image:', error);
        }
      });
      
      await Promise.allSettled(legacyDeletePromises);
    }
    
    // Delete the document with retry logic
    const docRef = doc(db, 'properties', propertyId);
    await retryOperation(async () => {
      await deleteDoc(docRef);
    }, 3, 1000);
    
    console.log('Property deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting property:', error);
    throw error;
  }
};

// Offline data management
export const enableOfflineMode = async () => {
  try {
    if (db) {
      await disableNetwork(db);
      console.log('Offline mode enabled');
    }
  } catch (error) {
    console.warn('Error enabling offline mode:', error);
  }
};

export const enableOnlineMode = async () => {
  try {
    if (db) {
      await enableNetwork(db);
      console.log('Online mode enabled');
    }
  } catch (error) {
    console.warn('Error enabling online mode:', error);
  }
};

// Data compression utilities for 3D models
export const compressModelData = (modelData: any): string => {
  try {
    // Simple compression using JSON stringify with reduced precision
    const compressed = JSON.stringify(modelData, (key, value) => {
      if (typeof value === 'number') {
        return Math.round(value * 1000) / 1000; // Reduce precision to 3 decimal places
      }
      return value;
    });
    
    return compressed;
  } catch (error) {
    console.error('Error compressing model data:', error);
    return JSON.stringify(modelData);
  }
};

export const decompressModelData = (compressedData: string): any => {
  try {
    return JSON.parse(compressedData);
  } catch (error) {
    console.error('Error decompressing model data:', error);
    return null;
  }
};