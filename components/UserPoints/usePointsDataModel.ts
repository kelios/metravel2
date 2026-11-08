import { useCallback, useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import type { ImportedPoint, PointFilters, UserPointPin } from '@/types/userPoints';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import {
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames as mapNamesToIds,
} from '@/utils/userPointsCategories';
import { haversineKm, normalizeCategoryIdsFromPoint, normalizePointSearchText } from './pointsListLogic';
import { userPointDetailsStore, useUserPointDetailsOwner } from './userPointDetailsStore';
import { USER_POINTS_COLLECTION_STALE_TIME_MS } from './userPointPin';

/** Пауза между перечитываниями коллекции из-за исчезнувших на сервере точек. */
const MISSING_REFETCH_MIN_INTERVAL_MS = 30 * 1000;

type Params = {
  filters: PointFilters;
  searchQuery: string;
  currentLocation: { lat?: number; lng?: number } | null;
  defaultPointColors: string[];
};

/** Пин с категориями сайта, приведёнными к строковым id (как в фильтре). */
export type ModelPoint = UserPointPin & { categoryIds: string[] };

const NUMERIC_ID_RE = /^\d+$/;

/**
 * Категории сайта пина: `category_ids` бэкенда (#3172); у пина без связей или
 * от бэкенда до #3172 — свободное имя категории (`category`, legacy-поля
 * полной карточки) через словарь имён → id.
 */
const toSiteCategoryIds = (
  pin: UserPointPin | ImportedPoint,
  resolveNames: (names: string[]) => string[],
): string[] => {
  const linked = (pin as UserPointPin).category_ids;
  if (Array.isArray(linked) && linked.length > 0) {
    return linked.map((id) => String(id).trim()).filter(Boolean);
  }
  const raw = normalizeCategoryIdsFromPoint(pin);
  const ids = raw.filter((value) => NUMERIC_ID_RE.test(value));
  const names = raw.filter((value) => !NUMERIC_ID_RE.test(value));
  return names.length > 0 ? Array.from(new Set([...ids, ...resolveNames(names)])) : ids;
};

/**
 * Модель данных «Моих точек» (#3161): коллекция = лёгкие пины всех точек
 * владельца одним запросом (`fields=pins`, ~34 КБ gzip у владельца вместо
 * 1,1 МБ четырнадцатью страницами). Цвет, статус, радиус и категории сайта
 * фильтруются здесь; поиск — на сервере (`search=`), потому что названия и
 * адреса в пинах не живут; полные карточки подгружаются окном
 * (`userPointDetailsStore`).
 */
export const usePointsDataModel = ({
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

  const owner = useQueryOwner();
  useUserPointDetailsOwner(owner);
  const queryClient = useQueryClient();
  // Сервер не вернул карточку по `ids=` — точка удалена с другого устройства:
  // перечитать пины (не чаще раза в полминуты), чтобы пин ушёл с карты и из списка.
  const lastMissingRefetchRef = useRef(0);
  useEffect(
    () =>
      userPointDetailsStore.onMissing(() => {
        const now = Date.now();
        if (now - lastMissingRefetchRef.current < MISSING_REFETCH_MIN_INTERVAL_MS) return;
        lastMissingRefetchRef.current = now;
        void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll(owner) });
      }),
    [owner, queryClient],
  );

  const pinsQuery = useQuery({
    queryKey: queryKeys.userPointsAll(owner),
    queryFn: () => userPointsApi.getAllPins(),
    staleTime: USER_POINTS_COLLECTION_STALE_TIME_MS,
  });

  // Серверный поиск: отдельный ключ на запрос, прежний результат держится до
  // прихода нового (`keepPreviousData`), чтобы список не мигал пустотой.
  const normalizedSearch = normalizePointSearchText(searchQuery);
  const searchQueryResult = useQuery({
    queryKey: queryKeys.userPointsSearch(owner, normalizedSearch),
    queryFn: normalizedSearch
      ? () => userPointsApi.getAllPins({ search: normalizedSearch })
      : skipToken,
    staleTime: USER_POINTS_COLLECTION_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  const allPins = useMemo<UserPointPin[]>(
    () => (Array.isArray(pinsQuery.data) ? (pinsQuery.data as UserPointPin[]) : []),
    [pinsQuery.data]
  );

  // Поиск сужает коллекцию до id, найденных сервером; остальные поля (цвет,
  // статус, координаты) берём из общей коллекции — она свежее после
  // оптимистичных правок.
  const searchedPins = useMemo<UserPointPin[] | null>(() => {
    if (!normalizedSearch) return null;
    const found = searchQueryResult.data;
    // Упавший поиск — пустой результат + состояние ошибки (`loadFailed`), а не
    // вся коллекция под строкой запроса, будто всё совпало.
    if (searchQueryResult.error && !Array.isArray(found)) return [];
    if (!Array.isArray(found)) return null;
    const ids = new Set(found.map((p: UserPointPin) => Number(p?.id)));
    return allPins.filter((p) => ids.has(Number(p?.id)));
  }, [allPins, normalizedSearch, searchQueryResult.data, searchQueryResult.error]);

  const points = useMemo<ModelPoint[]>(
    () => (searchedPins ?? allPins).map((p) => ({ ...p, categoryIds: toSiteCategoryIds(p, resolveCategoryIdsByNames) })),
    [allPins, resolveCategoryIdsByNames, searchedPins]
  );

  const baseFilteredPoints = useMemo(() => {
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

    return points.filter((p) => {
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
      return true;
    });
  }, [currentLocation, filters.colors, filters.radiusKm, filters.statuses, points]);

  // Фасеты категорий — по категориям сайта пинов (`category_ids` или имя через словарь).
  const availableCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of baseFilteredPoints) {
      for (const id of p.categoryIds) {
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
    for (const p of allPins) {
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
  }, [allPins, defaultPointColors]);

  const manualColorOptions = useMemo(() => {
    const base = [...defaultPointColors, ...(availableColors ?? [])];
    const unique = Array.from(new Set(base.map((c) => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : defaultPointColors.slice();
  }, [availableColors, defaultPointColors]);

  const filteredPoints = useMemo(() => {
    const selectedCategoryIds = filters.categoryIds ?? [];
    if (!selectedCategoryIds.length) return baseFilteredPoints;

    return baseFilteredPoints.filter((p) => selectedCategoryIds.some((id) => p.categoryIds.includes(id)));
  }, [baseFilteredPoints, filters.categoryIds]);

  const pinsFailed =
    Boolean(pinsQuery.error) ||
    (pinsQuery.fetchStatus === 'paused' && !Array.isArray(pinsQuery.data));
  const searchFailed = Boolean(normalizedSearch) && Boolean(searchQueryResult.error) && !searchQueryResult.isFetching;

  return {
    /** Пины коллекции (под поиском — найденные сервером). */
    points,
    /** Размер всей коллекции — для «Всего N» в шапке независимо от поиска. */
    totalCount: allPins.length,
    isLoading: pinsQuery.isLoading,
    // Загрузка не удалась (ошибка сети/API или offlineFirst-пауза без кэша):
    // список пуст НЕ потому, что у пользователя нет точек — UI обязан показать
    // ошибку с «Повторить», а не «У вас пока нет точек». Упавший серверный
    // поиск — то же состояние: «Повторить» перезапрашивает поиск.
    loadFailed: pinsFailed || searchFailed,
    refetch: searchFailed ? searchQueryResult.refetch : pinsQuery.refetch,
    /** Серверный поиск ещё не ответил на текущий запрос. */
    isSearching: Boolean(normalizedSearch) && (searchQueryResult.isFetching || searchQueryResult.isPlaceholderData),
    categoryIdToName,
    categoryData,
    resolveCategoryIdsByNames,
    availableCategoryOptions,
    availableColors,
    manualColorOptions,
    filteredPoints,
  };
};
