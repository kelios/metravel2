// hooks/usePlannedTripsApi.ts
// React Query хуки планирования поездок (Sprint 13 / блок D). Серверный стейт —
// только React Query. Мутации оптимистично/инвалидируют связанные кэши.
// До готовности BE работает на мок-фолбэке из api/plannedTrips.ts.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  createTrip,
  decideSuggestion,
  deletePlannedTrip,
  fetchCommunityTrips,
  fetchMyPlannedTrips,
  fetchPlannedTrip,
  fetchRouteTemplates,
  fetchTripRouteElevation,
  fetchTripSuggestions,
  inviteParticipants,
  refreshTripRouteElevation,
  setRsvp,
  submitTripReport,
  suggestPoint,
  updatePlannedTrip,
  updatePlannedTripBikeType,
  updatePlannedTripTransport,
  updateTripRoute,
  type CommunityTripsFilters,
  type CreateTripInput,
  type DecideSuggestionInput,
  type InviteInput,
  type PlannedTrip,
  type RouteTemplate,
  type RsvpInput,
  type SubmitReportInput,
  type SuggestPointInput,
  type TripRouteElevation,
  type TripSuggestion,
  type UpdateTripBikeTypeInput,
  type UpdateTripInput,
  type UpdateTripTransportInput,
  type UpdateRouteInput,
} from '@/api/plannedTrips';
import { ApiError, isTimeoutError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import {
  trackTripCreated,
  trackTripInviteSent,
  trackTripRsvp,
} from '@/utils/tripAnalytics';

const STALE_TIME = 5 * 60 * 1000;

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const retry = (failureCount: number, error: unknown): boolean =>
  !isAuthError(error) && !isTimeoutError(error) && failureCount < 2;

// Пересчёт маршрута на бэке переписывает сводку без высот, поэтому кэш профиля
// больше не относится к текущему маршруту.
const invalidateRouteElevation = (qc: QueryClient, tripId: number | string): void => {
  void qc.invalidateQueries({ queryKey: queryKeys.tripRouteElevation(tripId) });
};

const syncUpdatedPlannedTrip = (qc: QueryClient, trip: PlannedTrip): void => {
  qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
  invalidateRouteElevation(qc, trip.id);
  void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
  void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsAll() });
  void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
  void qc.invalidateQueries({ queryKey: queryKeys.communityTripsAll() });
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useMyPlannedTrips() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<PlannedTrip[]>({
    queryKey: queryKeys.plannedTripsMine(),
    queryFn: fetchMyPlannedTrips,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry,
  });
}

export function usePlannedTrip(tripId: string | number | null | undefined) {
  // Ждём гидрацию authStore: isOwner вычисляется в mapTrip из userId стора,
  // и запрос до authReady кэширует isOwner=false — владелец теряет кнопки
  // «Редактировать»/«Удалить» до ручного обновления страницы.
  const authReady = useAuthStore((s) => s.authReady);
  const userId = useAuthStore((s) => s.userId);
  // `isOwner` is viewer-specific and must not be trusted from a shared
  // React Query payload: a guest/cross-account cache can otherwise hide owner
  // controls for the whole stale window on a cold direct load. Keep the shared
  // trip key so existing mutation cache writes stay atomic, but derive the
  // permission bit from the current auth identity on every identity change.
  const selectForCurrentUser = useCallback(
    (trip: PlannedTrip): PlannedTrip => {
      const numericUserId = userId == null ? null : Number(userId);
      const isOwner = numericUserId != null
        && Number.isFinite(numericUserId)
        && trip.organizer.id === numericUserId;
      return trip.isOwner === isOwner ? trip : { ...trip, isOwner };
    },
    [userId],
  );
  return useQuery<PlannedTrip>({
    queryKey: queryKeys.plannedTrip(tripId),
    queryFn: () => fetchPlannedTrip(tripId as string | number),
    enabled: authReady && tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
    select: selectForCurrentUser,
  });
}

