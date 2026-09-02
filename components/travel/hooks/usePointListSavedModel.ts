import { useCallback, useMemo } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useSavedPointsCollection } from '@/hooks/useSavedPointsCollection';
import {
  buildSavedPointCoordIndex,
  findSavedPointInIndex,
} from '@/hooks/map/useSavedPointToggle';
import type { ImportedPoint } from '@/types/userPoints';

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

function readPointsFromUnknown(data: unknown): ImportedPoint[] {
  if (Array.isArray(data)) return data as ImportedPoint[];
  return [];
}

export function usePointListSavedModel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Контракт полноты коллекции — общий с map-попапом (#1706: одна страница
  // отдавала максимум 200 точек и отметка «сохранено» терялась на хвосте;
  // #1709: недокачанный префикс от экрана «Мои точки» — не полная коллекция).
  const pointsQuery = useSavedPointsCollection({ enabled: isAuthenticated });

  const points = useMemo(() => readPointsFromUnknown(pointsQuery.data), [pointsQuery.data]);
  const coordIndex = useMemo(() => buildSavedPointCoordIndex(points), [points]);

  const isPointSaved = useCallback(
    (coordStr?: string): boolean => {
      if (!isAuthenticated) return false;
      const c = parseCoord(coordStr);
      if (!c) return false;
      return !!findSavedPointInIndex(coordIndex, c.lat, c.lon);
    },
    [coordIndex, isAuthenticated],
  );

  return { isPointSaved };
}
