import { memo, useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import StarRating from '@/components/ui/StarRating';
import { useTravelRating } from '@/hooks/useTravelRating';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { selectPlural, translate as i18nT } from '@/i18n'


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
    const { requireAuth } = useRequireAuth({ intent: 'rate' });
    const shouldUseNativeDriver = false;

    // 🎨 Анимация для изменения рейтинга
    const ratingChangeAnim = useRef(new Animated.Value(1)).current;
    const successPulseAnim = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const [showSuccess, setShowSuccess] = useState(false);
    const prevRatingRef = useRef<number | null>(null);
    const prevSubmittingRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
        if (prevSubmittingRef.current && !isSubmitting && userRating !== null && userRating > 0) {
            setShowSuccess(true);
            const anim = Animated.sequence([
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
            ]);
            anim.start(() => {
                if (isMountedRef.current) setShowSuccess(false);
            });
            prevSubmittingRef.current = isSubmitting;
            return () => anim.stop();
        }
        prevSubmittingRef.current = isSubmitting;
        return undefined;
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
                {isSubmitting ? (
                    <Text style={styles.yourRatingText}>{i18nT('travel:components.travel.TravelRatingSection.sohranenie_19f7ec61')}</Text>
                ) : showSuccess ? (
                    <Text style={[styles.yourRatingText, { color: colors.success ?? colors.primary }]}>
                        {i18nT('travel:components.travel.TravelRatingSection.spasibo_za_otsenku_3fc0202d')}</Text>
                ) : userRating != null && userRating > 0 ? (
                    <Text style={styles.yourRatingText}>
                        {i18nT('travel:components.travel.TravelRatingSection.vasha_otsenka_f730b8df')}{userRating}
                    </Text>
                ) : null}
            </View>
        );
    }

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>{i18nT('travel:components.travel.TravelRatingSection.reyting_05774716')}</Text>
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
                    <Text style={styles.emptyStateTitle}>{i18nT('travel:components.travel.TravelRatingSection.poka_net_otsenok_90430f65')}</Text>
                    <Text style={styles.emptyStateSubtext}>
                        {canRate ? i18nT('travel:components.travel.TravelRatingSection.budte_pervym_kto_otsenit_etot_marshrut_4eeb3c4b') : i18nT('travel:components.travel.TravelRatingSection.voydite_chtoby_otsenit_marshrut_d63e5459')}
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
                            <Text style={styles.savingText}>{i18nT('travel:components.travel.TravelRatingSection.sohranenie_c98995ba')}</Text>
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
                            <Text style={styles.successText}>{i18nT('travel:components.travel.TravelRatingSection.spasibo_za_otsenku_3fc0202d')}</Text>
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
                    <Text style={styles.boxLabel}>{i18nT('travel:components.travel.TravelRatingSection.obschiy_reyting_b897dca1')}</Text>
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
                                {userRating != null && userRating > 0 ? i18nT('travel:components.travel.TravelRatingSection.vasha_otsenka_92978da8') : i18nT('travel:components.travel.TravelRatingSection.otsenite_marshrut_0de95cde')}
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
                                    <Text style={styles.savingText}>{i18nT('travel:components.travel.TravelRatingSection.sohranenie_c98995ba')}</Text>
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
                                    <Text style={styles.successText}>{i18nT('travel:components.travel.TravelRatingSection.spasibo_za_otsenku_3fc0202d')}</Text>
                                </Animated.View>
                            )}
                        </>
                    ) : (
                        <Pressable
                            onPress={requireAuth}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('travel:components.travel.TravelRatingSection.voydite_chtoby_otsenit_marshrut_d63e5459')}
                            hitSlop={8}
                        >
                            <Text style={[styles.loginHint, { textDecorationLine: 'underline' }]}>
                                {i18nT('travel:components.travel.TravelRatingSection.voydite_chtoby_otsenit_069eddcf')}</Text>
                        </Pressable>
                    )}
                </View>
            </View>
            )}
        </View>
    );
}

function getCountLabel(count: number): string {
    return selectPlural(count, {
        one: i18nT('travel:components.travel.TravelRatingSection.otsenka_912ec6a8'),
        few: i18nT('travel:components.travel.TravelRatingSection.otsenki_1f7548c9'),
        many: i18nT('travel:components.travel.TravelRatingSection.otsenok_ab81d5a5'),
        other: i18nT('travel:components.travel.TravelRatingSection.otsenok_ab81d5a5'),
    });
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
            color: colors.primaryText,
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
