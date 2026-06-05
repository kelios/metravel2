import { useMemo } from 'react'

import { useQuestsList } from '@/hooks/useQuestsApi'
import { findQuestForLocation, type LocationQuery } from '@/utils/questForLocation'
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
