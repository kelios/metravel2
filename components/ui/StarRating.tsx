// components/ui/StarRating.tsx
// ✅ Компонент рейтинга звёздами с возможностью интерактивной оценки

import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
    /** Текущий рейтинг (0-5, допускаются дробные значения) */
    rating: number | null | undefined;
    /** Количество оценок */
    ratingCount?: number;
    /** Оценка текущего пользователя (подсвечивается) */
    userRating?: number | null;
    /** Интерактивный режим — можно ставить оценки */
    interactive?: boolean;
    /** Отключить взаимодействие (например, во время сохранения) */
    disabled?: boolean;
    /** Callback при клике на звезду (для интерактивного режима) */
    onRate?: (rating: number) => void;
    /** Размер звёзд */
    size?: 'small' | 'medium' | 'large';
    /** Показывать число рядом с рейтингом */
    showValue?: boolean;
    /** Показывать количество оценок */
    showCount?: boolean;
    /** Дополнительный стиль контейнера */
    style?: any;
    /** Компактный режим (только число и одна звезда) */
    compact?: boolean;
    /** testID для тестирования */
    testID?: string;
};

const SIZE_CONFIG = {
    small: { starSize: 12, fontSize: 11, gap: 2 },
    medium: { starSize: 16, fontSize: 13, gap: 3 },
    large: { starSize: 24, fontSize: 16, gap: 4 },
} as const;

function StarRating({
    rating,
    ratingCount = 0,
    userRating,
    interactive = false,
    disabled = false,
    onRate,
    size = 'medium',
    showValue = true,
    showCount = true,
    style,
    compact = false,
    testID = 'star-rating',
}: Props) {
    const colors = useThemedColors();
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    const config = SIZE_CONFIG[size];
    const displayRating = rating ?? 0;
    const hasUserRating = userRating != null && userRating > 0;
    const effectiveRating =
        (Platform.OS === 'web' ? hoverRating : null) ?? (interactive && hasUserRating ? userRating! : displayRating);

    const styles = useMemo(() => createStyles(colors, config), [colors, config]);

    const handlePress = useCallback((starIndex: number) => {
        if (!interactive || disabled || !onRate) return;
        onRate(starIndex);
    }, [interactive, disabled, onRate]);

    const handleHoverIn = useCallback((starIndex: number) => {
        if (!interactive || disabled) return;
        setHoverRating(starIndex);
    }, [interactive, disabled]);

    const handleHoverOut = useCallback(() => {
        if (!interactive || disabled) return;
        setHoverRating(null);
    }, [interactive, disabled]);

    const formatRating = (value: number) => {
        if (value === 0) return '—';
        return value.toFixed(1);
    };

    const formatCount = (count: number) => {
        if (count === 0) return '';
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return String(count);
    };

    // Компактный режим: одна звезда + число
    if (compact) {
        if (!displayRating || displayRating === 0) return null;

        return (
            <View style={[styles.compactContainer, style]} testID={testID}>
                <Feather
                    name="star"
                    size={config.starSize}
                    color={colors.warning}
                    style={styles.compactStar}
                />
                <Text style={styles.compactText}>{formatRating(displayRating)}</Text>
            </View>
        );
    }

    const renderStar = (index: number) => {
        const starValue = index + 1;
        const filled = effectiveRating >= starValue;
        const halfFilled = !filled && effectiveRating >= starValue - 0.5;
        const isUserRated = hasUserRating && userRating === starValue;

        const starColor = filled || halfFilled ? colors.warning : colors.textMuted;

        const StarWrapper = interactive ? Pressable : View;
        const wrapperProps = interactive
            ? {
                onPress: () => handlePress(starValue),
                ...(Platform.OS === 'web'
                    ? {
                        onHoverIn: () => handleHoverIn(starValue),
                        onHoverOut: handleHoverOut,
                    }
                    : {}),
                accessibilityRole: 'button' as const,
                accessibilityLabel: `Оценить на ${starValue} из 5`,
                accessibilityHint: 'Нажмите, чтобы поставить оценку',
            }
            : {};

        return (
            <StarWrapper
                key={index}
                style={[
                    styles.starWrapper,
                    interactive && styles.starInteractive,
                    disabled && styles.starDisabled,
                    isUserRated && styles.starUserRated,
                ]}
                testID={`${testID}-star-${starValue}`}
                {...wrapperProps}
            >
                <View style={styles.starContainer}>
                    {/* Базовая звезда (пустая) */}
                    <Feather
                        name="star"
                        size={config.starSize}
                        color={colors.textMuted}
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Заполненная часть */}
                    {(filled || halfFilled) && (
                        <View
                            style={[
                                styles.starFilled,
                                halfFilled && styles.starHalf,
                            ]}
                        >
                            <Feather
                                name="star"
                                size={config.starSize}
                                color={starColor}
                            />
                        </View>
                    )}
                </View>
            </StarWrapper>
        );
    };

    return (
        <View style={[styles.container, style]} testID={testID}>
            <View style={styles.starsRow}>
                {[0, 1, 2, 3, 4].map(renderStar)}
            </View>

            {(showValue || showCount) && (
                <View style={styles.textContainer}>
                    {showValue && (
                        <Text style={styles.ratingValue} testID={`${testID}-value`}>
                            {formatRating(displayRating)}
                        </Text>
                    )}
                    {showCount && ratingCount > 0 && (
                        <Text style={styles.ratingCount} testID={`${testID}-count`}>
                            ({formatCount(ratingCount)})
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any, config: { starSize: number; fontSize: number; gap: number }) =>
    StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: config.gap * 2,
        },
        compactContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: config.gap,
        },
        compactStar: {
            // Используем fill через opacity trick
        },
        compactText: {
            fontSize: config.fontSize,
            fontWeight: '600',
            color: colors.text,
        },
        starsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: config.gap,
        },
        starWrapper: {
            padding: 0,
        },
        starInteractive: {
            padding: 4,
            marginHorizontal: -2,
            borderRadius: 4,
            ...(Platform.OS === 'web' && {
                cursor: 'pointer',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
            } as any),
        },
        starDisabled: {
            ...(Platform.OS === 'web' && {
                cursor: 'default',
            } as any),
            opacity: 0.55,
        },
        starUserRated: {
            opacity: 1,
        },
        starContainer: {
            width: config.starSize,
            height: config.starSize,
            position: 'relative',
        },
        starFilled: {
            position: 'absolute',
            top: 0,
            left: 0,
            overflow: 'hidden',
            width: '100%',
        },
        starHalf: {
            width: '50%',
        },
        textContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: config.gap,
        },
        ratingValue: {
            fontSize: config.fontSize,
            fontWeight: '600',
            color: colors.text,
        },
        ratingCount: {
            fontSize: config.fontSize - 1,
            color: colors.textMuted,
        },
    });

export default memo(StarRating);

