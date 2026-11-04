import React, { useMemo } from 'react'

import { useQuestsForLocation } from '@/hooks/useQuestForLocation'
import type { Travel } from '@/types/types'
import { parseTravelCoords, type LocationQuery } from '@/utils/questForLocation'
import { QuestForCityMatches } from './QuestForCityMatches'

const MAX_QUESTS = 6

type TravelWithExtraCoords = Travel & {
  coordsMeTravelArr?: string[]
  lat?: number | string | null
  latitude?: number | string | null
  lng?: number | string | null
  lon?: number | string | null
  longitude?: number | string | null
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

  return <QuestForCityMatches travel={travel} styles={styles} matches={matches} />
}

export default React.memo(QuestForCitySection)
