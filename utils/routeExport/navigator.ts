import type { LngLat, RouteExportInput } from './types';
import { normalizeTrack, normalizeWaypoints, roundCoord } from './normalize';

/**
 * `yandex` и `osmand` — только deeplink-провайдеры страницы маршрута (#2902);
 * в `ROUTE_NAVIGATORS` (меню экспорта поездки) их нет, чтобы не менять тот экран.
 */
export type NavigatorProvider = 'google' | 'apple' | 'yandex' | 'osmand' | 'garmin' | 'komoot';

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface NavigatorDescriptor {
  id: NavigatorProvider;
  label: string;
  /**
   * `deeplink` — opens the route directly via a URL built from coordinates.
   * `gpx` — consumes a GPX file (use `buildGpx`); `importUrl` points at the
   * provider's upload page so the user can attach the exported track.
   */
  kind: 'deeplink' | 'gpx';
  importUrl?: string;
}

export const ROUTE_NAVIGATORS: NavigatorDescriptor[] = [
  { id: 'google', label: 'Google Maps', kind: 'deeplink' },
  { id: 'apple', label: 'Apple Maps', kind: 'deeplink' },
  { id: 'garmin', label: 'Garmin Connect', kind: 'gpx', importUrl: 'https://connect.garmin.com/modern/import-data' },
  { id: 'komoot', label: 'Komoot', kind: 'gpx', importUrl: 'https://www.komoot.com/upload' },
];

// Google's `api=1` directions URL accepts at most 9 intermediate waypoints.
const GOOGLE_MAX_INTERMEDIATE = 9;

/**
 * Ordered list of navigation stops, preferring explicit waypoints and falling
 * back to the track's endpoints. Coordinates are returned as [lng, lat].
 */
export const extractRouteStops = (input: RouteExportInput): LngLat[] => {
  const waypoints = normalizeWaypoints(input.waypoints);
  if (waypoints.length) return waypoints.map((w) => w.coordinates);

  const track = normalizeTrack(input.track);
  if (track.length >= 2) return [track[0], track[track.length - 1]];
  if (track.length === 1) return [track[0]];
  return [];
};

const latLng = ([lng, lat]: LngLat) => `${roundCoord(lat)},${roundCoord(lng)}`;

const GOOGLE_MODE: Record<TravelMode, string> = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
};

// Apple Maps has no dedicated cycling flag; fall back to walking directions.
const APPLE_MODE: Record<TravelMode, string> = {
  driving: 'd',
  walking: 'w',
  cycling: 'w',
};

const buildGoogleUrl = (stops: LngLat[], mode: TravelMode): string => {
  const params = new URLSearchParams({ api: '1', travelmode: GOOGLE_MODE[mode] });
  if (stops.length === 1) {
    params.set('destination', latLng(stops[0]));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  params.set('origin', latLng(stops[0]));
  params.set('destination', latLng(stops[stops.length - 1]));
  const intermediate = stops.slice(1, -1).slice(0, GOOGLE_MAX_INTERMEDIATE);
  if (intermediate.length) params.set('waypoints', intermediate.map(latLng).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildAppleUrl = (stops: LngLat[], mode: TravelMode): string => {
  const params = new URLSearchParams({ dirflg: APPLE_MODE[mode] });
  if (stops.length === 1) {
    params.set('daddr', latLng(stops[0]));
    return `https://maps.apple.com/?${params.toString()}`;
  }
  // Apple Maps URLs reliably support a single origin→destination leg only.
  params.set('saddr', latLng(stops[0]));
  params.set('daddr', latLng(stops[stops.length - 1]));
  return `https://maps.apple.com/?${params.toString()}`;
};

const YANDEX_MODE: Record<TravelMode, string> = {
  driving: 'auto',
  walking: 'pd',
  cycling: 'bc',
};

// Yandex Maps `rtext`: точки `lat,lon` через `~`, первая — старт, последняя —
// финиш (https://yandex.ru/dev/yandex-apps-launch-maps/doc/ru/concepts/yandexmaps-web).
const buildYandexUrl = (stops: LngLat[], mode: TravelMode): string => {
  const rtext = stops.length === 1 ? `~${latLng(stops[0])}` : stops.map(latLng).join('~');
  return `https://yandex.ru/maps/?rtext=${rtext}&rtt=${YANDEX_MODE[mode]}`;
};

const OSMAND_PROFILE: Record<TravelMode, string> = {
  driving: 'car',
  walking: 'pedestrian',
  cycling: 'bicycle',
};

const OSMAND_ZOOM = 10;

/**
 * OsmAnd route link — тот же формат, что генерирует и разбирает само приложение
 * (`IntentHelper.generateRouteUrl` / parse в osmandapp/OsmAnd):
 * `https://osmand.net/map/navigate/?start=lat,lon&end=lat,lon&via=lat,lon;lat,lon&profile=car#zoom/lat/lon`.
 * Приложение перехватывает ссылку osmand.net и строит маршрут; без приложения
 * она открывает веб-карту OsmAnd с тем же маршрутом.
 */
const buildOsmandUrl = (stops: LngLat[], mode: TravelMode): string => {
  const [startLng, startLat] = stops[0];
  const end = stops[stops.length - 1];
  const parts = [] as string[];
  if (stops.length > 1) parts.push(`start=${latLng(stops[0])}`);
  parts.push(`end=${latLng(end)}`);
  const via = stops.slice(1, -1);
  if (via.length) parts.push(`via=${via.map(latLng).join(';')}`);
  parts.push(`profile=${OSMAND_PROFILE[mode]}`);
  const fragment = `${OSMAND_ZOOM}/${roundCoord(startLat)}/${roundCoord(startLng)}`;
  return `https://osmand.net/map/navigate/?${parts.join('&')}#${fragment}`;
};

/**
 * Build a navigator deep link from a route. Returns `null` for providers that
 * import GPX instead of accepting a coordinate URL (Garmin, Komoot) or when the
 * route has no usable coordinates.
 */
export const buildNavigatorUrl = (
  provider: NavigatorProvider,
  input: RouteExportInput,
  opts?: { mode?: TravelMode },
): string | null => {
  const stops = extractRouteStops(input);
  if (!stops.length) return null;

  const mode = opts?.mode ?? 'driving';
  switch (provider) {
    case 'google':
      return buildGoogleUrl(stops, mode);
    case 'apple':
      return buildAppleUrl(stops, mode);
    case 'yandex':
      return buildYandexUrl(stops, mode);
    case 'osmand':
      return buildOsmandUrl(stops, mode);
    default:
      return null;
  }
};
