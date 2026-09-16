// components/trips/planning/routePointOrder.ts
// #1899: чистая часть «Предложить оптимальный порядок точек». Здесь нет React и
// нет собственного оптимизатора: порядок считает сервер (#1951), а модуль только
// решает, можно ли спросить, собирает запрос, ключ черновика и раскладывает ответ
// на ходы `moveItem` — те же, что делают стрелки и drag&drop.
import { isTimeoutError } from '@/api/clientErrors';
import type { RoutePoint, TripBikeType, TripTransport } from '@/api/plannedTrips';
import {
  ROUTE_ORDER_MAX_POINTS,
  ROUTE_ORDER_MIN_POINTS,
  type RouteOrderRequest,
  type RouteOrderRequestPoint,
} from '@/api/routeOrderOptimization';
import { moveItem } from './routePointReorder';
import { isRoutableTransport } from './tripRoutePreview';

/**
 * Первая и последняя точки закреплены контрактом, поэтому переставлять есть что
 * только с четырёх точек. На трёх сервер отвечает исходным порядком, даже не
 * спрашивая провайдера, — такой запрос лишь съел бы поминутный лимит владельца.
 */
export const ROUTE_ORDER_MIN_REORDERABLE_POINTS = ROUTE_ORDER_MIN_POINTS + 1;

export type RouteOrderAvailability =
  /** Не для этого маршрута: транспорт без дорожного профиля или меньше трёх точек. */
  | 'hidden'
  /** Три точки: обе крайние закреплены, переставлять нечего. */
  | 'tooFew'
  | 'tooMany'
  | 'needCoordinates'
  | 'ready';

/** Координаты черновика в его порядке; `null`, если хоть у одной точки их нет. */
export const routeOrderRequestPoints = (
  route: readonly RoutePoint[],
): RouteOrderRequestPoint[] | null => {
  const points: RouteOrderRequestPoint[] = [];
  for (const { coordinates } of route) {
    if (
      !Array.isArray(coordinates) ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      return null;
    }
    points.push({ lat: coordinates[1], lng: coordinates[0] });
  }
  return points;
};

export const routeOrderAvailability = (
  route: readonly RoutePoint[],
  transport: TripTransport,
): RouteOrderAvailability => {
  if (!isRoutableTransport(transport) || route.length < ROUTE_ORDER_MIN_POINTS) return 'hidden';
  if (route.length < ROUTE_ORDER_MIN_REORDERABLE_POINTS) return 'tooFew';
  if (route.length > ROUTE_ORDER_MAX_POINTS) return 'tooMany';
  return routeOrderRequestPoints(route) ? 'ready' : 'needCoordinates';
};

export const buildRouteOrderRequest = (
  route: readonly RoutePoint[],
  transport: TripTransport,
  bikeType: TripBikeType | null,
): RouteOrderRequest | null => {
  const points = routeOrderRequestPoints(route);
  if (!points || !isRoutableTransport(transport)) return null;
  // `bike_type` без велосипеда сервер не ждёт; без выбранного типа он сам берёт
  // `regular`, поэтому поле уходит только когда тип известен.
  return transport === 'bike' && bikeType
    ? { points, transport_mode: transport, bike_type: bikeType }
    : { points, transport_mode: transport };
};

/**
 * Всё, от чего зависит ответ сервера: транспорт, тип велосипеда и точки по
 * порядку. Ответ, запрошенный для другого ключа, не показывается и не
 * применяется — перестановка индексов чужого списка переставила бы не те точки.
 */
export const routeOrderSnapshotKey = (
  route: readonly RoutePoint[],
  transport: TripTransport,
  bikeType: TripBikeType | null,
): string =>
  JSON.stringify([
    transport,
    transport === 'bike' ? bikeType : null,
    route.map(({ id, coordinates }) => [id, coordinates?.[0] ?? null, coordinates?.[1] ?? null]),
  ]);

