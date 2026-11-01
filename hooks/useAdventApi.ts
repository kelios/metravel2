// Серверный стейт адвент-календаря (#2867): конфиг кампании, прогресс аккаунта
// и его синхронизация с локальным стором. Бэкенд — #2864. Пока эндпоинты
// отвечают 404, экран работает на бандловом конфиге и локальном прогрессе и
// честно показывает, что прогресс хранится только на этом устройстве.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchAdventCampaign,
  fetchAdventProgress,
  isValidAdventCampaign,
  syncAdventProgress,
} from '@/api/advent'
import { queryKeys } from '@/api/queryKeys'
import { readRetryTwice } from '@/utils/queryRetryPolicy'
import { ADVENT_CAMPAIGN_YEAR, getAdventNow, toLocalIsoDate } from '@/constants/advent'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { ADVENT_GUEST_OWNER, useAdventProgressStore } from '@/stores/adventProgressStore'
import type { AdventCampaignConfig, AdventProgressSnapshot } from '@/types/advent'
import type { AdventProgressMaps } from '@/utils/advent/adventCalendar'
import { hasUnsyncedAdventProgress } from '@/utils/advent/adventProgressMerge'

/**
 * Серверный конфиг кампании, если бэкенд его отдаёт и он проходит проверку;
 * иначе `null` — экран остаётся на бандловом `data/advent/2026.json`, тот же
 * текст, что в статическом HTML.
 */
export function useAdventCampaignQuery(enabled = true): AdventCampaignConfig | null {
  const { data } = useQuery({
    queryKey: queryKeys.adventCampaign(ADVENT_CAMPAIGN_YEAR),
    queryFn: ({ signal }) => fetchAdventCampaign(signal),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: readRetryTwice,
  })
  return useMemo(() => (isValidAdventCampaign(data, ADVENT_CAMPAIGN_YEAR) ? data : null), [data])
}

export function useAdventProgressQuery(enabled: boolean) {
  const owner = useQueryOwner()
  return useQuery<AdventProgressSnapshot>({
    queryKey: queryKeys.adventProgress(owner),
    queryFn: ({ signal }) => fetchAdventProgress(signal),
    enabled: enabled && owner !== null,
    staleTime: 30 * 1000,
    // Возврат с действия сайта (`?from=advent`) должен подтянуть свежий зачёт.
    refetchOnMount: 'always',
    retry: readRetryTwice,
  })
}

/**
 * `guest` — гость, синхронизировать нечего; `syncing` — идёт запрос;
 * `synced` — прогресс сохранён в аккаунте; `local` — сервер недоступен,
 * прогресс хранится только на этом устройстве.
 */
export type AdventSyncState = 'guest' | 'syncing' | 'synced' | 'local'

export type AdventServerSync = {
  state: AdventSyncState
  /** Серия, посчитанная сервером; `null`, пока прогресс не синхронизирован. */
  serverStreak: number | null
  /** Дверцы, задания которых сервер засчитал сам (без кнопки «Сделано») в этой сессии. */
  creditedDays: ReadonlySet<number>
}

const EMPTY_DAYS: ReadonlySet<number> = new Set<number>()

/** Дверцы/задания, которых в ответе сервера нет совсем (не только другая дата). */
const lacksOnServer = (local: AdventProgressMaps, server: AdventProgressMaps): boolean =>
  Object.keys(local.opened).some((day) => !server.opened[day]) ||
  Object.keys(local.tasksDone).some((day) => !server.tasksDone[day])

const signatureOf = (maps: AdventProgressMaps): string =>
  JSON.stringify([
    Object.entries(maps.opened).sort(),
    Object.entries(maps.tasksDone).sort(),
  ])

/**
 * Двусторонняя синхронизация прогресса аккаунта: серверное объединяется с
 * локальным, локальное, которого сервер не знает, уходит `POST` объединением.
 * Один и тот же снимок повторно не отправляется — если сервер его не принял
 * (например, не засчитывает ручные отметки), цикла запросов нет.
 */
