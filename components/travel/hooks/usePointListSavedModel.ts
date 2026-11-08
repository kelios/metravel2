import { useCallback, useMemo } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useSavedPointsCollection } from '@/hooks/useSavedPointsCollection';
import {
  buildSavedPointCoordIndex,
  findSavedPointInIndex,
  type SavedPointLike,
} from '@/hooks/map/useSavedPointToggle';

/**
 * #839 — карточки точек путешествия должны показывать, сохранена ли точка в
 * «Мои точки». Читаем ту же коллекцию (`userPointsAll`), что и страница «Мои
 * точки» и map-popup, строим координатный индекс ОДИН раз на снапшот и отдаём
 * O(1)-матчер по координатам точки маршрута (у travel-адресов нет user-point id).
 */

const parseCoord = (coordStr?: string): { lat: number; lon: number } | null => {
  if (!coordStr) return null;
  const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

function readPointsFromUnknown(data: unknown): SavedPointLike[] {
  if (Array.isArray(data)) return data as SavedPointLike[];
  return [];
}

export function usePointListSavedModel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Коллекция пинов — общая с map-попапом и экраном «Мои точки» (#3161):
  // все точки владельца одним ответом, координатный матчер видит весь хвост.
  const pointsQuery = useSavedPointsCollection({ enabled: isAuthenticated });

  const points = useMemo(() => readPointsFromUnknown(pointsQuery.data), [pointsQuery.data]);
  const coordIndex = useMemo(() => buildSavedPointCoordIndex(points), [points]);

  // Запись «Моих точек» на координате точки маршрута — её id нужен ♥ для снятия.
  const findSavedPoint = useCallback(
    (coordStr?: string): SavedPointLike | null => {
      if (!isAuthenticated) return null;
      const c = parseCoord(coordStr);
      if (!c) return null;
      return findSavedPointInIndex(coordIndex, c.lat, c.lon);
    },
    [coordIndex, isAuthenticated],
  );

  const isPointSaved = useCallback(
    (coordStr?: string): boolean => findSavedPoint(coordStr) !== null,
    [findSavedPoint],
  );

  return { findSavedPoint, isPointSaved };
}
