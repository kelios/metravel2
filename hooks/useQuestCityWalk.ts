import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useQueries } from '@tanstack/react-query'

import type { ApiQuestBundle } from '@/api/quests'
import { questBundleQueryOptions } from '@/hooks/questBundleQuery'
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
 *
 * Офлайн-каталог эти чтения не наполняют: слотов «недавних» всего 20, и квест,
 * который посетитель не открывал, не должен вытеснять оттуда реально
 * просмотренный (#1569). Держит это `persistOffline: false` в общем
 * `questBundleQueryOptions` — с #1992 экран квеста читает бандл через ТОТ ЖЕ
 * ключ, поэтому отличить «посмотрел город» от «открыл квест» по запросу уже
 * нельзя. Открытый квест пишет себя отдельным эффектом `writeCachedQuestBundle`
 * в `useQuestBundle` (`hooks/useQuestsApi.ts`), который есть только у экрана.
 */
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
      // Определение запроса у ключа ОДНО (`questBundleQueryOptions`), своей
      // копии здесь нет: с #1992 ключ `['quest-bundle', slug]` переживает смену
      // владельца сессии (`api/identityQueryCache.ts`), и держит его публичным
      // ровно барьер `waitForQuestsCatalogCredentials` внутри того queryFn.
      // Вторая, безбарьерная копия запроса снова положила бы в переживший ключ
      // `is_completed_by_me`/`user_rating` ещё не закрытой сессии.
      ...questBundleQueryOptions(questId),
      enabled: enabled && ready,
      // Своя политика повтора сохранена: недоступный бандл убирает свой квест из
      // секции, поэтому одна повторная попытка здесь дешевле пустого слота.
      retry: 1,
    })),
    combine,
  })
}
