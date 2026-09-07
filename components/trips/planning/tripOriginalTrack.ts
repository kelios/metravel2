// components/trips/planning/tripOriginalTrack.ts
// Фаза 2 импорта (#1496): исходный GPX/KML поездки → геометрия для карты
// планировщика. Здесь нет упрощения формы: точки трека переносятся как есть,
// в отличие от фазы 1 (#1492), которая сводит трек к ≤50 именованным точкам
// маршрута. Вмешательство только защитное — потолки числа точек и числа линий:
// патологический файл (контракт бэкенда допускает до 20 МиБ, то есть сотни
// тысяч точек) не должен вешать Leaflet на web и WebView на устройстве.
import type { RouteGeometry } from '@/api/plannedTripsTypes';
import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { calculateRouteDistanceKm, splitRouteLineSegments } from '@/utils/routeFileParser';

/**
 * Потолок точек, отдаваемых карте. 12 000 сегментов рисуются плавно и на
 * телефоне, и покрывают любой реальный трек похода целиком (сверочный кейс
 * задачи — 458 точек). Выше потолка линия прореживается равномерно, старт и
 * финиш сохраняются точно, а сам файл на скачивание остаётся нетронутым.
 */
export const ORIGINAL_TRACK_MAX_DISPLAY_POINTS = 12000;

export interface OriginalTrackGeometry {
  /**
   * Непрерывные линии файла: сегмент на каждый `<trk>` GPX или `<LineString>`
   * KML плюс разрыв на каждой паузе записи внутри трека. Внутри сегмента — пары
   * [lng, lat], тот же формат, что у `PlannedTrip.routeGeometry`. Сегменты
   * намеренно НЕ склеиваются: конец одного и начало следующего могут стоять в
   * разных концах региона, и общая линия провела бы между ними прямую, которой
   * в файле нет (#1847). Сверх `ORIGINAL_TRACK_MAX_SEGMENTS` на карту едут
   * только самые длинные линии.
   */
  segments: RouteGeometry[];
  /** Число точек во всех треках файла (до защитного прореживания). */
  sourcePointCount: number;
  /** Сумма длин треков файла — включая те, что не попали в `segments`. */
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

/** Ниже двух точек линия не рисуется вовсе — это уже не сегмент. */
const MIN_SEGMENT_POINTS = 2;

/**
 * Потолок числа линий на карте. Точечного бюджета для защиты мало: он считает
 * точки, а карта встаёт на объектах — KML из тысяч коротких `<LineString>`
 * (контракт допускает файл до 20 МиБ) дал бы по слою Leaflet и по React-элементу
 * на каждый, и резерв в две точки на сегмент сам вынес бы сумму за потолок.
 * Реальному файлу запаса хватает кратно: трек на каждый день месячного похода —
 * это 30 сегментов. Сверх потолка на карте остаются самые длинные линии в
 * порядке файла: хвост из двух-трёх точек формы не несёт, ради которой оригинал
 * и рисуется, а `thinnedForDisplay` при этом честно поднимается.
 */
export const ORIGINAL_TRACK_MAX_SEGMENTS = 500;

/** Самые длинные линии, порядок файла сохраняется (`sort` в V8 стабилен). */
const limitSegmentCount = <T extends { coordinates: unknown[] }>(tracks: T[]): T[] => {
  if (tracks.length <= ORIGINAL_TRACK_MAX_SEGMENTS) return tracks;

  const kept = new Set(
    tracks
      .map((_track, index) => index)
      .sort((a, b) => tracks[b].coordinates.length - tracks[a].coordinates.length)
      .slice(0, ORIGINAL_TRACK_MAX_SEGMENTS),
  );
  return tracks.filter((_track, index) => kept.has(index));
};

/**
 * Раздаёт общий потолок файла по сегментам пропорционально их длине. Концы
 * каждого сегмента резервируются заранее: без резерва длинный трек забрал бы
 * весь бюджет, и короткое кольцо того же файла исчезло бы с карты. Число
 * сегментов к этому моменту уже ограничено `ORIGINAL_TRACK_MAX_SEGMENTS`,
 * поэтому резерв помещается в потолок; `Math.max` ниже держит вырожденный
 * вызов с крошечным `maxDisplayPoints` (тесты) от отрицательного бюджета.
 */
const distributeBudget = (counts: number[], maxDisplayPoints: number): number[] => {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= maxDisplayPoints) return counts;

