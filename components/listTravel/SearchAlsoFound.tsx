import { memo, useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import type { CatalogPlace } from '@/utils/placesCatalog'
import type { QuestMeta } from '@/utils/questAdapters'

const IS_WEB = Platform.OS === 'web'
const LINK_ROLE = IS_WEB ? ('link' as const) : ('button' as const)

export type SearchAlsoFoundProps = {
  query: string
  quests: QuestMeta[]
  questsTotal: number
  questCityName: string
  questCitySegment: string | null
  places: CatalogPlace[]
  placesTotal: number
}

/**
 * Раскрытый список строки «Ещё по запросу» на `/search` (#2775): квесты
 * найденного города и места каталога. Отдельный чанк — карточка квеста с медиа
 * нужна только после тапа по строке-сводке (`SearchAlsoFoundSummary`).
 */
function SearchAlsoFound({
  query,
  quests,
  questsTotal,
  questCityName,
  questCitySegment,
  places,
  placesTotal,
}: SearchAlsoFoundProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const openQuestCity = useCallback(() => {
    if (questCitySegment) router.push(`/quests/${encodeURIComponent(questCitySegment)}` as Href)
  }, [questCitySegment, router])
  const openPlaces = useCallback(
    (q: string) => router.push({ pathname: '/places', params: { q } } as Href),
    [router],
  )

  if (!quests.length && !places.length) return null

  return (
    <View style={styles.root} testID="search-also-found-list">
      {quests.length ? (
        <View style={styles.section} testID="search-also-found-quests">
          <Text style={styles.sectionTitle}>
            {i18nT('travel:components.listTravel.SearchAlsoFound.questsHeading', {
              value1: questCityName || quests[0]?.cityName || '',
            })}
          </Text>
          <View style={styles.questGrid}>
            {quests.map((quest) => (
              <QuestForCityCard
                key={quest.id}
                quest={quest}
                style={styles.questCard}
                analyticsSource="site_search"
                analyticsContextId={query}
              />
            ))}
          </View>
          {questCitySegment ? (
            <Pressable
              onPress={openQuestCity}
              accessibilityRole={LINK_ROLE}
              style={styles.moreLink}
              testID="search-also-found-quests-all"
            >
              <Text style={styles.moreLinkText}>
                {i18nT('travel:components.listTravel.SearchAlsoFound.allCityQuests', {
                  value1: formatInteger(questsTotal),
                })}
              </Text>
              <Feather name="arrow-right" size={16} color={colors.primaryText} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {places.length ? (
        <View style={styles.section} testID="search-also-found-places">
          <Text style={styles.sectionTitle}>
            {i18nT('travel:components.listTravel.SearchAlsoFound.placesHeading')}
          </Text>
          <View style={styles.placeList}>
            {places.map((place) => {
              const meta = [place.category, place.country].filter(Boolean).join(' · ')
              return (
                <Pressable
                  key={place.id}
                  onPress={() => openPlaces(place.title)}
                  accessibilityRole={LINK_ROLE}
                  accessibilityLabel={meta ? `${place.title}, ${meta}` : place.title}
                  style={({ pressed }) => [styles.placeRow, pressed && styles.placeRowPressed]}
                  testID={`search-also-found-place-${place.id}`}
                >
                  <Feather name="map-pin" size={18} color={colors.primaryText} />
                  <View style={styles.placeBody}>
                    <Text style={styles.placeTitle} numberOfLines={2}>{place.title}</Text>
                    {meta ? <Text style={styles.placeMeta} numberOfLines={1}>{meta}</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
          <Pressable
            onPress={() => openPlaces(query)}
            accessibilityRole={LINK_ROLE}
            style={styles.moreLink}
            testID="search-also-found-places-all"
          >
            <Text style={styles.moreLinkText}>
              {i18nT('travel:components.listTravel.SearchAlsoFound.allPlaces', {
                value1: formatInteger(placesTotal),
              })}
            </Text>
            <Feather name="arrow-right" size={16} color={colors.primaryText} />
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  const type = DESIGN_TOKENS.typography.scale
  return StyleSheet.create({
    root: {
      gap: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    section: { gap: DESIGN_TOKENS.spacing.sm },
    sectionTitle: { ...type.bodyStrong, color: colors.text },
    questGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    questCard: {
      flexGrow: 1,
      flexBasis: 300,
      maxWidth: 560,
    },
    placeList: {
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      minHeight: 48,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      ...(IS_WEB ? ({ cursor: 'pointer' } as const) : null),
    },
    placeRowPressed: { backgroundColor: colors.primarySoft },
    placeBody: { flex: 1, minWidth: 0 },
    placeTitle: { ...type.body, color: colors.text },
    placeMeta: { ...type.bodySmall, color: colors.textMuted },
    moreLink: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: DESIGN_TOKENS.spacing.xxs,
      minHeight: 44,
      ...(IS_WEB ? ({ cursor: 'pointer' } as const) : null),
    },
    moreLinkText: { ...type.bodyStrong, color: colors.primaryText },
  })
}

export default memo(SearchAlsoFound)
