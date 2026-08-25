// hooks/useQuestReview.ts
// Хук для отправки и префилла отзыва о пройденном квесте.

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getUserQuestReview,
  submitQuestReview,
  type QuestReviewRecord,
  type SubmitQuestReviewParams,
} from '@/api/questReview'
import { useAuth } from '@/context/AuthContext'
import { trackQuestReviewSubmit } from '@/utils/questReviewAnalytics'
import { queryKeys } from '@/queryKeys'

type SubmitInput = {
  rating: number
  liked: string
  disliked: string
}

type UseQuestReviewOptions = {
  questId: number | undefined
  /** Строковый quest_id для аналитики: в событиях квестов идёт именно он. */
  questSlug?: string
  cityId?: string
  enabled?: boolean
}

type UseQuestReviewReturn = {
  review: QuestReviewRecord | null
  isLoading: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  hasError: boolean
  submit: (input: SubmitInput) => void
}

export function useQuestReview({
  questId,
  questSlug,
  cityId,
  enabled = true,
}: UseQuestReviewOptions): UseQuestReviewReturn {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const reviewQuery = useQuery({
    queryKey: queryKeys.questUserReview(questId),
    queryFn: () => getUserQuestReview(questId!),
    enabled: enabled && !!questId && isAuthenticated,
    staleTime: 30 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (input: SubmitInput) => {
      const params: SubmitQuestReviewParams = {
        questId: questId!,
        rating: input.rating,
        liked: input.liked,
        disliked: input.disliked,
      }
      return submitQuestReview(params)
    },
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.questUserReview(questId), record)
      queryClient.invalidateQueries({ queryKey: queryKeys.questUserReview(questId) })
      // Единственная точка подтверждённого сохранения: срабатывает один раз на
      // mutate, поэтому ре-рендер экрана финала событие не дублирует, а
      // упавший запрос сюда не доходит (#1486).
      trackQuestReviewSubmit({
        questId: questSlug,
        cityId,
        rating: record.rating,
        hasText: !!(record.liked?.trim() || record.disliked?.trim()),
      })
    },
  })

  const submit = useCallback(
    (input: SubmitInput) => {
      if (!questId || mutation.isPending) return
      mutation.mutate(input)
    },
    [questId, mutation],
  )

  return {
    review: reviewQuery.data ?? null,
    isLoading: reviewQuery.isLoading,
    isSubmitting: mutation.isPending,
    isSubmitted: mutation.isSuccess,
    hasError: mutation.isError,
    submit,
  }
}

export default useQuestReview
