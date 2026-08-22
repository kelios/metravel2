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

/** Стабильный ключ набора точек: по нему решаем, устарел ли ответ движка. */
export const previewPointsKey = (
  points: Array<[number, number]>,
  transport: TripTransport,
): string =>
  `${transport}:${points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|')}`;

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
