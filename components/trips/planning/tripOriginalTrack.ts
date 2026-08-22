// components/trips/planning/tripOriginalTrack.ts
// Фаза 2 импорта (#1496): исходный GPX/KML поездки → геометрия для карты
// планировщика. Здесь нет упрощения формы: точки трека переносятся как есть,
// в отличие от фазы 1 (#1492), которая сводит трек к ≤50 именованным точкам
// маршрута. Единственное вмешательство — защитный потолок числа точек, он
// нужен, чтобы патологический файл (контракт бэкенда допускает до 20 МиБ,
// то есть сотни тысяч точек) не вешал Leaflet на web и WebView на устройстве.
import type { RouteGeometry } from '@/api/plannedTripsTypes';
import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { calculateRouteDistanceKm } from '@/utils/routeFileParser';

/**
 * Потолок точек, отдаваемых карте. 12 000 сегментов рисуются плавно и на
 * телефоне, и покрывают любой реальный трек похода целиком (сверочный кейс
 * задачи — 458 точек). Выше потолка линия прореживается равномерно, старт и
 * финиш сохраняются точно, а сам файл на скачивание остаётся нетронутым.
 */
export const ORIGINAL_TRACK_MAX_DISPLAY_POINTS = 12000;

export interface OriginalTrackGeometry {
  /** [lng, lat] — тот же формат, что у `PlannedTrip.routeGeometry`. */
  geometry: RouteGeometry;
  /** Число точек в исходном файле (до защитного прореживания). */
  sourcePointCount: number;
  distanceKm: number;
  /** true — форма прорежена ради карты; исходный файл при этом не меняется. */
  thinnedForDisplay: boolean;
}

const coordToLngLat = (coord: string): [number, number] | null => {
  const [latText, lngText, extra] = String(coord).split(',');
  if (extra != null) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
};

/** Равномерное прореживание с точным сохранением первой и последней точки. */
const thin = (points: Array<[number, number]>, limit: number): Array<[number, number]> => {
  if (points.length <= limit || limit < 2) return points;
  const step = (points.length - 1) / (limit - 1);
  const output: Array<[number, number]> = [];
  for (let index = 0; index < limit - 1; index += 1) {
    output.push(points[Math.round(index * step)]);
  }
  output.push(points[points.length - 1]);
  return output;
};

/**
 * Склеивает все треки файла в одну линию карты: GPX может нести несколько
 * `<trk>`, KML — несколько `<LineString>`, и все они принадлежат одному
 * загруженному маршруту.
 */
export const buildOriginalTrackGeometry = (
  previews: ParsedRoutePreview[],
  maxDisplayPoints: number = ORIGINAL_TRACK_MAX_DISPLAY_POINTS,
): OriginalTrackGeometry | null => {
  const linePoints = previews.flatMap((preview) =>
    Array.isArray(preview?.linePoints) ? preview.linePoints : [],
  );
  const coordinates = linePoints
    .map((point) => coordToLngLat(point.coord))
    .filter((pair): pair is [number, number] => pair != null);

  if (coordinates.length < 2) return null;

  const geometry = thin(coordinates, maxDisplayPoints);
  return {
    geometry,
    sourcePointCount: coordinates.length,
    distanceKm: calculateRouteDistanceKm(linePoints),
    thinnedForDisplay: geometry.length < coordinates.length,
  };
};

/** Расширение файла для парсера: поле `ext` бэкенда, иначе суффикс имени. */
export const routeFileExtension = (file: { ext?: string | null; original_name?: string | null }): string =>
  String(file.ext ?? file.original_name?.split('.').pop() ?? '')
    .toLowerCase()
    .replace(/^\./, '');
