import type { Travel } from '@/types/types'
import { parseTravelCoords, type LocationQuery } from '@/utils/questForLocation'
import { TRAVEL_QUEST_MATCH_LIMIT } from './travelQuestTeaser'

/**
 * Сколько квестов подбирается к статье: и для полного блока, и для строки над
 * текстом. Тот же потолок, по которому строка решает, писать ли число.
 */
export const TRAVEL_QUEST_LOCATION_LIMIT = TRAVEL_QUEST_MATCH_LIMIT

type TravelWithExtraCoords = Travel & {
  coordsMeTravelArr?: string[]
  lat?: number | string | null
  latitude?: number | string | null
  lng?: number | string | null
  lon?: number | string | null
  longitude?: number | string | null
}

/**
 * Локация статьи для подбора квестов. Один построитель на оба потребителя
 * (`QuestForCitySection` и `TravelQuestTeaserLine`): одинаковый запрос даёт
 * одинаковый ключ React Query, и вторая подписка не делает второго запроса.
 */
export function buildTravelQuestLocationQuery(travel: Travel): LocationQuery {
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
}
