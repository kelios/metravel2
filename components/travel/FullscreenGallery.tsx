import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ZoomableGalleryImage from '@/components/travel/ZoomableGalleryImage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface FullscreenGalleryProps {
  visible: boolean;
  images: { url: string; thumbUrl?: string; alt?: string; caption?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

type GalleryImage = { url: string; thumbUrl?: string; alt?: string; caption?: string };

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
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomedRawIndex, setZoomedRawIndex] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<GalleryImage>>(null);

  // Seamless infinite loop: with more than one image, render a clone of the last
  // image before the first and a clone of the first after the last. A swipe past
  // either edge lands on a clone and is silently recentered onto the matching real
  // slide. Raw indices live in [0, n+1]; real indices live in [0, n-1].
  const loopEnabled = images.length > 1;
  const data = useMemo<GalleryImage[]>(() => {
    if (!loopEnabled) return images;
    return [images[images.length - 1], ...images, images[0]];
  }, [images, loopEnabled]);

  const toRealIndex = useCallback(
    (rawIndex: number) => {
      if (!loopEnabled) return rawIndex;
      const n = images.length;
      return ((rawIndex - 1) % n + n) % n;
    },
    [loopEnabled, images.length],
  );

  const toRawIndex = useCallback(
    (realIndex: number) => (loopEnabled ? realIndex + 1 : realIndex),
    [loopEnabled],
  );

  // Reset index when gallery opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setZoomedRawIndex(null);
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
        setCurrentIndex(toRealIndex(viewableItems[0].index));
      }
    },
    [toRealIndex],
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    [],
  );

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (!loopEnabled) return;
      const rawIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const n = images.length;
      if (rawIndex <= 0) {
        flatListRef.current?.scrollToOffset({ offset: n * SCREEN_WIDTH, animated: false });
        setCurrentIndex(n - 1);
      } else if (rawIndex >= n + 1) {
        flatListRef.current?.scrollToOffset({ offset: SCREEN_WIDTH, animated: false });
        setCurrentIndex(0);
      }
    },
    [loopEnabled, images.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: GalleryImage; index: number }) => (
      <View style={styles.slideContainer}>
        <ZoomableGalleryImage
          src={item.url}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          priority="high"
          alt={item.alt || 'Фото маршрута'}
          resetKey={`${visible}-${index}`}
          onInteractionChange={(active) => {
            setZoomedRawIndex((current) => {
              if (active) return index;
              return current === index ? null : current;
            });
          }}
        />
      </View>
    ),
    [visible],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * (SCREEN_WIDTH || info.averageItemLength),
        animated: false,
      });
    },
    [],
  );

  const currentCaption = String(images[currentIndex]?.caption ?? '').trim();

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
      <View style={[styles.container, { backgroundColor: colors.overlay }]}>
        {/* Image gallery */}
        <FlatList
          ref={flatListRef}
          data={data}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          scrollEnabled={zoomedRawIndex == null}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={toRawIndex(initialIndex)}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={onMomentumScrollEnd}
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
          <Feather name="x" size={24} color={colors.textOnDark} />
        </Pressable>

        {/* Counter (bottom-center) */}
        {images.length > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 16 }]}>
            <Text style={[styles.counterText, { color: colors.textOnDark }]}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {currentCaption ? (
          <View
            style={[
              styles.caption,
              {
                bottom: insets.bottom + (images.length > 1 ? 60 : 16),
                backgroundColor: colors.overlay,
              },
            ]}
            testID="travel-fullscreen-gallery-caption"
          >
            <Text style={[styles.captionText, { color: colors.textOnDark }]}>{currentCaption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  caption: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    zIndex: 10,
  },
  captionText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});
