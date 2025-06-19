export type UserRole = 'buyer' | 'seller' | 'both';

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  isSeller: boolean;
  sellerModeActive?: boolean;
  createdAt: string;
  role?: UserRole;
  
  // Firebase-specific fields
  updatedAt?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  
  // Additional profile fields
  bio?: string;
  company?: string;
  website?: string;
  location?: string;
  
  // Seller-specific fields
  sellerRating?: number;
  sellerReviews?: number;
  licenseNumber?: string;
  yearsExperience?: number;
  
  // Preferences
  preferences?: {
    notifications?: {
      email?: boolean;
      push?: boolean;
      sms?: boolean;
    };
    privacy?: {
      showEmail?: boolean;
      showPhone?: boolean;
    };
  };
}