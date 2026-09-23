// components/trips/planning/tripRoutePreview.ts
// Чистая часть живого превью маршрута конструктора поездки (#1490): что считать
// маршрутизируемым, как разложить ответ движка /map в доменные RouteSummary /
// RoutingState и как собрать профиль высот превью.
//
// Здесь нет ни одной собственной формулы маршрута: расстояние и время приходят
// из ответа движка маршрутизации, набор/сброс — из `useElevation`. Прежний
// локальный оценщик по прямой удалён из проекта целиком, и это закреплено
// регрессионным гардом в `__tests__/trips/plannedTripsAdapter.test.ts`.
import type { ElevationSample } from '@/components/map-core/useElevation';
import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting';
import type {
  RoutableTripTransport,
  RouteGeometry,
  RouteLeg,
  RoutePoint,
  RouteSummary,
  RoutingState,
  TripTransport,
} from '@/api/plannedTrips';
import type { ParsedRoutePoint, ParsedRoutePreview } from '@/types/travelRoutes';
import { toTransportMode } from '@/components/MapPage/transportModes';
import { buildElevationProfile } from '@/utils/routeFileParser';
import {
  PREVIEW_DIRECT_PROVIDER,
  PREVIEW_PROVIDER,
  PREVIEW_SCHEMATIC_PROVIDER,
} from './tripRoutingProviders';
import { hasTransferSegment, splitRouteSegments, type RouteSegment } from './tripRouteLegs';

/** Провайдеры цепочки строят маршрут только для этих режимов. */
export const ROUTE_TRANSPORTS: RoutableTripTransport[] = ['car', 'foot', 'bike'];

/**
 * #1491: решение «строим по дорогам или нет» принимает общий маппинг карты, а
 * не собственный список планировщика. `RoutableTripTransport` и `TransportMode`
 * — одно и то же множество, поэтому сужение здесь корректно по построению.
 */
export const isRoutableTransport = (value: string): value is RoutableTripTransport =>
  toTransportMode(value) !== null;

/** Точки маршрута с координатами как [lng, lat] — вход движка маршрутизации. */
export const routablePreviewPoints = (route: RoutePoint[]): Array<[number, number]> =>
  route
    .map((point) => point.coordinates)
    .filter((coordinates): coordinates is [number, number] =>
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]));

/** A routed line must contain at least two finite [lng, lat] positions. */
export const hasUsableRouteGeometry = (
  geometry: RouteGeometry | null | undefined,
): geometry is RouteGeometry =>
  Array.isArray(geometry) &&
  geometry.length >= 2 &&
  geometry.every(
    (coordinates) =>
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]),
  );

const pointsFingerprint = (points: Array<[number, number]>): string =>
  points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|');

/** Стабильный ключ набора точек: по нему решаем, устарел ли ответ движка. */
export const previewPointsKey = (
  points: Array<[number, number]>,
  transport: TripTransport,
): string => `${transport}:${pointsFingerprint(points)}`;

/**
 * #2056: ключ формы маршрута — то, от чего зависят геометрия и цифры. Без
 * переездов он совпадает с `previewPointsKey` всех точек. С переездами в нём
 * прогоны и концы переездов, но не способ: «поезд → самолёт» не меняет ни
 * линии, ни итога, и сохранённую дорогу из-за этого выбрасывать незачем, а
 * новый или снятый переезд меняет прогоны — и отдаёт показ превью.
 */
export const previewRouteShapeKey = (
  route: RoutePoint[],
  transport: TripTransport,
  segments: RouteSegment[] = splitRouteSegments(route),
): string => {
  if (!hasTransferSegment(segments)) return previewPointsKey(routablePreviewPoints(route), transport);
  const parts = segments.map((segment) =>
    segment.kind === 'route'
      ? pointsFingerprint(segment.points)
      : `~${segment.line ? pointsFingerprint(segment.line) : ''}`);
  return `${transport}:${parts.join('#')}`;
};

/**
 * Движок уже что-то ответил. Свежесмонтированный `useRouting` секунду живёт
 * пустым состоянием (`loading: false`, ноль координат и метров) — до старта
 * собственного дебаунса. Считать это «маршрут построен» нельзя: индикатор
 * построения гас бы ровно в тот момент, когда запрос только уходит.
 */
export const hasEngineAnswer = (result: UseMapRoutingResult | null): boolean =>
  Boolean(result && (result.error || result.coords.length >= 2 || result.distance > 0));

/**
 * Деградация движка: `useRouting` отдаёт прямую линию между точками и текст
 * ошибки. Молча выдавать её за маршрут нельзя (`ROUTING-ORS-001`).
 */
export const isPreviewDegraded = (result: UseMapRoutingResult | null): boolean =>
  Boolean(result && !result.loading && result.error);

