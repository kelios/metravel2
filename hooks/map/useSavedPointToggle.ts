import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { ImportedPoint } from '@/types/userPoints';

/**
 * #334 — «Сохранить место» должно быть toggle.
 *
 * Раньше кнопка популярного попапа/карточки «Места рядом» всегда вызывала
 * createPoint → один и тот же объект можно было добавить много раз (дубли в «Мои
 * точки», тост «Точка добавлена…» каждый раз), а снять сохранение было нельзя.
 *
 * Этот хук:
 *  - читает текущую коллекцию пользователя из того же кэша React Query
 *    (`userPointsAll`), что и страница «Мои точки», и сопоставляет точку попапа по
 *    координатам (округление до ~метра), чтобы определить, сохранена ли она;
 *  - даёт идемпотентный save (не плодит дубль, если уже сохранено) и remove
 *    (DELETE существующей точки), т.е. полноценный toggle.
 *
 * Координатное сопоставление выбрано потому, что у точек на карте нет стабильного
 * user-point id — это травел-адреса/POI, а не записи коллекции пользователя.
 */

const COORD_EPSILON = 1e-5; // ~1.1 m по широте — достаточно для матча «та же точка»

function readPointsFromUnknown(data: unknown): ImportedPoint[] {
  if (Array.isArray(data)) return data as ImportedPoint[];
  return [];
}

export function findSavedPointByCoord(
  points: ImportedPoint[],
  lat: number,
  lng: number,
): ImportedPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const p of points) {
    const pLat = Number(p?.latitude);
    const pLng = Number(p?.longitude);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
    if (Math.abs(pLat - lat) <= COORD_EPSILON && Math.abs(pLng - lng) <= COORD_EPSILON) {
      return p;
    }
  }
  return null;
}

type UseSavedPointToggleArgs = {
  coord: { lat: number; lng: number } | null;
  enabled?: boolean;
};

export function useSavedPointToggle({ coord, enabled = true }: UseSavedPointToggleArgs) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Same key/queryFn the «Мои точки» page uses, so the saved-state is shared and
  // a save/remove here reflects there (and vice versa) once invalidated.
  const pointsQuery = useQuery({
    queryKey: queryKeys.userPointsAll(),
    queryFn: () => userPointsApi.getPoints({ page: 1, perPage: 1000 }),
    enabled: enabled && isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  const points = useMemo(() => readPointsFromUnknown(pointsQuery.data), [pointsQuery.data]);

  const savedPoint = useMemo(() => {
    if (!coord) return null;
    return findSavedPointByCoord(points, coord.lat, coord.lng);
  }, [coord, points]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() });
  }, [queryClient]);

  const removeSaved = useCallback(async () => {
    if (!savedPoint) return;
    await userPointsApi.deletePoint(savedPoint.id);
    invalidate();
  }, [invalidate, savedPoint]);

  const createPoint = useCallback(
    async (payload: Partial<ImportedPoint>) => {
      // Idempotency guard: backend has no remove-by-coordinate, so if the cache
      // already shows this point as saved we never POST a duplicate.
      if (savedPoint) {
        invalidate();
        return;
      }
      await userPointsApi.createPoint(payload);
      invalidate();
    },
    [invalidate, savedPoint],
  );

  return {
    isSaved: !!savedPoint,
    savedPointId: savedPoint?.id ?? null,
    isReady: !pointsQuery.isLoading,
    removeSaved,
    createPoint,
  };
}
