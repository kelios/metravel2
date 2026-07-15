import { translate as i18nT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { haversineKm } from '@/utils/geo';
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
  TripRsvp,
  TripSuggestion,
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

export interface RouteTemplateDto {
  id: number | string;
  title: string;
  description?: string | null;
  points_count?: number;
  duration_days?: number;
  tags?: string[];
  preview_image_url?: string | null;
}

const TRANSPORT_SPEED_KMH: Record<TripTransport, number> = {
  car: 60,
  bike: 16,
  foot: 4.5,
  public: 30,
  mixed: 35,
};

export function estimateRouteSummary(
  route: RoutePoint[],
  transport: TripTransport,
): RouteSummary {
  const points = route.filter((point) => point.coordinates);
  let distanceKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [previousLng, previousLat] = points[index - 1].coordinates as [number, number];
    const [currentLng, currentLat] = points[index].coordinates as [number, number];
    distanceKm += haversineKm(previousLat, previousLng, currentLat, currentLng);
  }
  distanceKm = Math.round(distanceKm * 10) / 10;
  const speed = TRANSPORT_SPEED_KMH[transport] ?? 35;
  return {
    distanceKm,
    durationMin: Math.round((distanceKm / speed) * 60),
    elevationGainM: Math.round(distanceKm * 8),
    stopsCount: Math.max(route.length - 1, 0),
  };
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
    startDate: dto.start_date ?? '',
    startTime: null,
    transport,
    visibility: dto.is_public ? 'public' : 'private',
    seatsTotal: toNum(dto.max_participants),
    startPoint: null,
    status: planStatusFromFacade(dto.status),
    organizer: owner,
    route,
    routeGeometry: normalizeRouteGeometry(dto.route_geometry),
    routeSummary:
      mapRouteSummary(dto.route_summary) ??
      (route.length ? estimateRouteSummary(route, transport) : null),
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
