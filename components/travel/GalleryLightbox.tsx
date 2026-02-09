/**
 * GalleryLightbox — fullscreen просмотр галереи (3.7)
 * Открывается по нажатию на фото в Slider.
 * Свайп влево/вправо, счётчик, кнопка закрытия.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ImageCardMedia, { prefetchImage } from '@/components/ui/ImageCardMedia';
import { getPreferredImageFormat, optimizeImageUrl, buildVersionedImageUrl } from '@/utils/imageOptimization';
import type { SliderImage } from '@/components/travel/Slider';
import { useThemedColors } from '@/hooks/useTheme';

/**
 * On web, useWindowDimensions returns the RN layout viewport which may exclude
 * sidebars / navigation chrome.  We need the real browser viewport so the
 * lightbox covers the entire screen.
 */
function useFullViewport() {
  const rn = useWindowDimensions();

  const getWebSize = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return rn;
    return { width: window.innerWidth, height: window.innerHeight };
  };

  const [size, setSize] = useState(getWebSize);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return Platform.OS === 'web' ? size : rn;
}

interface GalleryLightboxProps {
  images: SliderImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

function GalleryLightbox({
  images,
  initialIndex,
  visible,
  onClose,
}: GalleryLightboxProps) {
  const { width, height } = useFullViewport();
  const colors = useThemedColors();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<SliderImage>>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems.find((v) => v.index != null);
      if (first && typeof first.index === 'number') {
        setCurrentIndex(first.index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const canPrefetch = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    if (typeof navigator === 'undefined') return false;
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection?.saveData) return false;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g') || effectiveType === '3g') return false;
    return true;
  }, []);

  const optimizedUrl = useCallback(
    (img: SliderImage) => {
      const versioned = buildVersionedImageUrl(img.url, img.updated_at, img.id);
      const targetWidth = Math.min(Math.round(width * 1.5), 1600);
      const targetHeight = Math.min(Math.round(height * 1.5), 1200);
      return (
        optimizeImageUrl(versioned, {
          width: targetWidth,
          height: targetHeight,
          format: getPreferredImageFormat(),
          quality: 82,
          fit: 'contain',
          dpr: 1,
        }) || versioned
      );
    },
    [width, height]
  );

  const uriMap = useMemo(() => images.map((img) => optimizedUrl(img)), [images, optimizedUrl]);

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!visible) return;
      if (!canPrefetch) return;
      const targets = [idx - 1, idx + 1, idx - 2, idx + 2];
      targets.forEach((t) => {
        if (t < 0 || t >= uriMap.length) return;
        const uri = uriMap[t];
        if (!uri) return;
        prefetchImage(uri).catch(() => undefined);
      });
    },
    [canPrefetch, uriMap, visible]
  );

  useEffect(() => {
    warmNeighbors(currentIndex);
  }, [currentIndex, warmNeighbors]);

  // Block body scroll when lightbox is open (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  // Keyboard: Escape to close, arrows to navigate
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') {
        const prev = currentIndex - 1;
        if (prev >= 0) {
          listRef.current?.scrollToIndex({ index: prev, animated: true });
          setCurrentIndex(prev);
        }
      } else if (e.key === 'ArrowRight') {
        const next = currentIndex + 1;
        if (next < images.length) {
          listRef.current?.scrollToIndex({ index: next, animated: true });
          setCurrentIndex(next);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, currentIndex, images.length, onClose]);

  const goToPrev = useCallback(() => {
    const prev = currentIndex - 1;
    if (prev >= 0) {
      listRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIndex(prev);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next < images.length) {
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  }, [currentIndex, images.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => (
      <View style={[styles.slide, { width, height }]}>
        <ImageCardMedia
          src={uriMap[index] || optimizedUrl(item)}
          fit="contain"
          blurBackground={false}
          priority={Math.abs(index - currentIndex) <= 1 ? 'high' : 'low'}
          loading={Math.abs(index - currentIndex) <= 1 ? 'eager' : 'lazy'}
          transition={0}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFillObject}
          alt={`Фото ${index + 1} из ${images.length}`}
        />
      </View>
    ),
    [width, height, images.length, uriMap, optimizedUrl, currentIndex]
  );

  const keyExtractor = useCallback((item: SliderImage) => String(item.id), []);

  const content = (
    <View style={[styles.container, { width, height }]}>
      <FlatList
        ref={listRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={3}
        windowSize={5}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Закрыть галерею"
      >
        <Feather name="x" size={24} color={colors.textOnDark} />
      </Pressable>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <TouchableOpacity
              onPress={goToPrev}
              activeOpacity={0.8}
              style={[styles.navBtn, styles.navBtnLeft]}
              accessibilityRole="button"
              accessibilityLabel="Предыдущее фото"
            >
              <Feather name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          {currentIndex < images.length - 1 && (
            <TouchableOpacity
              onPress={goToNext}
              activeOpacity={0.8}
              style={[styles.navBtn, styles.navBtnRight]}
              accessibilityRole="button"
              accessibilityLabel="Следующее фото"
            >
              <Feather name="chevron-right" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <View style={styles.counter}>
          <Text style={[styles.counterText, { color: colors.textOnDark }]}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View
        style={[styles.webOverlay, { width, height }]}
        {...({ onClick: (e: any) => { if (e.target === e.currentTarget) onClose(); } } as any)}
      >
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  webOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        zIndex: 99999,
      },
      default: {},
    }),
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.select({ ios: 54, default: 16 }),
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  navBtnLeft: {
    left: 16,
  },
  navBtnRight: {
    right: 16,
  },
  counter: {
    position: 'absolute',
    bottom: Platform.select({ ios: 44, default: 24 }),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default React.memo(GalleryLightbox);
