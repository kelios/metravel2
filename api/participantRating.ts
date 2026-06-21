// api/participantRating.ts
// Trust & Safety (Sprint 16, FE-431): взаимная оценка участников после поездки.
// Зеркалит контракт оценки квеста (api/questRating.ts).
//
// КОНТРАКТ ЭНДПОИНТА (BE-post-trip-rating #428):
//   POST /trips/{tripId}/participants/{userId}/rate/  body { rating: 1..5, review?: string }
//   GET  /trips/{tripId}/participants/{userId}/rate/   → { rating, review } | null
//   403 — поездка не completed / оценивающий не участник / оценка самого себя.
//   Идемпотентно: повторный POST обновляет свою оценку.
//
// Пока эндпоинт не задеплоен — в DEV (или EXPO_PUBLIC_TRIPS_MOCK=true) держим оценку
// в памяти. В прод-бандл (__DEV__===false без флага) мок не попадает.

import { apiClient, ApiError } from '@/api/client'
import { devError } from '@/utils/logger'

export type ParticipantRatingValue = 1 | 2 | 3 | 4 | 5

export interface ParticipantRating {
  rating: ParticipantRatingValue
  review: string | null
}

export interface SubmitParticipantRatingInput {
  tripId: number
  userId: number
  rating: ParticipantRatingValue
  review?: string
}

const PARTICIPANT_RATING_MOCK =
  process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true' || __DEV__
const mockRatings = new Map<string, ParticipantRating>()

const mockKey = (tripId: number, userId: number): string => `${tripId}:${userId}`

const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'

function assertValidRating(rating: number): asserts rating is ParticipantRatingValue {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Оценка должна быть от 1 до 5')
  }
}

/**
 * Поставить/обновить оценку участника поездки.
 * POST /trips/{tripId}/participants/{userId}/rate/
 */
export async function rateParticipant(
  input: SubmitParticipantRatingInput,
): Promise<void> {
  assertValidRating(input.rating)
  const review = input.review?.trim() || null

  if (PARTICIPANT_RATING_MOCK) {
    mockRatings.set(mockKey(input.tripId, input.userId), {
      rating: input.rating,
      review,
    })
    return
  }

  const body: { rating: number; review?: string } = { rating: input.rating }
  if (review) body.review = review
  try {
    await apiClient.post<unknown>(
      `/trips/${input.tripId}/participants/${input.userId}/rate/`,
      body,
    )
  } catch (error) {
    devError('Error rating trip participant:', error)
    throw error
  }
}

/**
 * Своя оценка участника поездки (null, если не оценивал).
 * GET /trips/{tripId}/participants/{userId}/rate/ — 401/403/404 → null.
 */
export async function getMyParticipantRating(
  tripId: number,
  userId: number,
): Promise<ParticipantRating | null> {
  if (PARTICIPANT_RATING_MOCK) {
    return mockRatings.get(mockKey(tripId, userId)) ?? null
  }

  try {
    const res = await apiClient.get<ParticipantRating | null>(
      `/trips/${tripId}/participants/${userId}/rate/`,
    )
    if (res && typeof res.rating === 'number') {
      return { rating: res.rating as ParticipantRatingValue, review: res.review ?? null }
    }
    return null
  } catch (error: unknown) {
    if (isAbortError(error)) return null
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      return null
    }
    devError('Error fetching participant rating:', error)
    return null
  }
}
