// Данные петли возврата после финиша (#1484): компактный каталог квестов и
// производные от него коллекция города и подбор следующего квеста.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAllProgress, fetchQuestsCompactCatalog, type ApiQuestMeta, type ApiQuestProgress } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { adaptMeta, type QuestMeta } from '@/utils/questAdapters'
import {
  buildQuestCityCollection,
  buildQuestCityCollections,
  pickNextQuests,
  type QuestCityCollection,
  type QuestOrigin,
  type QuestSuggestion,
} from '@/utils/questCityCollection'
import { devWarn } from '@/utils/logger'
import { useAuthStore } from '@/stores/authStore'

/**
 * Компактный каталог квестов. Времена кеша те же, что у полного списка:
 * блок финала и профиль читают один и тот же ключ и в сеть ходят один раз.
 */
export function useQuestsCompactCatalog(opts?: { enabled?: boolean }): {
  quests: QuestMeta[]
  loading: boolean
} {
  const enabled = opts?.enabled ?? true
  const userId = useAuthStore((state) => state.userId)
  const identity = userId == null ? null : String(userId)
  const { data, isPending, error } = useQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.questsCompactCatalog(identity),
    queryFn: ({ signal }) => fetchQuestsCompactCatalog({ signal }),
    enabled,
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  })

  if (error) devWarn('Failed to load compact quests catalog:', error)

  const quests = useMemo<QuestMeta[]>(() => (data ?? []).map(adaptMeta), [data])

  return { quests, loading: enabled && isPending }
}

/**
 * Коллекция города и следующие квесты для экрана финала.
 * `completedQuestId` — квест, только что закрытый в этой сессии.
 */
export function useQuestCityCollection(params: {
  cityId?: string | null
  cityName?: string | null
  completedQuestId?: string | null
  origin?: QuestOrigin | null
  enabled?: boolean
}): {
  collection: QuestCityCollection | null
  suggestions: QuestSuggestion[]
  loading: boolean
} {
  const { cityId, cityName, completedQuestId, origin } = params
  const enabled = (params.enabled ?? true) && !!String(cityId ?? '').trim()
  const { quests, loading } = useQuestsCompactCatalog({ enabled })

  // Координаты приходят новым объектом на каждый рендер экрана — фиксируем
  // мемо по числам, иначе пересчёт подбора шёл бы вхолостую каждый раз.
  const originLat = origin?.lat
  const originLng = origin?.lng

  // Точка отсчёта — сам пройденный квест: его координаты есть в каталоге,
  // и они точнее центра города, переданного вызывающим как запасной вариант.
  const questOrigin = useMemo<QuestOrigin | null>(() => {
    const currentId = String(completedQuestId ?? '').trim()
    const current = currentId ? quests.find((quest) => quest.id === currentId) : undefined
    if (current && Number.isFinite(current.lat) && Number.isFinite(current.lng)) {
      return { lat: current.lat, lng: current.lng }
    }
    if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
      return { lat: originLat as number, lng: originLng as number }
    }
    return null
  }, [quests, completedQuestId, originLat, originLng])

  const collection = useMemo(
    () => buildQuestCityCollection(quests, { cityId, cityName, completedQuestId }),
    [quests, cityId, cityName, completedQuestId],
  )

  const suggestions = useMemo(
    () => pickNextQuests(quests, { currentQuestId: completedQuestId, cityId, origin: questOrigin }),
    [quests, completedQuestId, cityId, questOrigin],
  )

  return { collection, suggestions, loading }
}

/**
 * Коллекции городов с прохождениями — полоса прогресса в профиле.
 *
 * Каталог тянем только тем, у кого прохождения вообще есть: сначала спрашиваем
 * собственные записи прогресса (у аккаунта без квестов это ответ в два байта,
 * замер прода 2026-08-22), и лишь потом — компактный каталог на ~32 КБ gzip.
 * Иначе профиль платил бы за блок, который у большинства не рисуется вовсе.
 */
export function useQuestCityCollections(opts?: { enabled?: boolean }): {
  collections: QuestCityCollection[]
  loading: boolean
} {
  const enabled = opts?.enabled ?? true
  const authReady = useAuthStore((state) => state.authReady)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const userId = useAuthStore((state) => state.userId)
  const identity = userId == null ? null : String(userId)

  const { data: progress, isPending: progressPending } = useQuery<ApiQuestProgress[]>({
    queryKey: queryKeys.questProgressAll(identity),
    queryFn: () => fetchAllProgress(),
    enabled: enabled && authReady && isAuthenticated && identity != null,
    // Гостю эндпоинт отвечает 401 — повторять запрос незачем.
    retry: false,
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  })

  const hasCompleted = Array.isArray(progress) && progress.some((record) => record?.completed)

  const { quests, loading } = useQuestsCompactCatalog({
    enabled: enabled && authReady && isAuthenticated && hasCompleted,
  })
  const collections = useMemo(() => buildQuestCityCollections(quests), [quests])

  return {
    collections,
    loading: enabled && authReady && isAuthenticated && (progressPending || (hasCompleted && loading)),
  }
}
