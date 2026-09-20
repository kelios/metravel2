import React, { useMemo } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
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

/**
 * Базис колонки списка соседних городов: на широкой секции даёт колонки, на мобильной — одну.
 * Карточка обязана уметь сжиматься (`flexShrink`): у контейнера `/quests/<city>` остаётся ширина
 * экрана минус 80 px, то есть ровно 240 px уже на 320-точечном телефоне, а при делении экрана
 * или зуме — меньше базиса, и без сжатия карточка вылезала бы за рамку секции.
 */
const NEARBY_CARD_MIN_WIDTH = 240

/**
 * Потолок карточки: последний ряд часто остаётся неполным, и `flexGrow` растягивал бы
 * одинокую карточку на всю секцию (840 px) — она читалась бы как отдельный блок, а не как
 * хвост списка. Половина ряда секции: (840 − 32 отступа − 8 зазор) / 2.
 */
const NEARBY_CARD_MAX_WIDTH = 400

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

      {walkPlaces.length > 0 ? (
        <View style={styles.section} testID="quest-city-walk">
          <View style={styles.titleRow}>
            <Feather name="camera" size={18} color={colors.primary} aria-hidden />
            <Text
              accessibilityRole="header"
              {...({ 'aria-level': 2 } as Record<string, unknown>)}
              style={styles.title}
            >
              {t('quests:app.tabs.quests.city.index.walkTitle', { value1: cityName })}
            </Text>
          </View>
          <Text style={styles.body}>{t('quests:app.tabs.quests.city.index.walkLead')}</Text>
          {walkPlaces.map((place) => (
            <View key={`${place.questId}-${place.pointIndex}`} style={styles.place}>
              <Text
                accessibilityRole="header"
                {...({ 'aria-level': 3 } as Record<string, unknown>)}
                style={styles.placeTitle}
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
        </View>
      ) : null}

      {routeParagraphs.length > 0 ? (
        <View style={styles.section} testID="quest-city-routes">
          <View style={styles.titleRow}>
            <Feather name="list" size={18} color={colors.primary} aria-hidden />
            <Text
              accessibilityRole="header"
              {...({ 'aria-level': 2 } as Record<string, unknown>)}
              style={styles.title}
            >
              {t('quests:app.tabs.quests.city.index.routesStructureTitle')}
            </Text>
          </View>
          {routeParagraphs.map((paragraph) => (
            <Text key={paragraph.questId} style={styles.body}>
              {paragraph.text}
            </Text>
          ))}
        </View>
      ) : null}

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
              // Прямому ребёнку `Link asChild` отдаётся ОДИН плоский объект стиля: Slot сливает
              // стили спредом, поэтому функция `({ pressed }) => [...]` превращается в `{}` и
              // карточка теряет всю вёрстку. Состояние нажатия живёт на внутренней строке.
              <Link key={nearby.segment} href={`/quests/${nearby.segment}`} asChild>
                <Pressable
                  style={styles.nearbyLink}
                  accessibilityRole="link"
                  accessibilityLabel={t('quests:app.tabs.quests.city.index.nearbyA11y', {
                    value1: nearby.cityName || nearby.segment,
                    value2: formatDistance(nearby.distanceKm),
                  })}
                >
                  {({ pressed }) => (
                    <View style={[styles.nearbyRow, pressed && styles.nearbyRowPressed]}>
                      <View style={styles.nearbyText}>
                        <Text style={styles.nearbyName}>{nearby.cityName || nearby.segment}</Text>
                        <Text style={styles.nearbyMeta}>
                          {pluralizeQuest(nearby.quests.length)} · {formatDistance(nearby.distanceKm)}
                        </Text>
                      </View>
                      <Feather name="arrow-right" size={17} color={colors.primary} aria-hidden />
                    </View>
                  )}
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
    nearbyList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    nearbyLink: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: NEARBY_CARD_MIN_WIDTH,
      maxWidth: NEARBY_CARD_MAX_WIDTH,
      minHeight: 52,
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    nearbyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    nearbyRowPressed: {
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
