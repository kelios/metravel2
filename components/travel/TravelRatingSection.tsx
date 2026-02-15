// components/travel/TravelRatingSection.tsx
// ✅ Секция рейтинга на странице путешествия с возможностью оценки

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

    if (compact) {
        return (
            <View style={styles.compactContainer} testID={testID}>
                <StarRating
                    rating={rating}
                    ratingCount={ratingCount}
                    userRating={userRating}
                    interactive={canRate}
                    onRate={handleRate}
                    size="medium"
                    showValue
                    showCount
                />
                {userRating && (
                    <Text style={styles.yourRatingText}>
                        Ваша оценка: {userRating}
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.header}>
                <Text style={styles.title}>Рейтинг путешествия</Text>
                {ratingCount > 0 && (
                    <Text style={styles.countText}>
                        {ratingCount} {getCountLabel(ratingCount)}
                    </Text>
                )}
            </View>

            <View style={styles.ratingRow}>
                <View style={styles.ratingDisplay}>
                    <Text style={styles.ratingValue}>
                        {rating ? rating.toFixed(1) : '—'}
                    </Text>
                    <StarRating
                        rating={rating}
                        size="large"
                        showValue={false}
                        showCount={false}
                    />
                </View>

                {canRate && (
                    <View style={styles.rateSection}>
                        <Text style={styles.rateLabel}>
                            {userRating ? 'Изменить оценку:' : 'Оцените путешествие:'}
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
                            <Text style={styles.savingText}>Сохранение...</Text>
                        )}
                        {!isSubmitting && isLoading && (
                            <Text style={styles.loadingText}>Загрузка...</Text>
                        )}
                        {!!userRating && !isSubmitting && !isLoading && (
                            <Text style={styles.yourRatingText}>Ваша оценка: {userRating}</Text>
                        )}
                    </View>
                )}

                {!canRate && (
                    <Text style={styles.loginHint}>
                        Войдите, чтобы оценить
                    </Text>
                )}
            </View>
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
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: {
                    boxShadow: DESIGN_TOKENS.shadows.card,
                } as any,
                default: {},
            }),
        },
        compactContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        countText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        ratingRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
        },
        ratingDisplay: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        ratingValue: {
            fontSize: 36,
            fontWeight: '800',
            color: colors.text,
            lineHeight: 42,
        },
        rateSection: {
            gap: 8,
        },
        rateLabel: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 4,
        },
        savingText: {
            fontSize: 12,
            color: colors.primary,
            marginTop: 4,
        },
        loadingText: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 4,
        },
        loginHint: {
            fontSize: 14,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        yourRatingText: {
            fontSize: 12,
            color: colors.textMuted,
        },
    });

export default memo(TravelRatingSection);

