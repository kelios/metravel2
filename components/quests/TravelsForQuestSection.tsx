import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTravelsForQuest } from '@/hooks/useTravelsForQuest'
import type { TravelLocationQuery } from '@/utils/travelForLocation'
import { resolveTravelCityName } from '@/utils/travelDisplayLocation'
import { translate as i18nT } from '@/i18n'


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
  // Узкая раскладка включается только ПОСЛЕ гидратации. До неё `useResponsive`
  // отдаёт SSR-снимок {0,0}, а нулевая ширина проходит проверку `isMobile`, —
  // на десктопе первый кадр рисовал бы карточки во всю ширину ряда и следующий
  // кадр возвращал их к потолку 320 (тот самый «нулевой» кадр из #1282). При
  // тёплом кэше `useTravelsForQuest` карточки на этом кадре уже есть, так что
  // скачок видимый. На native `isHydrated` истинен сразу, поведение прежнее.
  const { isHydrated, isMobile } = useResponsive()
  const isNarrowLayout = isHydrated && isMobile
  const styles = useMemo(() => createStyles(colors, isNarrowLayout), [colors, isNarrowLayout])

  const query = useMemo<TravelLocationQuery>(
    () => ({ cityName, countryName, countryCode, coords }),
    [cityName, countryName, countryCode, coords],
  )
  const { matches } = useTravelsForQuest(query, { limit: MAX_TRAVELS })

  if (!matches.length) return null

  const heading = cityName ? i18nT('quests:components.quests.TravelsForQuestSection.puteshestviya_value1_0b7c9157', { value1: cityName }) : i18nT('quests:components.quests.TravelsForQuestSection.puteshestviya_po_etomu_gorodu_53e4e897')

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
      <Text style={styles.subtitle}>{i18nT('quests:components.quests.TravelsForQuestSection.istorii_i_marshruty_avtorov_po_etim_mestam_8d58fef3')}</Text>

      <View style={styles.grid}>
        {matches.map(({ travel }) => {
          const countries =
            travel.countryName?.split(',').map((c) => c.trim()).filter(Boolean) ?? []
          // `cityName` — подпись первой точки маршрута, а не город: в metaText
          // с numberOfLines={1} она приходит обрезанным адресом, поэтому
          // адресоподобное значение уступает место списку стран.
          const metaText =
            resolveTravelCityName(travel.cityName) ||
            (countries.length ? countries.join(', ') : null)
          return (
            <View
              key={String(travel.id)}
              style={styles.cardWrapper}
              testID={`quest-travel-card-slot-${travel.id}`}
            >
              <UnifiedTravelCard
                testID={`quest-travel-card-${travel.id}`}
                title={travel.name}
                imageUrl={travel.travel_image_thumb_url}
                metaText={metaText}
                onPress={() => router.push(`/travels/${travel.slug || travel.id}`)}
                imageHeight={170}
                mediaFit="contain"
                mediaProps={{
                  blurBackground: true,
                  allowCriticalWebBlur: true,
                  // #1221: без `optimizeWeb: false` карточка просит ступень под свой
                  // слот. С ним `travel_image_thumb_url` уходил голым, и ownership-роут
                  // отдавал мастер с `no-store` вместо `immutable`-производной.
                }}
                style={styles.card}
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}

function createStyles(colors: ThemedColors, isNarrowLayout: boolean) {
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
      // Потолок ширины нужен многоколоночной сетке на десктопе. На телефоне в
      // ряду всегда одна карточка, и потолок 320 оставлял её прижатой влево, а
      // справа — полосу пустоты (отзыв TestFlight 1.0.5 (8) «Блок смещен
      // визуально»). На узкой раскладке карточка занимает ряд целиком.
      maxWidth: isNarrowLayout ? undefined : 320,
    },
    card: {
      backgroundColor: colors.surface,
      // Web keeps equal-height cards via CSS %; on native Yoga can't resolve a
      // percent height inside a wrap-row within an unbounded ScrollView — it
      // inflates the box into a huge empty surface block. Row `align-items:
      // stretch` already equalises heights on native, so omit the percent there.
      ...Platform.select({ web: { height: '100%' as const } }),
    },
  })
}

export default React.memo(TravelsForQuestSection)
