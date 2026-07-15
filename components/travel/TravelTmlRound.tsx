// components/travel/TravelTmlRound.tsx
import React, { memo, useCallback, useMemo } from "react";
import {
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import type { Travel } from "@/types/types";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { buildVersionedImageUrl, getOptimalImageSize, optimizeImageUrl } from "@/utils/imageOptimization";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { useThemedColors } from '@/hooks/useTheme';
import { shareTravel } from '@/utils/shareTravel';
import { resolveTravelAuthorDisplayName, resolveTravelAuthorName } from '@/components/listTravel/travelListItemHelpers';
import { formatViewCount } from '@/components/travel/utils/travelHelpers';
import { translate as i18nT } from '@/i18n'


type Props = { travel: Travel };

const CARD_HEIGHT = 250;
const CARD_IMAGE_HEIGHT = 170;

const resolveTravelYear = (travel: Travel): string => {
    const value = String((travel as any)?.year ?? '').trim();
    return /^\d{4}$/.test(value) ? value : '';
};

const resolveTravelViews = (travel: Travel): number => {
    const raw =
        (travel as any)?.countUnicIpView ??
        (travel as any)?.views ??
        (travel as any)?.viewsCount ??
        (travel as any)?.countViews;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
};

const TravelTmlRound: React.FC<Props> = ({ travel }) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const unknownCountry = i18nT('travel:components.travel.TravelTmlRound.strana_ne_ukazana_2e2953f1');

    const {
        name = i18nT('travel:components.travel.TravelTmlRound.bez_nazvaniya_1402d4f0'),
        slug,
        travel_image_thumb_small_url,
        travel_image_thumb_url,
        countryName = unknownCountry,
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
    const authorDisplayName = useMemo(() => {
      const authorName = resolveTravelAuthorName(travel, (travel as any)?.userName);
      return resolveTravelAuthorDisplayName(authorName);
    }, [travel]);
    const travelYear = useMemo(() => resolveTravelYear(travel), [travel]);
    const views = useMemo(() => resolveTravelViews(travel), [travel]);
    const viewsLabel = views > 0 ? formatViewCount(views) : '';

    const onPress = useCallback(() => {
        if (!canOpen) return;
        router.push(`/travels/${slug || travel.id}`);
    }, [canOpen, slug, travel.id]);

    // AND-23: Share travel on long press (native only)
    const handleLongPress = useCallback(() => {
        shareTravel({
            id: slug || String(travel.id),
            title: name,
            description: countryName !== unknownCountry ? countryName : undefined,
        });
    }, [slug, travel.id, name, countryName, unknownCountry]);

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

    const contentSlot = useMemo(() => {
        const showCountry = !!countryName && countryName !== unknownCountry;
        const hasMeta = !!authorDisplayName || !!travelYear || !!viewsLabel;
        if (!showCountry && !hasMeta) return null;

        return (
            <View style={styles.contentSlot}>
                {showCountry ? (
                    <View style={styles.locationRow}>
                        <Feather name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={styles.locationText} numberOfLines={1}>
                            {countryName}
                        </Text>
                    </View>
                ) : null}
                {hasMeta ? (
                    <View style={styles.metaRow}>
                        {authorDisplayName ? (
                            <View style={[styles.metaItem, styles.metaItemAuthor]}>
                                <Feather name="user" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText} numberOfLines={1}>
                                    {authorDisplayName}
                                </Text>
                            </View>
                        ) : null}
                        {travelYear ? (
                            <View style={styles.metaItem}>
                                <Feather name="calendar" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText} numberOfLines={1}>
                                    {travelYear}
                                </Text>
                            </View>
                        ) : null}
                        {viewsLabel ? (
                            <View style={styles.metaItem}>
                                <Feather name="eye" size={12} color={colors.textMuted} />
                                <Text style={styles.metaText} numberOfLines={1}>
                                    {viewsLabel}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>
        );
    }, [
        authorDisplayName,
        colors.textMuted,
        countryName,
        unknownCountry,
        styles.contentSlot,
        styles.locationRow,
        styles.locationText,
        styles.metaItem,
        styles.metaItemAuthor,
        styles.metaRow,
        styles.metaText,
        travelYear,
        viewsLabel,
    ]);

    return (
        <View style={styles.container}>
            <UnifiedTravelCard
                title={name}
                imageUrl={optimizedImageUrl ?? null}
                onPress={onPress}
                onLongPress={handleLongPress}
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
                    allowCriticalWebBlur: Platform.OS === 'web',
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
        overflow: 'hidden',
    },

    // ✅ УЛУЧШЕНИЕ: Современная матовая карточка без границ, только тени
    card: {
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surface,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                alignItems: "center" as any,
                height: '100%' as any,
                cursor: "pointer" as any,
                transition: 'border-color 0.2s ease' as any,
            },
        }),
    },
    cardPressed: { 
        opacity: 0.92,
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
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    image: { 
        width: "100%", 
        height: "100%",
        ...Platform.select({
            web: {
                objectFit: 'contain' as any,
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
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 0,
        borderColor: 'transparent',
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
        gap: 4,
    },

    compactContent: {
        paddingVertical: 8,
        gap: 4,
    },

    locationText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        flex: 1,
    },

    contentSlot: {
        gap: 4,
    },

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 8,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        minHeight: 18,
        overflow: 'hidden',
    },

    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
        minWidth: 0,
    },

    metaItemAuthor: {
        flexShrink: 1,
        flexGrow: 1,
        maxWidth: '56%',
    },

    metaText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
        minWidth: 0,
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
