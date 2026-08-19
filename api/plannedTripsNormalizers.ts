import { translate as i18nT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { decodeEncodedPolyline } from '@/utils/encodedPolyline';
import { buildElevationProfile } from '@/utils/routeFileParser';
import { parseTripDateTime } from '@/utils/tripDateTime';
import type { ParsedRoutePoint } from '@/types/travelRoutes';
import type {
  PlannedTrip,
  RouteGeometry,
  RoutePoint,
  RoutePointType,
  RouteSummary,
  RouteTemplate,
  RoutingState,
  SuggestionStatus,
  TripParticipant,
  TripPerson,
  TripPlanStatus,
  TripRouteElevation,
  TripRouteSummaryStatus,
  TripRsvp,
  TripSuggestion,
  TripBikeType,
  TripTransport,
} from '@/api/plannedTripsTypes';

export interface Paginated<T> {
  total?: number;
  next_page_url?: string | null;
  data?: T[];
  results?: T[];
}

interface BeUser {
  id?: number | string | null;
  username?: string | null;
  avatar?: string | null;
}
type BeUserLike = BeUser | number | string | null | undefined;

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

export interface PlannedTripDto {
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
  bike_type?: string | null;
  created_at?: string | null;
}

export interface TripReportDto {
  id: number;
  trip?: number;
  summary?: string | null;
  visited_places?: Array<{ id: number; name?: string | null; slug?: string | null }>;
  published_route?: { type?: string; id?: number; url?: string } | null;
  published_at?: string | null;
}

export interface TripSuggestionDto {
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

export interface CommunityTripDto {
  id: number;
  owner: number;
  owner_profile?: ProfileField;
  title: string;
  description?: string | null;
  start_at?: string | null;
  transport_mode?: string | null;
  bike_type?: string | null;
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

/** GET/POST `/trips/{id}/route-summary/` — кэшированная сводка маршрута поездки. */
export interface TripRouteSummaryDto {
  trip?: number | string | null;
  distance_m?: number | string | null;
  duration_s?: number | string | null;
  ascent_m?: number | string | null;
  descent_m?: number | string | null;
  stops_count?: number | string | null;
  provider?: string | null;
  status?: string | null;
  geometry?: unknown;
  polyline?: string | null;
  bounds?: unknown;
  calculated_at?: string | null;
}

export interface RouteTemplateDto {
  id: number | string;
  title: string;
  description?: string | null;
  points_count?: number;
  duration_days?: number;
  tags?: string[];
  preview_image_url?: string | null;
}

export const unwrap = <T>(response: Paginated<T> | T[] | null | undefined): T[] =>
  Array.isArray(response) ? response : (response?.data ?? response?.results ?? []);

const currentUserId = (): number | null => {
  const raw = useAuthStore.getState().userId;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const isProfileObject = (profile: ProfileField | undefined): profile is ProfileObject =>
  typeof profile === 'object' && profile !== null;

const profileName = (profile: ProfileField | undefined, fallbackId?: number | null): string => {
  if (isProfileObject(profile) && profile.name?.trim()) return profile.name.trim();
  if (typeof profile === 'string' && profile.trim()) return profile.trim();
  return fallbackId != null
    ? `#${fallbackId}`
    : i18nT('errorsStatic:api.plannedTrips.participantFallback');
};

const mapProfile = (profile: ProfileField | undefined, fallbackId: number): TripPerson => ({
  id: isProfileObject(profile) && typeof profile.id === 'number' ? profile.id : fallbackId,
  name: profileName(profile, fallbackId),
  avatarUrl: isProfileObject(profile) ? (profile.avatar ?? null) : null,
});

const toOptionalNum = (value: number | string | null | undefined): number | null => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numberValue as number) ? (numberValue as number) : null;
};

const toNum = (value: number | string | null | undefined): number =>
  toOptionalNum(value) ?? 0;

const userIdFromBe = (user: BeUserLike): number | null => {
  if (typeof user === 'number' || typeof user === 'string') return toOptionalNum(user);
  if (user && typeof user === 'object') return toOptionalNum(user.id);
  return null;
};

const mapUser = (
  user: BeUserLike,
  fallbackId: number,
  fallbackName = i18nT('errorsStatic:api.plannedTrips.participantFallback'),
): TripPerson => {
  const id = userIdFromBe(user) ?? fallbackId;
  const username =
    user && typeof user === 'object' && typeof user.username === 'string'
      ? user.username.trim()
      : '';
  return {
    id,
    name: username || (Number.isFinite(id) && id > 0 ? `#${id}` : fallbackName),
    avatarUrl: user && typeof user === 'object' ? (user.avatar ?? null) : null,
  };
};

const TRANSPORT_FROM_BE: Record<string, TripTransport> = {
  car: 'car',
  motorcycle: 'car',
  bicycle: 'bike',
  walk: 'foot',
  public_transport: 'public',
  other: 'mixed',
};

const transportFromBe = (transport?: string | null): TripTransport =>
  (transport && TRANSPORT_FROM_BE[transport]) || 'car';

const TRANSPORT_TO_BE: Record<TripTransport, string> = {
  car: 'car',
  bike: 'bicycle',
  foot: 'walk',
  public: 'public_transport',
  mixed: 'other',
};

export const transportToBe = (transport: TripTransport): string =>
  TRANSPORT_TO_BE[transport] ?? 'car';

// Ключи совпадают с BIKE_TYPE_CHOICES бэка, поэтому маппинг — только валидация.
export const TRIP_BIKE_TYPES: TripBikeType[] = ['regular', 'road', 'mountain'];

export const isTripBikeType = (value: unknown): value is TripBikeType =>
  TRIP_BIKE_TYPES.some((bikeType) => bikeType === value);

// null означает «эндпоинт не отдаёт bike_type», а не «обычный велосипед»:
// подставленный дефолт молча гасил бы неприменённую миграцию на бэке.
export const bikeTypeFromBe = (bikeType?: string | null): TripBikeType | null =>
  (isTripBikeType(bikeType) ? bikeType : null);

const pointTypeFromBe = (pointType?: string | null): RoutePointType => {
  if (pointType === 'travel') return 'place';
  if (
    pointType === 'place' ||
    pointType === 'custom' ||
    pointType === 'rest' ||
    pointType === 'overnight'
  ) {
    return pointType;
  }
  return 'custom';
};

export const pointTypeToBe = (pointType: RoutePointType): string =>
  pointType === 'place' ? 'travel' : pointType;

const planStatusFromFacade = (status?: PlannedTripDto['status']): TripPlanStatus => {
  if (status === 'ongoing') return 'active';
  if (status === 'completed') return 'completed';
  return 'planning';
};

const baseStatusFromBe = (status?: string | null): TripPlanStatus => {
  if (status === 'active') return 'active';
  if (status === 'completed') return 'completed';
  return 'planning';
};

const RSVP_FROM_BE: Record<string, TripRsvp> = {
  pending: 'invited',
  accepted: 'going',
  declined: 'declined',
  invited: 'invited',
};

const participantRsvpFromBe = (status?: string | null): TripRsvp =>
  (status && RSVP_FROM_BE[status]) || 'invited';

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

const mapPlannedPoint = (point: BeRoutePoint, index: number): RoutePoint => {
  const lat = toOptionalNum(point.lat);
  const lng = toOptionalNum(point.lng);
  const placeId = toOptionalNum(point.place_id);
  const title = typeof point.title === 'string' ? point.title.trim() : '';
  return {
    id: point.id != null ? String(point.id) : `point-${index + 1}`,
    type: placeId != null ? 'place' : pointTypeFromBe(point.point_type),
    name:
      title ||
      i18nT('errorsStatic:api.plannedTrips.routePointFallback', { index: index + 1 }),
    description: point.description || null,
    coordinates: lat != null && lng != null ? [lng, lat] : null,
    placeId,
  };
};

const mapRouteSummary = (summary?: BeRouteSummary | null): RouteSummary | null =>
  summary
    ? {
        distanceKm: toNum(summary.distance_km),
        durationMin: Math.round(toNum(summary.duration_min)),
        elevationGainM: Math.round(toNum(summary.elevation_gain_m)),
        stopsCount: Math.round(toNum(summary.stops_count)),
        provider: summary.provider ?? undefined,
        updatedAt: summary.updated_at ?? null,
      }
    : null;

const mapRoutingState = (state?: BeRoutingState | null): RoutingState | null => {
  if (!state) return null;
  const provider =
    typeof state.provider === 'string' && state.provider.trim()
      ? state.provider.trim()
      : 'unknown';
  const warnings = Array.isArray(state.warnings)
    ? state.warnings
        .map((item) => {
          if (typeof item === 'string') return item;
          if (
            item &&
            typeof item === 'object' &&
            typeof (item as { code?: unknown }).code === 'string'
          ) {
            return (item as { code: string }).code;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item && item.trim()))
    : [];
  return {
    provider,
    isOptimal: state.is_optimal === true,
    fallbackReason:
      typeof state.fallback_reason === 'string' && state.fallback_reason.trim()
        ? state.fallback_reason.trim()
        : null,
    warnings,
  };
};

/**
 * Старт поездки в доменном виде: локальный календарный день + локальное время.
 * Бэк отдаёт ISO date-time со смещением, поэтому время больше не теряется, а
 * непрочитанное значение даёт пустую дату, а не сырую строку из payload (#1313).
 */
const tripStartFields = (raw: string | null | undefined): {
  startDate: string;
  startTime: string | null;
} => {
  const parsed = parseTripDateTime(raw);
  return { startDate: parsed?.date ?? '', startTime: parsed?.time ?? null };
};

export const mapTrip = (dto: PlannedTripDto): PlannedTrip => {
  const currentUser = currentUserId();
  const tripId = toNum(dto.id);
  const owner = mapUser(
    dto.owner,
    0,
    i18nT('errorsStatic:api.plannedTrips.organizerFallback'),
  );
  const points = Array.isArray(dto.route?.points) ? dto.route.points : [];
  const route = points.map(mapPlannedPoint);
  const transport = transportFromBe(dto.transport_mode);
  const rawParticipants = Array.isArray(dto.participants) ? dto.participants : [];
  const participants: TripParticipant[] = rawParticipants.map((participant, index) => {
    const person = mapUser(
      participant?.user,
      toOptionalNum(participant?.id) ?? index + 1,
    );
    return {
      ...person,
      rsvp: participantRsvpFromBe(participant?.status),
      role: person.id === owner.id ? 'organizer' : 'participant',
    };
  });
  const mine = rawParticipants.find(
    (participant) => userIdFromBe(participant?.user) === currentUser,
  );
  const title =
    typeof dto.title === 'string' && dto.title.trim()
      ? dto.title.trim()
      : i18nT('errorsStatic:api.plannedTrips.tripFallback', { id: tripId || dto.id });

  return {
    id: tripId,
    slug: String(dto.id),
    title,
    description: dto.description ?? '',
    ...tripStartFields(dto.start_date),
    transport,
    bikeType: bikeTypeFromBe(dto.bike_type),
    visibility: dto.is_public ? 'public' : 'private',
    seatsTotal: toNum(dto.max_participants),
    startPoint: null,
    status: planStatusFromFacade(dto.status),
    organizer: owner,
    route,
    routeGeometry: normalizeRouteGeometry(dto.route_geometry),
    // #1490: своей оценки расстояния/времени у клиента больше нет. Пока бэкенд
    // не посчитал сводку, её нет — конструктор в это время показывает цифры
    // живого превью от движка маршрутизации, а не выдуманные.
    routeSummary: mapRouteSummary(dto.route_summary),
    routingState: mapRoutingState(dto.routing_state),
    participants,
    coverUrl: dto.cover_url ?? dto.cover ?? dto.preview_image_url ?? null,
    region: '',
    publishedToCommunity: false,
    report: null,
    isOwner: currentUser != null && owner.id === currentUser,
    myRsvp: mine ? participantRsvpFromBe(mine.status) : null,
    createdAt: dto.created_at ?? dto.start_date ?? '',
  };
};

// ORS кодирует полилинию с точностью 5; при `elevation: true` в ней есть третье
// измерение — высота в метрах. Другой полилинии этот эндпоинт не отдаёт.
const ORS_POLYLINE_PRECISION = 5;

const decodeElevationPolyline = (
  polyline: string | null | undefined,
): Pick<TripRouteElevation, 'preview' | 'geometry'> => {
  if (typeof polyline !== 'string' || !polyline.trim()) {
    return { preview: null, geometry: null };
  }

  const decoded = decodeEncodedPolyline(polyline, {
    precision: ORS_POLYLINE_PRECISION,
    dimensions: 3,
  });
  const linePoints: ParsedRoutePoint[] = [];
  const geometry: RouteGeometry = [];

  for (const [lng, lat, elevation] of decoded) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    geometry.push([lng, lat]);
    linePoints.push(
      Number.isFinite(elevation)
        ? { coord: `${lat},${lng}`, elevation }
        : { coord: `${lat},${lng}` },
    );
  }

  if (geometry.length < 2) return { preview: null, geometry: null };

  // Профиль строится тем же билдером, что и треки travel details, поэтому
  // набор/сброс на графике совпадают с ascent_m/descent_m из ответа.
  const elevationProfile = buildElevationProfile(linePoints);
  return {
    preview: elevationProfile.length >= 2 ? { linePoints, elevationProfile } : null,
    geometry,
  };
};

const routeSummaryStatusFromBe = (status?: string | null): TripRouteSummaryStatus => {
  if (status === 'ready' || status === 'degraded') return status;
  return 'unavailable';
};

export const mapTripRouteElevation = (
  dto: TripRouteSummaryDto | null | undefined,
): TripRouteElevation => ({
  status: routeSummaryStatusFromBe(dto?.status),
  provider: (typeof dto?.provider === 'string' && dto.provider.trim()) || 'unknown',
  ascentM: toOptionalNum(dto?.ascent_m),
  descentM: toOptionalNum(dto?.descent_m),
  ...decodeElevationPolyline(dto?.polyline),
  calculatedAt: dto?.calculated_at ?? null,
});

export const mapSuggestion = (dto: TripSuggestionDto): TripSuggestion => ({
  id: dto.id,
  tripId: dto.trip,
  author: mapProfile(dto.author_profile, dto.author ?? 0),
  point: {
    id: String(dto.id),
    type: pointTypeFromBe(dto.point_type),
    name: dto.title ?? '',
    description: dto.description || null,
    coordinates: dto.lat != null && dto.lng != null ? [dto.lng, dto.lat] : null,
    placeId: dto.travel ?? null,
  },
  status: dto.status,
  createdAt: dto.created_at ?? '',
});

export const mapCommunityTrip = (dto: CommunityTripDto): PlannedTrip => {
  const currentUser = currentUserId();
  return {
    id: dto.id,
    slug: String(dto.id),
    title: dto.title,
    description: dto.description ?? '',
    ...tripStartFields(dto.start_at),
    transport: transportFromBe(dto.transport_mode),
    bikeType: bikeTypeFromBe(dto.bike_type),
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
    isOwner: dto.owner === currentUser,
    myRsvp: null,
    createdAt: dto.start_at ?? '',
  };
};

export const mapTemplate = (dto: RouteTemplateDto): RouteTemplate => ({
  id: String(dto.id),
  title: dto.title,
  description: dto.description ?? '',
  transport: 'car',
  points: [],
});
