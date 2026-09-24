import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  QuestLandingCityLinks,
  QuestLandingSection,
  useQuestLandingSectionStyles,
} from '@/components/quests/QuestLandingLayout'
import { useTranslation } from '@/i18n/LocaleProvider'
import { formatInteger } from '@/i18n/format'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { pluralizePoints, pluralizeQuest } from '@/screens/tabs/questsShared'
import { formatDistance, formatTravelTime } from '@/utils/distanceCalculator'
import type { QuestMeta } from '@/utils/questAdapters'
import type {
  NearbyQuestCityLandingGroup,
  QuestCityLandingGroup,
} from '@/utils/questCityAlias'
import type { QuestCityWalkModel, QuestCityWalkRoute } from '@/utils/questCityWalk'

type Props = {
  city: QuestCityLandingGroup<QuestMeta>
  nearbyCities: NearbyQuestCityLandingGroup<QuestMeta>[]
  /** Заметки о местах города; `null`, пока бандлы квестов не загружены. */
  walk: QuestCityWalkModel | null
}

const DIFFICULTY_KEYS: Record<string, string> = {
  easy: 'quests:app.tabs.quests.city.index.routeDifficultyEasy',
  medium: 'quests:app.tabs.quests.city.index.routeDifficultyMedium',
  hard: 'quests:app.tabs.quests.city.index.routeDifficultyHard',
}

/**
 * Content owned by the city landing, not by an individual quest card.
 *
 * The static generator mirrors these sections for crawlers. Keeping the
 * runtime hierarchy here makes a one-quest city useful after hydration too:
 * practical planning facts and links to other quest cities remain even when
 * the catalog grid contains a single item.
 */
