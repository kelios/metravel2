/**
 * Есть ли у источника блок «Похожие» (#3395) — для пунктов навигации, которые живут
 * вне самого блока (меню статьи). Наличие известно только из ответа соседей, поэтому
 * хук читает кэш того же запроса, что и `useAiSimilar`, и своего запроса не делает:
 * клиент `api/aiPicks` в чанк меню не попадает.
 *
 * Пока ответа нет — оптимистично «есть»: слепок (#3292) покрывает все статьи индекса,
 * пустым он бывает только у материала новее сборки. Решение повторяет сам блок
 * (`AiSimilarSection`): есть данные — по их длине, данных нет и запрос упал — «нет».
 * Выключенный блок, нет id или нет `QueryClientProvider` — «нет» без подписки на кэш.
 */
import { useCallback, useContext, useSyncExternalStore } from 'react'
import { QueryClientContext, hashKey } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { getActiveLocale } from '@/i18n'
import { isAiSimilarEnabled } from '@/utils/aiPicksConfig'

export type AiSimilarSourceType = 'travel' | 'quest'

/** Положительный целый id источника или 0 — общий для запроса и для этого хука. */
export const toAiSimilarSourceId = (id: unknown): number =>
  typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : 0

/** Ключ запроса соседей — единственный источник для `useAiSimilar` и этого хука. */
export const aiSimilarQueryKey = (
  type: AiSimilarSourceType,
  id: number,
  locale: string,
  resultType: string | undefined,
) => queryKeys.aiSimilar(type, id, locale, resultType ?? 'all')

const noopUnsubscribe = () => {}

export function useAiSimilarAvailability(
  type: AiSimilarSourceType,
  id: unknown,
  resultType?: AiSimilarSourceType,
): boolean {
  const client = useContext(QueryClientContext)
  const numericId = toAiSimilarSourceId(id)
  const active = Boolean(client) && isAiSimilarEnabled() && numericId > 0
  const queryKey = aiSimilarQueryKey(type, numericId, getActiveLocale(), resultType)
  const queryHash = hashKey(queryKey)

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active || !client) return noopUnsubscribe
      return client.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) onChange()
      })
    },
    [active, client, queryHash],
  )

  const getSnapshot = (): boolean => {
    if (!active || !client) return false
    const state = client.getQueryCache().get(queryHash)?.state
    if (Array.isArray(state?.data)) return state.data.length > 0
    return state?.status !== 'error'
  }

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
