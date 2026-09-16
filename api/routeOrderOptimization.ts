// api/routeOrderOptimization.ts
// #1899: клиент `POST /api/routing/optimize/` — контракт v1 бэкенда #1951.
//
// Сервер не пишет ничего в поездку и возвращает только перестановку индексов
// входного массива: первая и последняя точка закреплены, остальные расставлены
// по времени в пути. Клиент порядок не считает и принимает ответ, лишь убедившись,
// что это ровно такая перестановка — применять к черновику частичный или
// сдвинутый порядок нельзя.
import { ApiError, apiClient } from '@/api/client';

export type RouteOrderTransportMode = 'car' | 'bike' | 'foot';
export type RouteOrderBikeType = 'regular' | 'road' | 'mountain' | 'electric';

export interface RouteOrderRequestPoint {
  lat: number;
  lng: number;
}

/** Тело запроса: только координаты в порядке черновика, без id, названий и описаний. */
export interface RouteOrderRequest {
  points: RouteOrderRequestPoint[];
  transport_mode: RouteOrderTransportMode;
  bike_type?: RouteOrderBikeType;
}

export interface RouteOrderResponse {
  /** `order[новая позиция] = индекс во входном массиве`. */
  order: number[];
  provider: string | null;
  is_optimized: boolean;
  objective: string;
  fallback_reason: string | null;
  /** Стабильные коды без локализованного текста. */
  warnings: string[];
}

/** Границы контракта v1 (`routing/optimization.py`: `MIN_POINTS`, `ROUTING_OPTIMIZE_MAX_POINTS`). */
export const ROUTE_ORDER_MIN_POINTS = 3;
export const ROUTE_ORDER_MAX_POINTS = 50;

/** Тот же код, которым сервер отвечает на непригодное решение провайдера. */
export const ROUTE_ORDER_INVALID_RESPONSE_CODE = 'provider_response_invalid';

// Сервер ждёт провайдера до 8 секунд и сам отвечает 504 `provider_timeout`.
// Клиентский таймаут длиннее, чтобы до пользователя доходил серверный код, а не
// обрыв ожидания на полпути.
const OPTIMIZE_TIMEOUT_MS = 15_000;

/** Полная перестановка `0..count-1` с закреплёнными первым и последним индексом. */
export const isFixedEndpointPermutation = (order: unknown, count: number): order is number[] => {
  if (!Array.isArray(order) || count < 1 || order.length !== count) return false;
  const seen = new Set<number>();
  for (const value of order) {
    if (!Number.isInteger(value) || value < 0 || value >= count || seen.has(value)) return false;
    seen.add(value);
  }
  return order[0] === 0 && order[count - 1] === count - 1;
};

export async function optimizeRouteOrder(request: RouteOrderRequest): Promise<RouteOrderResponse> {
  const response = await apiClient.post<RouteOrderResponse | null>(
    '/routing/optimize/',
    request,
    OPTIMIZE_TIMEOUT_MS,
  );
  if (!response || !isFixedEndpointPermutation(response.order, request.points.length)) {
    throw new ApiError(502, 'Route order response is not a fixed-endpoint permutation', {
      code: ROUTE_ORDER_INVALID_RESPONSE_CODE,
    });
  }
  return response;
}
