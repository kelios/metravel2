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
import { useAuthStore } from '@/stores/authStore';
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
  createTelegramGroup?: boolean;
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

// ── DTO (snake_case с бэка, сверено с дев-сервером) ─────────────────────────

/** Обёртка DRF-пагинации (часть списков пагинированы, часть — bare arrays). */
interface Paginated<T> {
  total?: number;
  next_page_url?: string | null;
  data?: T[];
  results?: T[];
}

/** Вложенный owner/user в PlannedTripSerializer. */
interface BeUser {
  id: number;
  username?: string | null;
  avatar?: string | null;
}

/** Профиль автора в trip-route-suggestions / public-trips (*_profile). */
interface ProfileObject {
  id?: number;
  name?: string | null;
  avatar?: string | null;
}
type ProfileField = ProfileObject | string | null;

interface BeRoutePoint {
  id: number;
  place_id?: number | null;
  order?: number;
  lat?: number | null;
  lng?: number | null;
  title?: string | null;
}

interface BeParticipant {
  id: number;
  user: BeUser;
  status: 'pending' | 'accepted' | 'declined';
}

/** PlannedTripSerializer (GET /trips/planned/me|{id}, POST /trips/planned/, PUT .../route/). */
interface PlannedTripDto {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'draft' | 'planned' | 'ongoing' | 'completed';
  owner: BeUser;
  participants?: BeParticipant[];
  route?: { points?: BeRoutePoint[] } | null;
  is_public?: boolean;
  max_participants?: number | null;
}

/** TripReportSerializer (POST /trips/{id}/complete/). */
interface TripReportDto {
  id: number;
  trip?: number;
  summary?: string | null;
  visited_places?: Array<{ id: number; name?: string | null; slug?: string | null }>;
  published_route?: { type?: string; id?: number; url?: string } | null;
  published_at?: string | null;
}

/** Coedit-предложение точки (GET/POST/PATCH /trip-route-suggestions/). */
interface TripSuggestionDto {
  id: number;
  trip: number;
  author?: number | null;
  author_profile?: ProfileField;
  point_type?: RoutePointType | string | null;
  travel?: number | null;
  travel_title?: string | null;
  title?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: SuggestionStatus;
  created_at?: string | null;
}

/** PublicTripCatalogSerializer (GET /public-trips/?content_type=community_route). */
interface CommunityTripDto {
  id: number;
  owner: number;
  owner_profile?: ProfileField;
  title: string;
  description?: string | null;
  start_at?: string | null;
  transport_mode?: string | null;
  content_type?: string | null;
  is_public?: boolean;
  seats_count?: number | null;
  start_point_name?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  status?: 'planned' | 'active' | 'completed' | null;
  featured?: boolean;
  catalog_status?: string | null;
  going_participants_count?: number | string | null;
  available_seats?: number | string | null;
}

/** RouteTemplateSerializer (GET /trips/route-templates/, bare array, без points). */
interface RouteTemplateDto {
  id: number | string;
  title: string;
  description?: string | null;
  points_count?: number;
  duration_days?: number;
  tags?: string[];
  preview_image_url?: string | null;
}

// ── Хелперы ─────────────────────────────────────────────────────────────────

/** Часть списков пагинированы ({data|results}), часть — bare arrays. */
const unwrap = <T>(res: Paginated<T> | T[] | null | undefined): T[] =>
  Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);

/** Текущий пользователь из authStore (string|null → number|null). */
const currentUserId = (): number | null => {
  const raw = useAuthStore.getState().userId;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const isProfileObject = (p: ProfileField | undefined): p is ProfileObject =>
  typeof p === 'object' && p !== null;

const profileName = (
  p: ProfileField | undefined,
  fallbackId?: number | null,
): string => {
  if (isProfileObject(p) && p.name?.trim()) return p.name.trim();
  if (typeof p === 'string' && p.trim()) return p.trim();
  return fallbackId != null ? `#${fallbackId}` : 'Участник';
};

const profileAvatar = (p: ProfileField | undefined): string | null =>
  isProfileObject(p) ? (p.avatar ?? null) : null;

const profileId = (p: ProfileField | undefined, fallback: number): number =>
  isProfileObject(p) && typeof p.id === 'number' ? p.id : fallback;

const mapProfile = (
  p: ProfileField | undefined,
  fallbackId: number,
): TripPerson => ({
  id: profileId(p, fallbackId),
  name: profileName(p, fallbackId),
  avatarUrl: profileAvatar(p),
});

const mapUser = (u: BeUser): TripPerson => ({
  id: u.id,
  name: u.username ?? `#${u.id}`,
  avatarUrl: u.avatar ?? null,
});

// ── Маппинг enum'ов BE ↔ домен ──────────────────────────────────────────────

const TRANSPORT_FROM_BE: Record<string, TripTransport> = {
  car: 'car',
  motorcycle: 'car',
  bicycle: 'bike',
  walk: 'foot',
  public_transport: 'public',
  other: 'mixed',
};
const transportFromBe = (t?: string | null): TripTransport =>
  (t && TRANSPORT_FROM_BE[t]) || 'car';

const TRANSPORT_TO_BE: Record<TripTransport, string> = {
  car: 'car',
  bike: 'bicycle',
  foot: 'walk',
  public: 'public_transport',
  mixed: 'other',
};
const transportToBe = (t: TripTransport): string => TRANSPORT_TO_BE[t] ?? 'car';

const pointTypeFromBe = (t?: string | null): RoutePointType =>
  t === 'travel' ? 'place' : ((t as RoutePointType) ?? 'custom');

const pointTypeToBe = (t: RoutePointType): string =>
  t === 'place' ? 'travel' : t;

/** PlannedTripSerializer.status → доменный TripPlanStatus. */
const planStatusFromFacade = (
  s: PlannedTripDto['status'],
): TripPlanStatus => {
  if (s === 'ongoing') return 'active';
  if (s === 'completed') return 'completed';
  return 'planning'; // draft | planned
};

/** Базовый Trip.status (public-trips) → доменный TripPlanStatus. */
const baseStatusFromBe = (
  s?: 'planned' | 'active' | 'completed' | null,
): TripPlanStatus => {
  if (s === 'active') return 'active';
  if (s === 'completed') return 'completed';
  return 'planning';
};

const RSVP_FROM_BE: Record<string, TripRsvp> = {
  pending: 'invited',
  accepted: 'going',
  declined: 'declined',
  invited: 'invited',
};
const participantRsvpFromBe = (s?: string | null): TripRsvp =>
  (s && RSVP_FROM_BE[s]) || 'invited';

const toNum = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
};

