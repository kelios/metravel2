// api/questReview.ts
// API для отзывов о пройденном городском квесте.
//
// КОНТРАКТ ЭНДПОИНТА (BE-тикет, эндпоинта пока нет):
//
// 1) Отправка отзыва
//    POST /api/quest-reviews/
//    Тело запроса:
//      {
//        user: number,      // id пользователя
//        quest: number,     // числовой PK квеста (ApiQuestBundle.id)
//        rating: number,    // 1..5
//        liked: string,     // «что понравилось» (может быть пустым)
//        disliked: string   // «что не понравилось / что улучшить» (может быть пустым)
//      }
//    Ответ (QuestReviewRecord):
//      {
//        id: number,
//        user: number,
//        quest: number,
//        rating: number,
//        liked: string,
//        disliked: string
//      }
//
// 2) Отзыв текущего пользователя (для префилла)
//    GET /api/quests/quest{questId}/review/users/{userId}/
//    Ответ: QuestReviewRecord, либо 404 если пользователь ещё не оставлял отзыв.

import { apiClient, ApiError } from '@/api/client'
import { devError } from '@/utils/logger'
import { useAuthStore } from '@/stores/authStore'

export type QuestReviewRecord = {
  id: number
  user: number
  quest: number
  rating: number
  liked: string
  disliked: string
}

export type SubmitQuestReviewParams = {
  questId: number
  rating: number
  liked: string
  disliked: string
}

const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'

const getNumericUserId = (): number | null => {
  const userIdRaw = useAuthStore.getState().userId
  const userId = userIdRaw ? Number(userIdRaw) : null
  return userId && Number.isFinite(userId) ? userId : null
}

/**
 * Отправляет отзыв о квесте.
 * POST /api/quest-reviews/
 */
export const submitQuestReview = async (
  params: SubmitQuestReviewParams,
): Promise<QuestReviewRecord> => {
  const { questId, rating, liked, disliked } = params

  if (rating < 1 || rating > 5) {
    throw new Error('Рейтинг должен быть от 1 до 5')
  }

  try {
    const userId = getNumericUserId()

    const response = await apiClient.post<QuestReviewRecord>('/quest-reviews/', {
      user: userId,
      quest: questId,
      rating,
      liked,
      disliked,
    })
    return response
  } catch (error) {
    devError('Error submitting quest review:', error)
    throw error
  }
}

/**
 * Получает отзыв текущего пользователя о квесте для префилла.
 * GET /api/quests/quest{questId}/review/users/{userId}/
 * При 404/401/403 (отзыва нет / нет доступа) возвращает null без выброса.
 */
export const getUserQuestReview = async (questId: number): Promise<QuestReviewRecord | null> => {
  try {
    const userId = getNumericUserId()
    if (!userId) return null

    const response = await apiClient.get<QuestReviewRecord>(
      `/quests/quest${questId}/review/users/${userId}/`,
    )

    if (response && typeof response.rating === 'number') {
      return response
    }

    return null
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return null
    }
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      return null
    }
    devError('Error fetching user quest review:', error)
    return null
  }
}
