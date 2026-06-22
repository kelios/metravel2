// hooks/usePublicTripsApi.ts
// React Query хуки каталога публичных поездок «Поехали со мной» (Sprint 14).
// Серверный стейт — только через React Query. Мутации оптимистично двигают
// статусы заявок в кэше (мок-режим до готовности BE #408).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelApplication,
  decideApplication,
  fetchMyApplications,
  fetchPublicTrip,
  fetchPublicTrips,
  fetchTripApplications,
  fetchTripNotifications,
  submitApplication,
  type ApplicationDecisionInput,
  type ApplicationStatus,
  type PublicTrip,
  type PublicTripsFilters,
  type SubmitApplicationInput,
  type TripApplication,
  type TripNotification,
} from '@/api/publicTrips';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import {
  trackApplicationDecision,
  trackApplicationSubmitted,
} from '@/utils/tripAnalytics';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && failureCount < 2;

/** Каталог публичных поездок с фильтрами (#411). */
export function usePublicTrips(filters?: PublicTripsFilters) {
  const normalized = filters ?? {};
  return useQuery<PublicTrip[]>({
    queryKey: queryKeys.publicTrips(normalized as Record<string, unknown>),
    queryFn: () => fetchPublicTrips(filters),
    staleTime: STALE_TIME,
    retry,
  });
}

/** Одна публичная поездка (деталь). */
export function usePublicTrip(tripId: string | number | null | undefined) {
  // BE-деталь не отдаёт is_owner, поэтому владение вычисляем на клиенте: организатор
  // == текущий пользователь. Без этого OrganizerApplicationsPanel (гейт trip.isOwner)
  // не рендерится против реального BE. mock-фикстуры сохраняют свой isOwner через OR.
  // (Сам детальный GET теперь идёт с токеном — нужно для reveal места встречи, #410.)
  const userId = useAuthStore((s) => s.userId);
  return useQuery<PublicTrip>({
    queryKey: queryKeys.publicTrip(tripId),
    queryFn: () => fetchPublicTrip(tripId as string | number),
    enabled: tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
    select: (trip) => ({
      ...trip,
      isOwner: trip.isOwner || (userId != null && String(trip.organizer.id) === String(userId)),
    }),
  });
}

/** Заявки текущего пользователя со статусами (#414). */
export function useMyTripApplications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<TripApplication[]>({
    queryKey: queryKeys.tripMyApplications(),
    queryFn: fetchMyApplications,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Заявки на поездку для организатора (#413). Панель монтируется только у
 * владельца поездки (trip.isOwner), поэтому отдельный гейт по auth не нужен. */
export function useTripApplications(tripId: string | number | null | undefined) {
  return useQuery<TripApplication[]>({
    queryKey: queryKeys.tripApplications(tripId),
    queryFn: () => fetchTripApplications(tripId as string | number),
    enabled: tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}

/** Нотификации о заявках (#415). */
export function useTripNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<TripNotification[]>({
    queryKey: queryKeys.tripNotifications(),
    queryFn: fetchTripNotifications,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

/** Подача заявки «Хочу поехать» (#412). */
export function useSubmitApplication() {
  const qc = useQueryClient();
  return useMutation<TripApplication, unknown, SubmitApplicationInput>({
    mutationFn: submitApplication,
    onSuccess: (application, input) => {
      trackApplicationSubmitted(input.tripId);
      // Отразить «На рассмотрении» в карточке/детали поездки сразу.
      qc.setQueryData<PublicTrip>(queryKeys.publicTrip(input.tripId), (old) =>
        old ? { ...old, myApplicationStatus: application.status } : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.tripMyApplications() });
      void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
    },
  });
}

/** Отмена своей заявки участником (#414). */
export function useCancelApplication() {
  const qc = useQueryClient();
  return useMutation<
    { id: number; status: ApplicationStatus },
    unknown,
    number,
    TripApplication[] | undefined
  >({
    mutationFn: cancelApplication,
    onMutate: async (applicationId) => {
      await qc.cancelQueries({ queryKey: queryKeys.tripMyApplications() });
      const prev = qc.getQueryData<TripApplication[]>(queryKeys.tripMyApplications());
      qc.setQueryData<TripApplication[]>(queryKeys.tripMyApplications(), (old) =>
        (old ?? []).map((a) =>
          a.id === applicationId ? { ...a, status: 'cancelled' } : a,
        ),
      );
      return prev;
    },
    onError: (_err, _id, prev) => {
      if (prev) qc.setQueryData(queryKeys.tripMyApplications(), prev);
    },
    onSuccess: (_res, applicationId) => {
      // Сбросить «На рассмотрении» на карточке/детали соответствующей поездки.
      const apps = qc.getQueryData<TripApplication[]>(queryKeys.tripMyApplications());
      const tripId = apps?.find((a) => a.id === applicationId)?.tripId;
      if (tripId != null) {
        qc.setQueryData<PublicTrip>(queryKeys.publicTrip(tripId), (old) =>
          old ? { ...old, myApplicationStatus: 'cancelled' } : old,
        );
      }
      void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
    },
  });
}

interface DecisionContext {
  prev?: TripApplication[];
}

/** Решение организатора по заявке: accept/reject (#413). */
export function useDecideApplication() {
  const qc = useQueryClient();
  return useMutation<
    { id: number; status: ApplicationStatus },
    unknown,
    ApplicationDecisionInput,
    DecisionContext
  >({
    mutationFn: decideApplication,
    onMutate: async (input) => {
      const key = queryKeys.tripApplications(input.tripId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TripApplication[]>(key);
      const nextStatus = input.decision === 'approve' ? 'approved' : 'rejected';
      qc.setQueryData<TripApplication[]>(key, (old) =>
        (old ?? []).map((a) =>
          a.id === input.applicationId ? { ...a, status: nextStatus } : a,
        ),
      );
      return { prev };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.tripApplications(input.tripId), ctx.prev);
    },
    onSuccess: (_result, input) => {
      trackApplicationDecision(input.decision, input.tripId, input.applicationId);
    },
    onSettled: (_result, _err, input) => {
      // Одобрение/отклонение может изменить занятые места/статус поездки и
      // статус заявки участника — обновляем связанные кэши.
      void qc.invalidateQueries({ queryKey: queryKeys.publicTrip(input.tripId) });
      void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
      void qc.invalidateQueries({ queryKey: queryKeys.tripMyApplications() });
    },
  });
}
