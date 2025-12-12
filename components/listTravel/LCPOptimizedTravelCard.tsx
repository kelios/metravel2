import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { optimizeLCPImage, ultraCriticalCSS } from '@/utils/advancedPerformanceOptimization';

interface LCPOptimizedTravelCardProps {
  travel: any;
  isFirst?: boolean;
  isMobile?: boolean;
}

export const LCPOptimizedTravelCard = memo(function LCPOptimizedTravelCard({
  travel,
  isFirst = false,
  isMobile = false,
}: LCPOptimizedTravelCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef<any>(null);

  // LCP оптимизация для первой карточки
  useEffect(() => {
    if (isFirst && Platform.OS === 'web' && typeof document !== 'undefined') {
      // Инжектим critical CSS немедленно
      const criticalStyle = document.createElement('style');
      criticalStyle.textContent = ultraCriticalCSS;
      criticalStyle.setAttribute('data-lcp-critical', 'true');
      if (!document.querySelector('[data-lcp-critical]')) {
        document.head.insertBefore(criticalStyle, document.head.firstChild);
      }

      // Preload изображения с высоким приоритетом
      if (travel.travel_image_thumb_url) {
        const optimizedSrc = optimizeLCPImage(travel.travel_image_thumb_url);
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'image';
        preloadLink.href = optimizedSrc;
        preloadLink.fetchPriority = 'high';
        document.head.appendChild(preloadLink);
      }
    }
  }, [isFirst, travel.travel_image_thumb_url]);

  const optimizedImageSrc = travel.travel_image_thumb_url 
    ? optimizeLCPImage(travel.travel_image_thumb_url)
    : null;

  const handleImageLoad = () => {
    setIsLoaded(true);
    // LCP метрика
    if (isFirst && typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log(`[LCP] First card loaded in: ${lastEntry.startTime.toFixed(2)}ms`);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  };

  return (
    <View style={[styles.card, isMobile && styles.mobileCard]}>
      {/* LCP оптимизированное изображение */}
      <View style={styles.imageContainer}>
        {!isLoaded && <View style={styles.skeleton} />}
        {optimizedImageSrc && (
          <ExpoImage
            ref={imageRef}
            source={{ uri: optimizedImageSrc }}
            style={[styles.image, !isLoaded && { opacity: 0 }]}
            contentFit="cover"
            priority={isFirst ? 'high' : 'low'}
            cachePolicy="disk"
            onLoad={handleImageLoad}
            // LCP оптимизации
            fadeDuration={isFirst ? 0 : 200}
            placeholder="blur"
            blurRadius={isFirst ? 0 : 20}
            recyclingKey={optimizedImageSrc}
          />
        )}
      </View>

      {/* Контент с критическими стилями */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {travel.name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.author}>
            {travel.userName || 'Аноним'}
          </Text>
          {travel.countUnicIpView > 0 && (
            <Text style={styles.views}>
              {travel.countUnicIpView} просмотров
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    // LCP оптимизация - фиксированная высота для предотвращения layout shift
    height: 360,
    // Улучшенная тень для глубины
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  mobileCard: {
    height: 320,
  },
  imageContainer: {
    width: '100%',
    height: 220, // Фиксированная высота для LCP
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 22,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: 14,
    color: '#6b7280',
  },
  views: {
    fontSize: 14,
    color: '#6b7280',
  },
});
