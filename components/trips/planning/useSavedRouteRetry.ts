// components/trips/planning/useSavedRouteRetry.ts
// #2065: «Повторить» рядом с причиной деградации СОХРАНЁННОГО маршрута
// (`trip.routingState`, показанного шапкой карты и мобильной строкой итога).
// Один хук на обе поверхности — видимость, cooldown и вызов мутации живут в
// одном месте, а `TripPlanRouteMapHeader` (общая для web и native) и
// `RouteBuilderMobile` только рендерят кнопку по готовому состоянию.
//
// Не путать с баннером живого превью (`RoutingStatus` в `RouteBuilder.tsx`,
// `preview.retry`): тот перемонтирует локальный движок маршрутизации, пока
// правки ещё не сохранены. Этот хук вызывает существующий owner-only
// `POST /api/trips/{id}/route-summary/ {provider:'ors', force_refresh:true}`
// (`useRefreshTripRouteElevation`) — он пересчитывает СОХРАНЁННЫЙ маршрут на
// бэкенде и не видит несохранённых правок черновика, поэтому видимость гасится
// сама, пока живое превью владеет отображаемой тройкой geometry/routingState/
// summary (`useTripRouteDisplay`, `previewOwnsDisplay`) — см. `savedRoutingState`.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoutingState } from '@/api/plannedTrips';
import { routingStateRetryable } from '@/components/trips/planning/tripPlanFormatting';
import { useRefreshTripRouteElevation } from '@/hooks/usePlannedTripsApi';

/** ORS сам отдаёт 429 как одну из временных причин — 10 с защищают от повтора лимита. */
export const SAVED_ROUTE_RETRY_COOLDOWN_MS = 10_000;

interface Options {
  tripId: number | string;
  isOwner: boolean;
  /** Тройка, которую сейчас показывает экран (`useTripRouteDisplay.routingState`). */
  routingState: RoutingState | null | undefined;
  /**
   * `trip.routingState` как получен с бэкенда. Кнопка видна только когда
   * `routingState === savedRoutingState` (та же ссылка): `useTripRouteDisplay`
   * отдаёт сохранённое состояние без копирования и подменяет его превью-копией,
   * пока правки не совпадают с сохранёнными (см. заголовок файла) — тогда
   * ссылки расходятся, и кнопка скрыта целиком, а не просто недоступна, чтобы
   * не дублировать баннер живого превью своей копией «Повторить».
   */
  savedRoutingState: RoutingState | null | undefined;
}

export interface SavedRouteRetryState {
  visible: boolean;
  /** Запрос в полёте — единственное состояние со спиннером вместо текста. */
  pending: boolean;
  /** Пока запрос летит и ещё 10 с после ответа (`SAVED_ROUTE_RETRY_COOLDOWN_MS`). */
  disabled: boolean;
  onPress: () => void;
}

export function useSavedRouteRetry({
  tripId,
  isOwner,
  routingState,
  savedRoutingState,
}: Options): SavedRouteRetryState {
  const active = routingState === savedRoutingState;
  const refresh = useRefreshTripRouteElevation();
  // Булев флаг, а не отметка `Date.now()`: переход часов устройства назад не
  // продлевает cooldown — его снимает ровно этот таймер (P3 гейта #2065).
  const [coolingDown, setCoolingDown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const armCooldown = useCallback(() => {
    setCoolingDown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCoolingDown(false), SAVED_ROUTE_RETRY_COOLDOWN_MS);
  }, []);

  const onPress = useCallback(() => {
    if (refresh.isPending || coolingDown) return;
    refresh.mutate({ tripId }, { onSettled: armCooldown });
  }, [armCooldown, coolingDown, refresh, tripId]);

  return {
    visible: active && isOwner && routingStateRetryable(routingState),
    pending: refresh.isPending,
    disabled: refresh.isPending || coolingDown,
    onPress,
  };
}
