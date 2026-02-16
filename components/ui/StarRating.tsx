// components/ui/StarRating.tsx
// ✅ Компонент рейтинга звёздами с возможностью интерактивной оценки
// 🎨 УЛУЧШЕНО: Добавлена анимация, лучший визуальный feedback, улучшенная доступность

import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
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
    small: { starSize: 14, fontSize: 11, gap: 2 },
    medium: { starSize: 18, fontSize: 13, gap: 3 },
    large: { starSize: 26, fontSize: 16, gap: 4 },
} as const;

const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

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
    const [pressedStar, setPressedStar] = useState<number | null>(null);

    // 🎨 Анимация для пульсации при взаимодействии
    const [scaleAnims] = useState(() => [0, 1, 2, 3, 4].map(() => new Animated.Value(1)));

    const config = SIZE_CONFIG[size];
    const displayRating = rating ?? 0;

    const normalizedUserRating = useMemo(() => {
        if (userRating == null) return null;
        if (!Number.isFinite(userRating)) return null;
        if (userRating <= 0) return null;
        return Math.max(1, Math.min(5, Math.round(userRating)));
    }, [userRating]);

    const hasUserRating = normalizedUserRating != null;
    const effectiveRating =
        (Platform.OS === 'web' ? hoverRating : null) ??
        (interactive && hasUserRating ? normalizedUserRating! : displayRating);

    const styles = useMemo(() => createStyles(colors, config), [colors, config]);

    const handlePress = useCallback((starIndex: number) => {
        if (!interactive || disabled || !onRate) return;

        // 🎨 Анимация нажатия
        setPressedStar(starIndex);
        const anim = scaleAnims[starIndex - 1];
        Animated.sequence([
            Animated.timing(anim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(anim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => setPressedStar(null));

        onRate(starIndex);
    }, [interactive, disabled, onRate, scaleAnims]);

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
                <Text style={styles.compactStarChar}>{STAR_FILLED}</Text>
                <Text style={styles.compactText}>{formatRating(displayRating)}</Text>
            </View>
        );
    }

    const renderStar = (index: number) => {
        const starValue = index + 1;
        const filled = effectiveRating >= starValue;
        const halfFilled = !filled && effectiveRating >= starValue - 0.5;
        const isUserRated = hasUserRating && normalizedUserRating === starValue;
        const isActive = filled || halfFilled;
        const isHovered = Platform.OS === 'web' && hoverRating === starValue;
        const _isPulsing = pressedStar === starValue;

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
                accessibilityState: { selected: isUserRated },
            }
            : {};

        // 🎨 Анимированная обертка для интерактивных звёзд
        const StarContent = (
            <Text
                style={[
                    styles.starChar,
                    isActive ? styles.starCharFilled : styles.starCharEmpty,
                    halfFilled && styles.starCharHalf,
                    isHovered && styles.starCharHovered,
                ]}
                selectable={false}
            >
                {isActive ? STAR_FILLED : STAR_EMPTY}
            </Text>
        );

        return (
            <StarWrapper
                key={index}
                style={[
                    styles.starWrapper,
                    interactive && styles.starInteractive,
                    disabled && styles.starDisabled,
                    isUserRated && styles.starUserRated,
                    isHovered && styles.starHovered,
                ]}
                testID={`${testID}-star-${starValue}`}
                {...wrapperProps}
            >
                {interactive && !disabled ? (
                    <Animated.View style={{ transform: [{ scale: scaleAnims[index] }] }}>
                        {StarContent}
                    </Animated.View>
                ) : (
                    StarContent
                )}
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

const STAR_COLOR_FILLED = '#e8a838';
const STAR_COLOR_EMPTY = '#d4d0c8';
const STAR_COLOR_EMPTY_DARK = '#6b6552'; // 🎨 Увеличен контраст для тёмной темы
const STAR_COLOR_HOVER = '#f4b84d'; // 🎨 Цвет при hover

const createStyles = (colors: any, config: { starSize: number; fontSize: number; gap: number }) => {
    const isDarkTheme = colors.text?.includes?.('e8e4') || colors.text?.includes?.('d4d0');
    const emptyColor = isDarkTheme ? STAR_COLOR_EMPTY_DARK : STAR_COLOR_EMPTY;

    return StyleSheet.create({
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
        compactStarChar: {
            fontSize: config.starSize,
            lineHeight: config.starSize + 2,
            color: STAR_COLOR_FILLED,
            includeFontPadding: false,
        } as any,
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
            borderRadius: 6,
            ...(Platform.OS === 'web' && {
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
            } as any),
        },
        starHovered: {
            ...(Platform.OS === 'web' && {
                backgroundColor: isDarkTheme ? 'rgba(232,168,56,0.1)' : 'rgba(232,168,56,0.06)',
            } as any),
        },
        starDisabled: {
            ...(Platform.OS === 'web' && {
                cursor: 'default',
            } as any),
            opacity: 0.45,
        },
        starUserRated: {
            opacity: 1,
        },
        starChar: {
            fontSize: config.starSize,
            lineHeight: config.starSize + 2,
            textAlign: 'center',
            includeFontPadding: false,
            ...(Platform.OS === 'web' && {
                userSelect: 'none',
            } as any),
        } as any,
        starCharFilled: {
            color: STAR_COLOR_FILLED,
        },
        starCharEmpty: {
            color: emptyColor,
        },
        starCharHalf: {
            opacity: 0.7,
        },
        starCharHovered: {
            ...(Platform.OS === 'web' && {
                color: STAR_COLOR_HOVER,
            } as any),
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
};

export default memo(StarRating);

