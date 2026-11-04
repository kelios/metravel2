import { Platform, Text, View } from 'react-native'

import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { NEARBY_QUEST_THRESHOLD_KM, SAME_CITY_THRESHOLD_KM } from '@/constants/nearby'
import { translate as i18nT } from '@/i18n'
import type { Travel } from '@/types/types'
import { formatDistance } from '@/utils/distanceCalculator'
import type { QuestMeta } from '@/utils/questAdapters'
import type { useTravelDetailsStyles } from '../TravelDetailsStyles'

const CARD_LIST_STYLE = { marginTop: 12, gap: 12 } as const

function buildEyebrow(distanceKm: number, cityName?: string): string | undefined {
  if (Number.isFinite(distanceKm) && distanceKm < SAME_CITY_THRESHOLD_KM) return i18nT('travel:components.travel.details.sections.QuestForCitySection.v_etom_gorode_564dcecf')
  if (Number.isFinite(distanceKm) && distanceKm < NEARBY_QUEST_THRESHOLD_KM) {
    const distance = formatDistance(distanceKm)
    return cityName ? i18nT('travel:components.travel.details.sections.QuestForCitySection.value1_value2_f9d4c90f', { value1: distance, value2: cityName }) : i18nT('travel:components.travel.details.sections.QuestForCitySection.value1_ryadom_bb7fd54d', { value1: distance })
  }
  return undefined
}

export function QuestForCityMatches({ travel, styles, matches, responsiveWeb = false }: {
  travel: Travel
  styles: Pick<ReturnType<typeof useTravelDetailsStyles>, 'sectionContainer' | 'contentStable' | 'sectionHeaderText' | 'sectionSubtitle'>
  matches: Array<{ quest: QuestMeta; distanceKm: number }>
  responsiveWeb?: boolean
}) {
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
      role={Platform.OS === 'web' ? 'region' : undefined}
      testID="quest-for-city-section"
      {...(Platform.OS === 'web' ? { dataSet: { sectionKey: 'quest-for-city' } } : {})}
    >
      <Text
        style={styles.sectionHeaderText}
        role={Platform.OS === 'web' ? 'heading' : undefined}
        aria-level={2}
      >
        {heading}
      </Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>

      <View style={CARD_LIST_STYLE}>
        {matches.map(({ quest, distanceKm }) => (
          <QuestForCityCard
            key={quest.id}
            quest={quest}
            responsiveWeb={responsiveWeb}
            eyebrow={buildEyebrow(distanceKm, quest.cityName)}
            analyticsSource="travel_detail"
            analyticsContextId={travel.id ?? travel.slug}
          />
        ))}
      </View>
    </View>
  )
}
