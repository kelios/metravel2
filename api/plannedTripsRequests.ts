// api/plannedTripsRequests.ts
// Слой планирования поездок (Sprint 13 / блок D: «Планирование поездок и совместные
// выезды»). Это поездки, которые пользователь сам конструирует: форма создания,
// конструктор маршрута, RSVP участников, совместное редактирование, пост-отчёт.
// Не путать с api/publicTrips.ts — там каталог «Поехали со мной» (Sprint 14/E).
//
// Production contract verified by board #919. Explicit fixtures and missing-endpoint
// fallbacks are development-only and must never mask production failures.

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';
import { serializeTripStart } from '@/utils/tripDateTime';
import { translate as i18nT } from '@/i18n';
import {
  MOCK_PLANNED_TRIPS,
  MOCK_ROUTE_TEMPLATES,
  MOCK_TRIP_SUGGESTIONS,
  cloneTrip,
} from '@/api/plannedTripsMock';
import type {
  CommunityTripDto,
  Paginated,
  PlannedTripDto,
  RouteTemplateDto,
  TripReportDto,
  TripRouteSummaryDto,
  TripSuggestionDto,
} from '@/api/plannedTripsNormalizers';
import {
  mapCommunityTrip,
  mapSuggestion,
  mapTemplate,
  mapTrip,
  mapTripRouteElevation,
  pointTypeToBe,
  transportToBe,
  unwrap,
} from '@/api/plannedTripsNormalizers';
import type {
  CommunityTripsFilters,
  CreateTripInput,
  DecideSuggestionInput,
  InviteInput,
  PlannedTrip,
  RouteTemplate,
  RsvpInput,
  SubmitReportInput,
  SuggestPointInput,
  SuggestionStatus,
  TripRouteElevation,
  TripSuggestion,
  UpdateRouteInput,
  UpdateTripBikeTypeInput,
  UpdateTripInput,
  UpdateTripTransportInput,
} from '@/api/plannedTripsTypes';

// ── Мок-фолбэк ───────────────────────────────────────────────────────────────

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_TRIPS_MOCK',
  value: process.env.EXPO_PUBLIC_TRIPS_MOCK,
});

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// In-memory мок-стор: мутации в DEV видны до перезагрузки страницы.
const mockStore: PlannedTrip[] = MOCK_PLANNED_TRIPS.map(cloneTrip);
const mockSuggestions: TripSuggestion[] = MOCK_TRIP_SUGGESTIONS.map((s) => ({
  ...s,
  point: { ...s.point },
}));
let mockIdSeq = 9000;

const findMock = (tripId: number | string): PlannedTrip | undefined =>
  mockStore.find((t) => String(t.id) === String(tripId));

const matchesCommunity = (
  trip: PlannedTrip,
  filters?: CommunityTripsFilters,
): boolean => {
  if (!trip.publishedToCommunity) return false;
  if (!filters) return true;
  if (filters.transport && trip.transport !== filters.transport) return false;
  if (filters.region && trip.region !== filters.region) return false;
  const dist = trip.routeSummary?.distanceKm ?? 0;
  if (filters.minDistanceKm != null && dist < filters.minDistanceKm) return false;
  if (filters.maxDistanceKm != null && dist > filters.maxDistanceKm) return false;
  return true;
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

/** Поездки, где текущий пользователь организатор или участник (bare array). */
export async function fetchMyPlannedTrips(): Promise<PlannedTrip[]> {
  if (USE_MOCK) return mockStore.map(cloneTrip);
  try {
    const res = await apiClient.get<PlannedTripDto[]>('/trips/planned/me/');
    return unwrap(res).map(mapTrip);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] my trips → mock fallback');
      return mockStore.map(cloneTrip);
    }
    throw error;
  }
}
export async function fetchPlannedTrip(
  tripId: number | string,
): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    return cloneTrip(trip);
  }
  try {
    const dto = await apiClient.get<PlannedTripDto>(`/trips/planned/${tripId}/`);
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      const trip = findMock(tripId);
      if (trip) {
        devWarn('[planned-trips] detail → mock fallback');
        return cloneTrip(trip);
      }
    }
    throw error;
  }
}
/** Каталог опубликованных маршрутов сообщества (public-trips community_route). */
export async function fetchCommunityTrips(
  filters?: CommunityTripsFilters,
): Promise<PlannedTrip[]> {
  if (USE_MOCK) {
    return mockStore.filter((t) => matchesCommunity(t, filters)).map(cloneTrip);
  }
  try {
    const params = new URLSearchParams({ content_type: 'community_route' });
    if (filters?.transport)
      params.set('transport_mode', transportToBe(filters.transport));
    if (filters?.region) params.set('region', filters.region);
    const res = await apiClient.get<Paginated<CommunityTripDto>>(
      `/public-trips/?${params.toString()}`,
      undefined,
      { skipAuth: true },
    );
    return unwrap(res).map(mapCommunityTrip);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] community → mock fallback');
      return mockStore.filter((t) => matchesCommunity(t, filters)).map(cloneTrip);
    }
    throw error;
  }
}

