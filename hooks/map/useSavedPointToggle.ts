import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import {
  isPointsCollectionPartial,
  markPointsCollectionComplete,
} from '@/api/userPointsCollectionCache';
import { useAuthStore } from '@/stores/authStore';
import { useSavedPointsCollection } from '@/hooks/useSavedPointsCollection';
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

// Each in-flight create needs its own synthetic id. Reusing one `-1` made the
// first response replace every concurrent optimistic point and lose the later
// server records. Negative ids do not overlap backend ids.
let nextOptimisticPointId = -1;

const allocateOptimisticPointId = (): number => {
  const id = nextOptimisticPointId;
  nextOptimisticPointId -= 1;
  return id;
};

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

export function findSavedPointInIndex(
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

  // Общий с «Моими точками» кэш-ключ, поэтому сохранение/снятие здесь видно там
  // (и наоборот). Полнота коллекции — контракт `useSavedPointsCollection`
  // (#1706, #1709), общий с карточкой путешествия.
  const pointsQuery = useSavedPointsCollection({ enabled: enabled && isAuthenticated });

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
    // Отменяем летящее чтение коллекции: она читается постранично (#1706) и
    // резолвится долго, поэтому её ответ пришёл бы ПОСЛЕ оптимистичной записи и
    // вернул бы удалённую точку. Трейлингового рефетча, который это чинил, больше нет.
    // Только при уже загруженной коллекции: `cancelQueries` откатывает данные к
    // предыдущему состоянию, и на ПЕРВОМ чтении это `undefined` — оптимистичная
    // запись оставила бы кэш из одной точки, свежий на весь staleTime.
    if (queryClient.getQueryData(key) !== undefined) {
      await queryClient.cancelQueries({ queryKey: key });
    }
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
    // Рефетча на успехе нет намеренно: DELETE прошёл, кэш уже совпадает с сервером.
    // #1706 — коллекция читается постранично, и полный рефетч стоил бы
    // ceil(count/200) запросов на каждое снятие. Клиентский лимитер считает
    // `/user-points/` одним ключом (`utils/rateLimiter.ts:58`, 60 запросов в
    // минуту), поэтому серия сохранений упиралась бы в ложное 429.
  }, [invalidate, queryClient, savedPoint]);

  const createPoint = useCallback(
    async (payload: Partial<ImportedPoint>) => {
      // Idempotency guard: backend has no remove-by-coordinate, so if the cache
      // already shows this point as saved we never POST a duplicate.
      if (savedPoint) return;
      const key = queryKeys.userPointsAll();
      const hasCollection = queryClient.getQueryData(key) !== undefined;
      const collectionPartial = isPointsCollectionPartial(queryClient);
      const targetLat = Number(payload.latitude ?? coord?.lat);
      const targetLng = Number(payload.longitude ?? coord?.lng);
      if (!hasCollection || collectionPartial) {
        // The cache cannot prove absence while its first full read is pending or
        // while it contains a streamed prefix (#1709). Join the active full
        // read (Query.fetch deduplicates it), then repeat the coordinate guard
        // before POST. Failing closed is intentional: creating before this check
        // can duplicate a point which exists beyond the cached prefix.
        let completePoints = await queryClient.fetchQuery<ImportedPoint[]>({
          queryKey: key,
          queryFn: async () => {
            const allPoints = await userPointsApi.getAllPoints();
            markPointsCollectionComplete(queryClient);
            return allPoints;
          },
          staleTime: 0,
        });
        // A full-read consumer can mount while `usePointsDataModel` is fetching
        // page 1 under the same key. React Query joins that request, whose result
        // is only a prefix. Once it settles, run the required full query.
        if (isPointsCollectionPartial(queryClient)) {
          completePoints = await queryClient.fetchQuery<ImportedPoint[]>({
            queryKey: key,
            queryFn: async () => {
              const allPoints = await userPointsApi.getAllPoints();
              markPointsCollectionComplete(queryClient);
              return allPoints;
            },
            staleTime: 0,
          });
          if (isPointsCollectionPartial(queryClient)) {
            throw new Error('Saved points collection is still partial');
          }
        }
        if (findSavedPointByCoord(completePoints, targetLat, targetLng)) return;
      }
      // См. `removeSaved`: летящее постраничное чтение затёрло бы оптимистичную
      // точку, пользователь увидел бы «не сохранено» и создал дубль — сервер не
      // умеет дедуплицировать по координатам.
      await queryClient.cancelQueries({ queryKey: key });
      // Re-read after the async boundary. Another mounted card may have created
      // this coordinate while both calls were waiting for the shared collection
      // read or cancelQueries; its optimistic entry deduplicates this POST.
      const latestPoints = readPointsFromUnknown(queryClient.getQueryData(key));
      if (findSavedPointByCoord(latestPoints, targetLat, targetLng)) return;
      // Оптимистично добавляем синтетическую точку (матчится по координатам в
      // `findSavedPointByCoord`), чтобы иконка ＋→✓ переключилась мгновенно.
      const optimisticPointId = allocateOptimisticPointId();
      const optimistic = { ...(payload as ImportedPoint), id: optimisticPointId };
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
          readPointsFromUnknown(old).filter((p) => p.id !== optimisticPointId),
        );
        throw e;
      }
      // Заменяем оптимистичную запись реальной (с серверным id). Полного рефетча
      // на успехе нет — см. `removeSaved`: кэш уже держит серверную запись.
      queryClient.setQueryData<ImportedPoint[]>(key, (old) =>
        readPointsFromUnknown(old).map((p) => (p.id === optimisticPointId ? created : p)),
      );
    },
    [coord, queryClient, savedPoint],
  );

  return {
    isSaved: !!savedPoint,
    savedPointId: savedPoint?.id ?? null,
    isReady: pointsQuery.isTrusted,
    removeSaved,
    createPoint,
  };
}
