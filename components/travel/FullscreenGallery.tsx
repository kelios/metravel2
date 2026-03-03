// components/travel/FullscreenGallery.tsx
// AND-28: Fullscreen image gallery for native (Android/iOS).
// Hides status bar and navigation bar for immersive viewing.
// On web — not rendered (web has its own lightbox pattern).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface FullscreenGalleryProps {
  visible: boolean;
  images: { url: string; thumbUrl?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * AND-28: Immersive fullscreen gallery with hidden system bars.
 * Uses FlatList with horizontal paging for smooth swipe navigation.
 * Only renders on native (Android/iOS).
 */
export default function FullscreenGallery({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: FullscreenGalleryProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  // Reset index when gallery opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  // Hide navigation bar on Android when fullscreen
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    let NavigationBar: any;
    try {
      NavigationBar = require('expo-navigation-bar');
      NavigationBar.setVisibilityAsync('hidden');
    } catch {
      // not available
    }
    return () => {
      try {
        if (NavigationBar) {
          NavigationBar.setVisibilityAsync('visible');
        }
      } catch {
        // noop
      }
    };
  }, [visible]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: { url: string; thumbUrl?: string } }) => (
      <View style={styles.slideContainer}>
        <Image
          source={{ uri: item.url }}
          placeholder={item.thumbUrl ? { uri: item.thumbUrl } : undefined}
          style={styles.image}
          contentFit="contain"
          transition={200}
          accessibilityLabel="Фото маршрута"
        />
      </View>
    ),
    [],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  // Web: don't render (all hooks already called above)
  if (Platform.OS === 'web') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar hidden animated />
      <View style={styles.container}>
        {/* Image gallery */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          keyExtractor={(_, i) => String(i)}
          bounces={false}
          decelerationRate="fast"
        />

        {/* Close button (top-right, respects safe area) */}
        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Закрыть галерею"
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#fff" />
        </Pressable>

        {/* Counter (bottom-center) */}
        {images.length > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 16 }]}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 48, // AND-26: M3 touch target
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 10,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