// ── Мапперы DTO → домен ─────────────────────────────────────────────────────

const mapPlannedPoint = (p: BeRoutePoint): RoutePoint => ({
  id: String(p.id),
  type: p.place_id != null ? 'place' : 'custom',
  name: p.title ?? '',
  description: null,
  coordinates:
    p.lat != null && p.lng != null ? [p.lng, p.lat] : null,
  placeId: p.place_id ?? null,
});

const mapTrip = (dto: PlannedTripDto): PlannedTrip => {
  const me = currentUserId();
  const points = dto.route?.points ?? [];
  const route = points.map(mapPlannedPoint);
  const participants: TripParticipant[] = (dto.participants ?? []).map((p) => ({
    ...mapUser(p.user),
    rsvp: participantRsvpFromBe(p.status),
    role: p.user.id === dto.owner.id ? 'organizer' : 'participant',
  }));
  const mine = (dto.participants ?? []).find((p) => p.user.id === me);
  return {
    id: dto.id,
    slug: String(dto.id),
    title: dto.title,
    description: dto.description ?? '',
    startDate: dto.start_date ?? '',
    startTime: null,
    transport: 'car',
    visibility: dto.is_public ? 'public' : 'private',
    seatsTotal: dto.max_participants ?? 0,
    startPoint: null,
    status: planStatusFromFacade(dto.status),
    organizer: mapUser(dto.owner),
    route,
    routeSummary: route.length ? estimateRouteSummary(route, 'car') : null,
    participants,
    coverUrl: null,
    region: '',
    publishedToCommunity: false,
    report: null,
    isOwner: dto.owner.id === me,
    myRsvp: mine ? participantRsvpFromBe(mine.status) : null,
    createdAt: dto.start_date ?? '',
  };
};

const mapSuggestion = (dto: TripSuggestionDto): TripSuggestion => ({
  id: dto.id,
  tripId: dto.trip,
  author: mapProfile(dto.author_profile, dto.author ?? 0),
  point: {
    id: String(dto.id),
    type: pointTypeFromBe(dto.point_type),
    name: dto.title ?? '',
    description: dto.description || null,
    coordinates:
      dto.lat != null && dto.lng != null ? [dto.lng, dto.lat] : null,
    placeId: dto.travel ?? null,
  },
  status: dto.status,
  createdAt: dto.created_at ?? '',
});

/** PublicTripCatalog (community_route) → PlannedTrip (best-effort). */
const mapCommunityTrip = (dto: CommunityTripDto): PlannedTrip => {
  const me = currentUserId();
  return {
    id: dto.id,
    slug: String(dto.id),
    title: dto.title,
    description: dto.description ?? '',
    startDate: dto.start_at ?? '',
    startTime: null,
    transport: transportFromBe(dto.transport_mode),
    visibility: dto.is_public ? 'public' : 'private',
    seatsTotal: toNum(dto.seats_count),
    startPoint: null,
    status: baseStatusFromBe(dto.status),
    organizer: mapProfile(dto.owner_profile, dto.owner),
    route: [],
    routeSummary: null,
    participants: [],
    coverUrl: null,
    region: dto.start_point_name ?? '',
    publishedToCommunity: true,
    report: null,
    isOwner: dto.owner === me,
    myRsvp: null,
    createdAt: dto.start_at ?? '',
  };
};

const mapTemplate = (dto: RouteTemplateDto): RouteTemplate => ({
  id: String(dto.id),
  title: dto.title,
  description: dto.description ?? '',
  transport: 'car',
  points: [],
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

export async function fetchRouteTemplates(): Promise<RouteTemplate[]> {
  if (USE_MOCK) return MOCK_ROUTE_TEMPLATES;
  try {
    const res = await apiClient.get<RouteTemplateDto[]>(
      '/trips/route-templates/',
      undefined,
      { skipAuth: true },
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

export async function createTrip(input: CreateTripInput): Promise<PlannedTrip> {
  const coords = input.startPoint?.coordinates ?? null;
  const body = {
    title: input.title,
    description: input.description,
    start_date: `${input.startDate}T${input.startTime || '09:00'}:00`,
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

export async function updateTripRoute(input: UpdateRouteInput): Promise<PlannedTrip> {
  if (USE_MOCK) {
    const trip = findMock(input.tripId);
    if (!trip) throw new ApiError(404, 'Trip not found');
    trip.route = input.route;
    trip.routeSummary = estimateRouteSummary(input.route, trip.transport);
    return cloneTrip(trip);
  }
  try {
    const points = input.route.map((p, i) => ({
      place_id: p.placeId,
      point_type: pointTypeToBe(p.type),
      order: i,
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
