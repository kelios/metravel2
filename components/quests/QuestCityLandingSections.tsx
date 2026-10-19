import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

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
import QuestEditorialText from './QuestEditorialText'
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
 * Copy owned by the city page below the catalog grid (#2654).
 *
 * Only what the cards do not already say: place notes from the quests (#1569),
 * how each route is laid out, and links to nearby quest cities. The static
 * generator mirrors exactly these sections, so the crawler reads what a person
 * sees after hydration; template filler («самостоятельная прогулка», «как
 * спланировать») is gone from both.
 */
export default function QuestCityLandingSections({ city, nearbyCities, walk }: Props) {
  const colors = useThemedColors()
  const { t } = useTranslation()
  const styles = useQuestLandingSectionStyles(colors)
  const placeStyles = useMemo(() => createPlaceStyles(colors), [colors])
  const cityName = city.cityName || city.segment

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

  return (
    <>
      {walkPlaces.length > 0 ? (
        <QuestLandingSection
          styles={styles}
          colors={colors}
          testID="quest-city-walk"
          icon="camera"
          title={t('quests:app.tabs.quests.city.index.walkTitle', { value1: cityName })}
        >
          <QuestEditorialText style={styles.body}>{t('quests:app.tabs.quests.city.index.walkLead')}</QuestEditorialText>
          {walkPlaces.map((place) => (
            <View key={`${place.questId}-${place.pointIndex}`} style={placeStyles.place}>
              <QuestEditorialText
                accessibilityRole="header"
                {...({ 'aria-level': 3 } as Record<string, unknown>)}
                style={placeStyles.placeTitle}
              >
                {place.location ? `${place.title} — ${place.location}` : place.title}
              </QuestEditorialText>
              <QuestEditorialText style={styles.body}>{place.sentences.join(' ')}</QuestEditorialText>
              {place.openingHours ? (
                <QuestEditorialText style={styles.note}>
                  {t('quests:app.tabs.quests.city.index.walkOpeningHours', {
                    value1: place.openingHours,
                  })}
                </QuestEditorialText>
              ) : null}
              {place.ticketPrice ? (
                <QuestEditorialText style={styles.note}>
                  {t('quests:app.tabs.quests.city.index.walkTicket', { value1: place.ticketPrice })}
                </QuestEditorialText>
              ) : null}
            </View>
          ))}
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
            <QuestEditorialText key={paragraph.questId} style={styles.body}>
              {paragraph.text}
            </QuestEditorialText>
          ))}
        </QuestLandingSection>
      ) : null}

      {nearbyCities.length > 0 ? (
        <QuestLandingSection
          styles={styles}
          colors={colors}
          testID="quest-city-nearby"
          icon="navigation"
          title={t('quests:app.tabs.quests.city.index.nearbyTitle')}
        >
          <QuestEditorialText style={styles.body}>
            {t('quests:app.tabs.quests.city.index.nearbyLead', { value1: cityName })}
          </QuestEditorialText>
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