export const previewRoutingState = (
  result: UseMapRoutingResult | null,
): RoutingState | null => {
  if (!result || result.loading) return null;
  if (result.error) {
    return {
      provider: PREVIEW_DIRECT_PROVIDER,
      isOptimal: false,
      fallbackReason: result.error,
      warnings: [],
    };
  }
  if (!result.coords.length) return null;
  return {
    provider: PREVIEW_PROVIDER,
    isOptimal: true,
    fallbackReason: null,
    warnings: [],
  };
};

/** Транспорт без автопрокладки: точки соединены прямыми, и это сказано вслух. */
export const schematicRoutingState = (): RoutingState => ({
  provider: PREVIEW_SCHEMATIC_PROVIDER,
  isOptimal: false,
  fallbackReason: null,
  warnings: [],
});

/**
 * «Остановки» — это число точек маршрута. Ровно так же их считает бэкенд
 * (`stops_count = len(route_points)` в `trips/views.py`), включая точки без
 * координат. Своя формула здесь развела бы превью и серверную сводку на
 * единицу, и счётчик прыгал бы на ровном месте при каждой правке (#1490).
 */
export const previewStopsCount = (route: RoutePoint[]): number => route.length;

/**
 * Сводка схематичной линии: остановки посчитать можно, расстояние и время
 * общественным транспортом — нет. Нули печатаются прочерком, и это честнее
 * подставленной оценки по прямой.
 */
export const schematicSummary = (route: RoutePoint[]): RouteSummary | null => {
  if (route.length < 2) return null;
  return {
    distanceKm: 0,
    durationMin: 0,
    elevationGainM: 0,
    stopsCount: previewStopsCount(route),
    provider: PREVIEW_SCHEMATIC_PROVIDER,
    updatedAt: null,
  };
};

export const previewGeometry = (
  result: UseMapRoutingResult | null,
): RouteGeometry | null => {
  // Прямая линия деградации — не геометрия маршрута: пусть карта рисует её тем
  // же путём, что и «точки без маршрута», а баннер объяснит почему.
  if (!result || result.loading || result.error) return null;
  return result.coords.length >= 2 ? result.coords : null;
};

export const previewSummary = (
  result: UseMapRoutingResult | null,
  route: RoutePoint[],
): RouteSummary | null => {
  if (!result || result.loading) return null;
  if (!Number.isFinite(result.distance) || result.distance <= 0) return null;
  return {
    distanceKm: Math.round((result.distance / 1000) * 10) / 10,
    durationMin: Math.round(result.duration / 60),
    // Набор высоты меряется только для пешего и велосипедного режимов; для
    // остальных значение отсутствует, и панель печатает прочерк.
    elevationGainM: Number.isFinite(result.elevationGain as number)
      ? Number(result.elevationGain)
      : 0,
    stopsCount: previewStopsCount(route),
    provider: result.error ? PREVIEW_DIRECT_PROVIDER : PREVIEW_PROVIDER,
    updatedAt: null,
  };
};

/**
 * Профиль высот превью: редкие замеры Open-Meteo раскладываются обратно на
 * плотную геометрию маршрута, и дальше работает общий построитель профиля —
 * тот же, что у GPX-треков и у сохранённой ORS-полилинии. Дистанция по оси X
 * поэтому считается вдоль дороги, а не по прямой между замерами.
 */
export const previewElevation = (
  result: UseMapRoutingResult | null,
): ParsedRoutePreview | null => {
  if (!result || result.loading || result.error) return null;
  const coords = result.coords;
  const samples: ElevationSample[] | null = result.elevationSamples;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  if (!Array.isArray(samples) || samples.length < 2) return null;

  const elevationByIndex = new Map<number, number>();
  for (const sample of samples) {
    if (!Number.isFinite(sample?.elevationM)) continue;
    elevationByIndex.set(sample.index, sample.elevationM);
  }
  if (elevationByIndex.size < 2) return null;

  const linePoints: ParsedRoutePoint[] = [];
  for (let index = 0; index < coords.length; index += 1) {
    const point = coords[index];
    if (!Array.isArray(point) || point.length < 2) continue;
    const [lng, lat] = point;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const elevation = elevationByIndex.get(index);
    linePoints.push(
      elevation === undefined
        ? { coord: `${lat},${lng}` }
        : { coord: `${lat},${lng}`, elevation },
    );
  }

  const elevationProfile = buildElevationProfile(linePoints);
  return elevationProfile.length >= 2 ? { linePoints, elevationProfile } : null;
};

/** #2056: прогоны превью — вход движков, по одному на прогон; без переездов прогон один. */
export interface PreviewRunPlan {
  segments: RouteSegment[];
  runs: Array<Array<[number, number]>>;
}

