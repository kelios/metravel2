import { apiClient } from '@/api/client';
import { ApiError } from '@/api/clientErrors';

export type StravaConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'missing_scope'
  | 'deauthorized'
  | 'rate_limited'
  | 'backend_config_error'
  | 'error';

export type StravaAthleteSummary = {
  id?: string | number | null;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  profile?: string | null;
};

export type StravaRateLimitMeta = {
  retryAfterSeconds?: number | null;
  limit?: string | null;
  usage?: string | null;
};

export type StravaStatusResponse = {
  status: StravaConnectionStatus;
  connected: boolean;
  athlete?: StravaAthleteSummary | null;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  lastSyncAt?: string | null;
  cacheExpiresAt?: string | null;
  message?: string | null;
  rateLimit?: StravaRateLimitMeta | null;
};

export type StravaConnectResponse = {
  authUrl: string;
};

export type StravaDisconnectResponse = {
  status?: StravaConnectionStatus;
  message?: string | null;
  cacheDeleted?: boolean;
  tokensDeleted?: boolean;
  queuedForDeletion?: boolean;
};

export type StravaActivitySummary = {
  id: string;
  name: string;
  type?: string | null;
  sportType?: string | null;
  startDate?: string | null;
  distanceMeters?: number | null;
  movingTimeSeconds?: number | null;
  elapsedTimeSeconds?: number | null;
  totalElevationGainMeters?: number | null;
  visibility?: string | null;
  private?: boolean | null;
  cacheExpiresAt?: string | null;
  hasDetail?: boolean;
  hasMap?: boolean;
};

export type StravaActivitiesQuery = {
  after?: string;
  before?: string;
  type?: string;
  page?: number;
  perPage?: number;
};

export type StravaActivitiesResponse = {
  data: StravaActivitySummary[];
  page: number;
  perPage: number;
  hasMore: boolean;
  total?: number | null;
  cacheExpiresAt?: string | null;
  rateLimit?: StravaRateLimitMeta | null;
};

export type StravaActivityDetail = StravaActivitySummary & {
  description?: string | null;
  calories?: number | null;
  averageSpeed?: number | null;
  maxSpeed?: number | null;
  mapPolyline?: string | null;
  streamsAvailable?: boolean;
};

const STRAVA_ENDPOINTS = {
  status: '/strava/status/',
  connectStart: '/strava/connect/start/',
  disconnect: '/strava/disconnect/',
  activities: '/strava/activities/',
  activityDetail: (id: string | number) => `/strava/activities/${encodeURIComponent(String(id))}/`,
} as const;

const REQUIRED_SCOPES = ['read', 'activity:read'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asIdString = (value: unknown): string | null => {
  const stringValue = asString(value);
  if (stringValue) return stringValue;
  const numberValue = typeof value === 'number' ? value : null;
  return numberValue != null && Number.isFinite(numberValue) ? String(numberValue) : null;
};

const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => asString(item)).filter((item): item is string => Boolean(item))
    : [];

const normalizeStatus = (value: unknown, connected: boolean): StravaConnectionStatus => {
  const status = asString(value);
  if (
    status === 'not_connected' ||
    status === 'connected' ||
    status === 'missing_scope' ||
    status === 'deauthorized' ||
    status === 'rate_limited' ||
    status === 'backend_config_error' ||
    status === 'error'
  ) {
    return status;
  }
  return connected ? 'connected' : 'not_connected';
};

const normalizeRateLimit = (value: unknown): StravaRateLimitMeta | null => {
  if (!isObject(value)) return null;
  return {
    retryAfterSeconds: asNumber(value.retry_after_seconds ?? value.retryAfterSeconds),
    limit: asString(value.limit),
    usage: asString(value.usage),
  };
};

const normalizeAthlete = (value: unknown): StravaAthleteSummary | null => {
  if (!isObject(value)) return null;
  return {
    id: asIdString(value.id),
    username: asString(value.username),
    firstname: asString(value.firstname ?? value.first_name),
    lastname: asString(value.lastname ?? value.last_name),
    city: asString(value.city),
    state: asString(value.state),
    country: asString(value.country),
    profile: asString(value.profile ?? value.profile_medium),
  };
};

export const normalizeStravaStatus = (payload: unknown): StravaStatusResponse => {
  if (!isObject(payload)) {
    return {
      status: 'backend_config_error',
      connected: false,
      scopes: [],
      requiredScopes: REQUIRED_SCOPES,
      missingScopes: [],
      message: 'Strava API is not configured yet.',
    };
  }

  const connected = Boolean(payload.connected);
  const scopes = asStringArray(payload.scopes ?? payload.scope);
  const requiredScopes = asStringArray(payload.required_scopes ?? payload.requiredScopes);
  const missingScopes = asStringArray(payload.missing_scopes ?? payload.missingScopes);

  return {
    status: normalizeStatus(payload.status, connected),
    connected,
    athlete: normalizeAthlete(payload.athlete),
    scopes,
    requiredScopes: requiredScopes.length > 0 ? requiredScopes : REQUIRED_SCOPES,
    missingScopes,
    lastSyncAt: asString(payload.last_sync_at ?? payload.lastSyncAt),
    cacheExpiresAt: asString(payload.cache_expires_at ?? payload.cacheExpiresAt),
    message: asString(payload.message ?? payload.detail),
    rateLimit: normalizeRateLimit(payload.rate_limit ?? payload.rateLimit),
  };
};

