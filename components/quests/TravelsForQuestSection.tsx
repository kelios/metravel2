import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTravelsForQuest } from '@/hooks/useTravelsForQuest'
import type { TravelLocationQuery } from '@/utils/travelForLocation'

const MAX_TRAVELS = 4

type Props = {
  cityName?: string | null
  countryName?: string | null
  countryCode?: string | null
  /** Координаты точек квеста для матчинга travel по близости. */
  coords?: Array<{ lat: number; lng: number }>
}

/**
 * Блок «Путешествия по этому городу» на странице квеста — обратная
 * перелинковка квест → travel-статьи того же города/рядом.
 */
export function TravelsForQuestSection({ cityName, countryName, countryCode, coords }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const query = useMemo<TravelLocationQuery>(
    () => ({ cityName, countryName, countryCode, coords }),
    [cityName, countryName, countryCode, coords],
  )
  const { matches } = useTravelsForQuest(query, { limit: MAX_TRAVELS })

  if (!matches.length) return null

  const heading = cityName ? `Путешествия по городу ${cityName}` : 'Путешествия по этому городу'

  return (
    <View
      style={styles.section}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
    >
      <Text
        style={styles.title}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        {heading}
      </Text>
      <Text style={styles.subtitle}>Истории и маршруты автора по этим местам</Text>

      <View style={styles.grid}>
        {matches.map(({ travel }) => {
          const countries =
            travel.countryName?.split(',').map((c) => c.trim()).filter(Boolean) ?? []
          const metaText = travel.cityName || (countries.length ? countries.join(', ') : null)
          return (
            <View key={String(travel.id)} style={styles.cardWrapper}>
              <UnifiedTravelCard
                testID={`quest-travel-card-${travel.id}`}
                title={travel.name}
                imageUrl={travel.travel_image_thumb_url}
                metaText={metaText}
                onPress={() => router.push(`/travels/${travel.slug || travel.id}`)}
                imageHeight={170}
                style={styles.card}
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    section: {
      marginTop: 24,
      gap: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      gap: 12,
    },
    cardWrapper: {
      flexGrow: 1,
      flexBasis: 220,
      minWidth: 200,
      maxWidth: 320,
    },
    card: {
      height: '100%',
      backgroundColor: colors.surface,
    },
  })
}

export default React.memo(TravelsForQuestSection)
