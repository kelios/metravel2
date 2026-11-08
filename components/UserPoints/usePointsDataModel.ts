import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { logError } from '@/utils/logger';
import { resolveTotalPages } from '@/utils/fetchAllPages';
import { queryKeys } from '@/api/queryKeys';
import {
  USER_POINTS_COLLECTION_STALE_TIME_MS,
  readPointsPaginationState,
  writePointsPaginationState,
  type PointsPaginationState,
} from '@/api/userPointsCollectionCache';
import type { ImportedPoint } from '@/types/userPoints';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import type { PointFilters } from '@/types/userPoints';
import {
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames as mapNamesToIds,
} from '@/utils/userPointsCategories';
import {
  buildPointSearchText,
  haversineKm,
  normalizeCategoryIdsFromPoint,
  normalizePointSearchText,
} from './pointsListLogic';

const NUMERIC_ID_RE = /^\d+$/;

/** Сколько страниц докачки читать параллельно: браузер держит ~6 соединений на хост. */
export const STREAM_CONCURRENCY = 6;
/** Предохранитель от бесконечной докачки на неадекватном `count`/`hasMore`. */
const STREAM_MAX_PAGES = 200;

/**
 * Свежая первая страница поверх уже скачанной коллекции: записи первой
 * страницы заменяются по id, хвост остаётся. Пустой/короткий кэш — сама страница.
 */
export const mergeFirstPageIntoCollection = (
  previous: ImportedPoint[] | undefined,
  firstPage: ImportedPoint[],
): ImportedPoint[] => {
  if (!Array.isArray(previous) || previous.length <= firstPage.length) return firstPage;
  const fresh = new Set(firstPage.map((p) => Number(p?.id)));
  const tail = previous.filter((p) => !fresh.has(Number(p?.id)));
  return [...firstPage, ...tail];
};

type Params = {
  defaultPerPage: number;
  filters: PointFilters;
  searchQuery: string;
  currentLocation: { lat?: number; lng?: number } | null;
  defaultPointColors: string[];
};