// Высоты не мокаются: выдуманный профиль неотличим от настоящего, поэтому в
// mock-режиме и на маршруте без ORS-полилинии график просто не показывается.
const unavailableRouteElevation = (): TripRouteElevation => ({
  status: 'unavailable',
  provider: 'unknown',
  ascentM: null,
  descentM: null,
  preview: null,
  geometry: null,
  calculatedAt: null,
});

/** Кэшированная сводка маршрута: высоты и 3D-полилиния появляются после ORS-расчёта. */
export async function fetchTripRouteElevation(
  tripId: number | string,
): Promise<TripRouteElevation> {
  if (USE_MOCK) return unavailableRouteElevation();
  const dto = await apiClient.get<TripRouteSummaryDto>(
    `/trips/${tripId}/route-summary/`,
  );
  return mapTripRouteElevation(dto);
}

/**
 * Пересчёт сводки через ORS с запросом высот (только владелец). Нужен потому, что
 * сохранение маршрута кладёт сводку без ascent/descent и без полилинии.
 */
export async function refreshTripRouteElevation(
  tripId: number | string,
): Promise<TripRouteElevation> {
  if (USE_MOCK) return unavailableRouteElevation();
  const dto = await apiClient.post<TripRouteSummaryDto>(
    `/trips/${tripId}/route-summary/`,
    { provider: 'ors', force_refresh: true },
  );
  return mapTripRouteElevation(dto);
}

export async function fetchRouteTemplates(): Promise<RouteTemplate[]> {
  if (USE_MOCK) return MOCK_ROUTE_TEMPLATES;
  try {
    const res = await apiClient.get<RouteTemplateDto[]>(
      '/trips/route-templates/',
    );
    return unwrap(res).map(mapTemplate);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] templates → mock fallback');
      return MOCK_ROUTE_TEMPLATES;
    }
    throw error;
  }
}

export async function fetchTripSuggestions(
  tripId: number | string,
): Promise<TripSuggestion[]> {
  if (USE_MOCK) {
    return mockSuggestions.filter((s) => String(s.tripId) === String(tripId));
  }
  try {
    const res = await apiClient.get<Paginated<TripSuggestionDto>>(
      `/trip-route-suggestions/?trip=${tripId}`,
    );
    return unwrap(res).map(mapSuggestion);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] suggestions → mock fallback');
      return mockSuggestions.filter((s) => String(s.tripId) === String(tripId));
    }
    throw error;
  }
}

// ── Мутации ─────────────────────────────────────────────────────────────────

const buildMockTrip = (input: CreateTripInput): PlannedTrip => {
  mockIdSeq += 1;
  return {
    id: mockIdSeq,
    slug: String(mockIdSeq),
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    startTime: input.startTime,
    transport: input.transport,
    bikeType: 'regular',
    visibility: input.visibility,
    seatsTotal: input.seatsTotal,
    startPoint: input.startPoint,
    status: 'planning',
    organizer: { id: 0, name: i18nT('errorsStatic:api.plannedTrips.currentUser'), avatarUrl: null },
    route: input.startPoint ? [input.startPoint] : [],
    routeGeometry: null,
    routeSummary: null,
    routingState: null,
    participants: [
      { id: 0, name: i18nT('errorsStatic:api.plannedTrips.currentUser'), avatarUrl: null, rsvp: 'going', role: 'organizer' },
    ],
    coverUrl: null,
    region: input.startPoint?.name ?? '',
    publishedToCommunity: false,
    report: null,
    isOwner: true,
    myRsvp: 'going',
    createdAt: new Date().toISOString(),
  };
};

export async function createTrip(input: CreateTripInput): Promise<PlannedTrip> {
  const coords = input.startPoint?.coordinates ?? null;
  const body = {
    title: input.title,
    description: input.description,
    start_date: serializeTripStart(input.startDate, input.startTime),
    status: 'planned',
    is_public: input.visibility === 'public',
    max_participants: input.seatsTotal,
    transport_mode: transportToBe(input.transport),
    start_point_name: input.startPoint?.name ?? '',
    start_lat: coords ? coords[1] : null,
    start_lng: coords ? coords[0] : null,
    create_telegram_group: input.createTelegramGroup ?? false,
  };
  if (USE_MOCK) {
    const trip = buildMockTrip(input);
    mockStore.unshift(trip);
    return cloneTrip(trip);
  }
  try {
    const dto = await apiClient.post<PlannedTripDto>('/trips/planned/', body);
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] create → mock fallback');
      const trip = buildMockTrip(input);
      mockStore.unshift(trip);
      return cloneTrip(trip);
    }
    throw error;
  }
}

