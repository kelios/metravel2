// api/plannedTrips.ts
// Слой планирования поездок (Sprint 13 / блок D: «Планирование поездок и совместные
// выезды»). Это поездки, которые пользователь сам конструирует: форма создания,
// конструктор маршрута, RSVP участников, совместное редактирование, пост-отчёт.
// Не путать с api/publicTrips.ts — там каталог «Поехали со мной» (Sprint 14/E).
//
// Контракт зеркалит docs/features/social-trips-gamification-backlog.md. Пока бэкенд
// (BE-trip-model, BE-trip-route, BE-trip-routing, BE-trip-participants, BE-trip-coedit,
// BE-trip-report, BE-community-routes) не задеплоен — fetch/мутации отдают моки под
// флагом EXPO_PUBLIC_TRIPS_MOCK=true (или при 404/501/0 в DEV).

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';
import { haversineKm } from '@/utils/geo';
import {
  MOCK_PLANNED_TRIPS,
  MOCK_ROUTE_TEMPLATES,
  MOCK_TRIP_SUGGESTIONS,
  cloneTrip,
} from '@/api/plannedTripsMock';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

/** Способ передвижения поездки (влияет на оценку времени в пути). */
export type TripTransport = 'car' | 'bike' | 'foot' | 'public' | 'mixed';

/** Видимость поездки. */
export type TripVisibility = 'public' | 'followers' | 'private';

/** Жизненный цикл поездки. */
export type TripPlanStatus = 'planning' | 'active' | 'completed';

/** Тип точки маршрута. */
export type RoutePointType = 'place' | 'custom' | 'rest' | 'overnight';

/** Ответ участника на приглашение. */
export type TripRsvp = 'going' | 'maybe' | 'declined' | 'invited';

