// components/travel/TravelTmlRound.tsx
import React, { memo, useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    type ViewStyle,
    type ImageStyle,
    Text,
    View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import type { Travel } from "@/src/types/types";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';

type Props = { travel: Travel };

const TravelTmlRound: React.FC<Props> = ({ travel }) => {
    const { width, isTablet, isDesktop } = useResponsive();
    const isLargeDesktop = width >= 1440;

    const {
        name = "Без названия",
        slug,
        travel_image_thumb_small_url,
        travel_image_thumb_url,
        countryName = "Страна не указана",
    } = travel;

    const baseImageUrl = useMemo(() => {
      const directSmall = (travel_image_thumb_small_url as any) as string | null | undefined;
      const directThumb = (travel_image_thumb_url as any) as string | null | undefined;
      const fallbackCandidates = [
        directSmall,
        directThumb,
        (travel as any)?.travel_image_url,
        (travel as any)?.imageUrl,
        (travel as any)?.image_url,
        (travel as any)?.thumb,
        (travel as any)?.thumbnail,
      ].filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];

      if (fallbackCandidates.length > 0) return fallbackCandidates[0];

      const gallery = (travel as any)?.gallery;
      if (Array.isArray(gallery) && gallery.length > 0) {
        const first = gallery[0];
        if (typeof first === 'string' && first.trim().length > 0) return first;
        if (first && typeof first === 'object') {
          const url = (first as any).url;
          if (typeof url === 'string' && url.trim().length > 0) return url;
        }
      }

      return undefined;
    }, [travel, travel_image_thumb_small_url, travel_image_thumb_url]);

    // ✅ УЛУЧШЕНИЕ: Адаптивные размеры для пропорциональных карточек
    const cardDimensions = useMemo(() => {
      if (isLargeDesktop) {
        return { imageHeight: 240, cardPadding: 0 };
      } else if (isDesktop) {
        return { imageHeight: 220, cardPadding: 0 };
      } else if (isTablet) {
        return { imageHeight: 200, cardPadding: 0 };
      } else {
        return { imageHeight: 180, cardPadding: 0 };
      }
    }, [isTablet, isDesktop, isLargeDesktop]);
    
    const imageHeight = cardDimensions.imageHeight;
    const radius = 16;

    // ✅ УЛУЧШЕНИЕ: Оптимизация URL изображения
    const optimizedImageUrl = useMemo(() => {
      if (!baseImageUrl) return undefined;
      
      const versionedUrl = buildVersionedImageUrl(
        baseImageUrl,
        (travel as any).updated_at,
        travel.id
      );
      
      const optimalSize = getOptimalImageSize(Math.round(imageHeight * 1.8), imageHeight);
      
      return optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        height: optimalSize.height,
        format: 'webp',
        quality: 85,
        fit: 'contain',
      }) || versionedUrl;
    }, [baseImageUrl, imageHeight, travel]);

    // fallback, если изображение не загрузилось
    const [failed, setFailed] = useState(false);
    const canOpen = Boolean(slug);

    const onPress = () => {
        if (!canOpen) return;
        router.push(`/travels/${slug}`);
    };

    // ✅ УЛУЧШЕНИЕ: Пропорциональные стили с aspect ratio
    const imageWrapperStyle = useMemo(
        () => ({
            width: '100%',
            ...(Platform.OS === 'web'
              ? ({ aspectRatio: 4 / 3 } as any)
              : { height: imageHeight }),
            borderRadius: radius,
            overflow: 'hidden' as const,
        }) as ViewStyle,
        [radius, imageHeight]
    );
    const imgStyle = useMemo(
        () => ({ width: '100%', height: '100%' }) as ImageStyle,
        []
    );

    return (
        <View style={styles.container}>
            <Pressable
                onPress={onPress}
                disabled={!canOpen}
                android_ripple={{ color: `${DESIGN_TOKENS.colors.primary}33`, borderless: false }} // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
                style={({ pressed }) => [
                    styles.card,
                    globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                    { padding: cardDimensions.cardPadding },
                    pressed && styles.cardPressed,
                    !canOpen && styles.cardDisabled,
                ]}
                accessibilityRole="link"
                accessibilityLabel={`${name}, ${countryName}`}
            >
                <View style={[styles.imageWrapper, imageWrapperStyle]}>
                    {failed || !optimizedImageUrl ? (
                        <View style={styles.placeholder} />
                    ) : (
                        <>
                            <ExpoImage
                                source={{ uri: optimizedImageUrl }}
                                onError={() => setFailed(true)}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={0}
                                blurRadius={12}
                            />
                            <View style={styles.imageOverlay} />
                            <ExpoImage
                                source={{ uri: optimizedImageUrl }}
                                onError={() => setFailed(true)}
                                style={[styles.image, imgStyle]}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                transition={200}
                                {...(Platform.OS === "web" ? { loading: "lazy" as any } : {})}
                            />
                        </>
                    )}

                    <View style={styles.overlayBottom}>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={styles.overlayTitle}
                        >
                            {name}
                        </Text>
                        <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={styles.overlaySubtitle}
                        >
                            {countryName}
                        </Text>
                    </View>
                </View>
            </Pressable>
        </View>
    );
};

