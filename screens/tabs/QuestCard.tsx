import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import UserAvatar from '@/components/layout/UserAvatar';
import QuestReviewsModal from '@/components/quests/QuestReviewsModal';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

import { pluralizeRu } from '@/utils/pluralize';

import { pluralizePoints, type QuestMeta } from './questsShared';

const loadedQuestImageCache = new Set<string>();

const getDifficultyInfo = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy': return { label: 'Легко', color: 'rgba(129, 199, 132, 0.9)' };
        case 'medium': return { label: 'Средне', color: 'rgba(255, 213, 79, 0.9)' };
        case 'hard': return { label: 'Сложно', color: 'rgba(239, 154, 154, 0.9)' };
        default: return null;
    }
};

type QuestCardProps = {
    styles: any;
    cardWidth: number;
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
};

export default function QuestCard({
    styles,
    cardWidth,
    cityId,
    quest,
    nearby,
}: QuestCardProps) {
    const colors = useThemedColors();
    const { isPhone } = useResponsive();
    const [isHovered, setIsHovered] = useState(false);
    const [reviewsOpen, setReviewsOpen] = useState(false);

    const durationText = quest.durationMin ? `${Math.round((quest.durationMin ?? 60) / 5) * 5} мин` : '1–2 ч';
    const pointsText = pluralizePoints(quest.points ?? 0);
    const categoryLabel = quest.cityName || quest.countryName || null;
    const difficultyInfo = getDifficultyInfo(quest.difficulty);
    const distanceText = nearby && typeof quest._distanceKm === 'number'
        ? quest._distanceKm < 1
            ? `${Math.round(quest._distanceKm * 1000)} м`
            : `${quest._distanceKm.toFixed(1)} км`
        : null;
    const isPioneerQuest = (quest.completionsCount ?? 0) <= 0;
    const hasReviews = quest.ratingCount > 0;
    const showReviewsAction = Platform.OS !== 'web' || hasReviews;
    const reviewsLabel = quest.ratingCount > 0
        ? `${quest.ratingCount} ${pluralizeRu(quest.ratingCount, 'отзыв', 'отзыва', 'отзывов')}`
        : '0 отзывов';

    const imageUrl = typeof quest.cover === 'string' ? quest.cover : null;
    const cacheKey = imageUrl ? String(imageUrl).trim() : '';
    const [imageLoaded, setImageLoaded] = useState(() => !!cacheKey && loadedQuestImageCache.has(cacheKey));

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
                    'aria-label': `Начать приключение: ${quest.title}`,
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
                    accessibilityLabel={`Начать приключение: ${quest.title}`}
                />
            )}

            <View style={[styles.questCardImage, { height: cardHeight }]}>
                {!imageLoaded && imageUrl && (
                    <ShimmerOverlay style={StyleSheet.absoluteFill} />
                )}

                {imageUrl ? (
                    <ImageCardMedia
                        src={imageUrl}
                        alt={quest.title}
                        width={cardWidth}
                        height={cardHeight}
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        style={StyleSheet.absoluteFill}
                        loading="eager"
                        priority="low"
                        revealOnLoadOnly
                        optimizeWeb={false}
                        onLoad={handleImageLoad}
                        showImmediately={imageLoaded}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundTertiary }]} />
                )}

                <View style={styles.questCardVignette} />
                <View style={[styles.questCardGradient, { pointerEvents: 'none' }]} />
                <View style={styles.questCardMagicGlow} />

                {distanceText && (
                    <View style={styles.questCardBadge}>
                        <Feather name="navigation" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardBadgeText}>{distanceText}</Text>
                    </View>
                )}

                {quest.isCompletedByMe && (
                    <View style={[styles.questCardCompletedBadge, distanceText ? { top: 44 } : null]}>
                        <Feather name="check-circle" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardCompletedText}>Пройден</Text>
                    </View>
                )}

                {!isPhone && isPioneerQuest && !quest.isCompletedByMe && (
                    <View style={[styles.questCardCompletedBadge, distanceText ? { top: 44 } : null]}>
                        <Feather name="flag" size={12} color={colors.textOnDark} />
                        <Text style={styles.questCardCompletedText}>Ещё никто не проходил</Text>
                    </View>
                )}

                {difficultyInfo && (
                    <View style={styles.questCardDifficultyBadge}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: difficultyInfo.color }} />
                        <Text style={styles.questCardDifficultyText}>{difficultyInfo.label}</Text>
                    </View>
                )}

                <View
                    style={[
                        styles.questCardPlayIcon,
                        isHovered && styles.questCardPlayIconVisible,
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
                                            Пройдено {quest.completionsCount} {pluralizeRu(quest.completionsCount, 'раз', 'раза', 'раз')}
                                        </Text>
                                    </View>
                                )}
                        </View>
                    )}

                    {showOverlayMeta && quest.firstCompleter && (
                        <View style={styles.questCardPioneerRow}>
                            <UserAvatar uri={quest.firstCompleter.avatar} size="sm" />
                            <Text style={styles.questCardPioneerText} numberOfLines={1}>
                                Первым прошёл: {quest.firstCompleter.name}
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
                                    Platform.OS !== 'web' && styles.questCardReviewsChipNative,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Посмотреть отзывы: ${reviewsLabel}`}
                                accessibilityHint="Открывает отзывы к квесту"
                                testID={`quest-card-reviews-${quest.id}`}
                                hitSlop={6}
                            >
                                <Feather name="message-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>
                                    Посмотреть отзывы ({quest.ratingCount})
                                </Text>
                            </Pressable>
                        )}
                        {quest.completionsCount > 0 && (
                            <View
                                style={styles.questCardDetailsItem}
                                testID={`quest-card-completions-${quest.id}`}
                            >
                                <Feather name="check-circle" size={13} color={colors.textMuted} />
                                <Text style={styles.questCardDetailsText}>
                                    {quest.completionsCount} {pluralizeRu(quest.completionsCount, 'прохождение', 'прохождения', 'прохождений')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {isPioneerQuest && (
                        <View style={styles.questCardPioneerBadge} testID={`quest-card-pioneer-${quest.id}`}>
                            <Feather name="flag" size={13} color={colors.brandDark} />
                            <Text style={styles.questCardPioneerBadgeText}>Вы будете первооткрывателем</Text>
                        </View>
                    )}
                </View>
            )}

            {showReviewsAction && !isPhone && (
                <Pressable
                    onPress={handleReviewsPress}
                    style={[
                        styles.questCardReviewsChip,
                        Platform.OS !== 'web' && styles.questCardReviewsChipNative,
                        { top: cardHeight - 36 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Посмотреть отзывы: ${reviewsLabel}`}
                    accessibilityHint="Открывает отзывы к квесту"
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
                        {Platform.OS === 'web' ? quest.ratingCount : `Посмотреть отзывы (${quest.ratingCount})`}
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
