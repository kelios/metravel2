// api/questRating.ts
// API для оценки городского квеста звёздами 1..5.
//
// КОНТРАКТ ЭНДПОИНТА:
//   POST /api/quests/{id}/rate/   тело { rating: 1..5 } — поставить/изменить оценку
//   GET  /api/quests/{id}/rate/   — оценка текущего пользователя (null если не оценивал)

import { apiClient, ApiError } from '@/api/client'
import { devError } from '@/utils/logger'
import { translate as i18nT } from '@/i18n'

export type QuestRating = 1 | 2 | 3 | 4 | 5

type QuestRatingRecord = {
  user_rating: number | null
}

// DEV-only мок (НЕ env): пока эндпоинт оценки не на проде, в DEV не ходим
// на сервер, а держим оценку в памяти. В прод-бандл (__DEV__===false) не попадает.
const QUEST_RATING_MOCK = true
const mockRatings = new Map<number, QuestRating>()

const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'

function assertValidRating(rating: number): asserts rating is QuestRating {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(i18nT('errorsStatic:api.common.ratingRange'))
  }
}

/**
 * Отправляет оценку квеста.
 * POST /api/quests/{id}/rate/
 */
export const rateQuest = async (questId: number, rating: QuestRating): Promise<void> => {
  assertValidRating(rating)

  if (__DEV__ && QUEST_RATING_MOCK) {
    mockRatings.set(questId, rating)
    return
  }

  try {
    await apiClient.post<unknown>(`/quests/${questId}/rate/`, { rating })
  } catch (error) {
    devError('Error rating quest:', error)
    throw error
  }
}

/**
 * Оценка текущего пользователя для квеста.
 * GET /api/quests/{id}/rate/ — 401/403/404 трактуем как «оценки нет» → null.
 */
export const getUserQuestRating = async (questId: number): Promise<number | null> => {
  if (__DEV__ && QUEST_RATING_MOCK) {
    return mockRatings.get(questId) ?? null
  }

  try {
    const response = await apiClient.get<QuestRatingRecord>(`/quests/${questId}/rate/`)
    if (response && typeof response.user_rating === 'number') {
      return response.user_rating
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

/**
 * Минимальная выборка, при которой публичный агрегат квеста имеет смысл (#1486).
 *
 * Ниже порога усреднение врёт: один отзыв на пятёрку рисует в каталоге
 * «рейтинг 5.0», хотя за ним стоит один человек. Порог касается только
 * выведенной оценки — количество отзывов (вход в читалку) показывается с
 * первого, потому что это факт, а не вывод из выборки.
 */
export const QUEST_RATING_MIN_REVIEWS = 3

/** Показывать ли агрегированную оценку квеста при таком числе отзывов. */
export const hasPublicQuestRating = (ratingCount: number | null | undefined): boolean =>
  typeof ratingCount === 'number' &&
  Number.isFinite(ratingCount) &&
  ratingCount >= QUEST_RATING_MIN_REVIEWS
