// hooks/useQuestRating.ts
// Хук мутации оценки квеста с оптимистичным обновлением кеша.
// Сервер ещё не готов (BE #356) — api/questRating работает в mock-режиме в DEV.

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { rateQuest, type RateQuestRating } from '@/api/questRating'
import type { ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { calculateNewRating } from '@/utils/ratingHelpers'

type QuestRatingSnapshot = {
  user_rating: ApiQuestMeta['user_rating']
  rating_avg: number | null
  rating_count: number
}

type MutationContext = {
  previousUserRating: number | null
  previousDetail: ApiQuestMeta | undefined
  previousLists: Array<[readonly unknown[], unknown]>
}

const isQuestMeta = (value: unknown): value is ApiQuestMeta =>
  !!value && typeof value === 'object' && 'quest_id' in (value as Record<string, unknown>)

const computeSnapshot = (
  meta: Pick<ApiQuestMeta, 'rating_avg' | 'rating_count' | 'user_rating'>,
  rating: RateQuestRating,
): QuestRatingSnapshot => {
  const previousUserRating = meta.user_rating ?? null
  const nextCount =
    previousUserRating == null ? (meta.rating_count ?? 0) + 1 : meta.rating_count ?? 0
  const nextAvg = calculateNewRating(
    meta.rating_avg ?? 0,
    meta.rating_count ?? 0,
    rating,
    previousUserRating,
  )
  return {
    user_rating: rating,
    rating_avg: nextAvg,
    rating_count: nextCount,
  }
}

const applyOptimistic = (
  queryClient: QueryClient,
  questId: number,
  rating: RateQuestRating,
): MutationContext => {
  const previousDetail = queryClient.getQueryData<ApiQuestMeta>(queryKeys.questDetail(questId))
  const previousUserRating = previousDetail?.user_rating ?? null

  if (previousDetail) {
    queryClient.setQueryData<ApiQuestMeta>(queryKeys.questDetail(questId), {
      ...previousDetail,
      ...computeSnapshot(previousDetail, rating),
    })
  }

  // Snapshot list caches BEFORE mutating them, otherwise rollback would restore
  // the already-optimistic value instead of the original.
  const previousLists: Array<[readonly unknown[], unknown]> = []
  for (const [key, data] of queryClient.getQueriesData<unknown>({ queryKey: queryKeys.quests() })) {
    previousLists.push([key, data])
  }
  queryClient.setQueriesData<unknown>({ queryKey: queryKeys.quests() }, (current: unknown) => {
    if (!Array.isArray(current)) return current
    let changed = false
    const next = current.map((item) => {
      if (!isQuestMeta(item) || item.id !== questId) return item
      changed = true
      return { ...item, ...computeSnapshot(item, rating) }
    })
    return changed ? next : current
  })

  queryClient.setQueryData(queryKeys.questRating(questId), rating)

  return { previousUserRating, previousDetail, previousLists }
}

export function useRateQuestMutation(questId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, RateQuestRating, MutationContext>({
    mutationFn: (rating) => rateQuest(questId!, rating),
    onMutate: async (rating) => {
      if (questId == null) {
        return { previousUserRating: null, previousDetail: undefined, previousLists: [] }
      }
      await queryClient.cancelQueries({ queryKey: queryKeys.questDetail(questId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.quests() })
      return applyOptimistic(queryClient, questId, rating)
    },
    onError: (_error, _rating, context) => {
      if (questId == null || !context) return
      if (context.previousDetail) {
        queryClient.setQueryData(queryKeys.questDetail(questId), context.previousDetail)
      }
      for (const [key, data] of context.previousLists) {
        queryClient.setQueryData(key, data)
      }
      queryClient.setQueryData(queryKeys.questRating(questId), context.previousUserRating)
    },
    onSettled: () => {
      if (questId == null) return
      queryClient.invalidateQueries({ queryKey: queryKeys.questDetail(questId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.questRating(questId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.quests() })
    },
  })
}

export default useRateQuestMutation