export default memo(TravelTmlRound);

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        padding: 0,
        ...Platform.select({
            web: {
                display: 'flex' as any,
                flexDirection: 'column' as any,
                height: '100%',
            },
        }),
    },

    // ✅ УЛУЧШЕНИЕ: Современная матовая карточка без границ, только тени
    card: {
        alignItems: "center",
        borderRadius: DESIGN_TOKENS.radii.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        width: '100%',
        height: '100%',
        shadowColor: "#1f1f1f",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        ...(Platform.OS === "android" ? { elevation: 3 } : null),
        ...Platform.select({
            web: {
                cursor: "pointer" as any,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: DESIGN_TOKENS.shadows.card,
                ':hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: DESIGN_TOKENS.shadows.hover,
                } as any,
                ':active': {
                    transform: 'translateY(-1px)',
                    boxShadow: DESIGN_TOKENS.shadows.medium,
                } as any,
            },
        }),
    },
    cardPressed: { 
        opacity: 0.9,
        transform: [{ scale: 0.97 }],
    },
    cardDisabled: {
        opacity: 0.5,
        ...Platform.select({
            web: { cursor: "not-allowed" as any },
        }),
    },

    // ✅ УЛУЧШЕНИЕ: Пропорциональный контейнер изображения
    imageWrapper: {
        width: '100%',
        overflow: "hidden",
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.lg,
    },
    image: { 
        width: "100%", 
        height: "100%",
        ...Platform.select({
            web: {
                objectFit: 'cover' as any,
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                ':hover': {
                    transform: 'scale(1.08)',
                } as any,
            },
        }),
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    
    // ✅ УЛУЧШЕНИЕ: Современный placeholder
    placeholder: {
        width: '100%',
        height: '100%',
        borderRadius: DESIGN_TOKENS.radii.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderLight,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    },

    // ✅ Нижний оверлей как в попапе
    overlayBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 8,
        backgroundColor: 'rgba(15,23,42,0.78)',
        flexDirection: 'column',
        gap: DESIGN_TOKENS.spacing.xs,
        ...Platform.select({
            web: {
                paddingHorizontal: 'clamp(12px, 1.4vw, 16px)' as any,
                paddingVertical: 'clamp(10px, 1.1vw, 14px)' as any,
                backgroundColor: 'transparent' as any,
                backgroundImage:
                    'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.60) 55%, rgba(0,0,0,0.78) 100%)' as any,
            } as any,
        }),
    },
    overlayTitle: {
        color: '#f9fafb',
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        lineHeight: 18,
        ...Platform.select({
            web: {
                fontSize: 'clamp(14px, 1.2vw, 16px)' as any,
                lineHeight: 'clamp(18px, 1.5vw, 22px)' as any,
                display: '-webkit-box' as any,
                WebkitBoxOrient: 'vertical' as any,
                WebkitLineClamp: 2 as any,
                overflow: 'hidden' as any,
            } as any,
        }),
    },
    overlaySubtitle: {
        color: '#e5e7eb',
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '500',
        ...Platform.select({
            web: {
                fontSize: 'clamp(12px, 1.0vw, 13px)' as any,
                lineHeight: 'clamp(16px, 1.3vw, 18px)' as any,
                opacity: 0.9,
            } as any,
        }),
    },
});
