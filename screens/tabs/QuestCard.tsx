import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

import type { QuestMeta } from './questsShared';

const loadedQuestImageCache = new Set<string>();

const QUEST_CATEGORIES = [
    'Городская легенда',
    'Тайны истории',
    'Мистическое приключение',
    'Загадки прошлого',
    'Секреты города',
];

const getDifficultyInfo = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy': return { label: 'Легко', color: 'rgba(129, 199, 132, 0.9)' };
        case 'hard': return { label: 'Сложно', color: 'rgba(239, 154, 154, 0.9)' };
        default: return { label: 'Средне', color: 'rgba(255, 213, 79, 0.9)' };
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

    const durationText = quest.durationMin ? `${Math.round((quest.durationMin ?? 60) / 5) * 5} мин` : '1–2 ч';
    const pointsText = quest.points === 1 ? '1 точка' : quest.points < 5 ? `${quest.points} точки` : `${quest.points} точек`;
    const categoryIndex = quest.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % QUEST_CATEGORIES.length;
    const categoryLabel = QUEST_CATEGORIES[categoryIndex];
    const difficultyInfo = getDifficultyInfo(quest.difficulty);
    const distanceText = nearby && typeof quest._distanceKm === 'number'
        ? quest._distanceKm < 1
            ? `${Math.round(quest._distanceKm * 1000)} м`
            : `${quest._distanceKm.toFixed(1)} км`
        : null;

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

    const cardHeight = isPhone ? 220 : Math.round((cardWidth / 380) * 260);

    return (
        <View
            style={[
                styles.questCard,
                { width: cardWidth, maxWidth: '100%' },
                isHovered && styles.questCardHover,
            ]}
            {...Platform.select({
                web: {
                    onClick: handlePress,
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
                    style={StyleSheet.absoluteFill}
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
                        fit="cover"
                        blurBackground
                        style={StyleSheet.absoluteFill}
                        loading="lazy"
                        priority="normal"
                        onLoad={handleImageLoad}
                        showImmediately={imageLoaded}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundTertiary, alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="compass" size={40} color={colors.brandAlpha30} />
                    </View>
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

                <View style={styles.questCardDifficultyBadge}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: difficultyInfo.color }} />
                    <Text style={styles.questCardDifficultyText}>{difficultyInfo.label}</Text>
                </View>

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
                    <Text style={styles.questCardCategory}>{categoryLabel}</Text>
                    <Text style={styles.questCardTitle} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    <View style={styles.questCardMeta}>
                        <View style={styles.questCardMetaItem}>
                            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.9)" />
                            <Text style={styles.questCardMetaText}>{pointsText}</Text>
                        </View>
                        <View style={styles.questCardMetaItem}>
                            <Feather name="clock" size={13} color="rgba(255,255,255,0.9)" />
                            <Text style={styles.questCardMetaText}>{durationText}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
