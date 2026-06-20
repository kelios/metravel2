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
import { queryKeys } from '@/queryKeys'

type SubmitInput = {
  rating: number
  liked: string
  disliked: string
}

type UseQuestReviewOptions = {
  questId: number | undefined
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
