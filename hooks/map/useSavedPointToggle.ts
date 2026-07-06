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

// Синтетический id для оптимистичной точки в кэше `userPointsAll`, пока сервер не
// вернул реальную запись. Отрицательный, чтобы не столкнуться с реальными id.
const OPTIMISTIC_POINT_ID = -1;

function readPointsFromUnknown(data: unknown): ImportedPoint[] {
  if (Array.isArray(data)) return data as ImportedPoint[];
  return [];
}

// Grid step for the coordinate index. COORD_EPSILON = 1e-5, so a 1e-5 grid buckets
// points at the same match granularity; a match may straddle a bucket boundary, so
// lookups also probe the 8 neighbouring cells and re-verify with COORD_EPSILON.
const COORD_INDEX_STEP = COORD_EPSILON;

const coordBucket = (value: number): number => Math.round(value / COORD_INDEX_STEP);
const coordBucketKey = (latBucket: number, lngBucket: number): string =>
  `${latBucket},${lngBucket}`;

export type SavedPointCoordIndex = globalThis.Map<string, ImportedPoint[]>;

export function buildSavedPointCoordIndex(points: ImportedPoint[]): SavedPointCoordIndex {
  const index: SavedPointCoordIndex = new globalThis.Map();
  for (const p of points) {
    const pLat = Number(p?.latitude);
    const pLng = Number(p?.longitude);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
    const key = coordBucketKey(coordBucket(pLat), coordBucket(pLng));
    const bucket = index.get(key);
    if (bucket) bucket.push(p);
    else index.set(key, [p]);
  }
  return index;
}

function findSavedPointInIndex(
  index: SavedPointCoordIndex,
  lat: number,
  lng: number,
): ImportedPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const latB = coordBucket(lat);
  const lngB = coordBucket(lng);
  // Probe the target cell + 8 neighbours so an epsilon-close point that rounded
  // into an adjacent bucket is still found; verify with the original epsilon.
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const bucket = index.get(coordBucketKey(latB + dLat, lngB + dLng));
      if (!bucket) continue;
      for (const p of bucket) {
        const pLat = Number(p?.latitude);
        const pLng = Number(p?.longitude);
        if (
          Math.abs(pLat - lat) <= COORD_EPSILON &&
          Math.abs(pLng - lng) <= COORD_EPSILON
        ) {
          return p;
        }
      }
    }
  }
  return null;
}

export function findSavedPointByCoord(
  points: ImportedPoint[],
  lat: number,
  lng: number,
): ImportedPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return findSavedPointInIndex(buildSavedPointCoordIndex(points), lat, lng);
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

  // Build the coord index once per points snapshot (O(n)); each popup then matches
  // O(1) instead of rescanning up to 1000 points on every render.
  const coordIndex = useMemo(() => buildSavedPointCoordIndex(points), [points]);

  const savedPoint = useMemo(() => {
    if (!coord) return null;
    return findSavedPointInIndex(coordIndex, coord.lat, coord.lng);
  }, [coord, coordIndex]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() });
  }, [queryClient]);

  const removeSaved = useCallback(async () => {
    if (!savedPoint) return;
    const key = queryKeys.userPointsAll();
    const targetId = savedPoint.id;
    // Оптимистично убираем точку из кэша, чтобы `isSaved` (и иконка ✓→＋)
    // переключились сразу, не дожидаясь рефетча всей коллекции.
    queryClient.setQueryData<ImportedPoint[]>(key, (old) =>
      readPointsFromUnknown(old).filter((p) => p.id !== targetId),
    );
    try {
      await userPointsApi.deletePoint(targetId);
    } catch (e) {
      invalidate(); // запрос упал — синхронизируем кэш с сервером (точка вернётся)
      throw e;
    }
    invalidate();
  }, [invalidate, queryClient, savedPoint]);

  const createPoint = useCallback(
    async (payload: Partial<ImportedPoint>) => {
      // Idempotency guard: backend has no remove-by-coordinate, so if the cache
      // already shows this point as saved we never POST a duplicate.
      if (savedPoint) {
        invalidate();
        return;
      }
      const key = queryKeys.userPointsAll();
      // Оптимистично добавляем синтетическую точку (матчится по координатам в
      // `findSavedPointByCoord`), чтобы иконка ＋→✓ переключилась мгновенно.
      const optimistic = { ...(payload as ImportedPoint), id: OPTIMISTIC_POINT_ID };
      queryClient.setQueryData<ImportedPoint[]>(key, (old) => [
        ...readPointsFromUnknown(old),
        optimistic,
      ]);
      let created: ImportedPoint;
      try {
        created = await userPointsApi.createPoint(payload);
      } catch (e) {
        // Откат: убираем оптимистичную точку.
        queryClient.setQueryData<ImportedPoint[]>(key, (old) =>
          readPointsFromUnknown(old).filter((p) => p.id !== OPTIMISTIC_POINT_ID),
        );
        throw e;
      }
      // Заменяем оптимистичную запись реальной (с серверным id), затем рефетч.
      queryClient.setQueryData<ImportedPoint[]>(key, (old) =>
        readPointsFromUnknown(old).map((p) => (p.id === OPTIMISTIC_POINT_ID ? created : p)),
      );
      invalidate();
    },
    [invalidate, queryClient, savedPoint],
  );

  return {
    isSaved: !!savedPoint,
    savedPointId: savedPoint?.id ?? null,
    isReady: !pointsQuery.isLoading,
    removeSaved,
    createPoint,
  };
}
