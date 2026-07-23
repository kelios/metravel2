import { useCallback, useMemo, useState } from 'react';
import { PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import NavigationIcon from '@/components/layout/NavigationIcon';
import UserAvatar from '@/components/layout/UserAvatar';
import QuestReviewsModal from '@/components/quests/QuestReviewsModal';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

import { pluralizeRu } from '@/utils/pluralize';
import { getQuestAgeBadgeLabel, getQuestAgeCategory } from '@/utils/questAudience';
import { isBikeQuest } from './QuestsScreen.helpers';

import { pluralizePoints, type QuestMeta } from './questsShared';
import { translate as i18nT } from '@/i18n'


const loadedQuestImageCache = new Set<string>();

const getDifficultyInfo = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy': return { label: i18nT('quests:screens.tabs.QuestCard.legko_3e670625'), color: 'rgba(129, 199, 132, 0.9)' };
        case 'medium': return { label: i18nT('quests:screens.tabs.QuestCard.sredne_4ab6d3e0'), color: 'rgba(255, 213, 79, 0.9)' };
        case 'hard': return { label: i18nT('quests:screens.tabs.QuestCard.slozhno_9a98f059'), color: 'rgba(239, 154, 154, 0.9)' };
        default: return null;
    }
};

type QuestCardProps = {
    styles: any;
    cardWidth: number;
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
    /** Позиция карточки в каталоге: первые получают высокий fetch-приоритет обложки. */
    index?: number;
};