export const previewRunPlan = (route: RoutePoint[]): PreviewRunPlan => {
  const segments = splitRouteSegments(route);
  return {
    segments,
    runs: segments.flatMap((segment) => (segment.kind === 'route' ? [segment.points] : [])),
  };
};

export interface PreviewRunsView {
  loading: boolean;
  degraded: boolean;
  geometry: RouteGeometry | null;
  summary: RouteSummary | null;
  routingState: RoutingState | null;
  elevation: ParsedRoutePreview | null;
}

const finiteOrZero = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Number(value) : 0;

/**
 * #2056: ответы движков прогонов → одна тройка экрана. Маршрут без переездов
 * отдаётся прежними функциями одного ответа — поведение до #2056 не меняется.
 *
 * С переездами тройка собирается так же, как бэкенд склеивает сводку
 * (`combine_route_legs`): геометрия прогонов подряд (деградировавший прогон —
 * своими точками по прямой, соседние остаются проложенными), между ними пара
 * точек переезда; отрезки со срезами геометрии; расстояние и время — только по
 * прогонам, переезды — отдельной суммой. Профиля высот нет: по склеенной линии
 * перелёт в 431 км рисовался бы рельефом.
 */
export function combinePreviewRuns(
  plan: PreviewRunPlan,
  results: ReadonlyArray<UseMapRoutingResult | null | undefined>,
  route: RoutePoint[],
): PreviewRunsView {
  if (!hasTransferSegment(plan.segments)) {
    const result = results[0] ?? null;
    return {
      loading: !hasEngineAnswer(result) || Boolean(result?.loading),
      degraded: isPreviewDegraded(result),
      geometry: previewGeometry(result),
      summary: previewSummary(result, route),
      routingState: previewRoutingState(result),
      elevation: previewElevation(result),
    };
  }

  const runResults = plan.runs.map((_, index) => results[index] ?? null);
  const loading = runResults.some((result) => !hasEngineAnswer(result) || Boolean(result?.loading));
  const degradedResult = runResults.find(isPreviewDegraded) ?? null;
  if (loading) {
    return { loading, degraded: Boolean(degradedResult), geometry: null, summary: null, routingState: null, elevation: null };
  }

  const geometry: RouteGeometry = [];
  const legs: RouteLeg[] = [];
  let runIndex = 0;
  let distanceM = 0;
  let durationS = 0;
  let elevationGainM = 0;
  let transferDistanceKm = 0;
  for (const segment of plan.segments) {
    const start = geometry.length;
    if (segment.kind === 'route') {
      const result = runResults[runIndex] as UseMapRoutingResult;
      runIndex += 1;
      const routed = previewGeometry(result);
      geometry.push(...(routed ?? segment.points));
      distanceM += finiteOrZero(result.distance);
      durationS += finiteOrZero(result.duration);
      elevationGainM += finiteOrZero(result.elevationGain);
      legs.push({
        fromIndex: segment.fromIndex,
        toIndex: segment.toIndex,
        mode: 'route',
        distanceKm: finiteOrZero(result.distance) / 1000,
        durationMin: Math.round(finiteOrZero(result.duration) / 60),
        provider: routed ? PREVIEW_PROVIDER : PREVIEW_DIRECT_PROVIDER,
        geometrySlice: [start, start + (routed ?? segment.points).length],
      });
      continue;
    }
    if (segment.line) geometry.push(...segment.line);
    transferDistanceKm += segment.distanceKm;
    legs.push({
      fromIndex: segment.fromIndex,
      toIndex: segment.toIndex,
      mode: segment.mode,
      distanceKm: segment.distanceKm,
      durationMin: null,
      provider: 'transfer',
      geometrySlice: [start, geometry.length],
    });
  }

  const distanceKm = Math.round((distanceM / 1000) * 10) / 10;
  return {
    loading: false,
    degraded: Boolean(degradedResult),
    geometry: hasUsableRouteGeometry(geometry) ? geometry : null,
    summary: distanceKm > 0 || transferDistanceKm > 0
      ? {
          distanceKm,
          durationMin: Math.round(durationS / 60),
          elevationGainM: degradedResult ? 0 : elevationGainM,
          stopsCount: previewStopsCount(route),
          provider: degradedResult ? PREVIEW_DIRECT_PROVIDER : PREVIEW_PROVIDER,
          updatedAt: null,
          transferDistanceKm,
          legs,
        }
      : null,
    routingState: degradedResult
      ? previewRoutingState(degradedResult)
      : { provider: PREVIEW_PROVIDER, isOptimal: true, fallbackReason: null, warnings: [] },
    elevation: null,
  };
}
