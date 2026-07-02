import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchTravelsForMap, fetchTravelsNearRoute } from '@/api/map';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/utils/filterQuery';
import type { TravelCoords } from '@/types/types';
import { logError } from '@/utils/logger';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { queryKeys } from '@/api/queryKeys';
import type { Coordinates } from './useMapCoordinates';
import type { FiltersData } from './useMapFilters';
import type { MapFilterValues } from '@/utils/mapFiltersStorage';

const MAP_TRAVELS_PER_PAGE = 30;

interface UseMapTravelsParams {
  coordinates: Coordinates | null;
  filterValues: MapFilterValues;
  filters: FiltersData;
  mode: 'radius' | 'route';
  fullRouteCoords: [number, number][];
  isFocused: boolean;
}

// Минимальная структурная форма, которую читают identity/key-функции.
// Намеренно НЕ завязана на TravelCoords целиком: разные потребители (точки
// карты в MapMarkers/ClusterLayer) имеют свой Point-тип с другим categoryName,
// а ключ-функции эти поля не трогают — нужны только идентификаторы и координата.
type MapTravelIdentityCandidate = {
  id?: string | number;
  _id?: string | number;
  uid?: string | number;
  slug?: string;
  url?: string;
  articleUrl?: string;
  urlTravel?: string;
  coord?: string | null;
  lat?: unknown;
  lng?: unknown;
};

function normalizeIdentityValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  return null;
}

export function getPointCoordKey(travel: MapTravelIdentityCandidate): string | null {
  const coord = normalizeIdentityValue(travel?.coord);
  if (coord) return coord;

  const lat = normalizeIdentityValue((travel as { lat?: unknown })?.lat);
  const lng = normalizeIdentityValue((travel as { lng?: unknown })?.lng);
  if (lat && lng) return `${lat},${lng}`;

  return null;
}

export function getMapTravelIdentity(travel: MapTravelIdentityCandidate): string | null {
  // Сильные идентификаторы записи путешествия — если они есть, дедупим по ним.
  const strongCandidates: Array<[string, unknown]> = [
    ['id', travel?.id],
    ['_id', travel?._id],
    ['uid', travel?.uid],
    ['slug', travel?.slug],
  ];

  for (const [source, value] of strongCandidates) {
    const normalized = normalizeIdentityValue(value);
    if (normalized) {
      return `${source}:${normalized}`;
    }
  }

  // Point-payload карты: у точек нет своего id, идентичность путешествия —
  // urlTravel/url. Чтобы РАЗНЫЕ точки одного путешествия не схлопывались,
  // добавляем координату в композит (urlTravel|coord). Точный дубль точки
  // (тот же urlTravel + те же координаты) по-прежнему убирается.
  const urlCandidates: Array<[string, unknown]> = [
    ['urlTravel', travel?.urlTravel],
    ['url', travel?.url],
    ['articleUrl', travel?.articleUrl],
  ];

  for (const [source, value] of urlCandidates) {
    const normalized = normalizeIdentityValue(value);
    if (normalized) {
      const coordKey = getPointCoordKey(travel);
      return coordKey ? `${source}:${normalized}@${coordKey}` : `${source}:${normalized}`;
    }
  }

  return null;
}

/**
 * КАНОНИЧЕСКИЙ стабильный ключ/идентичность точки карты для React-рендера.
 * Единственная функция-источник ключей для ВСЕХ потребителей (маркеры,
 * кластеры, список мест, рекомендации) — раньше каждый собирал ключ вручную
 * (`travel-${id}-${coord}-${index}` и т.п.), что давало 4 несовместимых
 * формата.
 *
 * Консистентна с getMapTravelIdentity. После перехода дедупа на (urlTravel@coord)
 * одно путешествие может давать несколько точек с разными координатами — ключ
 * по travel-уровню (id/urlTravel) приводил к дублям React-ключей. Берём identity
 * (она уже coord-уникальна для point-payload), а в хвост всегда добавляем index —
 * это гарантирует уникальность даже для двух точек строго в одной координате
 * одного путешествия и для записей без какой-либо идентичности.
 */
export function getMapPointKey(
  travel: MapTravelIdentityCandidate,
  index: number
): string {
  const identity = getMapTravelIdentity(travel);
  if (identity) return `${identity}#${index}`;

  const coordKey = getPointCoordKey(travel);
  if (coordKey) return `coord:${coordKey}#${index}`;

  return `idx:${index}`;
}

