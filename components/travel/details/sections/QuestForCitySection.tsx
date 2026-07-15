import React, { useMemo } from 'react'
import { Platform, Text, View } from 'react-native'

import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestsForLocation } from '@/hooks/useQuestForLocation'
import { parseTravelCoords, type LocationQuery } from '@/utils/questForLocation'
import { NEARBY_QUEST_THRESHOLD_KM, SAME_CITY_THRESHOLD_KM } from '@/constants/nearby'
import type { Travel } from '@/types/types'
import { translate as i18nT } from '@/i18n'


const CARD_LIST_STYLE = { marginTop: 12, gap: 12 } as const
const MAX_QUESTS = 6

type TravelWithExtraCoords = Travel & {
  coordsMeTravelArr?: string[]
  lat?: number | string | null
  latitude?: number | string | null
  lng?: number | string | null
  lon?: number | string | null
  longitude?: number | string | null
}

function buildEyebrow(distanceKm: number, cityName?: string): string | undefined {
  if (Number.isFinite(distanceKm) && distanceKm < SAME_CITY_THRESHOLD_KM) return i18nT('travel:components.travel.details.sections.QuestForCitySection.v_etom_gorode_564dcecf')
  if (Number.isFinite(distanceKm) && distanceKm < NEARBY_QUEST_THRESHOLD_KM) {
    const rounded = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)
    return cityName ? i18nT('travel:components.travel.details.sections.QuestForCitySection.value1_km_value2_a298ad71', { value1: rounded, value2: cityName }) : i18nT('travel:components.travel.details.sections.QuestForCitySection.value1_km_ryadom_4891f0e6', { value1: rounded })
  }
  return undefined
}

export const QuestForCitySection: React.FC<{
  travel: Travel
  styles: any
}> = ({ travel, styles }) => {
  const query = useMemo<LocationQuery>(() => {
    const travelWithExtraCoords = travel as TravelWithExtraCoords
    const coordPoints = [
      ...(travel.travelAddress ?? []),
      ...(travel.coordsMeTravel ?? []),
      ...(travelWithExtraCoords.coordsMeTravelArr ?? []),
      {
        lat: travelWithExtraCoords.lat ?? travelWithExtraCoords.latitude,
        lng:
          travelWithExtraCoords.lng ??
          travelWithExtraCoords.lon ??
          travelWithExtraCoords.longitude,
      },
    ]
    return {
      cityName: travel.cityName,
      countryName: travel.countryName,
      countryCode: travel.countryCode,
      coords: parseTravelCoords(coordPoints),
    }
  }, [travel])

  const { matches } = useQuestsForLocation(query, { limit: MAX_QUESTS })

  if (!matches.length) return null

  const heading = matches.length === 1 ? i18nT('travel:components.travel.details.sections.QuestForCitySection.kvest_po_etomu_gorodu_6742264a') : i18nT('travel:components.travel.details.sections.QuestForCitySection.kvesty_po_etomu_gorodu_i_ryadom_5bc0bff9')
  const subtitle =
    matches.length === 1
      ? i18nT('travel:components.travel.details.sections.QuestForCitySection.proydite_peshkom_po_legendam_i_zagadkam_prya_1d4af784')
      : i18nT('travel:components.travel.details.sections.QuestForCitySection.peshie_marshruty_s_legendami_i_zagadkami_vyb_08dcfd14')

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
