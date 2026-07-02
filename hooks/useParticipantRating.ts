// hooks/useParticipantRating.ts
// React Query хуки оценки участников поездки (Sprint 16, FE-431). Зеркалит
// hooks/useQuestRating. Мутация инвалидирует свою оценку и публичный профиль
// оценённого (там агрегат participant_rating).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getMyParticipantRating,
  rateParticipant,
  type ParticipantRating,
  type SubmitParticipantRatingInput,
} from '@/api/participantRating'
import { ApiError, isTimeoutError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

export function useMyParticipantRating(
  tripId: number | null | undefined,
  userId: number | null | undefined,
) {
  return useQuery<ParticipantRating | null>({
    queryKey: queryKeys.participantRating(tripId, userId),
    queryFn: () => getMyParticipantRating(tripId as number, userId as number),
    enabled: tripId != null && userId != null,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isAuthError(error) && !isTimeoutError(error) && failureCount < 2,
  })
}

export function useRateParticipant() {
  const qc = useQueryClient()
  return useMutation<void, unknown, SubmitParticipantRatingInput>({
    mutationFn: rateParticipant,
    onSuccess: (_res, input) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.participantRating(input.tripId, input.userId),
      })
      void qc.invalidateQueries({ queryKey: queryKeys.userProfile(input.userId) })
    },
  })
}