  const reserved = counts.length * MIN_SEGMENT_POINTS;
  const spare = Math.max(0, maxDisplayPoints - reserved);
  const spareSource = total - reserved;
  return counts.map((count) => {
    const extra = spareSource > 0
      ? Math.floor((spare * (count - MIN_SEGMENT_POINTS)) / spareSource)
      : 0;
    return Math.min(count, MIN_SEGMENT_POINTS + extra);
  });
};

/**
 * Разбирает файл в набор независимых линий карты: GPX может нести несколько
 * `<trk>`, KML — несколько `<LineString>`, и каждый из них рисуется сам по себе;
 * пауза записи внутри трека рвёт линию так же. Раньше (#1496) всё склеивалось в
 * одну ломаную, потому что сценарий был «один трек на файл»; на реальном
 * многодневном походе склейка давала прямую длиной 8,6 км между двумя кольцами,
 * которой в файле нет (#1847).
 */
export const buildOriginalTrackGeometry = (
  previews: ParsedRoutePreview[],
  maxDisplayPoints: number = ORIGINAL_TRACK_MAX_DISPLAY_POINTS,
): OriginalTrackGeometry | null => {
  const tracks = previews
    // Граница `<trk>`/`<LineString>` — не единственный разрыв: паузы записи
    // внутри одного трека приходят слитым списком точек (парсер собирает все
    // `<trkpt>` трека, не разделяя `<trkseg>`), и такой разрыв нарисовался бы
    // той же фальшивой прямой. Правило разрыва в проекте одно и живёт в
    // `splitRouteLineSegments` — им же режет линии карта статьи
    // (`useTravelRouteMapBlockModel`); порог самокалибруется по медианному
    // шагу, поэтому редкий плановый маршрут своих длинных перегонов не теряет.
    .flatMap((preview) =>
      splitRouteLineSegments(Array.isArray(preview?.linePoints) ? preview.linePoints : []),
    )
    .map((linePoints) => ({
      linePoints,
      coordinates: linePoints
        .map((point) => coordToLngLat(point.coord))
        .filter((pair): pair is [number, number] => pair != null),
    }))
    // Трек, от которого уцелела одна точка или ни одной, линией не станет —
    // и не должен уносить с карты остальные треки файла.
    .filter((track) => track.coordinates.length >= MIN_SEGMENT_POINTS);

  if (!tracks.length) return null;

  // Рисуются не обязательно все треки файла, а счёт исходных точек и длина —
  // всегда по всему файлу: иначе прореживание выглядело бы как полный перенос.
  const drawnTracks = limitSegmentCount(tracks);
  const budgets = distributeBudget(
    drawnTracks.map((track) => track.coordinates.length),
    maxDisplayPoints,
  );
  const segments = drawnTracks.map((track, index) => thin(track.coordinates, budgets[index]));
  const sourcePointCount = tracks.reduce((sum, track) => sum + track.coordinates.length, 0);
  const displayPointCount = segments.reduce((sum, segment) => sum + segment.length, 0);

  return {
    segments,
    sourcePointCount,
    // Длина считается по каждой непрерывной линии отдельно: общий проход по
    // склеенному списку прибавлял бы перегон между несмежными треками.
    distanceKm: tracks.reduce((sum, track) => sum + calculateRouteDistanceKm(track.linePoints), 0),
    thinnedForDisplay: displayPointCount < sourcePointCount,
  };
};

/** Расширение файла для парсера: поле `ext` бэкенда, иначе суффикс имени. */
export const routeFileExtension = (file: { ext?: string | null; original_name?: string | null }): string =>
  String(file.ext ?? file.original_name?.split('.').pop() ?? '')
    .toLowerCase()
    .replace(/^\./, '');
