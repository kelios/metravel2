import { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import StarRating from '@/components/ui/StarRating';
import { usePlaceRating } from '@/hooks/usePlaceRating';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { selectPlural, translate as i18nT } from '@/i18n';

type Props = {
  placeId: string | number | undefined;
  initialRating?: number | null;
  initialCount?: number;
  initialUserRating?: number | null;
  compact?: boolean;
  /**
   * Тянуть ли агрегат/свою оценку отдельным GET. В списках (каталог /places)
   * выключаем: агрегат уже пришёл в ответе каталога, а по GET на карточку это
   * был бы отдельный запрос на КАЖДОЕ место страницы. Своя оценка там появится
   * после первого POST (ответ эндпоинта содержит актуальные значения).
   */
  autoFetch?: boolean;
  testID?: string;
};

/**
 * Собственный (MeTravel) рейтинг места: агрегат + интерактивная постановка
 * оценки авторизованным пользователем. Зеркалит ArticleRatingSection.
 * `compact` — одна строка звёзд (для тесных поверхностей вроде попапа карты).
 */
function PlaceRatingSection({
  placeId,
  initialRating,
  initialCount = 0,
  initialUserRating,
  compact = false,
  autoFetch = true,
  testID = 'place-rating-section',
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
  } = usePlaceRating({
    placeId,
    initialRating,
    initialCount,
    initialUserRating,
    enabled: autoFetch && placeId != null,
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
          disabled={isSubmitting || isLoading}
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
        <Text style={styles.title}>{i18nT('map:components.places.PlaceRatingSection.reyting_mesta_8eec0b7b')}</Text>
        {ratingCount > 0 && (
          <Text style={styles.countText}>
            {ratingCount} {getCountLabel(ratingCount)}
          </Text>
        )}
      </View>

      <View style={styles.ratingRow}>
        <View style={styles.ratingDisplay}>
          <Text style={styles.ratingValue}>{rating ? rating.toFixed(1) : '—'}</Text>
          <StarRating rating={rating} size="large" showValue={false} showCount={false} />
        </View>

        {canRate && (
          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>
              {userRating != null && userRating > 0
                ? i18nT('map:components.places.PlaceRatingSection.vasha_otsenka_7fdfa27d')
                : i18nT('map:components.places.PlaceRatingSection.ocenite_mesto_bcf0c96e')}
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
          </View>
        )}

        {!canRate && (
          <Text style={styles.loginHint}>
            {i18nT('map:components.places.PlaceRatingSection.voydite_chtoby_ocenit_10f3aa6a')}
          </Text>
        )}
      </View>
    </View>
  );
}

function getCountLabel(count: number): string {
  return selectPlural(count, {
    one: i18nT('map:components.places.PlaceRatingSection.otsenka_89103505'),
    few: i18nT('map:components.places.PlaceRatingSection.otsenki_9110419d'),
    many: i18nT('map:components.places.PlaceRatingSection.otsenok_07066e03'),
    other: i18nT('map:components.places.PlaceRatingSection.otsenok_07066e03'),
  });
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
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
    loginHint: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  });

export default memo(PlaceRatingSection);
