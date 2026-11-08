import { useCallback, useMemo } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { userPointDetailsStore } from '@/components/UserPoints/userPointDetailsStore';
import { useAuthStore } from '@/stores/authStore';
import { useSavedPointsCollection } from '@/hooks/useSavedPointsCollection';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import type { ImportedPoint, UserPointPin } from '@/types/userPoints';
import { USER_POINTS_COLLECTION_STALE_TIME_MS, toUserPointPin } from '@/components/UserPoints/userPointPin';

/** Запись общей коллекции: пин (#3161) или полная карточка, записанная мутацией до перевода на пины. */
export type SavedPointLike = UserPointPin | ImportedPoint;

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

function readPointsFromUnknown(data: unknown): SavedPointLike[] {
  if (Array.isArray(data)) return data as SavedPointLike[];
  return [];
}

// Grid step for the coordinate index. COORD_EPSILON = 1e-5, so a 1e-5 grid buckets
// points at the same match granularity; a match may straddle a bucket boundary, so
// lookups also probe the 8 neighbouring cells and re-verify with COORD_EPSILON.
const COORD_INDEX_STEP = COORD_EPSILON;

const coordBucket = (value: number): number => Math.round(value / COORD_INDEX_STEP);
const coordBucketKey = (latBucket: number, lngBucket: number): string =>
  `${latBucket},${lngBucket}`;

export type SavedPointCoordIndex = globalThis.Map<string, SavedPointLike[]>;

export function buildSavedPointCoordIndex(points: SavedPointLike[]): SavedPointCoordIndex {
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
): SavedPointLike | null {
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
  points: SavedPointLike[],
  lat: number,
  lng: number,
): SavedPointLike | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return findSavedPointInIndex(buildSavedPointCoordIndex(points), lat, lng);
}

/**
 * Снять точку из «Моих точек» по её id: оптимистично убрать из общего кэша
 * `userPointsAll` и удалить на сервере. Общий путь для toggle попапа/карточек
 * (`useSavedPointToggle`) и списка точек статьи (`usePointListAddPointModel`).
 */
export async function removeSavedPointFromCollection(
  queryClient: QueryClient,
  owner: string | null,
  targetId: ImportedPoint['id'],
): Promise<void> {
  const key = queryKeys.userPointsAll(owner);
  // Отменяем летящее чтение коллекции: его ответ пришёл бы ПОСЛЕ
  // оптимистичной записи и вернул бы удалённую точку. Трейлингового рефетча, который это чинил, больше нет.
  // Только при уже загруженной коллекции: `cancelQueries` откатывает данные к
  // предыдущему состоянию, и на ПЕРВОМ чтении это `undefined` — оптимистичная
  // запись оставила бы кэш из одной точки, свежий на весь staleTime.
  if (queryClient.getQueryData(key) !== undefined) {
    await queryClient.cancelQueries({ queryKey: key });
  }
  // Оптимистично убираем точку из кэша, чтобы `isSaved` (и ♥) переключились
  // сразу, не дожидаясь рефетча всей коллекции.
  queryClient.setQueryData<SavedPointLike[]>(key, (old) =>
    readPointsFromUnknown(old).filter((p) => p.id !== targetId),
  );
  userPointDetailsStore.remove([Number(targetId)]);
  try {
    await userPointsApi.deletePoint(targetId);
  } catch (e) {
    // Запрос упал — синхронизируем кэш с сервером (точка вернётся).
    void queryClient.invalidateQueries({ queryKey: key });
    throw e;
  }
  // Рефетча на успехе нет намеренно: DELETE прошёл, кэш уже совпадает с сервером.
  // Полный рефетч коллекции на каждое снятие — лишний запрос всех пинов; клиентский лимитер считает
  // `/user-points/` одним ключом (`utils/rateLimiter.ts:58`, 60 запросов в
  // минуту), поэтому серия сохранений упиралась бы в ложное 429.
}

type UseSavedPointToggleArgs = {
  coord: { lat: number; lng: number } | null;
  enabled?: boolean;
};

export function useSavedPointToggle({ coord, enabled = true }: UseSavedPointToggleArgs) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const owner = useQueryOwner();

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

  const removeSaved = useCallback(async () => {
    if (!savedPoint) return;
    await removeSavedPointFromCollection(queryClient, owner, savedPoint.id);
  }, [owner, queryClient, savedPoint]);

  const createPoint = useCallback(
    async (payload: Partial<ImportedPoint>) => {
      // Idempotency guard: backend has no remove-by-coordinate, so if the cache
      // already shows this point as saved we never POST a duplicate.
      if (savedPoint) return;
      const key = queryKeys.userPointsAll(owner);
      const targetLat = Number(payload.latitude ?? coord?.lat);
      const targetLng = Number(payload.longitude ?? coord?.lng);
      if (queryClient.getQueryData(key) === undefined) {
        // Кэш не доказывает отсутствие точки, пока коллекция не прочитана:
        // присоединяемся к летящему чтению пинов (Query.fetch дедуплицирует)
        // и повторяем координатную проверку перед POST. Fail closed: создать
        // до проверки — сделать дубль, сервер по координатам не дедуплицирует.
        const completePoints = await queryClient.fetchQuery<UserPointPin[]>({
          queryKey: key,
          queryFn: () => userPointsApi.getAllPins(),
          staleTime: USER_POINTS_COLLECTION_STALE_TIME_MS,
        });
        if (findSavedPointByCoord(completePoints, targetLat, targetLng)) return;
      }
      // См. `removeSaved`: летящее чтение коллекции затёрло бы оптимистичную
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
      queryClient.setQueryData<SavedPointLike[]>(key, (old) => [
        ...readPointsFromUnknown(old),
        optimistic,
      ]);
      let created: ImportedPoint;
      try {
        created = await userPointsApi.createPoint(payload);
      } catch (e) {
        // Откат: убираем оптимистичную точку.
        queryClient.setQueryData<SavedPointLike[]>(key, (old) =>
          readPointsFromUnknown(old).filter((p) => p.id !== optimisticPointId),
        );
        throw e;
      }
      // Заменяем оптимистичную запись реальной (с серверным id). Полного рефетча
      // на успехе нет — см. `removeSaved`: кэш уже держит серверную запись.
      queryClient.setQueryData<SavedPointLike[]>(key, (old) =>
        readPointsFromUnknown(old).map((p) => (p.id === optimisticPointId ? toUserPointPin(created) : p)),
      );
    },
    [coord, owner, queryClient, savedPoint],
  );

  return {
    isSaved: !!savedPoint,
    savedPointId: savedPoint?.id ?? null,
    isReady: pointsQuery.isTrusted,
    removeSaved,
    createPoint,
  };
}
