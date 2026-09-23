// components/trips/planning/useTripRoutePreview.ts
// Живое превью маршрута конструктора поездки (#1490): пока правки не сохранены,
// линию на карте и цифры в «Итоге» даёт тот же движок, что и /map, а не прямая
// между точками. #873 также включает этот путь для сохранённого маршрута, если
// бэк прислал healthy routing state без пригодной геометрии.
// #2056: маршрут с переездами строится по прогонам — по движку на прогон
// (`TripRoutePreviewEngines`), переезды не прокладываются.
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
  combinePreviewRuns,
  isRoutableTransport,
  previewRouteShapeKey,
  previewRunPlan,
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
  /** Превью нужно для несохранённых правок или ремонта saved healthy/null state. */
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
  /** #2056: точки каждого прогона — по движку на прогон; без переездов прогон один. */
  runs: Array<Array<[number, number]>>;
  transportMode: RoutableTripTransport | null;
  /** Ключ монтирования движка: смена = повторная попытка построения. */
  retryToken: number;
  retry: () => void;
  handleRunResult: (runIndex: number, result: UseMapRoutingResult) => void;
  loading: boolean;
  /** Движок честно вернул «дорогу построить не удалось». */
  degraded: boolean;
  geometry: RouteGeometry | null;
  summary: RouteSummary | null;
  routingState: RoutingState | null;
  elevation: ParsedRoutePreview | null;
}

const IDLE: Omit<TripRoutePreviewState, 'points' | 'runs' | 'retryToken' | 'retry' | 'handleRunResult'> = {
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
    const plan = previewRunPlan(route);
    return { points, plan, transport, key: previewRouteShapeKey(route, transport, plan.segments) };
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
  const [received, setReceived] = useState<{
    key: string;
    retryToken: number;
    results: Array<UseMapRoutingResult | undefined>;
  } | null>(null);

  // Ответ принадлежит запросу, с которым смонтирован конкретный engine. Нельзя
  // читать здесь самый новый `request.key`: пассивный effect старого engine ещё
  // может доехать после правки и тогда пометит старую геометрию новым ключом.
  const engineRequestKey = debounced.key;
  const engineRetryToken = retryToken;
  const currentEngineRef = useRef({ key: request.key, retryToken });
  currentEngineRef.current = { key: request.key, retryToken };
  const handleRunResult = useCallback((runIndex: number, result: UseMapRoutingResult) => {
    const currentEngine = currentEngineRef.current;
    if (
      currentEngine.key !== engineRequestKey
      || currentEngine.retryToken !== engineRetryToken
    ) {
      return;
    }
    setReceived((prev) => {
      const sameRequest = prev?.key === engineRequestKey && prev.retryToken === engineRetryToken;
      const results = sameRequest ? prev.results.slice() : [];
      results[runIndex] = result;
      return { key: engineRequestKey, retryToken: engineRetryToken, results };
    });
  }, [engineRequestKey, engineRetryToken]);

  const retry = useCallback(() => {
    setReceived(null);
    setRetryToken((token) => token + 1);
  }, []);

  const fresh = active
    && received
    && received.key === request.key
    && received.retryToken === retryToken
    ? received.results
    : null;

  return useMemo(() => {
    const shell = {
      points: debounced.points,
      runs: debounced.plan.runs,
      retryToken,
      retry,
      handleRunResult,
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
      // «Строим маршрут» держится и на время дебаунса — своего и внутреннего
      // дебаунса движка: для пользователя это один процесс, а не пауза, во
      // время которой блок статуса моргает и исчезает.
      ...combinePreviewRuns(request.plan, fresh ?? [], route),
    };
  }, [
    active,
    debounced.plan.runs,
    debounced.points,
    engaged,
    fresh,
    handleRunResult,
    request.plan,
    retry,
    retryToken,
    route,
    schematic,
    transport,
  ]);
}
