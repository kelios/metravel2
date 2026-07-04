import { apiClient } from '@/api/client';
import type {
  ParsedRoutePoint,
  ParsedRoutePreview,
  RouteElevationSample,
  TravelRouteFile,
  TravelRouteServerSummary,
} from '@/types/travelRoutes';

const LONG_TIMEOUT = 30000;

const toFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toCoordString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeServerLinePoints = (value: unknown): ParsedRoutePoint[] => {
  if (!Array.isArray(value)) return [];
  const points: ParsedRoutePoint[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const coord = toCoordString((entry as Record<string, unknown>).coord);
    if (!coord) continue;
    const elevation = toFiniteNumber((entry as Record<string, unknown>).elevation);
    points.push(elevation === null ? { coord } : { coord, elevation });
  }
  return points;
};

const normalizeServerElevationProfile = (value: unknown): RouteElevationSample[] => {
  if (!Array.isArray(value)) return [];
  const samples: RouteElevationSample[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const distanceKm = toFiniteNumber(rec.distance_km ?? rec.distanceKm);
    const elevationM = toFiniteNumber(rec.elevation_m ?? rec.elevationM);
    if (distanceKm === null || elevationM === null) continue;
    samples.push({ distanceKm, elevationM });
  }
  return samples;
};

const normalizeServerPreview = (value: unknown): ParsedRoutePreview | null => {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const linePoints = normalizeServerLinePoints(rec.line_points ?? rec.linePoints);
  if (linePoints.length < 2) return null;
  return {
    linePoints,
    elevationProfile: normalizeServerElevationProfile(rec.elevation_profile ?? rec.elevationProfile),
  };
};

const normalizeServerSummary = (value: unknown): TravelRouteServerSummary | null => {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  return {
    distanceKm: toFiniteNumber(rec.distance_km ?? rec.distanceKm),
    hasElevation: Boolean(rec.has_elevation ?? rec.hasElevation),
    ascentM: toFiniteNumber(rec.ascent_m ?? rec.ascentM),
    descentM: toFiniteNumber(rec.descent_m ?? rec.descentM),
    minElevationM: toFiniteNumber(rec.min_elevation_m ?? rec.minElevationM),
    maxElevationM: toFiniteNumber(rec.max_elevation_m ?? rec.maxElevationM),
    elevationRangeM: toFiniteNumber(rec.elevation_range_m ?? rec.elevationRangeM),
    avgClimbMPerKm: toFiniteNumber(rec.avg_climb_m_per_km ?? rec.avgClimbMPerKm),
    startCoord: toCoordString(rec.start_coord ?? rec.startCoord),
    finishCoord: toCoordString(rec.finish_coord ?? rec.finishCoord),
    peakCoord: toCoordString(rec.peak_coord ?? rec.peakCoord),
  };
};

type MaybePaginated<T> =
  | T[]
  | {
      results?: T[];
      data?: T[];
      items?: T[];
    };

const normalizeRouteFile = (input: unknown): TravelRouteFile | null => {
  if (!input || typeof input !== 'object') return null;
  const rec = input as Record<string, unknown>;
  const id = Number(rec.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    original_name: String(rec.original_name ?? rec.originalName ?? ''),
    ext: String(rec.ext ?? '').toLowerCase(),
    size: Number.isFinite(Number(rec.size)) ? Number(rec.size) : undefined,
    download_url:
      typeof rec.download_url === 'string'
        ? rec.download_url
        : typeof rec.downloadUrl === 'string'
          ? rec.downloadUrl
          : undefined,
    created_at: typeof rec.created_at === 'string' ? rec.created_at : null,
    preview: normalizeServerPreview(rec.preview),
    summary: normalizeServerSummary(rec.summary),
  };
};

const extractRouteFiles = (payload: MaybePaginated<unknown>): TravelRouteFile[] => {
  const rec = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(rec?.results)
      ? rec!.results
      : Array.isArray(rec?.data)
        ? rec!.data
        : Array.isArray(rec?.items)
          ? rec!.items
          : [];

  return (raw as unknown[]).map(normalizeRouteFile).filter((item): item is TravelRouteFile => Boolean(item));
};

export const listTravelRouteFiles = async (travelId: string | number): Promise<TravelRouteFile[]> => {
  const payload = await apiClient.get<MaybePaginated<unknown>>(
    `/travels/${encodeURIComponent(String(travelId))}/routes/`,
    LONG_TIMEOUT,
  );
  return extractRouteFiles(payload);
};

export const uploadTravelRouteFile = async (
  travelId: string | number,
  file: File | { uri: string; name: string; type?: string },
): Promise<TravelRouteFile | null> => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);

  const payload = await apiClient.uploadFormData<unknown>(
    `/travels/${encodeURIComponent(String(travelId))}/routes/`,
    formData,
    'POST',
    LONG_TIMEOUT,
  );

  return normalizeRouteFile(payload);
};

export const deleteTravelRouteFile = async (
  travelId: string | number,
  routeId: string | number,
): Promise<void> => {
  await apiClient.delete(
    `/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/`,
    LONG_TIMEOUT,
  );
};

export const downloadTravelRouteFileBlob = async (
  travelId: string | number,
  routeId: string | number,
): Promise<{ text: string; contentType?: string; filename?: string }> => {
  const response = await apiClient.download(
    `/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/download/`,
    { method: 'GET' },
    LONG_TIMEOUT,
  );

  const text = await response.blob.text();
  return {
    text,
    contentType: response.contentType,
    filename: response.filename,
  };
};

export const buildTravelRouteDownloadPath = (
  travelId: string | number,
  routeId: string | number,
): string =>
  `/api/travels/${encodeURIComponent(String(travelId))}/routes/${encodeURIComponent(String(routeId))}/download/`;
