// hooks/useQuestRating.ts
// Мутация оценки квеста с оптимистичным обновлением questDetail, списка квестов
// и questRating-ключа; откат при ошибке, инвалидация onSettled.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getUserQuestRating, rateQuest, type QuestRating } from '@/api/questRating'
import { queryKeys } from '@/api/queryKeys'
import { type ApiQuestMeta } from '@/api/quests'
import { useAuth } from '@/context/AuthContext'
import { calculateNewRating } from '@/utils/ratingHelpers'

type RateContext = {
  previousUserRating: number | null | undefined
  previousDetail: ApiQuestMeta | undefined
  previousList: ApiQuestMeta[] | undefined
}

const applyRatingToMeta = (
  meta: ApiQuestMeta,
  newRating: QuestRating,
  previousUserRating: number | null,
): ApiQuestMeta => {
  const nextCount =
    previousUserRating == null ? meta.rating_count + 1 : meta.rating_count
  const nextAvg = calculateNewRating(
    meta.rating_avg ?? 0,
    meta.rating_count,
    newRating,
    previousUserRating,
  )
  return {
    ...meta,
    rating_avg: nextAvg,
    rating_count: nextCount,
    user_rating: newRating,
  }
}

export function useQuestRatingMutation(questNumericId: number | undefined) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const userRatingQuery = useQuery({
    queryKey: queryKeys.questRating(questNumericId),
    queryFn: () => getUserQuestRating(questNumericId!),
    enabled: !!questNumericId && isAuthenticated,
    staleTime: 30 * 1000,
  })

  const mutation = useMutation<void, Error, QuestRating, RateContext>({
    mutationFn: (rating) => rateQuest(questNumericId!, rating),
    onMutate: async (newRating) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.questRating(questNumericId) })

      const previousUserRating = queryClient.getQueryData<number | null>(
        queryKeys.questRating(questNumericId),
      )
      const previousDetail = queryClient.getQueryData<ApiQuestMeta>(
        queryKeys.questDetail(questNumericId),
      )
      const previousList = queryClient.getQueryData<ApiQuestMeta[]>(queryKeys.quests())

      queryClient.setQueryData(queryKeys.questRating(questNumericId), newRating)

      if (previousDetail) {
        queryClient.setQueryData<ApiQuestMeta>(
          queryKeys.questDetail(questNumericId),
          applyRatingToMeta(previousDetail, newRating, previousUserRating ?? null),
        )
      }

      if (previousList) {
        queryClient.setQueryData<ApiQuestMeta[]>(
          queryKeys.quests(),
          previousList.map((meta) =>
            meta.id === questNumericId
              ? applyRatingToMeta(meta, newRating, previousUserRating ?? null)
              : meta,
          ),
        )
      }

      return { previousUserRating, previousDetail, previousList }
    },
    onError: (_error, _newRating, context) => {
      if (context?.previousUserRating !== undefined) {
        queryClient.setQueryData(
          queryKeys.questRating(questNumericId),
          context.previousUserRating,
        )
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(queryKeys.questDetail(questNumericId), context.previousDetail)
      }
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(queryKeys.quests(), context.previousList)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.questRating(questNumericId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.questDetail(questNumericId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.quests() })
    },
  })

  return {
    userRating: userRatingQuery.data ?? null,
    isSubmitting: mutation.isPending,
    canRate: isAuthenticated,
    rate: mutation.mutate,
  }
}

export default useQuestRatingMutation
