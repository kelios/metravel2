/**
 * GalleryLightbox — fullscreen просмотр галереи (3.7)
 * Открывается по нажатию на фото в Slider.
 * Свайп влево/вправо, счётчик, кнопка закрытия.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { optimizeImageUrl, buildVersionedImageUrl } from '@/utils/imageOptimization';
import type { SliderImage } from '@/components/travel/Slider';

interface GalleryLightboxProps {
  images: SliderImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

export default function GalleryLightbox({
  images,
  initialIndex,
  visible,
  onClose,
}: GalleryLightboxProps) {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<SliderImage>>(null);

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

  const optimizedUrl = useCallback((img: SliderImage) => {
    const versioned = buildVersionedImageUrl(img.url, img.updated_at);
    return optimizeImageUrl(versioned, {
      width: Math.min(width * 2, 1920),
      height: Math.min(height * 2, 1080),
      format: 'webp',
      quality: 90,
      fit: 'contain',
    }) || versioned;
  }, [width, height]);

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => (
      <View style={[styles.slide, { width, height }]}>
        <ImageCardMedia
          src={optimizedUrl(item)}
          fit="contain"
          blurBackground={false}
          priority={Math.abs(index - currentIndex) <= 1 ? 'high' : 'low'}
          loading="eager"
          transition={0}
          style={StyleSheet.absoluteFillObject}
          alt={`Фото ${index + 1} из ${images.length}`}
        />
      </View>
    ),
    [width, height, images.length, optimizedUrl, currentIndex]
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
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Закрыть галерею"
      >
        <Feather name="x" size={24} color="#fff" />
      </Pressable>

      {/* Counter */}
      {images.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
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
