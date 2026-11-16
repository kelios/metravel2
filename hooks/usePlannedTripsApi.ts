import { readRetryTwice } from '@/utils/queryRetryPolicy';
// hooks/usePlannedTripsApi.ts
// React Query хуки планирования поездок (Sprint 13 / блок D). Серверный стейт —
// только React Query. Мутации оптимистично/инвалидируют связанные кэши.
// До готовности BE работает на мок-фолбэке из api/plannedTrips.ts.

import { useCallback } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

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

import { queryKeys } from '@/api/queryKeys';
import { trackPlannerCreateFailed, trackPlannerFirstSavedPoint, trackPlannerTripCreated } from '@/utils/tripPlannerAnalytics';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { useAuthStore } from '@/stores/authStore';
import {
  trackTripCreated,
  trackTripInviteSent,
  trackTripRsvp,
} from '@/utils/tripAnalytics';

const STALE_TIME = 5 * 60 * 1000;

// Пересчёт маршрута на бэке переписывает сводку без высот, поэтому кэш профиля
// больше не относится к текущему маршруту.
const invalidateRouteElevation = (qc: QueryClient, tripId: number | string): void => {
  void qc.invalidateQueries({ queryKey: queryKeys.tripRouteElevation(tripId) });
};

const syncUpdatedPlannedTrip = (qc: QueryClient, trip: PlannedTrip): void => {
  qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
  invalidateRouteElevation(qc, trip.id);
  // `plannedTripsAll` is the parent key for `plannedTripsMine`; invalidating
  // both can cancel and restart the same active collection refetch.
  void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsAll() });
  void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
  void qc.invalidateQueries({ queryKey: queryKeys.communityTripsAll() });
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useMyPlannedTrips() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const owner = useQueryOwner();
  return useQuery<PlannedTrip[]>({
    queryKey: queryKeys.plannedTripsMine(owner),
    queryFn: fetchMyPlannedTrips,
    enabled: isAuthenticated,
    staleTime: STALE_TIME,
    retry: readRetryTwice,
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
  const query = useQuery<PlannedTrip>({
    queryKey: queryKeys.plannedTrip(tripId),
    queryFn: () => fetchPlannedTrip(tripId as string | number),
    enabled: authReady && tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry: readRetryTwice,
    select: selectForCurrentUser,
  });
  if (authReady) return query;
  // `enabled: false` does not hide data another reader already put under the
  // shared key: the breadcrumb (`useBreadcrumbModel`) loads this trip without
  // waiting for auth. Before `authReady` the identity is unknown, not «guest»:
  // `isOwner: false` derived from it rendered the read-only planner, and the
  // owner identity arriving a moment later swapped RouteBuilder's whole tree,
  // remounting the map with its markers and any popup the owner had opened.
  // Without cached data the same window rendered «failed to load». Until the
  // identity is known the trip is pending for every reader of this hook.
  // A spread would read every field of React Query's tracked result and
  // subscribe the screen to all of them for the observer's lifetime, so a
  // proxy masks only the fields the caller actually reads.
  return new Proxy(query, {
    get: (target, key) => {
      const value = Reflect.get(target, key);
      return Object.prototype.hasOwnProperty.call(AWAITING_IDENTITY_RESULT, key)
        ? AWAITING_IDENTITY_RESULT[key as keyof typeof AWAITING_IDENTITY_RESULT]
        : value;
    },
  });
}

const AWAITING_IDENTITY_RESULT = {
  data: undefined,
  error: null,
  status: 'pending',
  isPending: true,
  isLoading: true,
  isSuccess: false,
  isError: false,
  isLoadingError: false,
  isRefetchError: false,
  isPlaceholderData: false,
} as const satisfies Partial<UseQueryResult<PlannedTrip>>;

export function useCommunityTrips(filters?: CommunityTripsFilters) {
  const normalized = filters ?? {};
  return useQuery<PlannedTrip[]>({
    queryKey: queryKeys.communityTrips(normalized as Record<string, unknown>),
    queryFn: () => fetchCommunityTrips(filters),
    staleTime: STALE_TIME,
    retry: readRetryTwice,
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
    retry: readRetryTwice,
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
    retry: readRetryTwice,
  });
}

export function useTripSuggestions(tripId: string | number | null | undefined) {
  return useQuery<TripSuggestion[]>({
    queryKey: queryKeys.tripSuggestions(tripId),
    queryFn: () => fetchTripSuggestions(tripId as string | number),
    enabled: tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry: readRetryTwice,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateTrip(plannerEntryId?: string) {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<PlannedTrip, unknown, CreateTripInput>({
    mutationFn: createTrip,
    onError: () => trackPlannerCreateFailed(plannerEntryId),
    onSuccess: (trip) => {
      if (!trackPlannerTripCreated(plannerEntryId, trip.id, trip.transport)) trackTripCreated(trip.id, trip.transport);
      trackPlannerFirstSavedPoint(trip.id, trip.route);
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine(owner) });
      // Публичная поездка попадает в каталог «Поехали со мной» (BE отдаёт её сразу).
      if (trip.visibility === 'public') {
        void qc.invalidateQueries({ queryKey: queryKeys.publicTripsAll() });
      }
    },
  });
}

export function useDeletePlannedTrip() {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<{ id: number }, unknown, number | string>({
    mutationFn: deletePlannedTrip,
    onSuccess: (_result, tripId) => {
      void qc.cancelQueries({ queryKey: queryKeys.plannedTrip(tripId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.plannedTrip(tripId),
        refetchType: 'inactive',
      });
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine(owner) });
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
  const owner = useQueryOwner();
  return useMutation<PlannedTrip, unknown, UpdateRouteInput>({
    mutationFn: updateTripRoute,
    onSuccess: (trip) => {
      trackPlannerFirstSavedPoint(trip.id, trip.route);
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      invalidateRouteElevation(qc, trip.id);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine(owner) });
    },
  });
}

export function useSetRsvp() {
  const qc = useQueryClient();
  const owner = useQueryOwner();
  return useMutation<PlannedTrip, unknown, RsvpInput>({
    mutationFn: setRsvp,
    onSuccess: (trip, input) => {
      trackTripRsvp(input.tripId, input.rsvp);
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine(owner) });
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
  const owner = useQueryOwner();
  return useMutation<PlannedTrip, unknown, SubmitReportInput>({
    mutationFn: submitTripReport,
    onSuccess: (trip) => {
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
      void qc.invalidateQueries({ queryKey: queryKeys.plannedTripsMine(owner) });
      void qc.invalidateQueries({ queryKey: queryKeys.communityTripsAll() });
    },
  });
}
