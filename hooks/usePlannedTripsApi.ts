// hooks/usePlannedTripsApi.ts
// React Query хуки планирования поездок (Sprint 13 / блок D). Серверный стейт —
// только React Query. Мутации оптимистично/инвалидируют связанные кэши.
// До готовности BE работает на мок-фолбэке из api/plannedTrips.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTrip,
  decideSuggestion,
  fetchCommunityTrips,
  fetchMyPlannedTrips,
  fetchPlannedTrip,
  fetchRouteTemplates,
  fetchTripSuggestions,
  inviteParticipants,
  setRsvp,
  submitTripReport,
  suggestPoint,
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
  type TripSuggestion,
  type UpdateRouteInput,
} from '@/api/plannedTrips';
import { ApiError } from '@/api/client';
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
  !isAuthError(error) && failureCount < 2;

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
  return useQuery<PlannedTrip>({
    queryKey: queryKeys.plannedTrip(tripId),
    queryFn: () => fetchPlannedTrip(tripId as string | number),
    enabled: tripId != null && tripId !== '',
    staleTime: STALE_TIME,
    retry,
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
    },
  });
}

export function useUpdateTripRoute() {
  const qc = useQueryClient();
  return useMutation<PlannedTrip, unknown, UpdateRouteInput>({
    mutationFn: updateTripRoute,
    onSuccess: (trip) => {
      qc.setQueryData<PlannedTrip>(queryKeys.plannedTrip(trip.id), trip);
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
