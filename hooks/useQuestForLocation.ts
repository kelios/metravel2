import { useMemo } from 'react'

import { useQuestsList } from '@/hooks/useQuestsApi'
import {
  findQuestForLocation,
  findQuestsNearLocation,
  type LocationQuery,
  type QuestForLocationMatch,
} from '@/utils/questForLocation'
import type { QuestMeta } from '@/utils/questAdapters'

/**
 * Возвращает квест, подходящий под локацию (город/страна/координаты), или null.
 * Используется для блока «Пройдите квест по этому городу» на travel-странице.
 */
export function useQuestForLocation(query: LocationQuery): {
  quest: QuestMeta | null
  loading: boolean
} {
  const { quests, loading } = useQuestsList()
  const { cityName, countryName, countryCode, coords } = query

  const quest = useMemo(() => {
    if (loading || !quests.length) return null
    return findQuestForLocation(quests, { cityName, countryName, countryCode, coords })
  }, [loading, quests, cityName, countryName, countryCode, coords])

  return { quest, loading }
}

/**
 * Возвращает список квестов, подходящих под локацию (отсортированный
 * по релевантности и дистанции). Используется для блока
 * «Квесты по этому городу и рядом» на travel-странице.
 */
export function useQuestsForLocation(
  query: LocationQuery,
  opts?: { limit?: number },
): { matches: QuestForLocationMatch[]; loading: boolean } {
  const { quests, loading } = useQuestsList()
  const { cityName, countryName, countryCode, coords } = query
  const limit = opts?.limit

  const matches = useMemo(() => {
    if (loading || !quests.length) return []
    return findQuestsNearLocation(
      quests,
      { cityName, countryName, countryCode, coords },
      typeof limit === 'number' ? { limit } : undefined,
    )
  }, [loading, quests, cityName, countryName, countryCode, coords, limit])

  return { matches, loading }
}
