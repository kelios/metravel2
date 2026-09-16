// components/trips/planning/useRouteOrderSuggestion.ts
// #1899: состояние «Предложить оптимальный порядок» для шага «Точки маршрута».
//
// Черновик маршрута живёт в RouteBuilder, а не здесь: хук получает его вход
// перестановки и зовёт его только по «Применить». Каждый ответ помнит ключ
// черновика, для которого его просили; стоит точкам, координатам, транспорту или
// типу велосипеда поменяться — ответ перестаёт показываться и применяться.
import { useCallback, useMemo, useRef, useState } from 'react';

import type { RoutePoint, TripBikeType, TripTransport } from '@/api/plannedTrips';
import { optimizeRouteOrder } from '@/api/routeOrderOptimization';
import {
  applyRouteOrderMoves,
  buildRouteOrderRequest,
  isIdentityOrder,
  routeOrderAvailability,
  routeOrderErrorKind,
  routeOrderMoves,
  routeOrderPreviewRows,
  routeOrderSnapshotKey,
  type RouteOrderAvailability,
  type RouteOrderErrorKind,
  type RouteOrderPreviewRow,
} from './routePointOrder';

/** Что конструктор отдаёт блоку предложения: транспорт поездки и вход перестановки. */
export interface RouteOrderSuggestionTarget {
  transport: TripTransport;
  bikeType: TripBikeType | null;
  /**
   * `RouteBuilder.handleReorder` — единственный вход перестановки, общий со
   * стрелками и drag&drop: открытый редактор едет вместе со своей точкой.
   */
  onReorder: (from: number, to: number) => void;
}

export type RouteOrderSuggestionStatus =
  | 'idle'
  | 'pending'
  | 'preview'
  /** Сервер вернул текущий порядок: предлагать нечего. */
  | 'unchanged'
  /** Порядок применён к черновику, но ещё не сохранён. */
  | 'applied'
  | 'error';

type SuggestionState =
  | { status: 'idle' }
  | { status: 'pending' | 'unchanged' | 'applied'; key: string }
  | { status: 'preview'; key: string; order: number[] }
  | { status: 'error'; key: string; kind: RouteOrderErrorKind };

const IDLE: SuggestionState = { status: 'idle' };

export interface RouteOrderSuggestion {
  availability: RouteOrderAvailability;
  status: RouteOrderSuggestionStatus;
  errorKind: RouteOrderErrorKind | null;
  rows: RouteOrderPreviewRow[];
  request: () => void;
  apply: () => void;
  dismiss: () => void;
}

export function useRouteOrderSuggestion(
  route: RoutePoint[],
  { transport, bikeType, onReorder }: RouteOrderSuggestionTarget,
): RouteOrderSuggestion {
  const availability = routeOrderAvailability(route, transport);
  const snapshotKey = useMemo(
    () => routeOrderSnapshotKey(route, transport, bikeType),
    [bikeType, route, transport],
  );
  const [state, setState] = useState<SuggestionState>(IDLE);
  // Номер последнего запроса: ответ старого запроса не перетирает состояние
  // нового. Ключ в полёте ловит повторное нажатие синхронно — `pending` из state
  // появится только со следующим рендером.
  const requestSeqRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);

  const current = state.status !== 'idle' && state.key === snapshotKey ? state : IDLE;

  const request = useCallback(() => {
    if (availability !== 'ready' || inFlightKeyRef.current === snapshotKey) return;
    const body = buildRouteOrderRequest(route, transport, bikeType);
    if (!body) return;
    const seq = requestSeqRef.current + 1;
    const key = snapshotKey;
    requestSeqRef.current = seq;
    inFlightKeyRef.current = key;
    setState({ status: 'pending', key });
    optimizeRouteOrder(body).then(
      ({ order }) => {
        if (requestSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        setState(
          isIdentityOrder(order) ? { status: 'unchanged', key } : { status: 'preview', key, order },
        );
      },
      (error: unknown) => {
        if (requestSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        setState({ status: 'error', key, kind: routeOrderErrorKind(error) });
      },
    );
  }, [availability, bikeType, route, snapshotKey, transport]);

  const apply = useCallback(() => {
    if (current.status !== 'preview') return;
    const moves = routeOrderMoves(current.order);
    // Каждый ход — обычная перестановка: функциональные апдейты черновика и
    // индекса редактора встают в очередь и применяются одним рендером.
    moves.forEach(([from, to]) => onReorder(from, to));
    // Отметка «применено» принадлежит уже переставленному черновику: следующая
    // правка точек снимет её так же, как снимает предпросмотр.
    setState({
      status: 'applied',
      key: routeOrderSnapshotKey(applyRouteOrderMoves(route, moves), transport, bikeType),
    });
  }, [bikeType, current, onReorder, route, transport]);

  const dismiss = useCallback(() => setState(IDLE), []);

  const rows = useMemo(
    () => (current.status === 'preview' ? routeOrderPreviewRows(route, current.order) : []),
    [current, route],
  );

  return {
    availability,
    status: current.status,
    errorKind: current.status === 'error' ? current.kind : null,
    rows,
    request,
    apply,
    dismiss,
  };
}