export default function QuestCityLandingSections({ city, nearbyCities, walk }: Props) {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const styles = useQuestLandingSectionStyles(colors)
  const placeStyles = useMemo(() => createPlaceStyles(colors), [colors])
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

  // Тот же состав фраз, что печатает SSG (`buildQuestCityRoutesHtml`):
  // страница до гидратации и после обязана читаться одинаково.
  const routeParagraphs = useMemo(() => {
    const describeRoute = (route: QuestCityWalkRoute): string => {
      const difficultyKey = DIFFICULTY_KEYS[route.difficulty]
      const summary = [
        route.pointCount > 0 ? pluralizePoints(route.pointCount) : '',
        route.durationMin > 0
          ? t('quests:app.tabs.quests.city.index.routeDuration', {
              value1: formatTravelTime(route.durationMin),
            })
          : '',
        difficultyKey
          ? t('quests:app.tabs.quests.city.index.routeDifficulty', { value1: t(difficultyKey) })
          : '',
      ].filter(Boolean)

      return [
        route.title && summary.length > 0
          ? t('quests:app.tabs.quests.city.index.routeSummary', {
              value1: route.title,
              value2: summary.join(', '),
            })
          : '',
        route.optionalCount > 0
          ? t('quests:app.tabs.quests.city.index.routeOptional', {
              value1: pluralizePoints(route.optionalCount),
            })
          : '',
        route.startLocation && route.finishLocation
          ? t('quests:app.tabs.quests.city.index.routeEnds', {
              value1: route.startLocation,
              value2: route.finishLocation,
            })
          : '',
        route.museumCount > 0
          ? t('quests:app.tabs.quests.city.index.routeMuseums', {
              value1: formatInteger(route.museumCount),
            })
          : '',
        route.petFriendly ? t('quests:app.tabs.quests.city.index.routePet') : '',
      ]
        .filter(Boolean)
        .join(' ')
    }

    return (walk?.routes ?? [])
      .map((route) => ({ questId: route.questId, text: describeRoute(route) }))
      .filter((paragraph) => paragraph.text.length > 0)
  }, [walk, t])

  const walkPlaces = walk?.places ?? []
  const otherPlaces = walk?.otherPlaces ?? []

  return (
    <>
      <QuestLandingSection
        styles={styles}
        colors={colors}
        testID="quest-city-overview"
        icon="map-pin"
        title={t('quests:app.tabs.quests.city.index.overviewTitle', { value1: cityName })}
      >
        <Text style={styles.body}>{overview}</Text>
      </QuestLandingSection>

      {walkPlaces.length > 0 ? (
        <QuestLandingSection
          styles={styles}
          colors={colors}
          testID="quest-city-walk"
          icon="camera"
          title={t('quests:app.tabs.quests.city.index.walkTitle', { value1: cityName })}
        >
          <Text style={styles.body}>{t('quests:app.tabs.quests.city.index.walkLead')}</Text>
          {walkPlaces.map((place) => (
            <View key={`${place.questId}-${place.pointIndex}`} style={placeStyles.place}>
              <Text
                accessibilityRole="header"
                {...({ 'aria-level': 3 } as Record<string, unknown>)}
                style={placeStyles.placeTitle}
              >
                {place.location ? `${place.title} — ${place.location}` : place.title}
              </Text>
              <Text style={styles.body}>{place.sentences.join(' ')}</Text>
              {place.openingHours ? (
                <Text style={styles.note}>
                  {t('quests:app.tabs.quests.city.index.walkOpeningHours', {
                    value1: place.openingHours,
                  })}
                </Text>
              ) : null}
              {place.ticketPrice ? (
                <Text style={styles.note}>
                  {t('quests:app.tabs.quests.city.index.walkTicket', { value1: place.ticketPrice })}
                </Text>
              ) : null}
            </View>
          ))}
          {otherPlaces.length > 0 ? (
            <Text style={styles.body}>
              {t('quests:app.tabs.quests.city.index.walkMore', { value1: otherPlaces.join(', ') })}
            </Text>
          ) : null}
        </QuestLandingSection>
      ) : null}

      {routeParagraphs.length > 0 ? (
        <QuestLandingSection
          styles={styles}
          colors={colors}
          testID="quest-city-routes"
          icon="list"
          title={t('quests:app.tabs.quests.city.index.routesStructureTitle')}
        >
          {routeParagraphs.map((paragraph) => (
            <Text key={paragraph.questId} style={styles.body}>
              {paragraph.text}
            </Text>
          ))}
        </QuestLandingSection>
      ) : null}

      <QuestLandingSection
        styles={styles}
        colors={colors}
        testID="quest-city-practical"
        icon="sun"
        title={t('quests:app.tabs.quests.city.index.practiceTitle')}
      >
        <Text style={styles.body}>{practice}</Text>
        <Text style={styles.note}>
          {t('quests:app.tabs.quests.city.index.practiceNote')}
        </Text>
      </QuestLandingSection>

      {nearbyCities.length > 0 ? (
        <QuestLandingSection
          styles={styles}
          colors={colors}
          testID="quest-city-nearby"
          icon="navigation"
          title={t('quests:app.tabs.quests.city.index.nearbyTitle')}
        >
          <Text style={styles.body}>
            {t('quests:app.tabs.quests.city.index.nearbyLead', { value1: cityName })}
          </Text>
          <QuestLandingCityLinks
            styles={styles}
            colors={colors}
            links={nearbyCities.map((nearby) => ({
              key: nearby.segment,
              href: `/quests/${nearby.segment}`,
              a11yLabel: t('quests:app.tabs.quests.city.index.nearbyA11y', {
                value1: nearby.cityName || nearby.segment,
                value2: formatDistance(nearby.distanceKm),
              }),
              name: nearby.cityName || nearby.segment,
              meta: <>{pluralizeQuest(nearby.quests.length)} · {formatDistance(nearby.distanceKm)}</>,
            }))}
          />
        </QuestLandingSection>
      ) : null}
    </>
  )
}

function createPlaceStyles(colors: ThemedColors) {
  return StyleSheet.create({
    place: {
      gap: 4,
      marginTop: 4,
    },
    placeTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '700',
      color: colors.text,
    },
  })
}
