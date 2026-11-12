import type { QuestTripFacts } from '@/utils/questPublicPage'

export const QUEST_ENTITY_TYPES: readonly ['TouristTrip', 'CreativeWork'] = ['TouristTrip', 'CreativeWork']

export type QuestTouristTripInput = {
  name: string
  description: string
  url: string
  inLanguage: string
  image: string | null
  cityName?: string | null
  touristType?: string | null
  tripFacts?: QuestTripFacts | null
}

/**
 * The quest page's one schema.org entity (#3321): the published SSR document and
 * the app screen both describe the quest through this builder, so a crawler sees
 * the same node before and after hydration. It is a `TouristTrip` (route, start)
 * and a `CreativeWork` (authored text: language, time, free access); every
 * property sits in the domain of one of the two types, and the walking distance
 * rides the `TravelAction` that holds it. Route facts come only from the
 * backend's `trip_facts` (#3317); an unknown fact is omitted, never derived.
 */
export function buildQuestTouristTrip(input: QuestTouristTripInput) {
  const facts = input.tripFacts
  return {
    '@type': [...QUEST_ENTITY_TYPES],
    name: input.name,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    inLanguage: input.inLanguage,
    ...(input.touristType != null ? { touristType: input.touristType } : null),
    provider: { '@type': 'Organization', name: 'MeTravel', url: 'https://metravel.by' },
    image: input.image ? [input.image] : [],
    ...(input.cityName ? { contentLocation: { '@type': 'City', name: input.cityName } } : null),
    ...(facts?.duration_min ? { timeRequired: `PT${facts.duration_min}M` } : null),
    ...(facts?.distance_m ? { potentialAction: { '@type': 'TravelAction', distance: `${facts.distance_m} m` } } : null),
    ...(facts?.start
      ? { tripOrigin: { '@type': 'Place', geo: { '@type': 'GeoCoordinates', latitude: facts.start.lat, longitude: facts.start.lng } } }
      : null),
    ...(facts ? { isAccessibleForFree: facts.is_free } : null),
  }
}
