import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { Box, Plus, X, Camera, Link, Wifi, WifiOff, Upload, AlertCircle, Eye, Maximize2, Globe } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { usePropertyStore } from '@/store/property-store';
import { Property, TourRoom, DeviceCapability, TourType } from '@/types/property';

export default function Add3DTourScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    properties, 
    updateProperty, 
    isLoading,
    isOfflineMode,
    pendingUploads
  } = usePropertyStore();
  
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [tourType, setTourType] = useState<TourType>('panoramic');
  const [embedUrl, setEmbedUrl] = useState('');
  const [rooms, setRooms] = useState<TourRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Partial<TourRoom>>({
    name: '',
    panoramaImage: '',
    connections: [],
  });
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [sellerProperties, setSellerProperties] = useState<Property[]>([]);
  const [imageQuality, setImageQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [enableVRMode, setEnableVRMode] = useState(true);
  const [optimizeForLowEnd, setOptimizeForLowEnd] = useState(false);
  const [showPanoramaCapture, setShowPanoramaCapture] = useState(false);
  const [showWebViewPreview, setShowWebViewPreview] = useState(false);
  
  // Embed settings with proper typing
  const [embedSettings, setEmbedSettings] = useState({
    allowFullscreen: true,
    autoplay: false,
    showControls: true,
    responsive: true,
  });

  // Network status
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Filter properties owned by the current user
      const userProperties = properties.filter(p => p.sellerId === user.id);
      setSellerProperties(userProperties);
    }
  }, [user, properties]);

  const handlePropertySelect = (id: string) => {
    const property = sellerProperties.find(p => p.id === id);
    setSelectedProperty(property || null);
    setPropertyId(id);
    
    // If property already has tour data, load it
    if (property?.tourType) {
      setTourType(property.tourType);
    }
    if (property?.embedUrl) {
      setEmbedUrl(property.embedUrl);
    }
    if (property?.embedSettings) {
      // Handle optional properties properly with fallback values
      setEmbedSettings({
        allowFullscreen: property.embedSettings.allowFullscreen ?? true,
        autoplay: property.embedSettings.autoplay ?? false,
        showControls: property.embedSettings.showControls ?? true,
        responsive: property.embedSettings.responsive ?? true,
      });
    }
    if (property?.tourRooms) {
      setRooms(property.tourRooms);
    } else {
      setRooms([]);
    }
  };

  const validateEmbedUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to extract URL from iframe
  const extractUrlFromIframe = (iframeString: string): string => {
    const srcMatch = iframeString.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : iframeString;
  };

  const handleEmbedUrlChange = (text: string) => {
    // If user pastes an iframe, extract the src URL
    const url = text.includes('<iframe') ? extractUrlFromIframe(text) : text;
    setEmbedUrl(url);
  };

  const pickPanoramaImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: imageQuality === 'high' ? 1.0 : imageQuality === 'medium' ? 0.8 : 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCurrentRoom({
          ...currentRoom,
          panoramaImage: result.assets[0].uri,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick panorama image');
    }
  };

  const capturePanoramaImage = async () => {
    // For now, we'll simulate panorama capture with a placeholder
    // In a real implementation, this would use a 360 camera library
    const mockPanoramaUri = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1920&h=960&fit=crop';
    setCurrentRoom({
      ...currentRoom,
      panoramaImage: mockPanoramaUri,
    });
    setShowPanoramaCapture(false);
  };

  const addRoom = () => {
    if (!currentRoom.name || !currentRoom.panoramaImage) {
      Alert.alert('Error', 'Please provide a room name and panorama image');
      return;
    }

    const supportedDevices: DeviceCapability[] = optimizeForLowEnd ? ['low', 'medium', 'high'] : ['medium', 'high'];

    const newRoom: TourRoom = {
      id: Date.now().toString(),
      name: currentRoom.name,
      panoramaImage: currentRoom.panoramaImage,
      connections: currentRoom.connections || [],
      description: currentRoom.description,
      isMain: rooms.length === 0, // First room is main by default
      features: [],
      optimizedForLowEnd: optimizeForLowEnd,
      imageQuality,
      enableVRMode,
      supportedDevices,
    };

    setRooms([...rooms, newRoom]);
    setCurrentRoom({
      name: '',
      panoramaImage: '',
      connections: [],
      description: '',
    });
    setShowRoomForm(false);
  };

  const removeRoom = (id: string) => {
    // Remove this room from all other rooms' connections
    const updatedRooms = rooms.map(room => ({
      ...room,
      connections: room.connections.filter(connId => connId !== id),
    }));
    
    // Then remove the room itself
    const filteredRooms = updatedRooms.filter(room => room.id !== id);
    
    // If we removed the main room, make the first remaining room main
    if (filteredRooms.length > 0) {
      const removedRoom = rooms.find(r => r.id === id);
      if (removedRoom?.isMain) {
        filteredRooms[0].isMain = true;
      }
    }
    
    setRooms(filteredRooms);
  };

  const toggleRoomConnection = (roomId: string) => {
    const connections = currentRoom.connections || [];
    if (connections.includes(roomId)) {
      setCurrentRoom({
        ...currentRoom,
        connections: connections.filter(id => id !== roomId),
      });
    } else {
      setCurrentRoom({
        ...currentRoom,
        connections: [...connections, roomId],
      });
    }
  };

  const setMainRoom = (roomId: string) => {
    const updatedRooms = rooms.map(room => ({
      ...room,
      isMain: room.id === roomId,
    }));
    setRooms(updatedRooms);
  };

  const handleSubmit = async () => {
    if (!selectedProperty) {
      Alert.alert('Error', 'Please select a property');
      return;
    }

    if (tourType === 'embed') {
      if (!validateEmbedUrl(embedUrl)) {
        Alert.alert('Error', 'Please provide a valid embed URL');
        return;
      }
    } else if (tourType === 'panoramic') {
      if (rooms.length === 0) {
        Alert.alert('Error', 'Please add at least one room for the panoramic tour');
        return;
      }
    } else if (tourType === 'hybrid') {
      if (!validateEmbedUrl(embedUrl) && rooms.length === 0) {
        Alert.alert('Error', 'Please provide either an embed URL or add rooms for the hybrid tour');
        return;
      }
    }

    // Show offline warning if applicable
    if (!isOnline) {
      Alert.alert(
        'Offline Mode',
        'Your 3D tour will be saved locally and uploaded when you come back online.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Offline', onPress: () => performSubmit() }
        ]
      );
    } else {
      performSubmit();
    }
  };

  const performSubmit = async () => {
    try {
      const updateData: Partial<Property> = {
        has3DTour: true,
        tourType,
        tourSettings: {
          enableVRMode,
          optimizeForLowEnd: optimizeForLowEnd,
          imageQuality,
          supportOfflineViewing: true,
        },
      };

      if (tourType === 'embed' || tourType === 'hybrid') {
        updateData.embedUrl = embedUrl;
        updateData.embedSettings = embedSettings;
      }

      if (tourType === 'panoramic' || tourType === 'hybrid') {
        updateData.tourRooms = rooms;
      }

      await updateProperty(selectedProperty!.id, updateData);

      const successMessage = !isOnline 
        ? '3D tour saved offline successfully. It will be uploaded when you come back online.'
        : '3D tour added successfully';

      Alert.alert('Success', successMessage, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error adding 3D tour:', error);
      Alert.alert('Error', 'Failed to add 3D tour');
    }
  };

  // Generate embed HTML for WebView preview
  const generateEmbedHTML = () => {
    if (!embedUrl) return '';
    
    const responsive = embedSettings.responsive ? 'width="100%" height="100%"' : 'width="640" height="360"';
    const allowFullscreen = embedSettings.allowFullscreen ? 'allowfullscreen' : '';
    const autoplay = embedSettings.autoplay ? '&autoplay=1' : '';
    const controls = embedSettings.showControls ? '' : '&controls=0';
    
    // Handle different URL formats
    let finalUrl = embedUrl;
    if (embedUrl.includes('?')) {
      finalUrl = `${embedUrl}${autoplay}${controls}`;
    } else {
      finalUrl = `${embedUrl}?v=1${autoplay}${controls}`;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              background: #000; 
              overflow: hidden;
            }
            iframe { 
              border: none; 
              display: block; 
              width: 100vw;
              height: 100vh;
            }
            .container { 
              width: 100%; 
              height: 100vh; 
              display: flex;
              justify-content: center;
              align-items: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <iframe 
              src="${finalUrl}" 
              ${responsive}
              ${allowFullscreen}
              frameborder="0"
              scrolling="no"
              loading="lazy"
              allow="fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; magnetometer; xr-spatial-tracking;">
            </iframe>
          </div>
        </body>
      </html>
    `;
  };

  if (showWebViewPreview && embedUrl) {
    return (
      <SafeAreaView style={styles.webViewContainer} edges={['top']}>
        <Stack.Screen options={{ title: '3D Tour Preview' }} />
        
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={() => setShowWebViewPreview(false)} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>3D Tour Preview</Text>
          <View style={styles.placeholder} />
        </View>

        <WebView
          source={{ html: generateEmbedHTML() }}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.webViewLoadingText}>Loading 3D Tour...</Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
            Alert.alert('Error', 'Failed to load 3D tour. Please check the URL.');
          }}
          allowsFullscreenVideo={embedSettings.allowFullscreen}
          mediaPlaybackRequiresUserAction={!embedSettings.autoplay}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          allowsAirPlayForMediaPlayback={true}
          onLoadStart={() => console.log('WebView load started')}
          onLoadEnd={() => console.log('WebView load ended')}
          onMessage={(event) => console.log('WebView message:', event.nativeEvent.data)}
        />
      </SafeAreaView>
    );
  }

  if (showPanoramaCapture) {
    return (
      <SafeAreaView style={styles.cameraContainer} edges={['top']}>
        <Stack.Screen options={{ title: 'Capture Panorama' }} />
        
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setShowPanoramaCapture(false)} style={styles.closeButton}>
            <X size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.cameraTitle}>Capture 360° Panorama</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.camera}>
          <View style={styles.cameraOverlay}>
            <View style={styles.panoramaGuide}>
              <Text style={styles.panoramaGuideText}>
                Slowly rotate 360° to capture the entire room
              </Text>
              <View style={styles.panoramaIndicator} />
            </View>
            
            <View style={styles.cameraControls}>
              <TouchableOpacity 
                style={styles.captureButton}
                onPress={capturePanoramaImage}
              >
                <Camera size={32} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.cameraInstructions}>
          <Text style={styles.instructionText}>
            • Hold your device steady and rotate slowly
          </Text>
          <Text style={styles.instructionText}>
            • Keep the camera level for best results
          </Text>
          <Text style={styles.instructionText}>
            • Ensure good lighting throughout the room
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Add 3D Tour' }} />

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          {isOnline ? (
            <Wifi size={16} color={colors.success} />
          ) : (
            <WifiOff size={16} color={colors.warning} />
          )}
          <Text style={styles.statusText}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </Text>
        </View>
        {pendingUploads.length > 0 && (
          <View style={styles.pendingIndicator}>
            <Upload size={14} color={colors.warning} />
            <Text style={styles.pendingText}>
              {pendingUploads.length} pending
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Offline warning */}
        {!isOnline && (
          <View style={styles.offlineWarning}>
            <AlertCircle size={20} color={colors.warning} />
            <Text style={styles.offlineWarningText}>
              3D tours will be saved offline and uploaded when connection is restored
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Property</Text>
          <Text style={styles.sectionDescription}>
            Choose a property to add a 3D tour
          </Text>

          {sellerProperties.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propertiesScroll}>
              {sellerProperties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.propertyCard,
                    propertyId === property.id && styles.selectedPropertyCard,
                  ]}
                  onPress={() => handlePropertySelect(property.id)}
                >
                  <Image
                    source={{ uri: property.images[0] }}
                    style={styles.propertyImage}
                  />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyAddress} numberOfLines={1}>
                      {property.address}
                    </Text>
                    <Text style={styles.propertyDetails}>
                      {property.beds} bd • {property.baths} ba • {property.sqm.toLocaleString()} sqm
                    </Text>
                    {property.has3DTour && (
                      <View style={styles.tourBadge}>
                        <Box size={12} color={colors.secondary} />
                        <Text style={styles.tourBadgeText}>Has Tour</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPropertiesContainer}>
              <Text style={styles.emptyPropertiesText}>
                You do not have any properties yet. Add a property first.
              </Text>
              <TouchableOpacity
                style={styles.addPropertyButton}
                onPress={() => router.push('/seller/add-property')}
              >
                <Text style={styles.addPropertyButtonText}>Add Property</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {selectedProperty && (
          <>
            {/* Tour Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tour Type</Text>
              <Text style={styles.sectionDescription}>
                Choose how you want to create your 3D tour
              </Text>
              
              <View style={styles.tourTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.tourTypeOption,
                    tourType === 'embed' && styles.activeTourTypeOption
                  ]}
                  onPress={() => setTourType('embed')}
                >
                  <Globe size={24} color={tourType === 'embed' ? 'white' : colors.primary} />
                  <Text style={[
                    styles.tourTypeTitle,
                    tourType === 'embed' && styles.activeTourTypeTitle
                  ]}>
                    Embed URL
                  </Text>
                  <Text style={[
                    styles.tourTypeDescription,
                    tourType === 'embed' && styles.activeTourTypeDescription
                  ]}>
                    Use an existing 3D tour from platforms like Matterport, CloudPano, Zillow 3D Home, or others
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tourTypeOption,
                    tourType === 'panoramic' && styles.activeTourTypeOption
                  ]}
                  onPress={() => setTourType('panoramic')}
                >
                  <Camera size={24} color={tourType === 'panoramic' ? 'white' : colors.secondary} />
                  <Text style={[
                    styles.tourTypeTitle,
                    tourType === 'panoramic' && styles.activeTourTypeTitle
                  ]}>
                    Panoramic Tour
                  </Text>
                  <Text style={[
                    styles.tourTypeDescription,
                    tourType === 'panoramic' && styles.activeTourTypeDescription
                  ]}>
                    Create a custom tour using 360° panoramic images
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tourTypeOption,
                    tourType === 'hybrid' && styles.activeTourTypeOption
                  ]}
                  onPress={() => setTourType('hybrid')}
                >
                  <Box size={24} color={tourType === 'hybrid' ? 'white' : colors.text} />
                  <Text style={[
                    styles.tourTypeTitle,
                    tourType === 'hybrid' && styles.activeTourTypeTitle
                  ]}>
                    Hybrid Tour
                  </Text>
                  <Text style={[
                    styles.tourTypeDescription,
                    tourType === 'hybrid' && styles.activeTourTypeDescription
                  ]}>
                    Combine both embed URL and panoramic images
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Embed URL Section */}
            {(tourType === 'embed' || tourType === 'hybrid') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Embed URL</Text>
                <Text style={styles.sectionDescription}>
                  Paste the embed URL or iframe code from your 3D tour platform
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>3D Tour URL or iframe*</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={embedUrl}
                    onChangeText={handleEmbedUrlChange}
                    placeholder='https://app.cloudpano.com/tours/5yC0O-KbuXC or paste iframe code'
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    numberOfLines={3}
                  />
                  <Text style={styles.helperText}>
                    Supported: Matterport, CloudPano, Zillow 3D Home, Kuula, Roundme, and others. You can paste either the URL or the full iframe code.
                  </Text>
                </View>

                {/* Preview Button */}
                {validateEmbedUrl(embedUrl) && (
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => setShowWebViewPreview(true)}
                  >
                    <Eye size={20} color={colors.primary} />
                    <Text style={styles.previewButtonText}>Preview 3D Tour</Text>
                  </TouchableOpacity>
                )}
                
                <View style={styles.embedSettingsContainer}>
                  <Text style={styles.settingLabel}>Embed Settings:</Text>
                  
                  <View style={styles.settingsGrid}>
                    <TouchableOpacity 
                      style={styles.toggleSetting}
                      onPress={() => setEmbedSettings(prev => ({
                        ...prev,
                        allowFullscreen: !prev.allowFullscreen
                      }))}
                    >
                      <Maximize2 size={20} color={embedSettings.allowFullscreen ? colors.primary : colors.textLight} />
                      <Text style={[
                        styles.toggleText,
                        embedSettings.allowFullscreen && styles.activeToggleText
                      ]}>
                        Allow Fullscreen
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.toggleSetting}
                      onPress={() => setEmbedSettings(prev => ({
                        ...prev,
                        showControls: !prev.showControls
                      }))}
                    >
                      <Eye size={20} color={embedSettings.showControls ? colors.primary : colors.textLight} />
                      <Text style={[
                        styles.toggleText,
                        embedSettings.showControls && styles.activeToggleText
                      ]}>
                        Show Controls
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Tour Settings */}
            {(tourType === 'panoramic' || tourType === 'hybrid') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tour Settings</Text>
                
                <View style={styles.settingsGrid}>
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Image Quality:</Text>
                    <View style={styles.qualityButtons}>
                      {(['low', 'medium', 'high'] as const).map((quality) => (
                        <TouchableOpacity
                          key={quality}
                          style={[
                            styles.qualityButton,
                            imageQuality === quality && styles.activeQualityButton
                          ]}
                          onPress={() => setImageQuality(quality)}
                        >
                          <Text style={[
                            styles.qualityButtonText,
                            imageQuality === quality && styles.activeQualityButtonText
                          ]}>
                            {quality.charAt(0).toUpperCase() + quality.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.settingItem}>
                    <TouchableOpacity 
                      style={styles.toggleSetting}
                      onPress={() => setEnableVRMode(!enableVRMode)}
                    >
                      <Eye size={20} color={enableVRMode ? colors.primary : colors.textLight} />
                      <Text style={[
                        styles.toggleText,
                        enableVRMode && styles.activeToggleText
                      ]}>
                        Enable VR Mode
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.settingItem}>
                    <TouchableOpacity 
                      style={styles.toggleSetting}
                      onPress={() => setOptimizeForLowEnd(!optimizeForLowEnd)}
                    >
                      <Box size={20} color={optimizeForLowEnd ? colors.primary : colors.textLight} />
                      <Text style={[
                        styles.toggleText,
                        optimizeForLowEnd && styles.activeToggleText
                      ]}>
                        Optimize for Low-End Devices
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <Text style={styles.settingsNote}>
                  {optimizeForLowEnd 
                    ? 'Tour will be optimized for devices with limited processing power and slower connections'
                    : 'Tour will prioritize visual quality and features'
                  }
                </Text>
              </View>
            )}

            {/* Panoramic Rooms Section */}
            {(tourType === 'panoramic' || tourType === 'hybrid') && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tour Rooms</Text>
                  <TouchableOpacity
                    style={styles.addRoomButton}
                    onPress={() => setShowRoomForm(true)}
                  >
                    <Plus size={20} color={colors.primary} />
                    <Text style={styles.addRoomButtonText}>Add Room</Text>
                  </TouchableOpacity>
                </View>

                {rooms.length > 0 ? (
                  <View style={styles.roomsList}>
                    {rooms.map((room) => (
                      <View key={room.id} style={styles.roomItem}>
                        <Image
                          source={{ uri: room.panoramaImage }}
                          style={styles.roomThumbnail}
                        />
                        <View style={styles.roomInfo}>
                          <View style={styles.roomHeader}>
                            <Text style={styles.roomName}>{room.name}</Text>
                            {room.isMain && (
                              <View style={styles.mainRoomBadge}>
                                <Text style={styles.mainRoomBadgeText}>MAIN</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.roomConnections}>
                            Connected to: {room.connections.length} rooms
                          </Text>
                          {room.description && (
                            <Text style={styles.roomDescription} numberOfLines={2}>
                              {room.description}
                            </Text>
                          )}
                        </View>
                        <View style={styles.roomActions}>
                          {!room.isMain && (
                            <TouchableOpacity
                              style={styles.setMainButton}
                              onPress={() => setMainRoom(room.id)}
                            >
                              <Text style={styles.setMainButtonText}>Set Main</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.removeRoomButton}
                            onPress={() => removeRoom(room.id)}
                          >
                            <X size={20} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyRoomsContainer}>
                    <Box size={40} color={colors.textLight} />
                    <Text style={styles.emptyRoomsText}>
                      No rooms added yet. Add rooms to create a panoramic tour.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Room Form */}
            {showRoomForm && (tourType === 'panoramic' || tourType === 'hybrid') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add New Room</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Room Name*</Text>
                  <TextInput
                    style={styles.input}
                    value={currentRoom.name}
                    onChangeText={(text) => setCurrentRoom({ ...currentRoom, name: text })}
                    placeholder="e.g. Living Room, Kitchen, Bedroom"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Room Description (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={currentRoom.description}
                    onChangeText={(text) => setCurrentRoom({ ...currentRoom, description: text })}
                    placeholder="Describe this room and its features"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>360° Panorama Image*</Text>
                  {currentRoom.panoramaImage ? (
                    <View style={styles.panoramaContainer}>
                      <Image
                        source={{ uri: currentRoom.panoramaImage }}
                        style={styles.panoramaPreview}
                      />
                      <View style={styles.panoramaActions}>
                        <TouchableOpacity
                          style={styles.changePanoramaButton}
                          onPress={pickPanoramaImage}
                        >
                          <Text style={styles.changePanoramaButtonText}>Change Image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.capturePanoramaButton}
                          onPress={capturePanoramaImage}
                        >
                          <Camera size={16} color="white" />
                          <Text style={styles.capturePanoramaButtonText}>Capture New</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.panoramaOptions}>
                      <TouchableOpacity
                        style={styles.pickPanoramaButton}
                        onPress={pickPanoramaImage}
                      >
                        <Maximize2 size={24} color={colors.primary} />
                        <Text style={styles.pickPanoramaButtonText}>
                          Select from Gallery
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.capturePanoramaButtonLarge}
                        onPress={capturePanoramaImage}
                      >
                        <Camera size={24} color="white" />
                        <Text style={styles.capturePanoramaButtonLargeText}>
                          Capture 360° Panorama
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.helperText}>
                    Use a 360° panoramic image for the best virtual tour experience.
                    {optimizeForLowEnd && ' Lower quality images will load faster on slow connections.'}
                  </Text>
                </View>

                {rooms.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Connect to Other Rooms</Text>
                    <View style={styles.connectionsContainer}>
                      {rooms.map((room) => (
                        <TouchableOpacity
                          key={room.id}
                          style={[
                            styles.connectionItem,
                            currentRoom.connections?.includes(room.id) && styles.connectionItemSelected,
                          ]}
                          onPress={() => toggleRoomConnection(room.id)}
                        >
                          <Text
                            style={[
                              styles.connectionItemText,
                              currentRoom.connections?.includes(room.id) && styles.connectionItemTextSelected,
                            ]}
                          >
                            {room.name}
                          </Text>
                          {room.isMain && (
                            <View style={styles.connectionMainBadge}>
                              <Text style={styles.connectionMainBadgeText}>MAIN</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.helperText}>
                      Select which rooms visitors can navigate to from this room
                    </Text>
                  </View>
                )}

                <View style={styles.roomFormButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowRoomForm(false);
                      setCurrentRoom({
                        name: '',
                        panoramaImage: '',
                        connections: [],
                        description: '',
                      });
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addRoom}
                  >
                    <Text style={styles.addButtonText}>Add Room</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Upload size={20} color="white" />
                  <Text style={styles.submitButtonText}>
                    {!isOnline ? 'Save 3D Tour Offline' : 'Save 3D Tour'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  webViewTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  webViewLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  closeButton: {
    padding: 8,
  },
  cameraTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  camera: {
    flex: 1,
    backgroundColor: '#333',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  panoramaGuide: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 16,
    marginTop: 40,
  },
  panoramaGuideText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  panoramaIndicator: {
    width: 100,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  cameraControls: {
    alignItems: 'center',
    marginBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  cameraInstructions: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: colors.text,
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    color: colors.warning,
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 14,
    color: colors.warning,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 16,
  },
  tourTypeContainer: {
    gap: 12,
  },
  tourTypeOption: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  activeTourTypeOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tourTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  activeTourTypeTitle: {
    color: 'white',
  },
  tourTypeDescription: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  activeTourTypeDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  previewButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  embedSettingsContainer: {
    marginTop: 16,
  },
  settingsGrid: {
    gap: 16,
  },
  settingItem: {
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeQualityButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  qualityButtonText: {
    fontSize: 12,
    color: colors.text,
  },
  activeQualityButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  toggleSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  toggleText: {
    fontSize: 14,
    color: colors.textLight,
  },
  activeToggleText: {
    color: colors.primary,
    fontWeight: '500',
  },
  settingsNote: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  propertiesScroll: {
    marginBottom: 8,
  },
  propertyCard: {
    width: 200,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPropertyCard: {
    borderColor: colors.primary,
  },
  propertyImage: {
    width: '100%',
    height: 120,
  },
  propertyInfo: {
    padding: 8,
  },
  propertyAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  propertyDetails: {
    fontSize: 12,
    color: colors.textLight,
  },
  tourBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  tourBadgeText: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '500',
  },
  emptyPropertiesContainer: {
    alignItems: 'center',
    padding: 16,
  },
  emptyPropertiesText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  addPropertyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addPropertyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  addRoomButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  roomsList: {
    gap: 12,
  },
  roomItem: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomThumbnail: {
    width: 80,
    height: 80,
  },
  roomInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  mainRoomBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainRoomBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  roomConnections: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
  },
  roomDescription: {
    fontSize: 12,
    color: colors.textLight,
  },
  roomActions: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  setMainButton: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  setMainButtonText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  removeRoomButton: {
    padding: 4,
  },
  emptyRoomsContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyRoomsText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 12,
  },
  panoramaContainer: {
    marginBottom: 12,
  },
  panoramaPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  panoramaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  changePanoramaButton: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  changePanoramaButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  capturePanoramaButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  capturePanoramaButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  panoramaOptions: {
    gap: 12,
  },
  pickPanoramaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    gap: 8,
  },
  pickPanoramaButtonText: {
    fontSize: 14,
    color: colors.primary,
  },
  capturePanoramaButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 8,
    padding: 24,
    gap: 8,
  },
  capturePanoramaButtonLargeText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  connectionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  connectionItem: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  connectionItemText: {
    fontSize: 14,
    color: colors.text,
  },
  connectionItemTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  connectionMainBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  connectionMainBadgeText: {
    fontSize: 8,
    color: 'white',
    fontWeight: '600',
  },
  roomFormButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});