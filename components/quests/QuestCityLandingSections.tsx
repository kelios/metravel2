import React, { useMemo } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTranslation } from '@/i18n/LocaleProvider'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { pluralizePoints, pluralizeQuest } from '@/screens/tabs/questsShared'
import { formatDistance, formatTravelTime } from '@/utils/distanceCalculator'
import type { QuestMeta } from '@/utils/questAdapters'
import type {
  NearbyQuestCityLandingGroup,
  QuestCityLandingGroup,
} from '@/utils/questCityAlias'

type Props = {
  city: QuestCityLandingGroup<QuestMeta>
  nearbyCities: NearbyQuestCityLandingGroup<QuestMeta>[]
}

/**
 * Content owned by the city landing, not by an individual quest card.
 *
 * The static generator mirrors these sections for crawlers. Keeping the
 * runtime hierarchy here makes a one-quest city useful after hydration too:
 * practical planning facts and links to other quest cities remain even when
 * the catalog grid contains a single item.
 */
export default function QuestCityLandingSections({ city, nearbyCities }: Props) {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(colors), [colors])
  const cityName = city.cityName || city.segment
  const questCount = city.quests.length
  const pointCount = city.quests.reduce((sum, quest) => sum + (Number(quest.points) || 0), 0)
  const durations = city.quests
    .map((quest) => Number(quest.durationMin) || 0)
    .filter((duration) => duration > 0)
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0)

  const overview = city.countryName
    ? t('quests:app.tabs.quests.city.index.overviewWithCountry', {
        value1: cityName,
        value2: city.countryName,
        value3: pluralizeQuest(questCount),
      })
    : t('quests:app.tabs.quests.city.index.overview', {
        value1: cityName,
        value2: pluralizeQuest(questCount),
      })

  const practice = pointCount > 0 && totalDuration > 0
    ? t('quests:app.tabs.quests.city.index.practiceWithFacts', {
        value1: cityName,
        value2: pluralizePoints(pointCount),
        value3: formatTravelTime(totalDuration),
      })
    : t('quests:app.tabs.quests.city.index.practice', { value1: cityName })

  return (
    <>
      <View style={styles.section} testID="quest-city-overview">
        <View style={styles.titleRow}>
          <Feather name="map-pin" size={18} color={colors.primary} aria-hidden />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={styles.title}
          >
            {t('quests:app.tabs.quests.city.index.overviewTitle', { value1: cityName })}
          </Text>
        </View>
        <Text style={styles.body}>{overview}</Text>
      </View>

      <View style={styles.section} testID="quest-city-practical">
        <View style={styles.titleRow}>
          <Feather name="sun" size={18} color={colors.primary} aria-hidden />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={styles.title}
          >
            {t('quests:app.tabs.quests.city.index.practiceTitle')}
          </Text>
        </View>
        <Text style={styles.body}>{practice}</Text>
        <Text style={styles.note}>
          {t('quests:app.tabs.quests.city.index.practiceNote')}
        </Text>
      </View>

      {nearbyCities.length > 0 ? (
        <View style={styles.section} testID="quest-city-nearby">
          <View style={styles.titleRow}>
            <Feather name="navigation" size={18} color={colors.primary} aria-hidden />
            <Text
              accessibilityRole="header"
              {...({ 'aria-level': 2 } as Record<string, unknown>)}
              style={styles.title}
            >
              {t('quests:app.tabs.quests.city.index.nearbyTitle')}
            </Text>
          </View>
          <Text style={styles.body}>
            {t('quests:app.tabs.quests.city.index.nearbyLead', { value1: cityName })}
          </Text>
          <View style={styles.nearbyList}>
            {nearbyCities.map((nearby) => (
              <Link key={nearby.segment} href={`/quests/${nearby.segment}`} asChild>
                <Pressable
                  style={({ pressed }) => [styles.nearbyLink, pressed && styles.nearbyLinkPressed]}
                  accessibilityRole="link"
                  accessibilityLabel={t('quests:app.tabs.quests.city.index.nearbyA11y', {
                    value1: nearby.cityName || nearby.segment,
                    value2: formatDistance(nearby.distanceKm),
                  })}
                >
                  <View style={styles.nearbyText}>
                    <Text style={styles.nearbyName}>{nearby.cityName || nearby.segment}</Text>
                    <Text style={styles.nearbyMeta}>
                      {pluralizeQuest(nearby.quests.length)} · {formatDistance(nearby.distanceKm)}
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={17} color={colors.primary} aria-hidden />
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ) : null}
    </>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    section: {
      maxWidth: 840,
      gap: 8,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.textMuted,
    },
    note: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSubtle,
    },
    nearbyList: {
      gap: 8,
      marginTop: 4,
    },
    nearbyLink: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    nearbyLinkPressed: {
      opacity: 0.75,
    },
    nearbyText: {
      flex: 1,
      gap: 2,
    },
    nearbyName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    nearbyMeta: {
      fontSize: 12,
      color: colors.textSubtle,
    },
  })
}
