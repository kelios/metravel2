import type { RouteExportInput, RouteWaypoint } from '@/utils/routeExport';
import type { Travel } from '@/types/types';
import { translate as i18nT } from '@/i18n'


const parsePointCoord = (point: any): [number, number] | null => {
  const raw =
    point?.coord ??
    point?.coords ??
    point?.coordinates ??
    point?.location ??
    (point?.lat != null && point?.lng != null ? `${point.lat},${point.lng}` : null) ??
    (point?.latitude != null && point?.longitude != null ? `${point.latitude},${point.longitude}` : null);

  if (raw == null) return null;

  if (Array.isArray(raw) && raw.length >= 2) {
    const first = Number(raw[0]);
    const second = Number(raw[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
    const looksLikeLngLat = Math.abs(first) > 90 && Math.abs(second) <= 90;
    const lat = looksLikeLngLat ? second : first;
    const lng = looksLikeLngLat ? first : second;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
  }

  const [latStr, lngStr] = String(raw).replace(/;/g, ',').split(',').map((part) => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
};

const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeCategoryName = (raw: unknown) => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'object' ? normalizeText((item as any)?.name) : normalizeText(item)))
      .filter(Boolean)
      .join(', ');
  }
  if (raw && typeof raw === 'object') return normalizeText((raw as any).name);
  return normalizeText(raw);
};

export const getExportableTravelPointWaypoints = (points: unknown): RouteWaypoint[] => {
  const input = Array.isArray(points) ? points : [];

  return input
    .map((point: any, index) => {
      const coordinates = parsePointCoord(point);
      if (!coordinates) return null;

      const name =
        normalizeText(point?.address) ||
        normalizeText(point?.name) ||
        normalizeText(point?.title) ||
        `Point ${index + 1}`;
      const descriptionParts = [
        normalizeCategoryName(point?.categoryName ?? point?.category),
        normalizeText(point?.description),
      ].filter(Boolean);

      return {
        name,
        description: descriptionParts.join('\n'),
        coordinates,
      };
    })
    .filter(Boolean) as RouteWaypoint[];
};

export const buildTravelPointsExportInput = (travel: Travel): RouteExportInput => {
  const travelName = normalizeText((travel as any)?.name ?? (travel as any)?.title) || 'Metravel points';
  const sourceUrl = normalizeText((travel as any)?.url);
  const sourceLines = [
    i18nT('export:utils.travelPointsExport.tochki_marshruta_iz_metravel_value1_75577000', { value1: travelName }),
    sourceUrl ? i18nT('export:utils.travelPointsExport.istochnik_value1_93c005d7', { value1: sourceUrl }) : '',
  ].filter(Boolean);

  return {
    name: `${travelName} points`,
    description: sourceLines.join('\n'),
    sourceName: travelName,
    sourceUrl: sourceUrl || undefined,
    waypoints: getExportableTravelPointWaypoints((travel as any)?.travelAddress),
  };
};

export const buildGoogleMapsDirectionsUrl = (waypoints: RouteWaypoint[]): string | null => {
  if (!Array.isArray(waypoints) || waypoints.length === 0) return null;

  const path = waypoints
    .map((waypoint) => {
      const [lng, lat] = waypoint.coordinates;
      return `${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`;
    })
    .join('/');

  return `https://www.google.com/maps/dir/${path}`;
};
