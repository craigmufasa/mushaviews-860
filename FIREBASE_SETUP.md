# Firebase Setup for Android and iOS

## Overview
This project uses Firebase v9+ modular SDK with proper React Native configuration. The current setup works for web and Expo Go, but for production builds on Android and iOS, you need additional configuration files.

## What's Already Configured
- ✅ Firebase Web SDK configuration
- ✅ Firebase Auth with AsyncStorage persistence for React Native
- ✅ Firestore database
- ✅ Firebase Storage
- ✅ Proper TypeScript types
- ✅ Error handling for undefined values in Firestore

## For Production Android/iOS Builds

### Android Configuration
1. **Download google-services.json**:
   - Go to Firebase Console → Project Settings → General
   - Under "Your apps", find your Android app
   - Download `google-services.json`
   - Place it in your project root (same level as package.json)

2. **Add to app.json**:
   ```json
   {
     "expo": {
       "android": {
         "googleServicesFile": "./google-services.json"
       }
     }
   }
   ```

### iOS Configuration
1. **Download GoogleService-Info.plist**:
   - Go to Firebase Console → Project Settings → General
   - Under "Your apps", find your iOS app
   - Download `GoogleService-Info.plist`
   - Place it in your project root (same level as package.json)

2. **Add to app.json**:
   ```json
   {
     "expo": {
       "ios": {
         "googleServicesFile": "./GoogleService-Info.plist"
       }
     }
   }
   ```

### Complete app.json Example
```json
{
  "expo": {
    "name": "Musha Views",
    "slug": "musha-views",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "musha-views",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "googleServicesFile": "./google-services.json"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

## Current Status
- **Expo Go**: ✅ Works (uses Firebase Web SDK)
- **Web**: ✅ Works (uses Firebase Web SDK)
- **Production Android**: ⚠️ Needs google-services.json
- **Production iOS**: ⚠️ Needs GoogleService-Info.plist

## Notes
- The current Firebase configuration automatically detects the platform and uses the appropriate initialization method
- For Expo Go development, no additional files are needed
- The auth persistence is properly configured with AsyncStorage for React Native
- All undefined values are filtered out before saving to Firestore to prevent errors