/** Решение организатора по предложенной точке. */
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface TripPerson {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface RoutePoint {
  id: string;
  type: RoutePointType;
  name: string;
  description: string | null;
  /** [lng, lat] в формате Metravel; null для точек без координаты. */
  coordinates: [number, number] | null;
  /** Ссылка на место/путешествие MeTravel (для type='place'). */
  placeId: number | null;
}

export interface RouteSummary {
  distanceKm: number;
  durationMin: number;
  elevationGainM: number;
  stopsCount: number;
}

export interface TripParticipant extends TripPerson {
  rsvp: TripRsvp;
  role: 'organizer' | 'participant';
}

export interface TripReport {
  summary: string;
  photoUrls: string[];
  gpxUrl: string | null;
  visitedPlaceIds: number[];
  published: boolean;
  publishedAt: string | null;
}

export interface PlannedTrip {
  id: number;
  slug: string;
  title: string;
  description: string;
  /** ISO-дата старта (YYYY-MM-DD). */
  startDate: string;
  /** Время старта HH:MM (опц.). */
  startTime: string | null;
  transport: TripTransport;
  visibility: TripVisibility;
  seatsTotal: number;
  startPoint: RoutePoint | null;
  status: TripPlanStatus;
  organizer: TripPerson;
  route: RoutePoint[];
  routeSummary: RouteSummary | null;
  participants: TripParticipant[];
  coverUrl: string | null;
  region: string;
  /** Опубликован ли маршрут в каталог сообщества (FE-community-routes). */
  publishedToCommunity: boolean;
  report: TripReport | null;
  isOwner: boolean;
  /** RSVP текущего пользователя (если он участник). */
  myRsvp: TripRsvp | null;
  createdAt: string;
}

export interface RouteTemplate {
  id: string;
  title: string;
  description: string;
  transport: TripTransport;
  points: Array<Omit<RoutePoint, 'id'>>;
}

export interface TripSuggestion {
  id: number;
  tripId: number;
  author: TripPerson;
  point: RoutePoint;
  status: SuggestionStatus;
  createdAt: string;
}

export interface CommunityTripsFilters {
  transport?: TripTransport;
  region?: string;
  /** Минимальная длина маршрута, км. */
  minDistanceKm?: number;
  maxDistanceKm?: number;
}

// ── Инпуты мутаций ──────────────────────────────────────────────────────────

export interface CreateTripInput {
  title: string;
  description: string;
  startDate: string;
  startTime: string | null;
  transport: TripTransport;
  visibility: TripVisibility;
  seatsTotal: number;
  startPoint: RoutePoint | null;
}

export interface UpdateRouteInput {
  tripId: number;
  route: RoutePoint[];
}

export interface RsvpInput {
  tripId: number;
  rsvp: TripRsvp;
}

export interface InviteInput {
  tripId: number;
  userIds: number[];
}

export interface SuggestPointInput {
  tripId: number;
  point: Omit<RoutePoint, 'id'>;
}

export interface DecideSuggestionInput {
  tripId: number;
  suggestionId: number;
  decision: 'approve' | 'reject';
}

export interface SubmitReportInput {
  tripId: number;
  summary: string;
  photoUrls: string[];
  gpxUrl: string | null;
  visitedPlaceIds: number[];
  publishToCommunity: boolean;
}

// ── Транспортные скорости для оценки времени (мок-routing) ──────────────────

const TRANSPORT_SPEED_KMH: Record<TripTransport, number> = {
  car: 60,
  bike: 16,
  foot: 4.5,
  public: 30,
  mixed: 35,
};

/**
 * Оценка сводки маршрута без бэкенд-роутинга (BE-trip-routing #routing).
 * Дистанция — сумма haversine между точками с координатами; время — по скорости
 * транспорта; набор высоты — эвристика; остановки — все точки кроме старта.
 * Используется и в мок-фолбэке, и как мгновенный предпросмотр в конструкторе.
 */
export function estimateRouteSummary(
  route: RoutePoint[],
  transport: TripTransport,
): RouteSummary {
  const pts = route.filter((p) => p.coordinates);
  let distanceKm = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const [aLng, aLat] = pts[i - 1].coordinates as [number, number];
    const [bLng, bLat] = pts[i].coordinates as [number, number];
    distanceKm += haversineKm(aLat, aLng, bLat, bLng);
  }
  distanceKm = Math.round(distanceKm * 10) / 10;
  const speed = TRANSPORT_SPEED_KMH[transport] ?? 35;
  const durationMin = Math.round((distanceKm / speed) * 60);
  // Грубая эвристика набора высоты для предпросмотра (~8 м/км).
  const elevationGainM = Math.round(distanceKm * 8);
  const stopsCount = Math.max(route.length - 1, 0);
  return { distanceKm, durationMin, elevationGainM, stopsCount };
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface PersonDto {
  id: number;
  name: string;
  avatar?: string | null;
}

interface RoutePointDto {
  id: string;
  type: RoutePointType;
  name: string;
  description?: string | null;
  coordinates?: [number, number] | null;
  place_id?: number | null;
}

interface RouteSummaryDto {
  distance_km: number;
  duration_min: number;
  elevation_gain_m: number;
  stops_count: number;
}

interface ParticipantDto extends PersonDto {
  rsvp: TripRsvp;
  role: 'organizer' | 'participant';
}

interface TripReportDto {
  summary?: string;
  photo_urls?: string[];
  gpx_url?: string | null;
  visited_place_ids?: number[];
  published?: boolean;
  published_at?: string | null;
}

interface PlannedTripDto {
  id: number;
  slug?: string;
  title: string;
  description?: string;
  start_date: string;
  start_time?: string | null;
  transport: TripTransport;
  visibility: TripVisibility;
  seats_total: number;
  start_point?: RoutePointDto | null;
  status: TripPlanStatus;
  organizer: PersonDto;
  route?: RoutePointDto[];
  route_summary?: RouteSummaryDto | null;
  participants?: ParticipantDto[];
  cover_url?: string | null;
  region?: string;
  published_to_community?: boolean;
  report?: TripReportDto | null;
  is_owner?: boolean;
  my_rsvp?: TripRsvp | null;
  created_at: string;
}

interface TripSuggestionDto {
  id: number;
  trip_id: number;
  author: PersonDto;
  point: RoutePointDto;
  status: SuggestionStatus;
  created_at: string;
}

// ── Мапперы ─────────────────────────────────────────────────────────────────

const mapPerson = (dto: PersonDto): TripPerson => ({
  id: dto.id,
  name: dto.name,
  avatarUrl: dto.avatar ?? null,
});

const mapPoint = (dto: RoutePointDto): RoutePoint => ({
  id: dto.id,
  type: dto.type,
  name: dto.name,
  description: dto.description ?? null,
  coordinates: dto.coordinates ?? null,
  placeId: dto.place_id ?? null,
});

const mapSummary = (dto: RouteSummaryDto): RouteSummary => ({
  distanceKm: dto.distance_km,
  durationMin: dto.duration_min,
  elevationGainM: dto.elevation_gain_m,
  stopsCount: dto.stops_count,
});

const mapParticipant = (dto: ParticipantDto): TripParticipant => ({
  ...mapPerson(dto),
  rsvp: dto.rsvp,
  role: dto.role,
});

const mapReport = (dto: TripReportDto): TripReport => ({
  summary: dto.summary ?? '',
  photoUrls: dto.photo_urls ?? [],
  gpxUrl: dto.gpx_url ?? null,
  visitedPlaceIds: dto.visited_place_ids ?? [],
  published: dto.published ?? false,
  publishedAt: dto.published_at ?? null,
});

const mapTrip = (dto: PlannedTripDto): PlannedTrip => ({
  id: dto.id,
  slug: dto.slug ?? String(dto.id),
  title: dto.title,
  description: dto.description ?? '',
  startDate: dto.start_date,
  startTime: dto.start_time ?? null,
  transport: dto.transport,
  visibility: dto.visibility,
  seatsTotal: dto.seats_total,
  startPoint: dto.start_point ? mapPoint(dto.start_point) : null,
  status: dto.status,
  organizer: mapPerson(dto.organizer),
  route: (dto.route ?? []).map(mapPoint),
  routeSummary: dto.route_summary ? mapSummary(dto.route_summary) : null,
  participants: (dto.participants ?? []).map(mapParticipant),
  coverUrl: dto.cover_url ?? null,
  region: dto.region ?? '',
  publishedToCommunity: dto.published_to_community ?? false,
  report: dto.report ? mapReport(dto.report) : null,
  isOwner: dto.is_owner ?? false,
  myRsvp: dto.my_rsvp ?? null,
  createdAt: dto.created_at,
});

const mapSuggestion = (dto: TripSuggestionDto): TripSuggestion => ({
  id: dto.id,
  tripId: dto.trip_id,
  author: mapPerson(dto.author),
  point: mapPoint(dto.point),
  status: dto.status,
  createdAt: dto.created_at,
});

// ── Мок-фолбэк ───────────────────────────────────────────────────────────────

const USE_MOCK = process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true';

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

/** Поездки, где текущий пользователь организатор или участник. */
export async function fetchMyPlannedTrips(): Promise<PlannedTrip[]> {
  if (USE_MOCK) return mockStore.map(cloneTrip);
  try {
    const dto = await apiClient.get<PlannedTripDto[]>('/trips/planned/me/');
    return (dto ?? []).map(mapTrip);
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

/** Каталог опубликованных маршрутов сообщества (FE-community-routes). */
export async function fetchCommunityTrips(
  filters?: CommunityTripsFilters,
): Promise<PlannedTrip[]> {
  if (USE_MOCK) {
    return mockStore.filter((t) => matchesCommunity(t, filters)).map(cloneTrip);
  }
  try {
    const params = new URLSearchParams();
    if (filters?.transport) params.set('transport', filters.transport);
    if (filters?.region) params.set('region', filters.region);
    if (filters?.minDistanceKm != null)
      params.set('min_distance_km', String(filters.minDistanceKm));
    if (filters?.maxDistanceKm != null)
      params.set('max_distance_km', String(filters.maxDistanceKm));
    const qs = params.toString();
    const dto = await apiClient.get<PlannedTripDto[]>(
      `/trips/community/${qs ? `?${qs}` : ''}`,
      undefined,
      { skipAuth: true },
    );
    return (dto ?? []).map(mapTrip);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] community → mock fallback');
      return mockStore.filter((t) => matchesCommunity(t, filters)).map(cloneTrip);
    }
    throw error;
  }
}

export async function fetchRouteTemplates(): Promise<RouteTemplate[]> {
  if (USE_MOCK) return MOCK_ROUTE_TEMPLATES;
  try {
    const dto = await apiClient.get<RouteTemplate[]>('/trips/route-templates/', undefined, {
      skipAuth: true,
    });
    return dto ?? MOCK_ROUTE_TEMPLATES;
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
    const dto = await apiClient.get<TripSuggestionDto[]>(
      `/trips/planned/${tripId}/suggestions/`,
    );
    return (dto ?? []).map(mapSuggestion);
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
    visibility: input.visibility,
    seatsTotal: input.seatsTotal,
    startPoint: input.startPoint,
    status: 'planning',
    organizer: { id: 0, name: 'Вы', avatarUrl: null },
    route: input.startPoint ? [input.startPoint] : [],
    routeSummary: null,
    participants: [
      { id: 0, name: 'Вы', avatarUrl: null, rsvp: 'going', role: 'organizer' },
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

const toPointDto = (p: RoutePoint): RoutePointDto => ({
  id: p.id,
  type: p.type,
  name: p.name,
  description: p.description,
  coordinates: p.coordinates,
  place_id: p.placeId,
});

export async function createTrip(input: CreateTripInput): Promise<PlannedTrip> {
  const body = {
    title: input.title,
    description: input.description,
    start_date: input.startDate,
    start_time: input.startTime,
    transport: input.transport,
    visibility: input.visibility,
    seats_total: input.seatsTotal,
    start_point: input.startPoint ? toPointDto(input.startPoint) : null,
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

export async function updateTripRoute(input: UpdateRouteInput): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.route = input.route;
    trip.routeSummary = estimateRouteSummary(input.route, trip.transport);
    return cloneTrip(trip);
  }
  try {
    const dto = await apiClient.put<PlannedTripDto>(
      `/trips/planned/${input.tripId}/route/`,
      { route: input.route.map(toPointDto) },
    );
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] route → mock fallback');
      const trip = findMock(input.tripId);
      if (trip) {
        trip.route = input.route;
        trip.routeSummary = estimateRouteSummary(input.route, trip.transport);
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
        name: 'Вы',
        avatarUrl: null,
        rsvp: input.rsvp,
        role: 'participant',
      });
    return cloneTrip(trip);
  }
  try {
    const dto = await apiClient.post<PlannedTripDto>(
      `/trips/planned/${input.tripId}/rsvp/`,
      { rsvp: input.rsvp },
    );
    return mapTrip(dto);
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
    await apiClient.post(`/trips/planned/${input.tripId}/invite/`, {
      user_ids: input.userIds,
    });
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
      author: { id: 0, name: 'Вы', avatarUrl: null },
      point: { id: `s-${mockIdSeq}`, ...input.point },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    mockSuggestions.unshift(suggestion);
    return suggestion;
  };
  if (USE_MOCK) return mockResult();
  try {
    const dto = await apiClient.post<TripSuggestionDto>(
      `/trips/planned/${input.tripId}/suggestions/`,
      { point: { ...input.point, place_id: input.point.placeId } },
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
    await apiClient.post(
      `/trips/planned/${input.tripId}/suggestions/${input.suggestionId}/${input.decision}/`,
      {},
    );
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error;
    devWarn('[planned-trips] decide-suggestion → mock fallback');
    const s = mockSuggestions.find((x) => x.id === input.suggestionId);
    if (s) s.status = status;
  }
  return { id: input.suggestionId, status };
}

export async function submitTripReport(input: SubmitReportInput): Promise<PlannedTrip> {
  const body = {
    summary: input.summary,
    photo_urls: input.photoUrls,
    gpx_url: input.gpxUrl,
    visited_place_ids: input.visitedPlaceIds,
    publish_to_community: input.publishToCommunity,
  };
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
    const dto = await apiClient.post<PlannedTripDto>(
      `/trips/planned/${input.tripId}/report/`,
      body,
    );
    return mapTrip(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[planned-trips] report → mock fallback');
      return applyMock();
    }
    throw error;
  }
}