export function dedupeMapTravels(travels: TravelCoords[]): TravelCoords[] {
  if (!Array.isArray(travels) || travels.length <= 1) {
    return Array.isArray(travels) ? travels : [];
  }

  const seen = new Set<string>();
  return travels.filter((travel) => {
    const identity = getMapTravelIdentity(travel);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function filterTravelsByCategories(
  all: TravelCoords[],
  selectedCategories: string[]
): TravelCoords[] {
  if (!selectedCategories.length) return all;

  const selectedNormalized = selectedCategories
    .map((c) => c.trim())
    .filter(Boolean);

  if (!selectedNormalized.length) return all;

  return all.filter((travel) => {
    if (!travel.categoryName) return false;

    const travelCategories = travel.categoryName
      .split(',')
      .map((cat) => cat.trim())
      .filter(Boolean);

    return selectedNormalized.some((selectedCategory) =>
      travelCategories.some(
        (travelCategory) => travelCategory.trim() === selectedCategory.trim()
      )
    );
  });
}

function filterTravelsBySearchQuery(
  all: TravelCoords[],
  searchQuery?: string
): TravelCoords[] {
  const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
  if (!normalizedQuery) return all;

  return all.filter((travel) => {
    const searchable = [
      travel.address,
      travel.categoryName,
      (travel as TravelCoords & { name?: string }).name,
      travel.urlTravel,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

function parseBackendFilters(filtersKey: string): {
  categories?: Array<number | string>;
  categoryTravelAddress?: Array<number | string>;
} {
  try {
    const parsed: unknown = filtersKey ? JSON.parse(filtersKey) : {};

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const categories = (parsed as { categories?: unknown }).categories;
    const categoryTravelAddress = (parsed as { categoryTravelAddress?: unknown }).categoryTravelAddress;
    const normalizedCategories = Array.isArray(categories)
      ? categories
          .filter((c): c is number | string => typeof c === 'number' || typeof c === 'string')
          .slice(0, 50)
      : [];
    const normalizedCategoryTravelAddress = Array.isArray(categoryTravelAddress)
      ? categoryTravelAddress
          .filter((c): c is number | string => typeof c === 'number' || typeof c === 'string')
          .slice(0, 50)
      : [];

    if (normalizedCategories.length || normalizedCategoryTravelAddress.length) {
      return {
        ...(normalizedCategories.length ? { categories: normalizedCategories } : {}),
        ...(normalizedCategoryTravelAddress.length
          ? { categoryTravelAddress: normalizedCategoryTravelAddress }
          : {}),
      };
    }
  } catch (err) {
    logError(err, { scope: 'map', step: 'parseFilters' });
  }

  return {};
}

/**
 * Хук для загрузки путешествий на карте.
 * Поддерживает режимы radius и route.
 */
export function useMapTravels({
  coordinates,
  filterValues,
  filters,
  mode,
  fullRouteCoords,
  isFocused,
}: UseMapTravelsParams) {
  // Условие активации запроса
  const isEnabled = useMemo(() => {
    if (!isFocused) return false;

    const hasValidCoordinates =
      typeof coordinates?.latitude === 'number' &&
      typeof coordinates?.longitude === 'number' &&
      !Number.isNaN(coordinates.latitude) &&
      !Number.isNaN(coordinates.longitude);

    if (!hasValidCoordinates) return false;

    if (mode === 'radius') return true;
    if (mode === 'route' && fullRouteCoords.length >= 2) return true;

    return false;
  }, [isFocused, coordinates, mode, fullRouteCoords.length]);

  // Вычисляем нормализованные ID категорий
  const normalizedCategoryIds = useMemo(
    () => mapCategoryNamesToIds(filterValues.categories, filters.categories),
    [filterValues.categories, filters.categories]
  );
  const normalizedCategoryTravelAddressIds = useMemo(
    () => mapCategoryNamesToIds(filterValues.categoryTravelAddress, filters.categoryTravelAddress),
    [filterValues.categoryTravelAddress, filters.categoryTravelAddress]
  );

  // Строим параметры запроса для бэкенда
  const backendFilters = useMemo(
    () =>
      buildTravelQueryParams({
        ...(normalizedCategoryIds.length ? { categories: normalizedCategoryIds } : {}),
        ...(normalizedCategoryTravelAddressIds.length
          ? { categoryTravelAddress: normalizedCategoryTravelAddressIds }
          : {}),
      }),
    [normalizedCategoryIds, normalizedCategoryTravelAddressIds]
  );

  // Стабильный ключ для маршрута (для кэширования)
  const routeSignature = useMemo(
    () =>
      fullRouteCoords.length > 0
        ? fullRouteCoords.map((p) => `${p[0]},${p[1]}`).join('|')
        : '',
    [fullRouteCoords]
  );

  // Параметры запроса
  const queryParams = useMemo(
    () => {
      const radiusNum = Number(filterValues.radius);
      const params = {
        lat: coordinates?.latitude,
        lng: coordinates?.longitude,
        // Санитизируем: "0"/"abc"/пусто → дефолт, иначе radius=0/NaN даёт пустую выдачу.
        radius: Number.isFinite(radiusNum) && radiusNum > 0
          ? String(radiusNum)
          : String(DEFAULT_RADIUS_KM),
        mode,
        routeKey: routeSignature,
        filtersKey: JSON.stringify(backendFilters),
      };
      
      return params;
    },
    [
      coordinates?.latitude,
      coordinates?.longitude,
      filterValues.radius,
      mode,
      routeSignature,
      backendFilters,
    ]
  );

  const parsedFilters = useMemo(
    () => parseBackendFilters(queryParams.filtersKey),
    [queryParams.filtersKey]
  );

  const enabledRadius = isEnabled && queryParams.mode === 'radius';
  const enabledRoute = isEnabled && queryParams.mode === 'route' && !!queryParams.routeKey;
 
   // Страница — обычный объект {items,total}. Раньше total хранился как non-enumerable
   // свойство на массиве, но structural-sharing TanStack Query его не копирует →
   // в getNextPageParam total терялся и пагинация падала на длину-fallback.
   type TravelCoordsPage = { items: TravelCoords[]; total?: number };
   const getTotalFromResult = (value: unknown): number | undefined => {
     if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
     const total = (value as { __total?: unknown }).__total;
     return typeof total === 'number' && Number.isFinite(total) ? total : undefined;
   };

  const radiusQuery = useInfiniteQuery<TravelCoordsPage>({
    queryKey: queryKeys.travelsForMap(queryParams, MAP_TRAVELS_PER_PAGE),
    enabled: enabledRadius,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const page = typeof pageParam === 'number' ? pageParam : 0;
      const result = await fetchTravelsForMap(
        page,
        MAP_TRAVELS_PER_PAGE,
        {
          lat: queryParams.lat!.toString(),
          lng: queryParams.lng!.toString(),
          radius: queryParams.radius,
          categories: parsedFilters.categories,
          categoryTravelAddress: parsedFilters.categoryTravelAddress,
        },
        { signal }
      );

      const total = getTotalFromResult(result);
      const values = Array.isArray(result)
        ? result
        : Object.values((typeof result === 'object' && result !== null ? result : {}) as Record<string, unknown>);
      return { items: values as TravelCoords[], total };
    },
    getNextPageParam: (lastPage, allPages) => {
      const items = lastPage?.items;
      if (!Array.isArray(items)) return undefined;

      const total = lastPage.total;
      if (typeof total === 'number' && Number.isFinite(total)) {
        const loaded = allPages.reduce((acc, page) => acc + (page?.items?.length ?? 0), 0);
        if (loaded < total) return allPages.length;
        return undefined;
      }

      if (items.length < MAP_TRAVELS_PER_PAGE) return undefined;
      return allPages.length;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const routeQuery = useQuery<TravelCoords[]>({
    queryKey: queryKeys.travelsForMapRoute(queryParams),
    enabled: enabledRoute,
    queryFn: async ({ signal }) => {
      // Восстанавливаем координаты из ключа
      const coords = queryParams.routeKey!.split('|')
        .map((p) => {
          const [lng, lat] = p.split(',').map(Number);
          return [lng, lat] as [number, number];
        })
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

      if (coords.length < 2) return [];

      const corridorKmRaw = parseInt(String(queryParams.radius || '10'), 10);
      // Corridor must be narrow enough to be meaningful, but not too narrow.
      // Use a conservative clamp to avoid accidental "worldwide" queries.
      const corridorKm = Number.isFinite(corridorKmRaw)
        ? Math.min(20, Math.max(5, corridorKmRaw))
        : 10;

      const result = await fetchTravelsNearRoute(coords, corridorKm, { signal });
      if (result && typeof result === 'object') {
        return (Array.isArray(result) ? result : Object.values(result)) as TravelCoords[];
      }
      return [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const rawTravelsData = useMemo(() => {
    if (queryParams.mode === 'radius') {
      // Симметрично route-ветке: при выключенном радиус-режиме не отдаём
      // stale-данные из кэша (placeholderData).
      if (!enabledRadius) return [];
      const pages = radiusQuery.data?.pages ?? [];
      return pages.flatMap((p) => p?.items ?? []);
    }

    // In route mode, only show data when route is actually built;
    // otherwise placeholderData keeps stale results from the previous query.
    if (!enabledRoute) return [];

    return routeQuery.data ?? [];
  }, [queryParams.mode, radiusQuery.data?.pages, routeQuery.data, enabledRoute, enabledRadius]);

  const isLoading = queryParams.mode === 'radius' ? radiusQuery.isLoading : routeQuery.isLoading;
  const isFetching = queryParams.mode === 'radius' ? radiusQuery.isFetching : routeQuery.isFetching;
  const isPlaceholderData =
    queryParams.mode === 'radius'
      ? Boolean(radiusQuery.isPlaceholderData)
      : Boolean(routeQuery.isPlaceholderData);
  const isError = queryParams.mode === 'radius' ? radiusQuery.isError : routeQuery.isError;
  const error = queryParams.mode === 'radius' ? radiusQuery.error : routeQuery.error;
  const refetch = queryParams.mode === 'radius' ? radiusQuery.refetch : routeQuery.refetch;

  const hasMore = queryParams.mode === 'radius' ? Boolean(radiusQuery.hasNextPage) : false;
  const isFetchingNextPage =
    queryParams.mode === 'radius' ? Boolean(radiusQuery.isFetchingNextPage) : false;
  const loadMore = useCallback(() => {
    if (queryParams.mode !== 'radius') return;
    if (!radiusQuery.hasNextPage) return;
    if (radiusQuery.isFetchingNextPage) return;
    void radiusQuery.fetchNextPage();
  }, [queryParams.mode, radiusQuery]);

  // Нормализуем данные
  const allTravelsData = useMemo(() => {
    if (!Array.isArray(rawTravelsData)) return [];
    return dedupeMapTravels(rawTravelsData);
  }, [rawTravelsData]);

  // Общее число мест по бэкенду (а не длина загруженной страницы). Бэкенд отдаёт
  // total в первой странице — счётчик в UI должен показывать его, иначе при
  // смене радиуса (50/100/200) число залипает на размере страницы (30).
  const total = useMemo(() => {
    if (queryParams.mode === 'radius') {
      if (!enabledRadius) return 0;
      const t = radiusQuery.data?.pages?.[0]?.total;
      return typeof t === 'number' ? t : allTravelsData.length;
    }
    if (!enabledRoute) return 0;
    return allTravelsData.length;
  }, [queryParams.mode, enabledRadius, enabledRoute, radiusQuery.data?.pages, allTravelsData]);

  // Поиск по тексту фильтруется на клиенте. Дебаунс не нужен здесь: весь
  // filterValues уже дебаунсится в useMapDataController (300ms) до передачи в
  // этот хук — внутренний useDebouncedValue давал бы двойную задержку.
  const filteredTravelsData = useMemo(() => {
    // Категории уже отфильтрованы бэкендом по ID (queryKey включает их) —
    // повторный клиентский фильтр по точному имени резал бы валидные точки при
    // расхождении формулировок. Клиентский фильтр — только fallback, когда
    // имена не смапились в ID и бэкенд фильтр не получил.
    const byCategories = normalizedCategoryTravelAddressIds.length
      ? allTravelsData
      : filterTravelsByCategories(allTravelsData, filterValues.categoryTravelAddress);

    return filterTravelsBySearchQuery(byCategories, filterValues.searchQuery);
  }, [
    allTravelsData,
    normalizedCategoryTravelAddressIds.length,
    filterValues.categoryTravelAddress,
    filterValues.searchQuery,
  ]);

  return useMemo(() => ({
    allTravelsData,
    filteredTravelsData,
    total,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
    hasMore,
    loadMore,
    isFetchingNextPage,
  }), [
    allTravelsData,
    filteredTravelsData,
    total,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
    hasMore,
    loadMore,
    isFetchingNextPage,
  ]);
}
