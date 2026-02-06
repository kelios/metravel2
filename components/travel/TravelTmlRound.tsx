// components/travel/TravelTmlRound.tsx
import React, { memo, useMemo } from "react";
import {
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { router } from "expo-router";
import type { Travel } from "@/types/types";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { buildVersionedImageUrl, getOptimalImageSize, optimizeImageUrl } from "@/utils/imageOptimization";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { useThemedColors } from '@/hooks/useTheme';

type Props = { travel: Travel };

const CARD_HEIGHT = 250;
const CARD_IMAGE_HEIGHT = 170;

const TravelTmlRound: React.FC<Props> = ({ travel }) => {
    useResponsive();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
        (travel as any)?.travelImageThumbSmallUrl,
        (travel as any)?.travelImageThumbUrl,
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

    // Фиксированная высота карточки и изображения
    const imageHeight = CARD_IMAGE_HEIGHT;

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

    const canOpen = Boolean(slug || travel?.id);

    const onPress = () => {
        if (!canOpen) return;
        router.push(`/travels/${slug || travel.id}`);
    };

    const overlay = (
        <View style={styles.overlayBottom}>
            <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={styles.overlayTitle}
            >
                {name}
            </Text>
        </View>
    );

    // Create content slot to show only country information
    const contentSlot = useMemo(() => {
        if (!countryName || countryName === "Страна не указана") return null;
        
        return (
            <View style={styles.locationRow}>
                <Text style={styles.locationText} numberOfLines={1}>
                    {countryName}
                </Text>
            </View>
        );
    }, [countryName, styles.locationRow, styles.locationText]);

    return (
        <View style={styles.container}>
            <UnifiedTravelCard
                title={name}
                imageUrl={optimizedImageUrl ?? null}
                onPress={onPress}
                mediaFit="contain"
                heroTitleOverlay={false}
                containerOverlaySlot={overlay}
                contentSlot={contentSlot}
                imageHeight={imageHeight}
                contentContainerStyle={styles.compactContent}
                style={[
                    styles.card,
                    globalFocusStyles.focusable,
                    { padding: 0 },
                    !canOpen && styles.cardDisabled,
                ]}
                webAsView={Platform.OS === 'web'}
                mediaProps={{
                    blurBackground: true,
                }}
            />
        </View>
    );
};

export default memo(TravelTmlRound);

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: { 
        width: '100%',
        height: CARD_HEIGHT,
        padding: 0,
    },

    // ✅ УЛУЧШЕНИЕ: Современная матовая карточка без границ, только тени
    card: {
        alignItems: "center",
        borderRadius: DESIGN_TOKENS.radii.lg,
        backgroundColor: colors.surface,
        width: '100%',
        height: '100%',
        ...colors.shadows.light,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        ...(Platform.OS === "android" ? { elevation: 3 } : null),
        ...Platform.select({
            web: {
                cursor: "pointer" as any,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: colors.boxShadows.card,
                ':hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: colors.boxShadows.hover,
                } as any,
                ':active': {
                    transform: 'translateY(-1px)',
                    boxShadow: colors.boxShadows.medium,
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
        backgroundColor: colors.backgroundSecondary,
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
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
    },

    // ✅ Нижний оверлей как в попапе
    overlayBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 8,
        backgroundColor: colors.overlay,
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
        color: colors.textOnDark,
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
        color: colors.textOnDark,
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

    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 18,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },

    compactContent: {
        paddingVertical: 8,
        gap: 0,
    },

    locationText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        flex: 1,
    },

    contentSlot: {
        gap: DESIGN_TOKENS.spacing.xs,
    },

    contentTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 18,
        letterSpacing: -0.2,
        minHeight: 36,
    },
});
