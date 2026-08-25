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
import { queryKeys } from '@/api/queryKeys'

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
  hasLoadError: boolean
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
  const { isAuthenticated, userId } = useAuth()
  const queryClient = useQueryClient()
  const reviewKey = queryKeys.questUserReview(userId, questId)

  const reviewQuery = useQuery({
    queryKey: reviewKey,
    queryFn: () => getUserQuestReview(questId!),
    enabled: enabled && !!questId && isAuthenticated && !!userId,
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
      // POST возвращает полную сохранённую запись, поэтому отдельный GET личного
      // отзыва здесь был лишним. Ключ scoped по аккаунту, чтобы результат не
      // показывался следующему пользователю этого устройства.
      queryClient.setQueryData(reviewKey, record)
      // Рейтинг каталога и публичная читалка считаются из той же QuestReview.
      // Раньше их случайно обновляла отдельная /rate/-мутация; после удаления
      // несуществующего endpoint инвалидация принадлежит точке реального save.
      void queryClient.invalidateQueries({ queryKey: queryKeys.quests() })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.questDetail(questId),
        exact: true,
      })
      if (questSlug) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.questReviews(questSlug),
          exact: true,
        })
      }
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
      // Не разрешаем POST, пока неизвестно, есть ли уже отзыв: backend делает
      // upsert, и ранняя отправка могла бы затереть прежний текст пустыми полями.
      if (
        !questId ||
        !isAuthenticated ||
        !userId ||
        reviewQuery.isFetching ||
        reviewQuery.isError ||
        mutation.isPending
      ) {
        return
      }
      mutation.mutate(input)
    },
    [
      isAuthenticated,
      mutation,
      questId,
      reviewQuery.isError,
      reviewQuery.isFetching,
      userId,
    ],
  )

  return {
    review: reviewQuery.data ?? null,
    // Блокируем upsert и на первом GET, и на фоновом refetch старого `null`:
    // оба запроса ещё могут обнаружить сохранённый на другом устройстве отзыв.
    isLoading: reviewQuery.isFetching,
    hasLoadError: reviewQuery.isError,
    isSubmitting: mutation.isPending,
    isSubmitted: mutation.isSuccess,
    hasError: mutation.isError,
    submit,
  }
}

export default useQuestReview
