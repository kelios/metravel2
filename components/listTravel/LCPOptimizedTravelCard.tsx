import React, { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { optimizeLCPImage, ultraCriticalCSS } from '@/utils/advancedPerformanceOptimization';
import { fetchUserProfile } from '@/src/api/user';
import { TRAVEL_CARD_MAX_WIDTH } from './utils/listTravelConstants';

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
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef<any>(null);

  const authorUserId = useMemo(() => {
    const ownerId = travel?.userIds ?? travel?.userId ?? travel?.user?.id ?? null;
    if (ownerId == null) return null;
    const v = String(ownerId).trim();
    return v ? v : null;
  }, [travel?.userIds, travel?.userId, travel?.user?.id]);

  const handleAuthorPress = useCallback(
    (e?: any) => {
      if (!authorUserId) return;
      e?.stopPropagation?.();
      e?.preventDefault?.();
      router.push(`/user/${authorUserId}` as any);
    },
    [authorUserId, router]
  );

  const authorAvatarUri = useMemo(() => {
    const uri =
      travel?.user?.avatar ??
      travel?.userAvatar ??
      travel?.avatar ??
      travel?.authorAvatar ??
      null;
    if (!uri) return null;
    const v = String(uri).trim();
    return v ? v : null;
  }, [travel?.user?.avatar, travel?.userAvatar, travel?.avatar, travel?.authorAvatar]);

  const shouldFetchAuthorProfile = !!authorUserId && !authorAvatarUri;

  const { data: authorProfile } = useQuery({
    queryKey: ['user-profile', authorUserId],
    queryFn: () => fetchUserProfile(String(authorUserId)),
    enabled: shouldFetchAuthorProfile,
    staleTime: 10 * 60 * 1000,
  });

  const resolvedAuthorAvatarUri = useMemo(() => {
    if (authorAvatarUri) return authorAvatarUri;
    const uri = authorProfile?.avatar ?? null;
    if (!uri) return null;
    const v = String(uri).trim();
    return v ? v : null;
  }, [authorAvatarUri, authorProfile?.avatar]);

  const authorProfileFullName = useMemo(() => {
    const clean = (value: unknown) => {
      const v = String(value ?? '').trim();
      if (!v) return '';
      const lower = v.toLowerCase();
      if (lower === 'null' || lower === 'undefined') return '';
      return v;
    };

    const full = `${clean(authorProfile?.first_name)} ${clean(authorProfile?.last_name)}`.trim();
    return full || null;
  }, [authorProfile?.first_name, authorProfile?.last_name]);

  const authorName = useMemo(() => {
    const name =
      travel?.userName ??
      travel?.user?.name ??
      travel?.authorName ??
      authorProfileFullName ??
      'Аноним';
    const v = String(name ?? '').trim();
    return v || 'Аноним';
  }, [travel?.userName, travel?.user?.name, travel?.authorName, authorProfileFullName]);

  const authorInitial = useMemo(() => {
    const first = authorName.trim().slice(0, 1).toUpperCase();
    return first || '?';
  }, [authorName]);

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
        console.info(`[LCP] First card loaded in: ${lastEntry.startTime.toFixed(2)}ms`);
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
          <>
            <ExpoImage
              source={{ uri: optimizedImageSrc }}
              style={styles.blurBg}
              contentFit="cover"
              priority="low"
              cachePolicy="disk"
              transition={0}
              blurRadius={isFirst ? 0 : 16}
              recyclingKey={`${optimizedImageSrc}-bg`}
            />
            <View style={styles.blurOverlay} />
            <ExpoImage
              ref={imageRef}
              source={{ uri: optimizedImageSrc }}
              style={[styles.image, !isLoaded && { opacity: 0 }]}
              contentFit="contain"
              priority={isFirst ? 'high' : 'low'}
              cachePolicy="disk"
              onLoad={handleImageLoad}
              // LCP оптимизации
              fadeDuration={isFirst ? 0 : 200}
              placeholder="blur"
              blurRadius={isFirst ? 0 : 20}
              recyclingKey={optimizedImageSrc}
            />
          </>
        )}
      </View>

      {/* Контент с критическими стилями */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {travel.name}
        </Text>
        <View style={styles.meta}>
          <Pressable
            onPress={handleAuthorPress}
            disabled={!authorUserId}
            accessibilityRole={authorUserId ? 'button' : undefined}
            accessibilityLabel={authorUserId ? `Открыть профиль автора ${authorName}` : undefined}
            style={[styles.authorRow, Platform.OS === 'web' && authorUserId ? ({ cursor: 'pointer' } as any) : null]}
          >
            <View style={styles.authorAvatar}>
              {resolvedAuthorAvatarUri ? (
                <ExpoImage
                  source={{ uri: resolvedAuthorAvatarUri }}
                  style={styles.authorAvatarImage}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <Text style={styles.authorInitial}>{authorInitial}</Text>
              )}
            </View>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
          </Pressable>
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
    maxWidth: TRAVEL_CARD_MAX_WIDTH,
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
    overflow: 'hidden',
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  authorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  authorInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  authorName: {
    fontSize: 14,
    color: '#6b7280',
    flexShrink: 1,
  },
  views: {
    fontSize: 14,
    color: '#6b7280',
  },
});
