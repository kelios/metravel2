// components/trips/planning/TripPlanMapFocus.tsx
// Кадр web-карты конструктора: подгонка под маршрут и фокус по запросу списка
// точек. Компоненты живут внутри MapContainer, потому что доступ к
// leaflet-инстансу даёт только `useMap`. Импортирует их только
// `TripPlanRouteMap.web.tsx`; native-карта ставит кадр в WebView.
import React, { useEffect, useLayoutEffect, useRef } from 'react';

import type { RoutePoint } from '@/api/plannedTrips';
import {
  FOCUS_POINT_ZOOM,
  type MapFocusIndices,
  type MapFocusPoint,
  type RouteReplacementToken,
} from '@/components/trips/planning/tripPlanRouteMap.types';
import { isDrawableCoordinatePair } from '@/components/trips/planning/tripPlanFormatting';
import { routeMapFitBoundsOptions } from '@/components/trips/planning/tripPlanMapMarkers';

type LeafletNS = typeof import('leaflet');
type ReactLeafletNS = typeof import('react-leaflet');

/** Зум, ближе которого подгонка под весь маршрут не подводит кадр. */
export const ROUTE_FIT_MAX_ZOOM = 13;

type SizedMap = { getSize?: () => { x: number; y: number } };
/** Размер контейнера карты для отступов подгонки; в jest-моках его нет. */
const mapSize = (map: unknown) => {
  try {
    return (map as SizedMap).getSize?.() ?? null;
  } catch {
    return null;
  }
};

// `fittedTokenRef` живёт в родителе и переживает пересборку карты (#1301: разворот
// на весь экран переносит карту порталом, то есть MapContainer монтируется заново).
// Без него подгонка под маршрут срабатывала бы на каждом развороте и отменяла
// восстановленные центр и зум. Перенесено из `TripPlanRouteMap.web.tsx` (#2059);
// отступы кадра — `routeMapFitBoundsOptions`: капля и кнопки в углах карты.
export function FitRouteBounds({
  L,
  positions,
  useMap,
  fitToken,
  fittedTokenRef,
  lockedRef,
  replacementToken,
  appliedReplacementTokenRef,
}: {
  L: LeafletNS;
  positions: Array<[number, number]>;
  useMap: ReactLeafletNS['useMap'];
  fitToken: string;
  fittedTokenRef: React.MutableRefObject<string | null>;
  /** #1781: пользователь уже наводил кадр руками — подгонка больше не двигает вид. */
  lockedRef: React.MutableRefObject<boolean>;
  /** #1820: счётчик оптовых замен маршрута из `RouteBuilder`. */
  replacementToken: RouteReplacementToken | undefined;
  /** Значение счётчика, на котором подгонка уже отработала. */
  appliedReplacementTokenRef: React.MutableRefObject<RouteReplacementToken | undefined>;
}) {
  const map = useMap();

  // MapContainer removes the Leaflet instance from a passive effect. Stop any
  // pending pan/zoom in the earlier layout cleanup, including remounted maps
  // whose bounds token was already fitted (fullscreen restores their view).
  useLayoutEffect(() => {
    return () => {
      map.stop();
    };
  }, [map]);

  useEffect(() => {
    // #1820: маршрут заменили целиком — шаблоном или импортом трека. Признак
    // приходит сигналом, а не выводится из точек: повторное применение того же
    // шаблона возвращает неперетащенные точки с прежними координатами, и по
    // самим точкам такая замена неотличима от частичной правки.
    //
    // Снимается ДО проверки токена: иначе новый токен запомнился бы как
    // подогнанный, а подгонка не случилась бы уже никогда. Сбрасывается и сам
    // токен — «маршрут заменили целиком» значит «покажи получившийся», даже
    // если форма линии совпала с той, по которой кадр уже наводили.
    if (appliedReplacementTokenRef.current !== replacementToken) {
      appliedReplacementTokenRef.current = replacementToken;
      lockedRef.current = false;
      fittedTokenRef.current = null;
    }
    if (!positions.length) return;
    if (fittedTokenRef.current === fitToken) return;
    fittedTokenRef.current = fitToken;
    // Перетаскивание маркера меняет и точки, и (через 500 мс) геометрию, то есть
    // токен обновляется дважды подряд. Подгонка кадра в этот момент отменяла бы
    // ровно ту точность, ради которой пользователь и тянул маркер, поэтому после
    // ручного перемещения токен только запоминается.
    if (lockedRef.current) return;
    if (positions.length === 1) {
      map.setView(positions[0], 12);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), routeMapFitBoundsOptions(mapSize(map), ROUTE_FIT_MAX_ZOOM));
  }, [
    L,
    appliedReplacementTokenRef,
    fitToken,
    fittedTokenRef,
    lockedRef,
    map,
    positions,
    replacementToken,
  ]);

  return null;
}

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
    map.fitBounds(L.latLngBounds(positions), routeMapFitBoundsOptions(mapSize(map), FOCUS_POINT_ZOOM));
  }, [L, appliedTokenRef, focusIndices, map, route]);

  return null;
}