const normalizeActivity = (payload: unknown): StravaActivitySummary | null => {
  if (!isObject(payload)) return null;
  const id = asIdString(payload.id ?? payload.strava_activity_id);
  if (!id) return null;
  return {
    id,
    name: asString(payload.name ?? payload.title) ?? 'Активность Strava',
    type: asString(payload.type),
    sportType: asString(payload.sport_type ?? payload.sportType),
    startDate: asString(payload.start_date ?? payload.startDate),
    distanceMeters: asNumber(payload.distance ?? payload.distance_meters ?? payload.distanceMeters),
    movingTimeSeconds: asNumber(payload.moving_time ?? payload.movingTimeSeconds),
    elapsedTimeSeconds: asNumber(payload.elapsed_time ?? payload.elapsedTimeSeconds),
    totalElevationGainMeters: asNumber(
      payload.total_elevation_gain ?? payload.totalElevationGainMeters,
    ),
    visibility: asString(payload.visibility),
    private: asBoolean(payload.private),
    cacheExpiresAt: asString(payload.cache_expires_at ?? payload.cacheExpiresAt),
    hasDetail: Boolean(payload.has_detail ?? payload.hasDetail),
    hasMap: Boolean(payload.has_map ?? payload.hasMap ?? payload.map_polyline),
  };
};

export const normalizeStravaActivities = (
  payload: unknown,
  query: StravaActivitiesQuery = {},
): StravaActivitiesResponse => {
  const source = isObject(payload) ? payload : {};
  const rows = Array.isArray(source.results)
    ? source.results
    : Array.isArray(source.data)
      ? source.data
      : Array.isArray(payload)
        ? payload
        : [];
  const data = rows
    .map((item) => normalizeActivity(item))
    .filter((item): item is StravaActivitySummary => Boolean(item));

  const page = asNumber(source.page) ?? query.page ?? 1;
  const perPage = asNumber(source.per_page ?? source.perPage) ?? query.perPage ?? data.length;
  const total = asNumber(source.total ?? source.count);

  return {
    data,
    page,
    perPage,
    total,
    hasMore: Boolean(source.has_more ?? source.hasMore ?? (total != null ? page * perPage < total : false)),
    cacheExpiresAt: asString(source.cache_expires_at ?? source.cacheExpiresAt),
    rateLimit: normalizeRateLimit(source.rate_limit ?? source.rateLimit),
  };
};

export const normalizeStravaActivityDetail = (payload: unknown): StravaActivityDetail | null => {
  const summary = normalizeActivity(payload);
  if (!summary || !isObject(payload)) return summary;
  return {
    ...summary,
    description: asString(payload.description),
    calories: asNumber(payload.calories),
    averageSpeed: asNumber(payload.average_speed ?? payload.averageSpeed),
    maxSpeed: asNumber(payload.max_speed ?? payload.maxSpeed),
    mapPolyline: asString(payload.map_polyline ?? payload.mapPolyline),
    streamsAvailable: Boolean(payload.streams_available ?? payload.streamsAvailable),
  };
};

export const fetchStravaStatus = async (): Promise<StravaStatusResponse> => {
  try {
    const payload = await apiClient.get<unknown>(STRAVA_ENDPOINTS.status);
    return normalizeStravaStatus(payload);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501 || error.status === 503)) {
      return {
        status: 'backend_config_error',
        connected: false,
        scopes: [],
        requiredScopes: REQUIRED_SCOPES,
        missingScopes: [],
        message: error.message,
      };
    }
    throw error;
  }
};

export const startStravaConnect = async (): Promise<StravaConnectResponse> => {
  const payload = await apiClient.post<unknown>(STRAVA_ENDPOINTS.connectStart);
  if (!isObject(payload)) throw new ApiError(502, 'Некорректный ответ Strava connect');
  const authUrl = asString(payload.authUrl ?? payload.auth_url);
  if (!authUrl) throw new ApiError(502, 'Backend не вернул Strava authUrl');
  return { authUrl };
};

export const disconnectStrava = async (): Promise<StravaDisconnectResponse> => {
  const payload = await apiClient.post<unknown>(STRAVA_ENDPOINTS.disconnect);
  if (!isObject(payload)) return {};
  return {
    status: normalizeStatus(payload.status, false),
    message: asString(payload.message ?? payload.detail),
    cacheDeleted: asBoolean(payload.cache_deleted ?? payload.cacheDeleted) ?? undefined,
    tokensDeleted: asBoolean(payload.tokens_deleted ?? payload.tokensDeleted) ?? undefined,
    queuedForDeletion: asBoolean(payload.queued_for_deletion ?? payload.queuedForDeletion) ?? undefined,
  };
};

export const fetchStravaActivities = async (
  query: StravaActivitiesQuery = {},
): Promise<StravaActivitiesResponse> => {
  const params = new URLSearchParams();
  if (query.after) params.set('after', query.after);
  if (query.before) params.set('before', query.before);
  if (query.type) params.set('type', query.type);
  if (query.page) params.set('page', String(query.page));
  if (query.perPage) params.set('perPage', String(query.perPage));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await apiClient.get<unknown>(`${STRAVA_ENDPOINTS.activities}${suffix}`);
  return normalizeStravaActivities(payload, query);
};

export const fetchStravaActivityDetail = async (
  activityId: string | number,
): Promise<StravaActivityDetail | null> => {
  const payload = await apiClient.get<unknown>(STRAVA_ENDPOINTS.activityDetail(activityId));
  return normalizeStravaActivityDetail(payload);
};
