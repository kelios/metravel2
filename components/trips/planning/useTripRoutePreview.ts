// components/trips/planning/useTripRoutePreview.ts
// Живое превью маршрута конструктора поездки (#1490): пока правки не сохранены,
// линию на карте и цифры в «Итоге» даёт тот же движок, что и /map, а не прямая
// между точками. Сохранённый маршрут остаётся за бэкендом — превью его не трогает.
import { useCallback, useMemo, useRef, useState } from 'react';

import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting';
import type {
  RoutableTripTransport,
  RouteGeometry,
  RoutePoint,
  RouteSummary,
  RoutingState,
  TripTransport,
} from '@/api/plannedTrips';
import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  isPreviewDegraded,
  isRoutableTransport,
  previewElevation,
  previewGeometry,
  previewPointsKey,
  previewRoutingState,
  previewSummary,
  routablePreviewPoints,
  schematicRoutingState,
  schematicSummary,
} from './tripRoutePreview';

/**
 * Перетаскивание точки и ввод координат меняют маршрут десятками микро-шагов.
 * Полсекунды тишины — компромисс между «линия перестраивается сразу» и лимитами
 * провайдеров маршрутизации.
 */
export const PREVIEW_DEBOUNCE_MS = 500;

interface Options {
  route: RoutePoint[];
  transport: TripTransport;
  /** Живое превью нужно только пока правки не сохранены. */
  enabled: boolean;
}

export interface TripRoutePreviewState {
  /** Маршрут этого экрана сейчас строит превью, а не бэкенд. */
  engaged: boolean;
  /** Движок маршрутизации должен быть смонтирован. */
  active: boolean;
  /** Транспорт без автопрокладки (public/mixed): линия схематичная. */
  schematic: boolean;
  points: Array<[number, number]>;
  transportMode: RoutableTripTransport | null;
  /** Ключ монтирования движка: смена = повторная попытка построения. */
  retryToken: number;
  retry: () => void;
  handleResult: (result: UseMapRoutingResult) => void;
  loading: boolean;
  /** Движок честно вернул «дорогу построить не удалось». */
  degraded: boolean;
  geometry: RouteGeometry | null;
  summary: RouteSummary | null;
  routingState: RoutingState | null;
  elevation: ParsedRoutePreview | null;
}

const IDLE: Omit<TripRoutePreviewState, 'points' | 'retryToken' | 'retry' | 'handleResult'> = {
  engaged: false,
  active: false,
  schematic: false,
  transportMode: null,
  loading: false,
  degraded: false,
  geometry: null,
  summary: null,
  routingState: null,
  elevation: null,
};

export function useTripRoutePreview({ route, transport, enabled }: Options): TripRoutePreviewState {
  const request = useMemo(() => {
    const points = routablePreviewPoints(route);
    return { points, transport, key: previewPointsKey(points, transport) };
  }, [route, transport]);

  // Дебаунс идёт по всему запросу целиком, иначе точки и транспорт на секунду
  // разъезжаются и движок строит маршрут не того режима.
  const debounced = useDebouncedValue(request, PREVIEW_DEBOUNCE_MS);
  // Пока дебаунс не догнал правку, старый набор точек уже не описывает маршрут:
  // строить по нему нельзя, иначе полсекунды на карте живёт дорога до правки.
  const settled = debounced.key === request.key;

  const routable = isRoutableTransport(transport);
  const schematic = enabled && !routable && request.points.length >= 2;
  const engaged = enabled && routable && request.points.length >= 2;
  const active = engaged && settled && debounced.points.length >= 2;

  const [retryToken, setRetryToken] = useState(0);
  const [received, setReceived] = useState<{ key: string; result: UseMapRoutingResult } | null>(null);

  // Ответ движка принадлежит тому набору точек, который был смонтирован в
  // момент ответа: следующая правка делает его устаревшим сразу, не дожидаясь
  // нового построения.
  const requestKeyRef = useRef(request.key);
  requestKeyRef.current = request.key;

  const handleResult = useCallback((result: UseMapRoutingResult) => {
    setReceived({ key: requestKeyRef.current, result });
  }, []);

  const retry = useCallback(() => {
    setReceived(null);
    setRetryToken((token) => token + 1);
  }, []);

  const fresh = active && received && received.key === request.key ? received.result : null;

  return useMemo(() => {
    const shell = {
      points: debounced.points,
      retryToken,
      retry,
      handleResult,
    };

    if (schematic) {
      return {
        ...IDLE,
        ...shell,
        engaged: true,
        schematic: true,
        routingState: schematicRoutingState(),
        summary: schematicSummary(route),
      };
    }

    if (!engaged) return { ...IDLE, ...shell };

    return {
      ...shell,
      engaged: true,
      active,
      schematic: false,
      transportMode: transport as RoutableTripTransport,
      // «Строим маршрут» держится и на время дебаунса: для пользователя это один
      // и тот же процесс, а не пауза, во время которой ничего не происходит.
      loading: !fresh || fresh.loading,
      degraded: isPreviewDegraded(fresh),
      geometry: previewGeometry(fresh),
      summary: previewSummary(fresh, route),
      routingState: previewRoutingState(fresh),
      elevation: previewElevation(fresh),
    };
  }, [
    active,
    debounced.points,
    engaged,
    fresh,
    handleResult,
    retry,
    retryToken,
    route,
    schematic,
    transport,
  ]);
}