export default function QuestCard({
    styles,
    cardWidth,
    cityId,
    quest,
    nearby,
    index,
}: QuestCardProps) {
    const colors = useThemedColors();
    const { isPhone } = useResponsive();
    const [isHovered, setIsHovered] = useState(false);
    const [reviewsOpen, setReviewsOpen] = useState(false);

    const durationText = quest.durationMin ? i18nT('quests:screens.tabs.QuestCard.value1_min_1c47c0c7', { value1: Math.round((quest.durationMin ?? 60) / 5) * 5 }) : i18nT('quests:screens.tabs.QuestCard.1_2_ch_59b7a35e');
    const pointsText = pluralizePoints(quest.points ?? 0);
    const difficultyInfo = getDifficultyInfo(quest.difficulty);
    const ageCategory = quest.ageCategory ?? getQuestAgeCategory(quest.tags);
    const ageBadgeLabel = getQuestAgeBadgeLabel(ageCategory);
    const isBike = isBikeQuest(quest.tags);
    const categoryLabel = quest.cityName || quest.countryName || null;
    const distanceText = nearby && typeof quest._distanceKm === 'number'
        ? quest._distanceKm < 1
            ? i18nT('quests:screens.tabs.QuestCard.value1_m_b93b13fa', { value1: Math.round(quest._distanceKm * 1000) })
            : i18nT('quests:screens.tabs.QuestCard.value1_km_9154fdca', { value1: quest._distanceKm.toFixed(1) })
        : null;
    const isPioneerQuest = (quest.completionsCount ?? 0) <= 0;
    // Паритет с native: на устройстве чип «Посмотреть отзывы (0)» виден всегда —
    // web (включая mobile web) ведёт себя так же.
    const showReviewsAction = true;
    const reviewsLabel = quest.ratingCount > 0
        ? `${quest.ratingCount} ${pluralizeRu(quest.ratingCount, i18nT('quests:screens.tabs.QuestCard.otzyv_9b980975'), i18nT('quests:screens.tabs.QuestCard.otzyva_7e8267a2'), i18nT('quests:screens.tabs.QuestCard.otzyvov_5a06b55c'))}`
        : i18nT('quests:screens.tabs.QuestCard.0_otzyvov_d0eb25eb');

    const imageUrl = typeof quest.cover === 'string' ? quest.cover : null;
    const cacheKey = imageUrl ? String(imageUrl).trim() : '';
    const [imageLoaded, setImageLoaded] = useState(() => !!cacheKey && loadedQuestImageCache.has(cacheKey));
    // Первые карточки каталога — визуальная доминанта экрана: обложке нужен
    // высокий fetch-приоритет, иначе браузер тянет её последней (fetchPriority=low).
    const isAboveTheFold = typeof index === 'number' && index < 2;

    const handleImageLoad = useCallback(() => {
        if (cacheKey) loadedQuestImageCache.add(cacheKey);
        setImageLoaded(true);
    }, [cacheKey]);

    const handlePress = useCallback(() => {
        router.push(`/quests/${cityId}/${quest.id}`);
    }, [cityId, quest.id]);

    const handleReviewsPress = useCallback((event?: any) => {
        event?.stopPropagation?.();
        setReviewsOpen(true);
    }, []);

    const handleReviewsClose = useCallback(() => {
        setReviewsOpen(false);
    }, []);

    const cardHeight = isPhone ? 238 : Math.round((cardWidth / 380) * 260);
    const showOverlayMeta = !isPhone;

    // Pick one bounded proxy variant for both the sharp image and the shared blur.
    // This avoids a second backdrop request and prevents a ~420px DPR1 card from
    // falling through to the old 1024px candidate.
    const coverSrc = useMemo(() => {
        if (!imageUrl) return imageUrl;
        const dpr = Math.min(PixelRatio.get() || (Platform.OS === 'web' ? 1 : 2), 2);
        const requestedWidth = Math.max(1, Math.round(cardWidth * dpr));
        const responsiveWidths = [320, 480, 640, 800, 1024, 1280];
        const targetWidth =
            responsiveWidths.find((candidate) => candidate >= requestedWidth) ??
            responsiveWidths[responsiveWidths.length - 1];
        return optimizeImageUrl(imageUrl, {
            width: targetWidth,
            quality: 60,
            format: 'auto',
            fit: 'contain',
        }) ?? imageUrl;
    }, [imageUrl, cardWidth]);

    return (
        <View
            style={[
                styles.questCard,
                { width: cardWidth, maxWidth: '100%' },
                isHovered && styles.questCardHover,
            ]}
            {...Platform.select({
                web: {
                    onClick: (event: any) => {
                        if (event?.target?.closest?.('[data-card-action="true"]')) return;
                        handlePress();
                    },
                    onMouseEnter: () => setIsHovered(true),
                    onMouseLeave: () => setIsHovered(false),
                    role: 'link',
                    tabIndex: 0,
                    'aria-label': i18nT('quests:screens.tabs.QuestCard.nachat_priklyuchenie_value1_43ad4b32', { value1: quest.title }),
                    onKeyDown: (e: any) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePress();
                        }
                    },
                } as any,
                default: {},
            })}
            testID={`quest-card-${quest.id}`}
        >
            {Platform.OS !== 'web' && (
                <Pressable
                    style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
                    onPress={handlePress}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestCard.nachat_priklyuchenie_value1_43ad4b32', { value1: quest.title })}
                />
            )}

            <View style={[styles.questCardImage, { height: cardHeight }]}>
                {!imageLoaded && imageUrl && (
                    <ShimmerOverlay style={StyleSheet.absoluteFill} />
                )}

                {imageUrl ? (
                    <ImageCardMedia
                        src={coverSrc}
                        alt={quest.title}
                        width={cardWidth}
                        height={cardHeight}
                        fit="contain"
                        blurBackground
                        style={StyleSheet.absoluteFill}
                        loading={isAboveTheFold ? 'eager' : 'lazy'}
                        priority={isAboveTheFold ? 'high' : 'low'}
                        optimizeWeb={false}
                        allowCriticalWebBlur
                        allowSafariWebLazy={!isAboveTheFold}
                        onLoad={handleImageLoad}
                        showImmediately={imageLoaded}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundTertiary }]} />
                )}

                {Platform.OS === 'web' && (
                    <>
                        <View style={styles.questCardVignette} />
                        <View style={[styles.questCardGradient, { pointerEvents: 'none' }]} />
                        <View style={styles.questCardMagicGlow} />
                    </>
                )}

                {distanceText && (
                    <View style={styles.questCardBadge}>
                        <Feather name="navigation" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardBadgeText}>{distanceText}</Text>
                    </View>
                )}

                {quest.isCompletedByMe && (
                    <View style={[styles.questCardCompletedBadge, distanceText ? { top: 44 } : null]}>
                        <Feather name="check-circle" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardCompletedText}>{i18nT('quests:screens.tabs.QuestCard.proyden_73ced70e')}</Text>
                    </View>
                )}

                {isPioneerQuest && !quest.isCompletedByMe && (
                    <View
                        style={[styles.questCardCompletedBadge, distanceText ? { top: 44 } : null]}
                        testID={`quest-card-pioneer-${quest.id}`}
                    >
                        <Feather name="flag" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardCompletedText}>{i18nT('quests:screens.tabs.QuestCard.esche_nikto_ne_prohodil_341ee9f0')}</Text>
                    </View>
                )}

                {difficultyInfo && (
                    <View style={styles.questCardDifficultyBadge}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: difficultyInfo.color }} />
                        <Text style={styles.questCardDifficultyText}>{difficultyInfo.label}</Text>
                    </View>
                )}

                {ageBadgeLabel && (
                    <View
                        style={[styles.questCardKidsBadge, difficultyInfo ? { top: 44 } : null]}
                        testID={`quest-card-kids-${quest.id}`}
                    >
                        <Feather name="smile" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardKidsText} numberOfLines={1}>
                            {ageBadgeLabel}
                        </Text>
                    </View>
                )}

                {isBike && (
                    <View
                        style={[
                            styles.questCardBikeBadge,
                            // Стек правых бейджей: сложность и/или возраст выше — сдвигаемся вниз.
                            { top: 8 + (difficultyInfo ? 36 : 0) + (ageBadgeLabel ? 36 : 0) },
                        ]}
                        testID={`quest-card-bike-${quest.id}`}
                    >
                        <NavigationIcon name="bike" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardBikeText} numberOfLines={1}>
                            {i18nT('quests:screens.tabs.QuestCard.veloBadge')}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.questCardPlayIcon,
                        // На телефоне hover нет (mobile web) — кнопка видна всегда, как на устройстве.
                        (isHovered || isPhone) && styles.questCardPlayIconVisible,
                        { pointerEvents: 'none' },
                    ]}
                >
                    <Feather name="play" size={18} color={colors.textOnDark} style={{ marginLeft: 2 } as any} />
                </View>

                <View style={[styles.questCardContent, { pointerEvents: 'none' }]}>
                    {categoryLabel && <Text style={styles.questCardCategory}>{categoryLabel}</Text>}
                    <Text style={styles.questCardTitle} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    {showOverlayMeta && (
                        <View style={styles.questCardMeta}>
                            <View style={styles.questCardMetaItem}>
                                <Feather name="map-pin" size={13} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.questCardMetaText}>{pointsText}</Text>
                            </View>
                                <View style={styles.questCardMetaItem}>
                                    <Feather name="clock" size={13} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.questCardMetaText}>{durationText}</Text>
                                </View>
                                {quest.ratingCount > 0 && (
                                    <View
                                        style={styles.questCardMetaItem}
                                        testID={`quest-card-rating-${quest.id}`}
                                    >
                                        <Feather name="star" size={13} color="rgba(255,255,255,0.95)" />
                                        <Text style={styles.questCardMetaText}>
                                            {(quest.ratingAvg ?? 0).toFixed(1)} ({quest.ratingCount})
                                        </Text>
                                    </View>
                                )}
                                {quest.completionsCount > 0 && (
                                    <View
                                        style={styles.questCardMetaItem}
                                        testID={`quest-card-completions-${quest.id}`}
                                    >
                                        <Feather name="check-circle" size={13} color="rgba(255,255,255,0.9)" />
                                        <Text style={styles.questCardMetaText}>
                                            {i18nT('quests:screens.tabs.QuestCard.proydeno_5cec53cc')}{quest.completionsCount} {pluralizeRu(quest.completionsCount, i18nT('quests:screens.tabs.QuestCard.raz_cb5ff63c'), i18nT('quests:screens.tabs.QuestCard.raza_7014923e'), i18nT('quests:screens.tabs.QuestCard.raz_cb5ff63c'))}
                                        </Text>
                                    </View>
                                )}
                        </View>
                    )}

                    {showOverlayMeta && quest.firstCompleter && (
                        <View style={styles.questCardPioneerRow}>
                            <UserAvatar uri={quest.firstCompleter.avatar} size="sm" />
                            <Text style={styles.questCardPioneerText} numberOfLines={1}>
                                {i18nT('quests:screens.tabs.QuestCard.pervym_proshel_0647d9f1')}{quest.firstCompleter.name}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {isPhone && (
                <View style={styles.questCardDetails}>
                    <View style={styles.questCardDetailsMeta}>
                        <View style={styles.questCardDetailsItem}>
                            <Feather name="map-pin" size={13} color={colors.textMuted} />
                            <Text style={styles.questCardDetailsText}>{pointsText}</Text>
                        </View>
                        <View style={styles.questCardDetailsItem}>
                            <Feather name="clock" size={13} color={colors.textMuted} />
                            <Text style={styles.questCardDetailsText}>{durationText}</Text>
                        </View>
                        {quest.ratingCount > 0 && (
                            <View
                                style={styles.questCardDetailsItem}
                                testID={`quest-card-rating-${quest.id}`}
                            >
                                <Feather name="star" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>
                                    {(quest.ratingAvg ?? 0).toFixed(1)}
                                </Text>
                            </View>
                        )}
                        {showReviewsAction && (
                            <Pressable
                                onPress={handleReviewsPress}
                                style={[
                                    styles.questCardDetailsItem,
                                    styles.questCardReviewsInline,
                                    Platform.OS !== 'web' && styles.questCardReviewsChipNativeInline,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_0859ae2d', { value1: reviewsLabel })}
                                accessibilityHint={i18nT('quests:screens.tabs.QuestCard.otkryvaet_otzyvy_k_kvestu_02dd3527')}
                                testID={`quest-card-reviews-${quest.id}`}
                                hitSlop={6}
                            >
                                <Feather name="message-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>{quest.ratingCount}</Text>
                            </Pressable>
                        )}
                        {quest.completionsCount > 0 && (
                            <View
                                style={styles.questCardDetailsItem}
                                testID={`quest-card-completions-${quest.id}`}
                            >
                                <Feather name="check-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>{quest.completionsCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {showReviewsAction && !isPhone && (
                <Pressable
                    onPress={handleReviewsPress}
                    style={[
                        styles.questCardReviewsChip,
                        Platform.OS !== 'web' && styles.questCardReviewsChipNative,
                        {
                            top:
                                cardHeight -
                                DESIGN_TOKENS.touchTarget.minHeight -
                                DESIGN_TOKENS.spacing.sm,
                        },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_0859ae2d', { value1: reviewsLabel })}
                    accessibilityHint={i18nT('quests:screens.tabs.QuestCard.otkryvaet_otzyvy_k_kvestu_02dd3527')}
                    testID={`quest-card-reviews-${quest.id}`}
                    hitSlop={6}
                    {...Platform.select({
                        web: {
                            role: 'button',
                            tabIndex: 0,
                            'data-card-action': 'true',
                            onClick: (event: any) => {
                                event?.stopPropagation?.();
                                handleReviewsPress(event);
                            },
                        } as any,
                        default: {},
                    })}
                >
                    <Feather name="message-circle" size={13} color={colors.textOnDark} />
                    <Text style={styles.questCardReviewsChipText}>
                        {Platform.OS === 'web' ? quest.ratingCount : i18nT('quests:screens.tabs.QuestCard.posmotret_otzyvy_value1_4dd71d0d', { value1: quest.ratingCount })}
                    </Text>
                </Pressable>
            )}

            {reviewsOpen && (
                <QuestReviewsModal
                    questId={String(quest.id)}
                    visible={reviewsOpen}
                    onClose={handleReviewsClose}
                />
            )}
        </View>
    );
}
