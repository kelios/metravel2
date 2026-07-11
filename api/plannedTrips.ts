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
  provider?: 'backend' | 'fallback' | 'ors' | 'direct' | string;
  updatedAt?: string | null;
}

export type RouteGeometry = [number, number][];

export interface RoutingState {
  provider: string;
  isOptimal: boolean;
  fallbackReason: string | null;
  warnings: string[];
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
  /** Routed track coordinates in Metravel format: [lng, lat]. */
  routeGeometry: RouteGeometry | null;
  routeSummary: RouteSummary | null;
  routingState: RoutingState | null;
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

export interface UpdateTripInput {
  tripId: number;
  title: string;
  description: string;
  startDate: string;
  startTime: string | null;
  transport: TripTransport;
  visibility: TripVisibility;
  seatsTotal: number;
  coverUrl: string | null;
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
  id?: number | string | null;
  username?: string | null;
  avatar?: string | null;
}
type BeUserLike = BeUser | number | string | null | undefined;

/** Профиль автора в trip-route-suggestions / public-trips (*_profile). */
interface ProfileObject {
  id?: number;
  name?: string | null;
  avatar?: string | null;
}
type ProfileField = ProfileObject | string | null;

interface BeRoutePoint {
  id?: number | string | null;
  place_id?: number | string | null;
  point_type?: string | null;
  order?: number;
  lat?: number | string | null;
  lng?: number | string | null;
  title?: string | null;
  description?: string | null;
}

interface BeRouteSummary {
  distance_km?: number | string | null;
  duration_min?: number | string | null;
  elevation_gain_m?: number | string | null;
  stops_count?: number | string | null;
  provider?: string | null;
  updated_at?: string | null;
}

interface BeRoutingState {
  provider?: string | null;
  is_optimal?: boolean | null;
  fallback_reason?: string | null;
  warnings?: unknown;
}

interface BeParticipant {
  id?: number | string | null;
  user?: BeUserLike;
  status?: 'pending' | 'accepted' | 'declined' | string | null;
}

/** PlannedTripSerializer (GET /trips/planned/me|{id}, POST /trips/planned/, PUT .../route/). */
interface PlannedTripDto {
  id: number | string;
  title?: string | null;
  description?: string | null;
  cover_url?: string | null;
  cover?: string | null;
  preview_image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: 'draft' | 'planned' | 'ongoing' | 'completed' | string | null;
  owner?: BeUserLike;
  participants?: BeParticipant[] | null;
  route?: { points?: BeRoutePoint[] | null } | null;
  route_geometry?: unknown;
  route_summary?: BeRouteSummary | null;
  routing_state?: BeRoutingState | null;
  is_public?: boolean;
  max_participants?: number | string | null;
  transport_mode?: string | null;
  created_at?: string | null;
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

const userIdFromBe = (u: BeUserLike): number | null => {
  if (typeof u === 'number' || typeof u === 'string') return toOptionalNum(u);
  if (u && typeof u === 'object') return toOptionalNum(u.id);
  return null;
};

const mapUser = (
  u: BeUserLike,
  fallbackId: number,
  fallbackName = 'Участник',
): TripPerson => {
  const id = userIdFromBe(u) ?? fallbackId;
  const username =
    u && typeof u === 'object' && typeof u.username === 'string'
      ? u.username.trim()
      : '';
  return {
    id,
    name: username || (Number.isFinite(id) && id > 0 ? `#${id}` : fallbackName),
    avatarUrl: u && typeof u === 'object' ? (u.avatar ?? null) : null,
  };
};

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

const pointTypeFromBe = (t?: string | null): RoutePointType => {
  if (t === 'travel') return 'place';
  if (t === 'place' || t === 'custom' || t === 'rest' || t === 'overnight') {
    return t;
  }
  return 'custom';
};

const pointTypeToBe = (t: RoutePointType): string =>
  t === 'place' ? 'travel' : t;

/** PlannedTripSerializer.status → доменный TripPlanStatus. */
const planStatusFromFacade = (
  s?: PlannedTripDto['status'],
): TripPlanStatus => {
  if (s === 'ongoing') return 'active';
  if (s === 'completed') return 'completed';
  return 'planning'; // draft | planned
};

/** Базовый Trip.status (public-trips) → доменный TripPlanStatus. */
const baseStatusFromBe = (
  s?: string | null,
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

const toOptionalNum = (v: number | string | null | undefined): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : null;
};

const normalizeRouteGeometry = (value: unknown): RouteGeometry | null => {
  if (!Array.isArray(value)) return null;
  const points: RouteGeometry = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const lng = Number(item[0]);
    const lat = Number(item[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    points.push([lng, lat]);
  }
  return points.length >= 2 ? points : null;
};

// ── Мапперы DTO → домен ─────────────────────────────────────────────────────

const mapPlannedPoint = (p: BeRoutePoint, index: number): RoutePoint => {
  const lat = toOptionalNum(p.lat);
  const lng = toOptionalNum(p.lng);
  const placeId = toOptionalNum(p.place_id);
  const title = typeof p.title === 'string' ? p.title.trim() : '';
  return {
    id: p.id != null ? String(p.id) : `point-${index + 1}`,
    type: placeId != null ? 'place' : pointTypeFromBe(p.point_type),
    name: title || `Точка ${index + 1}`,
    description: p.description || null,
    coordinates: lat != null && lng != null ? [lng, lat] : null,
    placeId,
  };
};

const mapRouteSummary = (summary?: BeRouteSummary | null): RouteSummary | null => {
  if (!summary) return null;

  return {
    distanceKm: toNum(summary.distance_km),
    durationMin: Math.round(toNum(summary.duration_min)),
    elevationGainM: Math.round(toNum(summary.elevation_gain_m)),
    stopsCount: Math.round(toNum(summary.stops_count)),
    provider: summary.provider ?? undefined,
    updatedAt: summary.updated_at ?? null,
  };
};

const mapRoutingState = (state?: BeRoutingState | null): RoutingState | null => {
  if (!state) return null;
  const provider = typeof state.provider === 'string' && state.provider.trim()
    ? state.provider.trim()
    : 'unknown';
  // БЭК шлёт warnings и строками, и объектами {code, message} (routing/services.py) —
  // нормализуем к кодам, человеческий текст собирает routingStateHint.
  const warnings = Array.isArray(state.warnings)
    ? state.warnings
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && typeof (item as { code?: unknown }).code === 'string') {
            return (item as { code: string }).code;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item && item.trim()))
    : [];
  return {
    provider,
    isOptimal: state.is_optimal === true,
    fallbackReason: typeof state.fallback_reason === 'string' && state.fallback_reason.trim()
      ? state.fallback_reason.trim()
      : null,
    warnings,
  };
};

const mapTrip = (dto: PlannedTripDto): PlannedTrip => {
  const me = currentUserId();
  const tripId = toNum(dto.id);
  const owner = mapUser(dto.owner, 0, 'Организатор');
  const points = Array.isArray(dto.route?.points) ? dto.route.points : [];
  const route = points.map(mapPlannedPoint);
  const transport = transportFromBe(dto.transport_mode);
  const routeGeometry = normalizeRouteGeometry(dto.route_geometry);
  const rawParticipants = Array.isArray(dto.participants) ? dto.participants : [];
  const participants: TripParticipant[] = rawParticipants.map((p, index) => {
    const participant = mapUser(p?.user, toOptionalNum(p?.id) ?? index + 1);
    return {
      ...participant,
      rsvp: participantRsvpFromBe(p?.status),
      role: participant.id === owner.id ? 'organizer' : 'participant',
    };
  });
  const mine = rawParticipants.find((p) => userIdFromBe(p?.user) === me);
  const title = typeof dto.title === 'string' && dto.title.trim()
    ? dto.title.trim()
    : `Поездка #${tripId || dto.id}`;
  return {
    id: tripId,
    slug: String(dto.id),
    title,
    description: dto.description ?? '',
    startDate: dto.start_date ?? '',
    startTime: null,
    transport,
    visibility: dto.is_public ? 'public' : 'private',
    seatsTotal: toNum(dto.max_participants),
    startPoint: null,
    status: planStatusFromFacade(dto.status),
    organizer: owner,
    route,
    routeGeometry,
    routeSummary:
      mapRouteSummary(dto.route_summary) ??
      (route.length ? estimateRouteSummary(route, transport) : null),
    routingState: mapRoutingState(dto.routing_state),
    participants,
    coverUrl: dto.cover_url ?? dto.cover ?? dto.preview_image_url ?? null,
    region: '',
    publishedToCommunity: false,
    report: null,
    isOwner: me != null && owner.id === me,
    myRsvp: mine ? participantRsvpFromBe(mine.status) : null,
    createdAt: dto.created_at ?? dto.start_date ?? '',
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
    routeGeometry: null,
    routeSummary: null,
    routingState: null,
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
    routeGeometry: null,
    routeSummary: null,
    routingState: null,
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

export async function updatePlannedTrip(input: UpdateTripInput): Promise<PlannedTrip> {
  const body = {
    title: input.title,
    description: input.description,
    start_date: `${input.startDate}T${input.startTime || '09:00'}:00`,
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
    trip.routeSummary = trip.route.length ? estimateRouteSummary(trip.route, input.transport) : null;
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
        trip.routeSummary = trip.route.length ? estimateRouteSummary(trip.route, input.transport) : null;
        return cloneTrip(trip);
      }
    }
    throw error;
  }
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
