import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useQueries } from '@tanstack/react-query'

import type { ApiQuestBundle } from '@/api/quests'
import { fetchQuestByQuestId } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import {
  buildQuestCityWalkModel,
  questCityWalkQuestIds,
  type QuestCityWalkModel,
} from '@/utils/questCityWalk'
import type { QuestMeta } from '@/utils/questAdapters'

/**
 * Заметки о местах города для посадочной `/quests/<город>` (#1569).
 *
 * Текст страницы собирается из бандлов квестов, а бандл — это отдельный запрос
 * на квест. Поэтому: набор квестов выбирает общая модель
 * (`questCityWalkQuestIds`) — тот же, что взяла сборка; запросы стартуют после
 * первого экрана; недоступный бандл убирает свой квест из секции, а не ломает
 * страницу. Ключ и форма данных те же, что у запроса крошек
 * (`hooks/useBreadcrumbModel`, сырой `ApiQuestBundle`), поэтому переход с
 * посадочной в квест не платит за бандл второй раз.
 */
const QUEST_CITY_WALK_STALE_TIME = 30 * 60 * 1000
const QUEST_CITY_WALK_GC_TIME = 60 * 60 * 1000
/** Запрос бандлов ждёт свободного кадра: секция лежит ниже первого экрана. */
const QUEST_CITY_WALK_IDLE_TIMEOUT = 1200

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function useDeferredUntilIdle(enabled: boolean): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled || ready) return undefined
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setReady(true)
      return undefined
    }

    const idleWindow = window as IdleWindow
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), {
        timeout: QUEST_CITY_WALK_IDLE_TIMEOUT,
      })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }

    const timeout = window.setTimeout(() => setReady(true), QUEST_CITY_WALK_IDLE_TIMEOUT)
    return () => window.clearTimeout(timeout)
  }, [enabled, ready])

  return ready
}

export function useQuestCityWalk(
  quests: QuestMeta[],
  opts?: { enabled?: boolean },
): QuestCityWalkModel | null {
  const enabled = opts?.enabled !== false
  const ready = useDeferredUntilIdle(enabled)

  const walkQuestIds = useMemo(() => questCityWalkQuestIds(quests), [quests])

  const combine = useCallback(
    (results: { data?: ApiQuestBundle }[]): QuestCityWalkModel | null => {
      const bundles = new Map<string, ApiQuestBundle>()
      results.forEach((result, index) => {
        const questId = walkQuestIds[index]
        if (questId && result.data) bundles.set(questId, result.data)
      })
      if (bundles.size === 0) return null
      return buildQuestCityWalkModel(quests, bundles)
    },
    [quests, walkQuestIds],
  )

  return useQueries({
    queries: walkQuestIds.map((questId) => ({
      queryKey: queryKeys.questBundle(questId),
      queryFn: () => fetchQuestByQuestId(questId),
      enabled: enabled && ready,
      staleTime: QUEST_CITY_WALK_STALE_TIME,
      gcTime: QUEST_CITY_WALK_GC_TIME,
      retry: 1,
    })),
    combine,
  })
}