export function useAdventServerSync(params: {
  ownerKey: string | null
  localProgress: AdventProgressMaps
  enabled: boolean
}): AdventServerSync {
  const { ownerKey, localProgress, enabled } = params
  const queryClient = useQueryClient()
  const owner = useQueryOwner()
  const isAccount = enabled && !!ownerKey && ownerKey !== ADVENT_GUEST_OWNER
  const query = useAdventProgressQuery(isAccount)
  const mergeOwner = useAdventProgressStore((state) => state.mergeOwner)
  const [creditedDays, setCreditedDays] = useState<ReadonlySet<number>>(EMPTY_DAYS)
  const attemptedSignature = useRef<string | null>(null)
  const localRef = useRef(localProgress)
  localRef.current = localProgress

  const mutation = useMutation({
    // Владелец едет в переменных: ответ пишется в кэш того, чей снимок ушёл, даже если сессия сменилась.
    mutationFn: ({ maps }: { maps: AdventProgressMaps; owner: string | null }) => syncAdventProgress(maps),
    // Летящий `GET` (фокус, возврат на экран) не должен перетереть ответ `POST` старым снимком.
    onMutate: ({ owner: mutationOwner }) => queryClient.cancelQueries({ queryKey: queryKeys.adventProgress(mutationOwner) }),
    onSuccess: (snapshot, { owner: mutationOwner }) => {
      queryClient.setQueryData(queryKeys.adventProgress(mutationOwner), snapshot)
      // Синхронизация может выдать значок адвента — тост читает свежие достижения.
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievementsMeAll(mutationOwner) })
    },
  })

  // Смена владельца (выход или другой аккаунт): отметки и отправленный снимок
  // прежнего не переносятся. Объявлен до эффекта слияния, чтобы на монтировании
  // не стереть отметки, выставленные по кэшу.
  useEffect(() => {
    attemptedSignature.current = null
    setCreditedDays(EMPTY_DAYS)
  }, [isAccount, ownerKey])

  // Сервер → локальный стор. Задания, которые сервер засчитал, а локально их
  // не было, — это автозачёт действия сайта: показываем отметку «засчитано».
  const serverData = isAccount ? query.data : undefined
  useEffect(() => {
    if (!serverData || !ownerKey) return
    const local = localRef.current
    // Только сегодняшние: на новом устройстве локально пусто, и задания, отмеченные
    // «Сделано» на другом, не должны выглядеть автозачётом.
    const today = toLocalIsoDate(getAdventNow())
    const credited = Object.entries(serverData.tasksDone)
      .filter(([day, date]) => !local.tasksDone[day] && date === today)
      .map(([day]) => Number(day))
    if (credited.length > 0) {
      setCreditedDays((prev) => {
        const next = new Set(prev)
        credited.forEach((day) => next.add(day))
        return next
      })
    }
    mergeOwner(ownerKey, serverData)
  }, [serverData, ownerKey, mergeOwner])

  // Локальный → сервер.
  const signature = signatureOf(localProgress)
  // Отправляем только после того, как серверное уже влито в локальное, —
  // иначе первым уйдёт неполный снимок и сразу за ним второй.
  const needsPush =
    !!serverData &&
    !hasUnsyncedAdventProgress(serverData, localProgress) &&
    hasUnsyncedAdventProgress(localProgress, serverData)
  const { mutate, isPending: isPushing } = mutation
  useEffect(() => {
    if (!needsPush || isPushing || attemptedSignature.current === signature) return
    attemptedSignature.current = signature
    mutate({ maps: localRef.current, owner })
  }, [needsPush, isPushing, signature, mutate, owner])

  let state: AdventSyncState
  if (!isAccount) state = 'guest'
  else if (query.isError || (mutation.isError && attemptedSignature.current === signature)) state = 'local'
  // `isLoading`, а не `isPending`: у выключенного запроса без данных `isPending` вечно true.
  else if (!serverData) state = query.isLoading ? 'syncing' : 'local'
  // Серверное ещё не влито в локальное (эффект слияния — следующий рендер) или идёт `POST`.
  else if (
    isPushing ||
    hasUnsyncedAdventProgress(serverData, localProgress) ||
    (needsPush && attemptedSignature.current !== signature)
  )
    state = 'syncing'
  // Сервер принял `POST`, но часть локального в ответе отсутствует (например,
  // отклонил дверцу) — это не «сохранено в аккаунте».
  else if (lacksOnServer(localProgress, serverData)) state = 'local'
  else state = 'synced'

  return {
    state,
    serverStreak: state === 'synced' && serverData ? serverData.streak : null,
    creditedDays,
  }
}
