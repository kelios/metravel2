import { readRetryOnce } from '@/utils/queryRetryPolicy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useQueries } from '@tanstack/react-query'

import type { ApiQuestBundle } from '@/api/quests'
import { questBundleQueryOptions } from '@/hooks/questBundleQuery'
import { useQuestContentLocale } from '@/hooks/useQuestContentLocale'
import type { QuestCityWalkModel } from '@/utils/questCityWalk'
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
/**
 * Запрос бандлов ждёт свободного кадра: секция лежит ниже первого экрана.
 * Дедлайн простоя — не дольше 1000 мс по «Timeout policy» (#2020).
 */
const QUEST_CITY_WALK_IDLE_TIMEOUT = 1000

/**
 * Разбор бандлов (`utils/questCityWalk` + `utils/questStoryText`, ~11 KB) живёт
 * за async-границей (#2082). На первом кадре он не исполняется ни разу — бандлы
 * приходят только после простоя, — а синхронным импортом ехал в стартовом чанке
 * маршрута города. Этот хук — единственный потребитель в приложении, значит и
 * единственный корень чанка (канон `hooks/useCountryCodeByCoords.ts`). Загрузка
 * стартует при монтировании, параллельно ожиданию простоя, поэтому запросы
 * бандлов не ждут лишнего круга сети.
 */
type QuestCityWalkRuntime = typeof import('@/utils/questCityWalk')

let questCityWalkRuntimePromise: Promise<QuestCityWalkRuntime> | null = null

function loadQuestCityWalkRuntime(): Promise<QuestCityWalkRuntime> {
  if (!questCityWalkRuntimePromise) {
    questCityWalkRuntimePromise = Promise.resolve(import('@/utils/questCityWalk')).catch((error) => {
      // Следующий заход на посадочную пробует снова, а не наследует отказ.
      questCityWalkRuntimePromise = null
      throw error
    })
  }
  return questCityWalkRuntimePromise
}

function useQuestCityWalkRuntime(enabled: boolean): { runtime: QuestCityWalkRuntime | null; failed: boolean } {
  const [runtime, setRuntime] = useState<QuestCityWalkRuntime | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || runtime) return undefined
    let active = true
    loadQuestCityWalkRuntime()
      .then((loaded) => {
        if (active) setRuntime(loaded)
      })
      .catch(() => {
        // Чанк не догрузился — секции заметок нет, как при недоступных бандлах;
        // статический блок SSG остаётся на странице.
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [enabled, runtime])

  return { runtime, failed }
}

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

/**
 * `settled` — набор заметок окончательный: каждый бандл ответил или отказал
 * (либо разбор не догрузился). До этого момента посадочная не рисует секции
 * города: заметки встают ВЫШЕ маршрутов и соседних городов, и поздняя вставка
 * сдвигала уже видимый блок на сотни пикселей (CLS до 0,33, #2754).
 */
export type QuestCityWalkState = {
  walk: QuestCityWalkModel | null
  settled: boolean
}

export function useQuestCityWalk(
  quests: QuestMeta[],
  opts?: { enabled?: boolean },
): QuestCityWalkState {
  const enabled = opts?.enabled !== false
  const ready = useDeferredUntilIdle(enabled)
  const { runtime, failed } = useQuestCityWalkRuntime(enabled)
  const locale = useQuestContentLocale()

  const walkQuestIds = useMemo(
    () => (runtime ? runtime.questCityWalkQuestIds(quests) : []),
    [quests, runtime],
  )

  const combine = useCallback(
    (results: { data?: ApiQuestBundle; isPending: boolean }[]): QuestCityWalkState => {
      if (!enabled || failed) return { walk: null, settled: true }
      if (!runtime) return { walk: null, settled: false }
      const settled = walkQuestIds.length === 0 || (ready && results.every((result) => !result.isPending))
      const bundles = new Map<string, ApiQuestBundle>()
      results.forEach((result, index) => {
        const questId = walkQuestIds[index]
        if (questId && result.data) bundles.set(questId, result.data)
      })
      if (bundles.size === 0) return { walk: null, settled }
      return { walk: runtime.buildQuestCityWalkModel(quests, bundles), settled }
    },
    [enabled, failed, quests, ready, runtime, walkQuestIds],
  )

  const state = useQueries({
    queries: walkQuestIds.map((questId) => ({
      // Определение запроса у ключа ОДНО (`questBundleQueryOptions`), своей
      // копии здесь нет: с #1992 ключ `['quest-bundle', slug, locale]` переживает смену
      // владельца сессии (`api/identityQueryCache.ts`), и держит его публичным
      // ровно барьер `waitForQuestsCatalogCredentials` внутри того queryFn.
      // Вторая, безбарьерная копия запроса снова положила бы в переживший ключ
      // `is_completed_by_me`/`user_rating` ещё не закрытой сессии.
      ...questBundleQueryOptions(questId, locale),
      enabled: enabled && ready,
      // Своя политика повтора сохранена: недоступный бандл убирает свой квест из
      // секции, поэтому одна повторная попытка здесь дешевле пустого слота.
      retry: readRetryOnce,
    })),
    combine,
  })

  // Набор, однажды ставший окончательным, остаётся таким для тех же квестов:
  // смена языка меняет ключи бандлов, и без этого подвал города целиком
  // пропадал бы до ответа на новом языке. Другой город — другой набор id.
  const settledIdsRef = useRef<string | null>(null)
  const idsKey = runtime ? walkQuestIds.join('|') : null
  if (state.settled && idsKey !== null) settledIdsRef.current = idsKey
  return !state.settled && idsKey !== null && settledIdsRef.current === idsKey
    ? { ...state, settled: true }
    : state
}
