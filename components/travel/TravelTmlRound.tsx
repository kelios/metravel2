// components/travel/TravelTmlRound.tsx
import React, { memo, useMemo, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Paragraph } from "react-native-paper";
import { router } from "expo-router";
import type { Travel } from "@/src/types/types";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from "@/utils/imageOptimization";

type Props = { travel: Travel };

const PLACEHOLDER = require("@/assets/placeholder.webp");

const TravelTmlRound: React.FC<Props> = ({ travel }) => {
    const { width } = useWindowDimensions();
    // ✅ УЛУЧШЕНИЕ: Более точные брейкпоинты
    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;
    const isDesktop = width >= 1024;
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
                android_ripple={{ color: "rgba(255,159,90,0.2)", borderless: false }}
                style={({ pressed }) => [
                    styles.card,
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
                </View>

                <View style={styles.textContainer}>
                    <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
                        {name}
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.subtitle}>
                        {countryName}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
};

export default memo(TravelTmlRound);

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        padding: 8,
        ...Platform.select({
            web: {
                display: 'flex' as any,
                flexDirection: 'column' as any,
                height: '100%',
            },
        }),
    },

    // ✅ УЛУЧШЕНИЕ: Современная карточка с улучшенными тенями и анимациями
    card: {
        alignItems: "center",
        borderRadius: 20,
        backgroundColor: "#fff",
        width: '100%',
        height: '100%',
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...(Platform.OS === "android" ? { elevation: 4 } : null),
        ...Platform.select({
            web: {
                cursor: "pointer" as any,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform, box-shadow',
                ':hover': {
                    transform: 'translateY(-6px) scale(1.02)',
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    shadowOffset: { width: 0, height: 8 },
                    borderColor: 'rgba(255,159,90,0.3)',
                } as any,
                ':active': {
                    transform: 'translateY(-2px) scale(0.98)',
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
        backgroundColor: "#f3f4f6",
        marginBottom: 12,
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
        padding: 16,
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
        fontSize: 28,
    },
    placeholderText: {
        color: '#ff8f4c',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(255,255,255,0.9)',
    },

    // ✅ УЛУЧШЕНИЕ: Улучшенная типографика
    textContainer: {
        width: '100%',
        paddingHorizontal: 4,
        gap: 6,
    },
    title: {
        color: "#1f2937",
        fontSize: 15,
        fontWeight: "700",
        textAlign: "center",
        lineHeight: 20,
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "500",
        letterSpacing: 0.1,
    },
});
