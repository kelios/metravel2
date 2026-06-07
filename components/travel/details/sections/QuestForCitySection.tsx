import React, { useMemo } from 'react'
import { Platform, Text, View } from 'react-native'

import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestsForLocation } from '@/hooks/useQuestForLocation'
import { parseTravelCoords, type LocationQuery } from '@/utils/questForLocation'
import type { Travel } from '@/types/types'

const CARD_LIST_STYLE = { marginTop: 12, gap: 12 } as const
const MAX_QUESTS = 6

function buildEyebrow(distanceKm: number, cityName?: string): string | undefined {
  if (Number.isFinite(distanceKm) && distanceKm < 1.5) return 'В этом городе'
  if (Number.isFinite(distanceKm) && distanceKm < 50) {
    const rounded = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)
    return cityName ? `~${rounded} км · ${cityName}` : `~${rounded} км рядом`
  }
  return undefined
}

export const QuestForCitySection: React.FC<{
  travel: Travel
  styles: any
}> = ({ travel, styles }) => {
  const query = useMemo<LocationQuery>(() => {
    const coordPoints = (travel.travelAddress ?? []).map((item) =>
      typeof item === 'string' ? { coord: item } : { coord: item?.coords },
    )
    return {
      cityName: travel.cityName,
      countryName: travel.countryName,
      countryCode: travel.countryCode,
      coords: parseTravelCoords(coordPoints),
    }
  }, [travel.cityName, travel.countryName, travel.countryCode, travel.travelAddress])

  const { matches } = useQuestsForLocation(query, { limit: MAX_QUESTS })

  if (!matches.length) return null

  const heading = matches.length === 1 ? 'Квест по этому городу' : 'Квесты по этому городу и рядом'
  const subtitle =
    matches.length === 1
      ? 'Пройдите пешком по легендам и загадкам — прямо со смартфона'
      : 'Пешие маршруты с легендами и загадками — выберите подходящий'

  return (
    <View
      style={[styles.sectionContainer, styles.contentStable]}
      collapsable={false}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
      data-section-key="quest-for-city"
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        {heading}
      </Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>

      <View style={CARD_LIST_STYLE}>
        {matches.map(({ quest, distanceKm }) => (
          <QuestForCityCard
            key={quest.id}
            quest={quest}
            eyebrow={buildEyebrow(distanceKm, quest.cityName)}
          />
        ))}
      </View>
    </View>
  )
}

export default React.memo(QuestForCitySection)