export function useCommunityTrips(filters?: CommunityTripsFilters) {
  const normalized = filters ?? {};
  return useQuery<PlannedTrip[]>({
    queryKey: queryKeys.communityTrips(normalized as Record<string, unknown>),
    queryFn: () => fetchCommunityTrips(filters),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useTripRouteElevation(
  tripId: string | number | null | undefined,
  options?: { enabled?: boolean },
) {
  // Эндпоинт закрыт TokenAuthentication: до гидрации токена запрос даёт 401 и
  // кэширует пустой профиль.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<TripRouteElevation>({
    queryKey: queryKeys.tripRouteElevation(tripId),
    queryFn: () => fetchTripRouteElevation(tripId as string | number),
    enabled:
      (options?.enabled ?? true) &&
      isAuthenticated &&
      tripId != null &&
      tripId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}

export function useRefreshTripRouteElevation() {
  const qc = useQueryClient();
  return useMutation<TripRouteElevation, unknown, { tripId: number | string }>({
    mutationFn: ({ tripId }) => refreshTripRouteElevation(tripId),
    onSuccess: (elevation, { tripId }) => {
      qc.setQueryData<TripRouteElevation>(
        queryKeys.tripRouteElevation(tripId),
        elevation,
      );
      // Пересчёт переписывает сохранённую сводку: в поездке меняются набор высоты
      // и routing state, а route_geometry обнуляется в пользу полилинии.
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTrip(tripId) });
    },
  });
}

export function useRouteTemplates() {
  return useQuery<RouteTemplate[]>({
    queryKey: queryKeys.routeTemplates(),
    queryFn: fetchRouteTemplates,
    staleTime: 60 * 60 * 1000,
    retry,
  });
}

export function useTripSuggestions(tripId: string | number | null | undefined) {
  return useQuery<TripSuggestion[]>({
    queryKey: queryKeys.tripSuggestions(tripId),
    queryFn: () => fetchTripSuggestions(tripId as string | number),
    enabled: tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, CreateTripInput>({
    mutationFn: createTrip,
    onSuccess: (trip) => {
      trackTripCreated(trip.id, trip.transport);
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
      // Публичная поездка попадает в каталог «Поехали со мной» (BE отдаёт её сразу).
      if (trip.visibility === 'public') {
        void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
      }
    },
  });
}

export function useDeletePlannedTrip() {
  const qc = useQueryClient();
  return useMutation<{ id: number }, unknown, number | string>({
    mutationFn: deletePlannedTrip,
    onSuccess: (_result, tripId) => {
      void qc.cancelQueries({ queryKey: queryKeys.plannedTrip(tripId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.plannedTrip(tripId),
        refetchType: 'inactive',
      });
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsAll() });
      void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
      void qc.invalidateQueries({ queryKey: queryKeys.communityTripsAll() });
    },
  });
}

export function useUpdatePlannedTrip() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, UpdateTripInput>({
    mutationFn: updatePlannedTrip,
    onSuccess: (trip) => syncUpdatedPlannedTrip(qc, trip),
  });
}

export function useUpdateTripTransport() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, UpdateTripTransportInput>({
    mutationFn: updatePlannedTripTransport,
    onSuccess: (trip) => syncUpdatedPlannedTrip(qc, trip),
  });
}

export function useUpdateTripBikeType() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, UpdateTripBikeTypeInput>({
    mutationFn: updatePlannedTripBikeType,
    onSuccess: (trip) => syncUpdatedPlannedTrip(qc, trip),
  });
}

export function useUpdateTripRoute() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, UpdateRouteInput>({
    mutationFn: updateTripRoute,
    onSuccess: (trip) => {
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      invalidateRouteElevation(qc, trip.id);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
    },
  });
}

export function useSetRsvp() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, RsvpInput>({
    mutationFn: setRsvp,
    onSuccess: (trip, input) => {
      trackTripRsvp(input.tripId, input.rsvp);
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
    },
  });
}

export function useInviteParticipants() {
  return useMutation<{ invited: number }, unknown, InviteInput>({
    mutationFn: inviteParticipants,
    onSuccess: (res, input) => {
      trackTripInviteSent(input.tripId, res.invited);
    },
  });
}

export function useSuggestPoint() {
  const qc = useQueryClient();
  return useMutation<TripSuggestion, unknown, SuggestPointInput>({
    mutationFn: suggestPoint,
    onSuccess: (_s, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tripSuggestions(input.tripId) });
    },
  });
}

export function useDecideSuggestion() {
  const qc = useQueryClient();
  return useMutation<{ id: number }, unknown, DecideSuggestionInput>({
    mutationFn: decideSuggestion,
    onSettled: (_res, _err, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tripSuggestions(input.tripId) });
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTrip(input.tripId) });
    },
  });
}

export function useSubmitTripReport() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, SubmitReportInput>({
    mutationFn: submitTripReport,
    onSuccess: (trip) => {
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine() });
      void qc.invalidateQueries({ queryKey: queryKeys.communityTripsAll() });
    },
  });
}
