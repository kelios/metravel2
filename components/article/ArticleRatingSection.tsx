import { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import StarRating from '@/components/ui/StarRating';
import { useArticleRating } from '@/hooks/useArticleRating';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { selectPlural, translate as i18nT } from '@/i18n'


type Props = {
    articleId: number | undefined;
    initialRating?: number | null;
    initialCount?: number;
    initialUserRating?: number | null;
    compact?: boolean;
    testID?: string;
};

function ArticleRatingSection({
    articleId,
    initialRating,
    initialCount = 0,
    initialUserRating,
    compact = false,
    testID = 'article-rating-section',
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
    } = useArticleRating({
        articleId,
        initialRating,
        initialCount,
        initialUserRating,
        enabled: !!articleId,
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
            </View>
        );
    }

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.header}>
                <Text style={styles.title}>{i18nT('shared:components.article.ArticleRatingSection.reyting_stati_bf5d2d3e')}</Text>
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
                            {userRating != null && userRating > 0 ? i18nT('shared:components.article.ArticleRatingSection.vasha_otsenka_6e822bc5') : i18nT('shared:components.article.ArticleRatingSection.otsenite_statyu_ff384ce6')}
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
                            <Text style={styles.savingText}>{i18nT('shared:components.article.ArticleRatingSection.sohranenie_9d9151b6')}</Text>
                        )}
                        {userRating != null && userRating > 0 && !isSubmitting && !isLoading && (
                            <Text style={styles.yourRatingText}>{i18nT('shared:components.article.ArticleRatingSection.vasha_otsenka_cccfdba6')}{userRating}</Text>
                        )}
                    </View>
                )}

                {!canRate && (
                    <Text style={styles.loginHint}>
                        {i18nT('shared:components.article.ArticleRatingSection.voydite_chtoby_otsenit_fe9f546b')}</Text>
                )}
            </View>
        </View>
    );
}

function getCountLabel(count: number): string {
    return selectPlural(count, {
        one: i18nT('shared:components.article.ArticleRatingSection.otsenka_f65ce63f'),
        few: i18nT('shared:components.article.ArticleRatingSection.otsenki_d41c6edf'),
        many: i18nT('shared:components.article.ArticleRatingSection.otsenok_0f83ec1c'),
        other: i18nT('shared:components.article.ArticleRatingSection.otsenok_0f83ec1c'),
    });
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            padding: 16,
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.md,
            marginTop: 16,
        },
        compactContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        countText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        ratingRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
        },
        ratingDisplay: {
            alignItems: 'center',
            minWidth: 80,
        },
        ratingValue: {
            fontSize: 32,
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: 4,
        },
        rateSection: {
            flex: 1,
            alignItems: 'flex-end',
            minWidth: 150,
        },
        rateLabel: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 8,
        },
        yourRatingText: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 4,
        },
        savingText: {
            fontSize: 12,
            color: colors.primaryText,
            marginTop: 4,
        },
        loginHint: {
            fontSize: 14,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
    });

export default memo(ArticleRatingSection);