export const isIdentityOrder = (order: readonly number[]): boolean =>
  order.every((sourceIndex, index) => sourceIndex === index);

export type RouteOrderMove = readonly [from: number, to: number];

/**
 * Разложение перестановки на последовательные `moveItem`. Ходы зависят только от
 * `order`, а не от содержимого списка, поэтому каждый уходит в общий вход
 * перестановки `RouteBuilder.handleReorder`, и индекс открытого редактора
 * переезжает так же, как после стрелок и перетаскивания.
 */
export const routeOrderMoves = (order: readonly number[]): RouteOrderMove[] => {
  let arrangement = order.map((_, index) => index);
  const moves: RouteOrderMove[] = [];
  order.forEach((sourceIndex, target) => {
    const from = arrangement.indexOf(sourceIndex);
    if (from < 0 || from === target) return;
    arrangement = moveItem(arrangement, from, target);
    moves.push([from, target]);
  });
  return moves;
};

export const applyRouteOrderMoves = <T,>(list: T[], moves: readonly RouteOrderMove[]): T[] =>
  moves.reduce((current, [from, to]) => moveItem(current, from, to), list);

export interface RouteOrderPreviewRow {
  key: string;
  /** Номер в предложенном порядке, с единицы. */
  position: number;
  /** Номер в текущем черновике, с единицы. */
  previousPosition: number;
  name: string;
  moved: boolean;
}

export const routeOrderPreviewRows = (
  route: readonly RoutePoint[],
  order: readonly number[],
): RouteOrderPreviewRow[] =>
  order.flatMap((sourceIndex, index) => {
    const point = route[sourceIndex];
    if (!point) return [];
    return [
      {
        key: `${index}:${point.id}`,
        position: index + 1,
        previousPosition: sourceIndex + 1,
        name: point.name,
        moved: sourceIndex !== index,
      },
    ];
  });

export type RouteOrderErrorKind =
  | 'offline'
  | 'timeout'
  | 'authRequired'
  | 'invalidRequest'
  | 'rateLimited'
  | 'profileUnsupported'
  | 'incomplete'
  | 'unavailable';

// Коды — таблица ошибок контракта #1951 (`routing/optimization.py`,
// `routing/views.py`). Статус нужен для ответов без кода: 401 от DRF, 404 на
// бэке без эндпоинта, 5xx от nginx.
const ERROR_KIND_BY_CODE: Readonly<Record<string, RouteOrderErrorKind>> = {
  INVALID_OPTIMIZATION_REQUEST: 'invalidRequest',
  provider_not_configured: 'unavailable',
  provider_access_denied: 'unavailable',
  provider_unavailable: 'unavailable',
  provider_response_invalid: 'unavailable',
  provider_profile_unsupported: 'profileUnsupported',
  optimization_incomplete: 'incomplete',
  provider_rate_limited: 'rateLimited',
  optimization_rate_limited: 'rateLimited',
  provider_timeout: 'timeout',
};

const ERROR_KIND_BY_STATUS: Readonly<Record<number, RouteOrderErrorKind>> = {
  400: 'invalidRequest',
  401: 'authRequired',
  403: 'authRequired',
  422: 'incomplete',
  429: 'rateLimited',
  504: 'timeout',
};

export const routeOrderErrorKind = (error: unknown): RouteOrderErrorKind => {
  const { status, data } = (error ?? {}) as { status?: unknown; data?: unknown };
  const body = data && typeof data === 'object' ? (data as { code?: unknown; offline?: unknown }) : null;
  if (body?.offline === true) return 'offline';
  const byCode = typeof body?.code === 'string' ? ERROR_KIND_BY_CODE[body.code] : undefined;
  if (byCode) return byCode;
  if (isTimeoutError(error)) return 'timeout';
  const byStatus = typeof status === 'number' ? ERROR_KIND_BY_STATUS[status] : undefined;
  return byStatus ?? 'unavailable';
};
