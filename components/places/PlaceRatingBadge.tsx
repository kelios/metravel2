import React, { memo, useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import type { PlaceRating } from '@/utils/placesCatalog'
import { translate as i18nT } from '@/i18n'

// The site's own aggregated user rating. It needs no external attribution, so its
// provider label is hidden on the badge (just the stars + score are shown).
const NATIVE_PROVIDER = 'metravel'

// Human-facing provider labels. These are brand names, not localizable copy, so
// they stay verbatim across locales; unknown codes fall back to a capitalized form.
const PROVIDER_LABELS: Record<string, string> = {
  metravel: 'MeTravel',
  '2gis': '2GIS',
  tripadvisor: 'TripAdvisor',
  google: 'Google',
  yandex: 'Yandex',
  foursquare: 'Foursquare',
}

const formatProvider = (provider: string): string => {
  const normalized = provider.trim().toLowerCase()
  if (PROVIDER_LABELS[normalized]) return PROVIDER_LABELS[normalized]
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : ''
}

const formatCount = (count: number): string => {
  if (count <= 0) return ''
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

type Props = {
  rating: PlaceRating | null | undefined
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Compact gold rating pill shown over a place photo: ★ value · Source (count).
 * Renders nothing when there is no aggregate score, so it is safe to mount on
 * every card before the backend rating enrichment ships.
 */
function PlaceRatingBadge({ rating, style, testID = 'place-rating-badge' }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  if (!rating || rating.value == null || rating.value <= 0) return null

  // Prefer the source that actually carries the score for attribution; fall back
  // to the first listed provider.
  const primarySource =
    rating.sources.find((source) => source.value != null) ?? rating.sources[0] ?? null
  const providerLabel = primarySource ? formatProvider(primarySource.provider) : ''
  const isNativeProvider = primarySource?.provider.trim().toLowerCase() === NATIVE_PROVIDER
  // Own MeTravel rating shows no source attribution; external sources always do.
  const showProvider = !!providerLabel && !isNativeProvider
  const valueLabel = rating.value.toFixed(1)
  const countLabel = formatCount(rating.count)

  return (
    <View
      style={[styles.pill, style]}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={i18nT(
        'map:components.places.PlaceRatingBadge.reyting_value1_iz_5_istochnik_value2_dd3a3e3d',
        { value1: valueLabel, value2: providerLabel || '—' },
      )}
    >
      <Text style={styles.star}>★</Text>
      <Text style={styles.value}>{valueLabel}</Text>
      {showProvider ? (
        <>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.provider} numberOfLines={1}>
            {providerLabel}
          </Text>
        </>
      ) : null}
      {countLabel ? <Text style={styles.count}>({countLabel})</Text> : null}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      // Legible over any photo, matching the dark scrim of the corner action buttons.
      backgroundColor: 'rgba(0, 0, 0, 0.58)',
      maxWidth: 180,
    },
    star: {
      fontSize: 13,
      lineHeight: 15,
      color: colors.warning,
    },
    value: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textOnDark ?? '#fff',
    },
    separator: {
      fontSize: 12,
      color: colors.textOnDark ?? '#fff',
      opacity: 0.6,
    },
    provider: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textOnDark ?? '#fff',
      opacity: 0.9,
      flexShrink: 1,
    },
    count: {
      fontSize: 11,
      color: colors.textOnDark ?? '#fff',
      opacity: 0.75,
    },
  })

export default memo(PlaceRatingBadge)