export async function updatePlannedTrip(input: UpdateTripInput): Promise<PlannedTrip> {
  const body = {
    title: input.title,
    description: input.description,
    start_date: serializeTripStart(input.startDate, input.startTime),
    is_public: input.visibility === 'public',
    max_participants: input.seatsTotal,
    transport_mode: transportToBe(input.transport),
    cover_url: input.coverUrl,
  };

  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.title = input.title;
    trip.description = input.description;
    trip.startDate = input.startDate;
    trip.startTime = input.startTime;
    trip.transport = input.transport;
    trip.visibility = input.visibility;
    trip.seatsTotal = input.seatsTotal;
    trip.coverUrl = input.coverUrl;
    return cloneTrip(trip);
  }

  try {
    const dto = await apiClient.patch<PlannedTripDto>(
      `/trips/planned/${input.tripId}/`,
      body,
    );
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] update → mock fallback');
      const trip = findMock(input.tripId);
      if (trip) {
        trip.title = input.title;
        trip.description = input.description;
        trip.startDate = input.startDate;
        trip.startTime = input.startTime;
        trip.transport = input.transport;
        trip.visibility = input.visibility;
        trip.seatsTotal = input.seatsTotal;
        trip.coverUrl = input.coverUrl;
        return cloneTrip(trip);
      }
    }
    throw error;
  }
}

export async function updatePlannedTripTransport(
  input: UpdateTripTransportInput,
): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.transport = input.transport;
    return cloneTrip(trip);
  }

  const dto = await apiClient.patch<PlannedTripDto>(
    `/trips/planned/${input.tripId}/`,
    { transport_mode: transportToBe(input.transport) },
  );
  return mapTrip(dto);
}

// Тип велосипеда меняет профиль ORS на бэке: маршрут перестраивается тем же
// PATCH, отдельный rebuild-запрос не нужен.
export async function updatePlannedTripBikeType(
  input: UpdateTripBikeTypeInput,
): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.bikeType = input.bikeType;
    return cloneTrip(trip);
  }

  const dto = await apiClient.patch<PlannedTripDto>(
    `/trips/planned/${input.tripId}/`,
    { bike_type: input.bikeType },
  );
  return mapTrip(dto);
}

export async function deletePlannedTrip(tripId: number | string): Promise<{ id: number }> {
  if (USE_MOCK) {
    const index = mockStore.findIndex((trip) => String(trip.id) === String(tripId));
    if (index < 0) throw new ApiError(404, 'Trip not found');
    const [removed] = mockStore.splice(index, 1);
    for (let i = mockSuggestions.length - 1; i >= 0; i -= 1) {
      if (String(mockSuggestions[i].tripId) === String(tripId)) {
        mockSuggestions.splice(i, 1);
      }
    }
    return { id: removed.id };
  }

  await apiClient.delete<null>(`/trips/${tripId}/`);
  return { id: Number(tripId) };
}

export async function updateTripRoute(input: UpdateRouteInput): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.route = input.route;
    // Движка маршрутизации у мока нет, а старая сводка описывает уже другие
    // точки: честнее отдать «сводки пока нет» (#1490).
    trip.routeSummary = null;
    return cloneTrip(trip);
  }
  try {
    // #1303: порядок нумеруется с единицы. Развёрнутый бэкенд подставляет вместо
    // falsy `order: 0` собственный номер (`order or index + 1`), поэтому первая
    // точка получала тот же order, что и вторая, и весь PUT падал на
    // `unique_together (trip, order)` — маршрут из двух и более точек не
    // сохранялся вовсе. Версия из origin/master клиентский order игнорирует и
    // нумерует сама с единицы, так что 1-based безопасен для обеих.
    const points = input.route.map((p, i) => ({
      place_id: p.placeId,
      point_type: pointTypeToBe(p.type),
      order: i + 1,
      title: p.name,
      description: p.description ?? '',
      lat: p.coordinates ? p.coordinates[1] : null,
      lng: p.coordinates ? p.coordinates[0] : null,
    }));
    const dto = await apiClient.put<PlannedTripDto>(
      `/trips/planned/${input.tripId}/route/`,
      { points },
    );
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] route → mock fallback');
      const trip = findMock(input.tripId);
      if (trip) {
        trip.route = input.route;
        trip.routeSummary = null;
        return cloneTrip(trip);
      }
    }
    throw error;
  }
}

