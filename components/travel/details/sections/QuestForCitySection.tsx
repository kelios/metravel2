import React, { useMemo } from 'react'
import { Platform, Text, View } from 'react-native'

import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestForLocation } from '@/hooks/useQuestForLocation'
import { parseTravelCoords, type LocationQuery } from '@/utils/questForLocation'
import type { Travel } from '@/types/types'

const CARD_CONTAINER_STYLE = { marginTop: 12 } as const

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

  const { quest } = useQuestForLocation(query)

  if (!quest) return null

  return (
    <View
      style={[styles.sectionContainer, styles.contentStable]}
      collapsable={false}
      accessibilityLabel="Квест по этому городу"
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
      data-section-key="quest-for-city"
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        Квест по этому городу
      </Text>
      <Text style={styles.sectionSubtitle}>
        Пройдите пешком по легендам и загадкам — прямо со смартфона
      </Text>

      <View style={CARD_CONTAINER_STYLE}>
        <QuestForCityCard quest={quest} />
      </View>
    </View>
  )
}

export default React.memo(QuestForCitySection)
