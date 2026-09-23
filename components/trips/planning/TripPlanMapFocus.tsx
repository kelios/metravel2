// components/trips/planning/TripPlanMapFocus.tsx
// Фокус web-карты конструктора по запросу списка точек. Оба компонента живут
// внутри MapContainer, потому что доступ к leaflet-инстансу даёт только
// `useMap`. Импортирует их только `TripPlanRouteMap.web.tsx`; native-карта
// фокусируется через MapUiApi WebView.
import React, { useEffect, useRef } from 'react';

import type { RoutePoint } from '@/api/plannedTrips';
import {
  FOCUS_POINT_ZOOM,
  type MapFocusIndices,
  type MapFocusPoint,
} from '@/components/trips/planning/tripPlanRouteMap.types';
import { isDrawableCoordinatePair } from '@/components/trips/planning/tripPlanFormatting';

type LeafletNS = typeof import('leaflet');
type ReactLeafletNS = typeof import('react-leaflet');

/**
 * #1495: центрирование карты на точке, выбранной в списке панели маршрута
 * (перенесено из `TripPlanRouteMap.web.tsx` без изменений).
 */
export function FocusRoutePoint({
  focusPoint,
  useMap,
}: {
  focusPoint: MapFocusPoint | null | undefined;
  useMap: ReactLeafletNS['useMap'];
}) {
  const map = useMap();
  const appliedTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusPoint) return;
    // #1683: запрос фокуса приходит из списка точек, а он отпускает точку по
    // наличию пары (`RouteBuilder.handleFocusPoint`), не по её пригодности.
    // `setView` с нефинитным LatLng бросает уже внутри эффекта — маркерный гард
    // такую точку не спасает. На /map тот же вызов закрыт проверкой координат
    // (`components/MapPage/Map.web.tsx`), здесь — общим предикатом карты плана.
    if (!isDrawableCoordinatePair([focusPoint.lng, focusPoint.lat])) return;
    if (appliedTokenRef.current === focusPoint.token) return;
    appliedTokenRef.current = focusPoint.token;
    map.setView(
      [focusPoint.lat, focusPoint.lng],
      Math.max(map.getZoom() ?? FOCUS_POINT_ZOOM, FOCUS_POINT_ZOOM),
    );
  }, [focusPoint, map]);

  return null;
}

/** [lat, lng] пригодных точек из списка индексов — порядок и дубли не важны. */
export const focusIndicesPositions = (
  route: readonly RoutePoint[],
  indices: readonly number[],
): Array<[number, number]> =>
  indices
    .map((index) => route[index]?.coordinates)
    .filter(isDrawableCoordinatePair)
    .map(([lng, lat]) => [lat, lng]);

/**
 * #2058: кадр под точки дня — разворот дня на desktop и `[⌖]` на телефоне.
 * Применённый токен живёт в родителе, как `fittedTokenRef` у подгонки под
 * маршрут: разворот карты на весь экран пересобирает MapContainer, и повтор
 * запроса затёр бы восстановленный кадр (#1928).
 */
export function FocusRouteIndices({
  L,
  route,
  focusIndices,
  appliedTokenRef,
  useMap,
}: {
  L: LeafletNS;
  route: readonly RoutePoint[];
  focusIndices: MapFocusIndices | null | undefined;
  appliedTokenRef: React.MutableRefObject<number | null>;
  useMap: ReactLeafletNS['useMap'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusIndices || appliedTokenRef.current === focusIndices.token) return;
    const positions = focusIndicesPositions(route, focusIndices.indices);
    if (!positions.length) return;
    appliedTokenRef.current = focusIndices.token;
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom() ?? FOCUS_POINT_ZOOM, FOCUS_POINT_ZOOM));
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [28, 28], maxZoom: FOCUS_POINT_ZOOM });
  }, [L, appliedTokenRef, focusIndices, map, route]);

  return null;
}