export async function setRsvp(input: RsvpInput): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.myRsvp = input.rsvp;
    const me = trip.participants.find((p) => p.id === 0);
    if (me) me.rsvp = input.rsvp;
    else
      trip.participants.push({
        id: 0,
        name: i18nT('errorsStatic:api.plannedTrips.currentUser'),
        avatarUrl: null,
        rsvp: input.rsvp,
        role: 'participant',
      });
    return cloneTrip(trip);
  }
  try {
    const status = input.rsvp === 'declined' ? 'declined' : 'accepted';
    await apiClient.post(`/trips/planned/${input.tripId}/rsvp/`, { status });
    return fetchPlannedTrip(input.tripId);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] rsvp → mock fallback');
      const trip = findMock(input.tripId);
      if (trip) {
        trip.myRsvp = input.rsvp;
        return cloneTrip(trip);
      }
    }
    throw error;
  }
}

export async function inviteParticipants(input: InviteInput): Promise<{ invited: number }> {
  if (USE_MOCK) return { invited: input.userIds.length };
  try {
    const res = await apiClient.post<{ invited?: number }>(
      `/trips/planned/${input.tripId}/invite/`,
      { user_ids: input.userIds },
    );
    return { invited: res?.invited ?? input.userIds.length };
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[planned-trips] invite → mock fallback');
  }
  return { invited: input.userIds.length };
}

export async function suggestPoint(input: SuggestPointInput): Promise<TripSuggestion> {
  const mockResult = (): TripSuggestion => {
    mockIdSeq += 1;
    const suggestion: TripSuggestion = {
      id: mockIdSeq,
      tripId: input.tripId,
      author: { id: 0, name: i18nT('errorsStatic:api.plannedTrips.currentUser'), avatarUrl: null },
      point: { id: `s-${mockIdSeq}`, ...input.point },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    mockSuggestions.unshift(suggestion);
    return suggestion;
  };
  if (USE_MOCK) return mockResult();
  try {
    const coords = input.point.coordinates ?? null;
    const dto = await apiClient.post<TripSuggestionDto>(
      '/trip-route-suggestions/',
      {
        trip: input.tripId,
        point_type: pointTypeToBe(input.point.type),
        travel: input.point.placeId,
        title: input.point.name,
        description: input.point.description ?? '',
        lat: coords ? coords[1] : null,
        lng: coords ? coords[0] : null,
      },
    );
    return mapSuggestion(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] suggest → mock fallback');
      return mockResult();
    }
    throw error;
  }
}

export async function decideSuggestion(
  input: DecideSuggestionInput,
): Promise<{ id: number; status: SuggestionStatus }> {
  const status: SuggestionStatus =
    input.decision === 'approve' ? 'approved' : 'rejected';
  if (USE_MOCK) {
    const s = mockSuggestions.find((x) => x.id === input.suggestionId);
    if (s) s.status = status;
    return { id: input.suggestionId, status };
  }
  try {
    await apiClient.patch(`/trip-route-suggestions/${input.suggestionId}/`, {
      status,
      rejection_reason: '',
    });
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[planned-trips] decide-suggestion → mock fallback');
    const s = mockSuggestions.find((x) => x.id === input.suggestionId);
    if (s) s.status = status;
  }
  return { id: input.suggestionId, status };
}

export async function submitTripReport(input: SubmitReportInput): Promise<PlannedTrip> {
  const applyMock = (): PlannedTrip => {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.status = 'completed';
    trip.publishedToCommunity = input.publishToCommunity;
    trip.report = {
      summary: input.summary,
      photoUrls: input.photoUrls,
      gpxUrl: input.gpxUrl,
      visitedPlaceIds: input.visitedPlaceIds,
      published: input.publishToCommunity,
      publishedAt: input.publishToCommunity ? new Date().toISOString() : null,
    };
    return cloneTrip(trip);
  };
  if (USE_MOCK) return applyMock();
  try {
    const report = await apiClient.post<TripReportDto>(
      `/trips/${input.tripId}/complete/`,
      {
        summary: input.summary,
        visited_place_ids: input.visitedPlaceIds,
        publish_to_catalog: input.publishToCommunity,
      },
    );
    const trip = await fetchPlannedTrip(input.tripId);
    const published = !!report.published_route;
    return {
      ...trip,
      status: 'completed',
      publishedToCommunity: published,
      report: {
        summary: report.summary ?? input.summary,
        photoUrls: [],
        gpxUrl: report.published_route?.url ?? null,
        visitedPlaceIds: (report.visited_places ?? []).map((v) => v.id),
        published,
        publishedAt: report.published_at ?? null,
      },
    };
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] report → mock fallback');
      return applyMock();
    }
    throw error;
  }
}
