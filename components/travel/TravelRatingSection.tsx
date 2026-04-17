// components/travel/TravelRatingSection.tsx
// ✅ Секция рейтинга на странице путешествия с возможностью оценки
// 🎨 УЛУЧШЕНО: Анимация изменения рейтинга, улучшенная визуальная иерархия, success feedback

import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import StarRating from '@/components/ui/StarRating';
import { useTravelRating } from '@/hooks/useTravelRating';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type Props = {
    travelId: number | undefined;
    initialRating?: number | null;
    initialCount?: number;
    initialUserRating?: number | null;
    compact?: boolean;
    testID?: string;
};

function TravelRatingSection({
    travelId,
    initialRating,
    initialCount = 0,
    initialUserRating,
    compact = false,
    testID = 'travel-rating-section',
}: Props) {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const shouldUseNativeDriver = false;

    // 🎨 Анимация для изменения рейтинга
    const ratingChangeAnim = useRef(new Animated.Value(1)).current;
    const successPulseAnim = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const [showSuccess, setShowSuccess] = useState(false);
    const prevRatingRef = useRef<number | null>(null);

    const {
        rating,
        ratingCount,
        userRating,
        isLoading,
        isSubmitting,
        canRate,
        handleRate,
    } = useTravelRating({
        travelId,
        initialRating,
        initialCount,
        initialUserRating,
        enabled: !!travelId,
    });

    // 🎨 Анимация при изменении общего рейтинга
    useEffect(() => {
        if (prevRatingRef.current !== null && rating !== prevRatingRef.current && rating !== null) {
            Animated.sequence([
                Animated.timing(ratingChangeAnim, {
                    toValue: 1.1,
                    duration: 200,
                    useNativeDriver: shouldUseNativeDriver,
                }),
                Animated.timing(ratingChangeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: shouldUseNativeDriver,
                }),
            ]).start();
        }
        prevRatingRef.current = rating;
    }, [rating, ratingChangeAnim, shouldUseNativeDriver]);

    // Spinner rotation animation
    useEffect(() => {
        if (!isSubmitting) {
            spinAnim.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: shouldUseNativeDriver,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [isSubmitting, spinAnim, shouldUseNativeDriver]);

    // 🎨 Success feedback после сохранения оценки
    useEffect(() => {
        if (!isSubmitting && userRating !== null && userRating > 0) {
            setShowSuccess(true);
            Animated.sequence([
                Animated.timing(successPulseAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: shouldUseNativeDriver,
                }),
                Animated.delay(2000),
                Animated.timing(successPulseAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: shouldUseNativeDriver,
                }),
            ]).start(() => setShowSuccess(false));
        }
    }, [isSubmitting, userRating, successPulseAnim, shouldUseNativeDriver]);

    if (compact) {
        return (
            <View style={styles.compactContainer} testID={testID}>
                <StarRating
                    rating={rating}
                    ratingCount={ratingCount}
                    userRating={userRating}
                    interactive={canRate}
                    onRate={handleRate}
                    disabled={isSubmitting || isLoading}
                    size="medium"
                    showValue
                    showCount
                />
                {userRating != null && userRating > 0 && (
                    <Text style={styles.yourRatingText}>
                        Ваша оценка: {userRating}
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Рейтинг</Text>
                {ratingCount > 0 && (
                    <Text style={styles.countText}>
                        {ratingCount} {getCountLabel(ratingCount)}
                    </Text>
                )}
            </View>

            {ratingCount === 0 && (userRating == null || userRating === 0) ? (
                <View style={styles.emptyStateBox}>
                    <View style={styles.emptyStateIconWrap}>
                      <Feather name="star" size={28} color={colors.warning ?? colors.accent} />
                    </View>
                    <Text style={styles.emptyStateTitle}>Пока нет оценок</Text>
                    <Text style={styles.emptyStateSubtext}>
                        {canRate ? 'Будьте первым, кто оценит этот маршрут' : 'Войдите, чтобы оценить маршрут'}
                    </Text>
                    {canRate && (
                        <View style={styles.emptyStateStars}>
                            <StarRating
                                rating={0}
                                userRating={userRating}
                                interactive
                                onRate={handleRate}
                                disabled={isSubmitting || isLoading}
                                size="large"
                                showValue={false}
                                showCount={false}
                            />
                        </View>
                    )}
                    {isSubmitting && (
                        <View style={styles.statusRow}>
                            <Animated.View style={[styles.spinner, { transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
                            <Text style={styles.savingText}>Сохранение...</Text>
                        </View>
                    )}
                    {!isSubmitting && showSuccess && (
                        <Animated.View
                            style={[
                                styles.successRow,
                                {
                                    opacity: successPulseAnim,
                                    transform: [{
                                        translateY: successPulseAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, 0],
                                        })
                                    }]
                                }
                            ]}
                        >
                            <Text style={styles.successText}>Спасибо за оценку!</Text>
                        </Animated.View>
                    )}
                </View>
            ) : (
            <View style={styles.contentRow}>
                <Animated.View
                    style={[
                        styles.summaryBox,
                        { transform: [{ scale: ratingChangeAnim }] }
                    ]}
                >
                    <Text style={styles.boxLabel}>Общий рейтинг</Text>
                    <StarRating
                        rating={rating}
                        ratingCount={ratingCount}
                        size="large"
                        showValue
                        showCount={false}
                    />
                </Animated.View>

                <View style={styles.userBox}>
                    {canRate ? (
                        <>
                            <Text style={styles.rateLabel}>
                                {userRating != null && userRating > 0 ? 'Ваша оценка' : 'Оцените маршрут'}
                            </Text>
                            <StarRating
                                rating={userRating ?? 0}
                                userRating={userRating}
                                interactive
                                onRate={handleRate}
                                disabled={isSubmitting || isLoading}
                                size="large"
                                showValue={false}
                                showCount={false}
                            />
                            {isSubmitting && (
                                <View style={styles.statusRow}>
                                    <Animated.View style={[styles.spinner, { transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
                                    <Text style={styles.savingText}>Сохранение...</Text>
                                </View>
                            )}
                            {!isSubmitting && showSuccess && (
                                <Animated.View
                                    style={[
                                        styles.successRow,
                                        {
                                            opacity: successPulseAnim,
                                            transform: [{
                                                translateY: successPulseAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [10, 0],
                                                })
                                            }]
                                        }
                                    ]}
                                >
                                    <Text style={styles.successText}>Спасибо за оценку!</Text>
                                </Animated.View>
                            )}
                        </>
                    ) : (
                        <Text style={styles.loginHint}>Войдите, чтобы оценить</Text>
                    )}
                </View>
            </View>
            )}
        </View>
    );
}

function getCountLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 19) return 'оценок';
    if (mod10 === 1) return 'оценка';
    if (mod10 >= 2 && mod10 <= 4) return 'оценки';
    return 'оценок';
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.md,
            padding: Platform.select({ default: 16, web: 20 }),
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...(Platform.OS === 'web'
                ? ({
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  } as any)
                : {}),
        },
        compactContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
        },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            letterSpacing: -0.2,
        },
        countText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        contentRow: {
            flexDirection: 'row',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
        },
        summaryBox: {
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 160,
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: DESIGN_TOKENS.radii.sm,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 0,
            borderColor: 'transparent',
            gap: 10,
        },
        boxLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        userBox: {
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 200,
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: DESIGN_TOKENS.radii.sm,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 0,
            borderColor: 'transparent',
            alignItems: 'flex-start',
            gap: 10,
        },
        rateLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        statusRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
        },
        spinner: {
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.primary,
            borderTopColor: 'transparent',
        },
        savingText: {
            fontSize: 13,
            color: colors.primary,
            fontWeight: '500',
        },
        successRow: {
            marginTop: 4,
        },
        successText: {
            fontSize: 13,
            color: colors.success,
            fontWeight: '600',
        },
        loginHint: {
            fontSize: 14,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        emptyStateBox: {
            alignItems: 'center',
            paddingVertical: 24,
            paddingHorizontal: 16,
            borderRadius: DESIGN_TOKENS.radii.sm,
            backgroundColor: colors.backgroundSecondary,
            gap: 8,
        },
        emptyStateIconWrap: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.warningSoft ?? colors.backgroundTertiary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
        },
        emptyStateTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.textMuted,
            marginTop: 4,
        },
        emptyStateSubtext: {
            fontSize: 14,
            color: colors.textTertiary ?? colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
        },
        emptyStateStars: {
            marginTop: 8,
        },
        yourRatingText: {
            fontSize: 12,
            color: colors.textMuted,
        },
    });

export default memo(TravelRatingSection);
