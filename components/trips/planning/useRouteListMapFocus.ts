// components/trips/planning/useRouteListMapFocus.ts
// Связь списка точек конструктора с картой: фокус точки по тапу в мобильном
// списке (#1495, перенесён из RouteBuilder.tsx без изменений), свёртка дней и
// показ дня на карте (#2058, `docs/features/trips-plan-route-tab-mock.md` §3).
// Состояние живёт в сессии экрана и на бэкенд не уходит.
import { useCallback, useMemo, useRef, useState } from 'react';

import type { RoutePoint } from '@/api/plannedTrips';
import {
  initialRouteDayCollapse,
  routeDayDropScope,
  routeDayKey,
  syncRouteDayCollapse,
  toggleRouteDay,
  type RouteDayCollapseView,
} from '@/components/trips/planning/routeDayCollapse';
import type { RouteDayGroup } from '@/components/trips/planning/routePointDays';
import type {
  MapFocusIndices,
  MapFocusPoint,
  RouteReplacementToken,
} from '@/components/trips/planning/tripPlanRouteMap.types';

type Options = {
  route: RoutePoint[];
  editingIndex: number | null;
  routeReplacementToken: RouteReplacementToken;
  isMapFirst: boolean;
};

export function useRouteListMapFocus({
  route,
  editingIndex,
  routeReplacementToken,
  isMapFirst,
}: Options) {
  // #1495: тап по точке в списке панели центрует карту на этой точке — только в
  // раскладке `mapFirst`: в `stack` строка точки получает `onFocus=undefined`.
  // Владелец и гость здесь равны (#1700): обе ветки отдают карте один и тот же
  // `focusPoint`. Токен растёт на каждый тап, поэтому повторный тап по той же
  // точке возвращает карту к ней даже после ручного панорамирования.
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
  const focusTokenRef = useRef(0);
  const handleFocusPoint = useCallback(
    (index: number) => {
      const coordinates = route[index]?.coordinates;
      if (!coordinates) return;
      focusTokenRef.current += 1;
      setFocusPoint({ lat: coordinates[1], lng: coordinates[0], token: focusTokenRef.current });
    },
    [route],
  );

  const [focusIndices, setFocusIndices] = useState<MapFocusIndices | null>(null);
  // Мобильная карта стоит блоком над списком: `[⌖]` поднимает к ней страницу.
  const [mapRevealToken, setMapRevealToken] = useState(0);
  const focusDay = useCallback((group: RouteDayGroup) => {
    setFocusIndices((previous) => ({ indices: group.indices, token: (previous?.token ?? 0) + 1 }));
  }, []);

  const input = { route, editingIndex, replacementToken: routeReplacementToken };
  const [session, setSession] = useState(() => initialRouteDayCollapse(input));
  // Авто-раскрытие дня добавленной и редактируемой точки выводится из самого
  // маршрута во время рендера, а не эффектом: иначе строка точки, открытой с
  // карты, на кадр оставалась бы в свёрнутом дне без своей формы.
  const synced = syncRouteDayCollapse(session, input);
  if (synced !== session) setSession(synced);

  const toggleDay = useCallback(
    (group: RouteDayGroup) => {
      const key = routeDayKey(group.dayNumber);
      const expanding = !synced.expanded.has(key);
      setSession((current) => toggleRouteDay(current, key));
      // Desktop: разворот дня сам подгоняет липкую карту справа (§3). На
      // телефоне карта над списком, её подгоняет только `[⌖]`.
      if (expanding && !isMapFirst) focusDay(group);
    },
    [focusDay, isMapFirst, synced],
  );

  const showDayOnMap = useCallback(
    (group: RouteDayGroup) => {
      focusDay(group);
      setMapRevealToken((value) => value + 1);
    },
    [focusDay],
  );

  const dayCollapse = useMemo<RouteDayCollapseView | null>(
    () =>
      synced.collapsible
        ? {
            isExpanded: (key) => synced.expanded.has(key),
            onToggle: toggleDay,
            onShowOnMap: isMapFirst ? showDayOnMap : undefined,
          }
        : null,
    [isMapFirst, showDayOnMap, synced, toggleDay],
  );

  const dropScope = useMemo(
    () => (synced.collapsible ? routeDayDropScope(route) : undefined),
    [route, synced.collapsible],
  );

  return { focusPoint, handleFocusPoint, focusIndices, mapRevealToken, dayCollapse, dropScope };
}
