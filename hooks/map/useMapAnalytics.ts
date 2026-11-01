import { useCallback, useEffect, useRef } from 'react';
import {
  trackMapFilterChanged,
  trackMapOpened,
  trackMapRouteBuilt,
  type MapOpenEntry,
} from '@/utils/mapAnalytics';

type Options = {
  isFocused: boolean;
  isMobile: boolean;
  hasUrlPlace: boolean;
  hasUrlCoordinates: boolean;
  handleFilterChangeForPanel: (field: string, value: unknown) => void;
  resetFilters: () => void;
  transportMode: string;
  routePointsCount: number;
  routeDistance: number | null | undefined;
};

/**
 * Телеметрия экрана /map (#2908): открытие, смена фильтров, построенный
 * маршрут. Вкладка карты после первого визита остаётся смонтированной
 * (`lazy` без размонтирования на blur), поэтому «открытие» — каждый переход
 * экрана в фокус, а не монтирование. Открытие маркера считается в рендер-адаптере (`Map.web.tsx`), где
 * известен способ показа — попап или нижняя карточка.
 *
 * Текстовые поля фильтров (`searchQuery`, `address`) меняются на каждую букву
 * и событием не считаются: смена фильтра — это выбор категории или радиуса.
 */
export function useMapAnalytics({
  isFocused,
  isMobile,
  hasUrlPlace,
  hasUrlCoordinates,
  handleFilterChangeForPanel,
  resetFilters,
  transportMode,
  routePointsCount,
  routeDistance,
}: Options) {
  // Остальные поля читаются в момент фокуса: ресайз и смена якорей при уже
  // открытом экране новое «открытие» не дают.
  const openContextRef = useRef({ isMobile, hasUrlPlace, hasUrlCoordinates });
  openContextRef.current = { isMobile, hasUrlPlace, hasUrlCoordinates };
  useEffect(() => {
    if (!isFocused) return;
    const ctx = openContextRef.current;
    const entry: MapOpenEntry = ctx.hasUrlPlace ? 'place_link' : ctx.hasUrlCoordinates ? 'coords_link' : 'direct';
    trackMapOpened({ entry, isMobile: ctx.isMobile });
  }, [isFocused]);

  const trackedFilterChange = useCallback(
    (field: string, value: unknown) => {
      handleFilterChangeForPanel(field, value);
      if ((field === 'categories' || field === 'categoryTravelAddress') && Array.isArray(value)) {
        trackMapFilterChanged({ filter: field, valueCount: value.length });
        return;
      }
      if (field === 'radius' && typeof value === 'string') {
        const radiusKm = Number(value);
        trackMapFilterChanged({
          filter: 'radius',
          radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
        });
      }
    },
    [handleFilterChangeForPanel],
  );

  const trackedResetFilters = useCallback(() => {
    resetFilters();
    trackMapFilterChanged({ filter: 'reset' });
  }, [resetFilters]);

  // Один маршрут — одно событие: пересчёт той же геометрии (ресайз, повторный
  // ответ роутера) не повторяет его; новый набор точек или транспорт — повторяет.
  // Точки маршрута переживают перезагрузку (persist-стор): первое построение
  // восстановленного маршрута — не действие пользователя в этом визите.
  const lastRouteKeyRef = useRef<string | null>(null);
  const restoredRouteRef = useRef(routePointsCount >= 2);
  const mountPointsCountRef = useRef(routePointsCount);
  useEffect(() => {
    // Пользователь изменил восстановленный маршрут — дальше любые построения его.
    if (routePointsCount !== mountPointsCountRef.current) restoredRouteRef.current = false;
    const distance = typeof routeDistance === 'number' && Number.isFinite(routeDistance) ? routeDistance : 0;
    if (distance <= 0 || routePointsCount < 2) {
      if (routePointsCount < 2) {
        lastRouteKeyRef.current = null;
        restoredRouteRef.current = false;
      }
      return;
    }
    const key = `${transportMode}:${routePointsCount}:${Math.round(distance)}`;
    if (lastRouteKeyRef.current === key) return;
    lastRouteKeyRef.current = key;
    if (restoredRouteRef.current) {
      restoredRouteRef.current = false;
      return;
    }
    trackMapRouteBuilt({ transportMode, pointsCount: routePointsCount, distanceMeters: distance });
  }, [routeDistance, routePointsCount, transportMode]);

  return { trackedFilterChange, trackedResetFilters };
}