export const usePointsDataModel = ({
  defaultPerPage,
  filters,
  searchQuery,
  currentLocation,
  defaultPointColors,
}: Params) => {
  const siteCategoryOptionsQuery = useFilterOptions({
    select: (data) => {
      const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
      return normalizeCategoryDictionary(raw);
    },
  });

  const categoryData = useMemo(() => siteCategoryOptionsQuery.data ?? [], [siteCategoryOptionsQuery.data]);

  const categoryIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoryData as any[]) {
      const id = String((c as any)?.id ?? '').trim();
      const name = String((c as any)?.name ?? id).trim();
      if (!id) continue;
      map.set(id, name || id);
    }
    return map;
  }, [categoryData]);

  const categoryNameToIds = useMemo(() => createCategoryNameToIdsMap(categoryData), [categoryData]);

  const resolveCategoryIdsByNames = useCallback(
    (names: string[]) => mapNamesToIds(names, categoryNameToIds),
    [categoryNameToIds]
  );

  const queryClient = useQueryClient();
  const owner = useQueryOwner();
  // Хвост прежней коллекции, оставленный `queryFn` под свежей первой страницей:
  // докачка его не сеет, а перечитывает (точки, удалённые на другом устройстве,
  // уходят). Остальной кэш — страница 1 и оптимистичные записи (созданная
  // точка встаёт ПЕРЕД страницей 1) — сеется целиком, а не срезом `slice(0, perPage)`,
  // который терял последнюю точку страницы 1 после такой вставки.
  const staleTailRef = useRef<{ owner: string | null; ids: Set<number> } | null>(null);

  // First page renders fast (perPage=defaultPerPage). Remaining pages stream in
  // the background and are appended to the same flat-array cache so map pins and
  // list rows appear incrementally without the first paint waiting for all points.
  const pointsQuery = useQuery({
    queryKey: queryKeys.userPointsAll(owner),
    queryFn: async () => {
      const { items, total } = await userPointsApi.getPointsPage(1, defaultPerPage);
      // #1709: пока докачка не закончилась, в кэше лежит ПРЕФИКС коллекции.
      // Отметка полноты — часть контракта общего ключа: потребители, которым
      // нужна вся коллекция, обязаны её прочитать прежде, чем поверить кэшу.
      // A short page is the end. An oversized page means the backend ignored
      // perPage and returned the complete set in one response (#752).
      const complete = items.length !== defaultPerPage;
      writePointsPaginationState(queryClient, owner, { nextPage: 2, complete, total });
      if (complete) return items;
      // #3130: повторное чтение первой страницы (кэш из персиста старше staleTime,
      // invalidateQueries после импорта) не должно сжимать экран до 200 точек —
      // уже скачанный хвост остаётся на месте, докачка ниже заменит его свежим.
      const merged = mergeFirstPageIntoCollection(
        queryClient.getQueryData<ImportedPoint[]>(queryKeys.userPointsAll(owner)),
        items,
      );
      staleTailRef.current = {
        owner,
        ids: new Set(merged.slice(items.length).map((p) => Number(p?.id))),
      };
      return merged;
    },
    staleTime: USER_POINTS_COLLECTION_STALE_TIME_MS,
  });

  const points = useMemo(() => {
    if (pointsQuery.error) return [];
    return Array.isArray(pointsQuery.data) ? pointsQuery.data : [];
  }, [pointsQuery.data, pointsQuery.error]);

  // #3133: прогресс фоновой докачки для списка («Загружено N из M»). Отметка
  // пагинации пишется через setQueryData без фетча, поэтому читаем её
  // подпиской на тот же ключ: `enabled: false` — никаких запросов, только
  // уведомления об изменении данных.
  const paginationQuery = useQuery<PointsPaginationState | undefined>({
    queryKey: queryKeys.userPointsPagination(owner),
    queryFn: skipToken,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const loadProgress = useMemo(() => {
    const state = paginationQuery.data;
    const loaded = points.length;
    const total =
      typeof state?.total === 'number' && Number.isFinite(state.total) && state.total >= loaded
        ? state.total
        : loaded;
    return {
      loaded,
      total,
      // Без отметки докачка либо не начиналась (пустой кэш), либо кэш заполнен
      // полным чтением — в обоих случаях показывать «из M» нечего.
      complete: state === undefined || state.complete,
      // #3130: оборванная докачка — не «все точки», а префикс с кнопкой «Повторить».
      failed: state?.failed === true,
    };
  }, [paginationQuery.data, points.length]);
  const [streamAttempt, setStreamAttempt] = useState(0);
  const resumeStream = useCallback(() => {
    const state = readPointsPaginationState(queryClient, owner);
    if (state?.failed) {
      writePointsPaginationState(queryClient, owner, { ...state, failed: false });
    }
    setStreamAttempt((n) => n + 1);
  }, [owner, queryClient]);

  const backgroundLoadRef = useRef<{ running: boolean; token: number }>({ running: false, token: 0 });

  // Фоновая докачка остатка коллекции (#3130). Раньше страницы шли строго по
  // очереди (13 round-trip подряд, 3,1 с водопада на 2656 точках) и каждая
  // писалась в кэш отдельно — 13 перерисовок списка, карты и фильтров; ошибка
  // страницы N глоталась, и префикс выглядел полной коллекцией. Теперь хвост
  // читается параллельными пачками по `STREAM_CONCURRENCY`, в кэш уходит одна
  // запись со свежим снимком, а обрыв фиксируется в отметке (`failed`) с
  // кнопкой «Повторить». `dataUpdatedAt` в зависимостях перезапускает докачку
  // после `invalidateQueries` (импорт, другое устройство), `streamAttempt` —
  // по кнопке.
  useEffect(() => {
    if (pointsQuery.isLoading || pointsQuery.error) return;
    const cached = queryClient.getQueryData<ImportedPoint[]>(queryKeys.userPointsAll(owner));
    const count = Array.isArray(cached) ? cached.length : 0;
    let pagination: PointsPaginationState | undefined = readPointsPaginationState(
      queryClient,
      owner,
    );
    if (!pagination) {
      if (count !== defaultPerPage) return;
      pagination = { nextPage: 2, complete: false };
      writePointsPaginationState(queryClient, owner, pagination);
    }
    if (pagination.complete || pagination.failed) return;
    if (backgroundLoadRef.current.running) return;

    const token = backgroundLoadRef.current.token + 1;
    backgroundLoadRef.current = { running: true, token };
    let cancelled = false;
    const isStale = () => cancelled || backgroundLoadRef.current.token !== token;
    const startPage = pagination.nextPage;
    const knownTotal = pagination.total;
    const collectionKey = queryKeys.userPointsAll(owner);
    // Запись в коллекцию во время докачки (удаление, создание, правка) двигает
    // `dataUpdatedAt` и перезапускает эффект, но cleanup приходит только после
    // рендера: снимок, дописанный в этом окне, затёр бы оптимистичную запись.
    const startedAt = queryClient.getQueryState(collectionKey)?.dataUpdatedAt;
    const staleTail = staleTailRef.current?.owner === owner ? staleTailRef.current.ids : null;

    (async () => {
      try {
        const collected = new Map<number, ImportedPoint>();
        for (const point of Array.isArray(cached) ? cached : []) {
          const id = Number(point?.id);
          if (!staleTail?.has(id)) collected.set(id, point);
        }
        // «Новые» id для стоп-условия #752 считаются против страницы 1 и уже
        // прочитанных страниц, а не против всего сида: недоотслеженный хвост в
        // кэше (персист посреди докачки) не должен обрывать докачку раньше конца.
        const seen = new Set<number>(
          staleTail
            ? collected.keys()
            : (Array.isArray(cached) ? cached.slice(0, defaultPerPage) : []).map((p) => Number(p?.id)),
        );
        let total = knownTotal;
        // Без серверного count число страниц неизвестно — идём пачками, пока
        // страница не окажется короткой или пустой.
        let page = startPage;
        let reachedEnd = false;
        while (!reachedEnd && page <= STREAM_MAX_PAGES) {
          const lastKnownPage =
            typeof total === 'number' && Number.isFinite(total) && total > 0
              ? resolveTotalPages({ total, pageSize: defaultPerPage, maxPages: STREAM_MAX_PAGES })
              : null;
          const batchEnd = Math.min(
            page + STREAM_CONCURRENCY - 1,
            lastKnownPage ?? page + STREAM_CONCURRENCY - 1,
            STREAM_MAX_PAGES,
          );
          if (batchEnd < page) break;
          const pages = Array.from({ length: batchEnd - page + 1 }, (_, i) => page + i);
          const results = await Promise.all(
            pages.map((n) => userPointsApi.getPointsPage(n, defaultPerPage)),
          );
          if (isStale()) return;
          let added = 0;
          for (const result of results) {
            if (typeof result.total === 'number' && Number.isFinite(result.total) && result.total > 0) {
              total = result.total;
            }
            for (const point of result.items) {
              const id = Number(point?.id);
              // Свежая копия с сервера заменяет закэшированную.
              collected.set(id, point);
              if (!seen.has(id)) {
                seen.add(id);
                added += 1;
              }
            }
            if (!result.hasMore) reachedEnd = true;
          }
          // Пачка без новых id — сервер не пагинирует (#752) или конец позади.
          if (added === 0) reachedEnd = true;
          page = batchEnd + 1;
          if (lastKnownPage !== null && page > lastKnownPage) reachedEnd = true;
        }
        if (isStale() || queryClient.getQueryState(collectionKey)?.dataUpdatedAt !== startedAt) return;
        const snapshot = Array.from(collected.values());
        // Сначала отметка, потом данные: запись данных двигает `dataUpdatedAt`
        // и перезапускает этот эффект, который обязан увидеть `complete`.
        writePointsPaginationState(queryClient, owner, {
          nextPage: page,
          complete: true,
          total: snapshot.length,
        });
        // Одна запись: свежий снимок заменяет и префикс, и прежний хвост (в том
        // числе точки, удалённые с другого устройства).
        queryClient.setQueryData(collectionKey, snapshot);
        if (staleTailRef.current?.owner === owner) staleTailRef.current = null;
      } catch (error) {
        if (isStale()) return;
        logError(error, { scope: 'usePointsDataModel.stream', page: startPage });
        writePointsPaginationState(queryClient, owner, {
          nextPage: startPage,
          complete: false,
          total: knownTotal,
          failed: true,
        });
      } finally {
        if (backgroundLoadRef.current.token === token) {
          backgroundLoadRef.current.running = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      // Release the slot synchronously: on a fast remount (StrictMode) the new
      // effect must be able to start without waiting for the aborted loop's
      // finally block.
      if (backgroundLoadRef.current.token === token) {
        backgroundLoadRef.current.running = false;
      }
    };
  }, [
    defaultPerPage,
    owner,
    pointsQuery.dataUpdatedAt,
    pointsQuery.error,
    pointsQuery.isLoading,
    queryClient,
    streamAttempt,
  ]);

  const pointsWithDerivedCategories = useMemo(() => {
    return (points as any[]).map((p) => {
      const categoryIds = normalizeCategoryIdsFromPoint(p);
      const categoryNames = categoryIds
        .map((id) => categoryIdToName.get(id) ?? id)
        .map((v) => String(v).trim())
        .filter(Boolean);
      // #3132: индекс поиска считается здесь один раз на загрузку/смену словаря
      // категорий, а не на каждую букву в фильтре ниже. Реальные точки хранят
      // категорию строкой-именем («Парковка», нет в словаре) — она идёт в индекс;
      // голый числовой id без имени («12») — нет, иначе ложные совпадения по цифрам.
      const searchCategoryNames = [
        ...categoryNames,
        typeof p?.category === 'string' ? p.category.trim() : '',
      ].filter((name) => name !== '' && !NUMERIC_ID_RE.test(name));
      const searchText = buildPointSearchText(p, searchCategoryNames);
      return { ...p, categoryIds, categoryNames, searchText };
    });
  }, [categoryIdToName, points]);

  const baseFilteredPoints = useMemo(() => {
    const q = normalizePointSearchText(searchQuery);
    const selectedColors = filters.colors ?? [];
    const selectedStatuses = filters.statuses ?? [];
    const radiusKm = filters.radiusKm;

    const radiusFilterEnabled = radiusKm !== null && radiusKm !== undefined && currentLocation;
    const userLat = Number(currentLocation?.lat);
    const userLng = Number(currentLocation?.lng);
    const radius = Number(radiusKm);
    const canDoRadius =
      Boolean(radiusFilterEnabled) &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng) &&
      Number.isFinite(radius) &&
      radius > 0;

    const latDelta = canDoRadius ? radius / 111 : 0;
    const lngDelta = canDoRadius ? radius / (111 * Math.max(0.2, Math.cos((userLat * Math.PI) / 180))) : 0;
    const minLat = canDoRadius ? userLat - latDelta : 0;
    const maxLat = canDoRadius ? userLat + latDelta : 0;
    const minLng = canDoRadius ? userLng - lngDelta : 0;
    const maxLng = canDoRadius ? userLng + lngDelta : 0;

    return pointsWithDerivedCategories.filter((p: any) => {
      if (selectedColors.length > 0 && !selectedColors.includes(p.color)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;

      if (canDoRadius) {
        const pointLat = Number(p.latitude);
        const pointLng = Number(p.longitude);
        if (Number.isFinite(pointLat) && Number.isFinite(pointLng)) {
          if (pointLat < minLat || pointLat > maxLat || pointLng < minLng || pointLng > maxLng) return false;
          const distance = haversineKm(userLat, userLng, pointLat, pointLng);
          if (distance > radius) return false;
        }
      }

      if (!q) return true;
      return String(p.searchText ?? '').includes(q);
    });
  }, [currentLocation, filters.colors, filters.radiusKm, filters.statuses, pointsWithDerivedCategories, searchQuery]);

  const availableCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of baseFilteredPoints as any[]) {
      const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
      for (const id of ids) {
        const norm = String(id).trim();
        if (!norm) continue;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => ({ id, name: categoryIdToName.get(id) ?? id }));
  }, [baseFilteredPoints, categoryIdToName]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, number>();
    for (const p of points as any[]) {
      const c = String(p?.color ?? '').trim();
      if (c) {
        colorMap.set(c, (colorMap.get(c) || 0) + 1);
      }
    }

    const observed = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const c of observed) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }
    for (const c of defaultPointColors) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }

    return merged;
  }, [defaultPointColors, points]);

  const manualColorOptions = useMemo(() => {
    const base = [...defaultPointColors, ...(availableColors ?? [])];
    const unique = Array.from(new Set(base.map((c) => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : defaultPointColors.slice();
  }, [availableColors, defaultPointColors]);

  const filteredPoints = useMemo(() => {
    const selectedCategoryIds = filters.categoryIds ?? [];
    if (!selectedCategoryIds.length) return baseFilteredPoints;

    return baseFilteredPoints.filter((p: any) => {
      const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
      return selectedCategoryIds.some((id) => ids.includes(id));
    });
  }, [baseFilteredPoints, filters.categoryIds]);

  return {
    points,
    isLoading: pointsQuery.isLoading,
    // Загрузка не удалась (ошибка сети/API или offlineFirst-пауза без кэша):
    // список пуст НЕ потому, что у пользователя нет точек — UI обязан показать
    // ошибку с «Повторить», а не «У вас пока нет точек».
    loadFailed:
      Boolean(pointsQuery.error) ||
      (pointsQuery.fetchStatus === 'paused' && !Array.isArray(pointsQuery.data)),
    refetch: pointsQuery.refetch,
    loadProgress,
    resumeStream,
    categoryIdToName,
    categoryData,
    resolveCategoryIdsByNames,
    availableCategoryOptions,
    availableColors,
    manualColorOptions,
    filteredPoints,
  };
};
