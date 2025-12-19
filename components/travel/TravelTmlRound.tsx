// components/travel/TravelTmlRound.tsx
import React, { memo, useMemo, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Paragraph } from "react-native-paper";
import { router } from "expo-router";
import type { Travel } from "@/src/types/types";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';

type Props = { travel: Travel };

const PLACEHOLDER = require("@/assets/placeholder.webp");

const TravelTmlRound: React.FC<Props> = ({ travel }) => {
    const { width, isPhone, isLargePhone, isTablet, isDesktop } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isLargeDesktop = width >= 1440;

    const {
        name = "Без названия",
        slug,
        travel_image_thumb_small_url,
        countryName = "Страна не указана",
    } = travel;

    // ✅ УЛУЧШЕНИЕ: Адаптивные размеры для пропорциональных карточек
    const cardDimensions = useMemo(() => {
      if (isLargeDesktop) {
        return { imageSize: 240, cardPadding: 16 };
      } else if (isDesktop) {
        return { imageSize: 220, cardPadding: 14 };
      } else if (isTablet) {
        return { imageSize: 180, cardPadding: 12 };
      } else {
        return { imageSize: 160, cardPadding: 12 };
      }
    }, [isMobile, isTablet, isDesktop, isLargeDesktop]);
    
    const size = cardDimensions.imageSize;
    const radius = 16; // ✅ УЛУЧШЕНИЕ: Современные скругленные углы вместо круга

    // ✅ УЛУЧШЕНИЕ: Оптимизация URL изображения
    const optimizedImageUrl = useMemo(() => {
      if (!travel_image_thumb_small_url) return undefined;
      
      const versionedUrl = buildVersionedImageUrl(
        travel_image_thumb_small_url,
        (travel as any).updated_at,
        travel.id
      );
      
      const optimalSize = getOptimalImageSize(size, size);
      
      return optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        height: optimalSize.height,
        format: 'webp',
        quality: 85,
        fit: 'cover',
      }) || versionedUrl;
    }, [travel_image_thumb_small_url, size, travel]);

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
          aspectRatio: 1,
          borderRadius: radius,
          overflow: 'hidden' as const,
        }),
        [radius]
    );
    const imgStyle = useMemo(
        () => ({ width: '100%', height: '100%' }),
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
                        <View style={styles.placeholder}>
                            <View style={styles.placeholderIcon}>
                                <Text style={styles.placeholderIconText}>🗺️</Text>
                            </View>
                            <Text style={styles.placeholderText} numberOfLines={2}>
                                Нет изображения
                            </Text>
                        </View>
                    ) : (
                        <ExpoImage
                            source={{ uri: optimizedImageUrl }}
                            onError={() => setFailed(true)}
                            style={[styles.image, imgStyle]}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            priority="low"
                            transition={200}
                            {...(Platform.OS === "web" ? { loading: "lazy" as any } : {})}
                        />
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
        padding: DESIGN_TOKENS.spacing.sm,
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
                    transform: 'translateY(-4px)',
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
        ...Platform.select({
            web: {
                aspectRatio: '1',
            },
        }),
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
    
    // ✅ УЛУЧШЕНИЕ: Современный placeholder
    placeholder: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        backgroundColor: 'rgba(255,255,255,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: DESIGN_TOKENS.spacing.lg,
        overflow: 'hidden',
    },
    placeholderIcon: {
        marginBottom: 8,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,159,90,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderIconText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
    },
    placeholderText: {
        color: '#ff8f4c',
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(255,255,255,0.9)',
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
    },
    overlayTitle: {
        color: '#f9fafb',
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        lineHeight: 18,
    },
    overlaySubtitle: {
        color: '#e5e7eb',
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '500',
    },
});
