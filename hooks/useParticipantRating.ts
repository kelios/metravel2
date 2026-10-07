import { readRetryTwice } from '@/utils/queryRetryPolicy';
// hooks/useParticipantRating.ts
// React Query хуки оценки участников поездки (Sprint 16, FE-431). Мутация
// инвалидирует свою оценку и публичный профиль оценённого (там агрегат
// participant_rating).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getMyParticipantRating,
  rateParticipant,
  type ParticipantRating,
  type SubmitParticipantRatingInput,
} from '@/api/participantRating'

import { queryKeys } from '@/api/queryKeys'

export function useMyParticipantRating(
  tripId: number | null | undefined,
  userId: number | null | undefined,
) {
  return useQuery<ParticipantRating | null>({
    queryKey: queryKeys.participantRating(tripId, userId),
    queryFn: () => getMyParticipantRating(tripId as number, userId as number),
    enabled: tripId != null && userId != null,
    staleTime: 5 * 60 * 1000,
    retry: readRetryTwice,
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
