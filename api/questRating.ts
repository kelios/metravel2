// api/questRating.ts
// API для работы с рейтингом городских квестов. Зеркалит api/travelRating.ts.
//   POST /quests/{id}/rate/  тело { rating }
//   GET  /quests/{id}/rate/  → { rating } | null
//
// MOCK-режим: пока живой BE-эндпоинт недоступен, в DEV под флагом
// QUEST_RATING_MOCK работаем поверх in-memory-хранилища оценок (по questId).
// В прод-сборке __DEV__===false → мок выключен и идёт реальный API.

import { apiClient, ApiError } from '@/api/client'
import { devError } from '@/utils/logger'

export type RateQuestRating = 1 | 2 | 3 | 4 | 5

const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'

// ── Mock-хранилище ───────────────────────────────────────────────────────────
// Хранит оценку текущего устройства по questId. Не попадает в прод: гейтится __DEV__.
const QUEST_RATING_MOCK = true

const shouldUseMockRating = (): boolean => __DEV__ && QUEST_RATING_MOCK

const mockRatings = new Map<number, number>()

/**
 * Отправляет оценку квеста.
 * POST /quests/{id}/rate/  тело { rating }.
 */
export const rateQuest = async (questId: number, rating: RateQuestRating): Promise<void> => {
  if (rating < 1 || rating > 5) {
    throw new Error('Рейтинг должен быть от 1 до 5')
  }

  if (shouldUseMockRating()) {
    mockRatings.set(questId, rating)
    return
  }

  try {
    await apiClient.post<void>(`/quests/${questId}/rate/`, { rating })
  } catch (error) {
    devError('Error rating quest:', error)
    throw error
  }
}

/**
 * Получает оценку квеста от текущего пользователя.
 * GET /quests/{id}/rate/  → rating или null, если пользователь ещё не оценивал.
 */
export const getUserQuestRating = async (questId: number): Promise<number | null> => {
  if (shouldUseMockRating()) {
    return mockRatings.get(questId) ?? null
  }

  try {
    const response = await apiClient.get<{ rating: number | null } | null>(
      `/quests/${questId}/rate/`,
    )

    if (response && typeof response.rating === 'number') {
      return response.rating
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
    devError('Error fetching user quest rating:', error)
    return null
  }
}
