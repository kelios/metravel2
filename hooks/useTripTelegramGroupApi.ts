// hooks/useTripTelegramGroupApi.ts
// React Query хуки Telegram-группы поездки (Sprint 15 / блок 6, FE-423).
// Серверный стейт — только через React Query; мок-фолбэк до готовности BE #420.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTripTelegramGroup,
  fetchTripInviteLink,
  fetchTripTelegramGroup,
  type CreateTripTelegramGroupInput,
  type TripInviteLink,
  type TripTelegramGroup,
} from '@/api/tripTelegramGroup';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2;

/** Состояние Telegram-группы поездки. */
export function useTripTelegramGroup(tripId: number | null | undefined) {
  return useQuery<TripTelegramGroup>({
    queryKey: queryKeys.tripTelegramGroup(tripId),
    queryFn: () => fetchTripTelegramGroup(tripId as number),
    enabled: tripId != null,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Создание Telegram-группы (owner-only). */
export function useCreateTripTelegramGroup(tripId: number) {
  const qc = useQueryClient();
  return useMutation<
    TripTelegramGroup,
    unknown,
    Omit<CreateTripTelegramGroupInput, 'tripId'> | void
  >({
    mutationFn: (input) =>
      createTripTelegramGroup({ tripId, ...(input ?? {}) }),
    onSuccess: (group) => {
      qc.setQueryData<TripTelegramGroup>(queryKeys.tripTelegramGroup(tripId), group);
      void qc.invalidateQueries({ queryKey: queryKeys.tripTelegramGroup(tripId) });
    },
  });
}

/** Получение invite-ссылки (owner/participant) — кнопка «Пригласить». */
export function useFetchTripInviteLink(tripId: number) {
  return useMutation<TripInviteLink, unknown, void>({
    mutationFn: () => fetchTripInviteLink(tripId),
  });
}
