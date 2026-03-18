// components/ui/RatingChip.tsx
// 🎨 Улучшенный компонент для отображения рейтинга на карточках
// Оптимизирован для списков с высокой производительностью

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
    rating: number;
    ratingCount?: number;
    showCount?: boolean;
    size?: 'small' | 'medium';
    variant?: 'default' | 'highlighted';
    testID?: string;
};

const STAR_FILLED = '★';

function RatingChip({
    rating,
    ratingCount = 0,
    showCount = false,
    size = 'small',
    variant = 'default',
    testID = 'rating-chip',
}: Props) {
    const colors = useThemedColors();

    const formattedRating = useMemo(() => {
        if (rating === 0) return '—';
        return rating.toFixed(1);
    }, [rating]);

    const formattedCount = useMemo(() => {
        if (!ratingCount || ratingCount === 0) return '';
        if (ratingCount >= 1000) return `${(ratingCount / 1000).toFixed(1)}k`;
        return String(ratingCount);
    }, [ratingCount]);

    const styles = useMemo(() => createStyles(colors, size, variant), [colors, size, variant]);

    if (rating === 0) return null;

    return (
        <View
            style={styles.container}
            testID={testID}
            {...Platform.select({
                web: {
                    title: `Рейтинг: ${formattedRating} из 5${
                        ratingCount ? ` (${ratingCount} ${getRatingLabel(ratingCount)})` : ''
                    }`,
                } as any,
                default: {},
            })}
        >
            <Text style={styles.star}>{STAR_FILLED}</Text>
            <Text style={styles.value}>{formattedRating}</Text>
            {showCount && ratingCount > 0 && (
                <Text style={styles.count}>({formattedCount})</Text>
            )}
        </View>
    );
}

function getRatingLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 19) return 'оценок';
    if (mod10 === 1) return 'оценка';
    if (mod10 >= 2 && mod10 <= 4) return 'оценки';
    return 'оценок';
}

const createStyles = (
    colors: any,
    size: 'small' | 'medium',
    variant: 'default' | 'highlighted'
) => {
    const starColor = variant === 'highlighted' ? colors.warning : colors.brand;

    const isSmall = size === 'small';
    const isHighlighted = variant === 'highlighted';

    return StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: isSmall ? 3 : 4,
            paddingVertical: isSmall ? 3 : 5,
            paddingHorizontal: isSmall ? 8 : 10,
            borderRadius: 999,
            backgroundColor: isHighlighted
                ? (Platform.OS === 'web' ? 'rgba(232, 168, 56, 0.1)' : colors.backgroundSecondary)
                : colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: isHighlighted
                ? (Platform.OS === 'web' ? 'rgba(232, 168, 56, 0.25)' : colors.borderLight)
                : colors.borderLight,
            ...Platform.select({
                web: isHighlighted
                    ? {
                        boxShadow: '0 1px 3px rgba(232, 168, 56, 0.15)',
                        transition: 'all 0.2s ease',
                    }
                    : {},
                default: {},
            } as any),
        },
        star: {
            fontSize: isSmall ? 12 : 14,
            lineHeight: isSmall ? 14 : 16,
            color: starColor,
            includeFontPadding: false,
            ...Platform.select({
                web: {
                    textShadow: '0 1px 1px rgba(232, 168, 56, 0.2)',
                    filter: 'drop-shadow(0 0.5px 0.5px rgba(232, 168, 56, 0.15))',
                } as any,
                default: {},
            }),
        } as any,
        value: {
            fontSize: isSmall ? 12 : 13,
            lineHeight: isSmall ? 14 : 16,
            fontWeight: '600',
            color: isHighlighted ? starColor : colors.text,
            includeFontPadding: false,
        } as any,
        count: {
            fontSize: isSmall ? 10 : 11,
            lineHeight: isSmall ? 12 : 14,
            fontWeight: '500',
            color: colors.textMuted,
            marginLeft: isSmall ? 1 : 2,
            includeFontPadding: false,
        } as any,
    });
};

export default memo(RatingChip);
