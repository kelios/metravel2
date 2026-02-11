import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchTravelsForMap, fetchTravelsNearRoute } from '@/api/map';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/utils/filterQuery';
import type { TravelCoords } from '@/types/types';
import { logError } from '@/utils/logger';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
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

function parseBackendFilters(filtersKey: string): { categories?: Array<number | string> } {
  try {
    const parsed: unknown = filtersKey ? JSON.parse(filtersKey) : {};

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const categories = (parsed as { categories?: unknown }).categories;

    if (Array.isArray(categories)) {
      return {
        categories: categories
          .filter((c): c is number | string => typeof c === 'number' || typeof c === 'string')
          .slice(0, 50),
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

  // Строим параметры запроса для бэкенда
  const backendFilters = useMemo(
    () =>
      buildTravelQueryParams(
        normalizedCategoryIds.length ? { categories: normalizedCategoryIds } : {}
      ),
    [normalizedCategoryIds]
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
      const params = {
        lat: coordinates?.latitude,
        lng: coordinates?.longitude,
        radius: filterValues.radius || String(DEFAULT_RADIUS_KM),
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

  const radiusQuery = useInfiniteQuery<TravelCoords[]>({
    queryKey: ['travelsForMap', queryParams, { perPage: MAP_TRAVELS_PER_PAGE }],
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
        },
        { signal }
      );

      const total = !Array.isArray(result) ? (result as any)?.__total : undefined;
      const values = Array.isArray(result) ? result : (Object.values(result || {}) as any[]);
      const items = values as TravelCoords[];
      if (typeof total === 'number' && Array.isArray(items)) {
        Object.defineProperty(items, '__total', {
          value: total,
          enumerable: false,
          configurable: false,
          writable: false,
        });
      }
      return items;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage)) return undefined;

      const total = (lastPage as any)?.__total;
      if (typeof total === 'number' && Number.isFinite(total)) {
        const loaded = allPages.reduce((acc, page) => acc + (Array.isArray(page) ? page.length : 0), 0);
        if (loaded < total) return allPages.length;
        return undefined;
      }

      if (lastPage.length < MAP_TRAVELS_PER_PAGE) return undefined;
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
    queryKey: ['travelsForMapRoute', queryParams],
    enabled: enabledRoute,
    queryFn: async ({ signal }) => {
      // Восстанавливаем координаты из ключа
      const coords = queryParams.routeKey!.split('|').map((p) => {
        const [lng, lat] = p.split(',').map(Number);
        return [lng, lat] as [number, number];
      });

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
      const pages = radiusQuery.data?.pages ?? [];
      return pages.flat();
    }

    return routeQuery.data ?? [];
  }, [queryParams.mode, radiusQuery.data?.pages, routeQuery.data]);

  const isLoading = queryParams.mode === 'radius' ? radiusQuery.isLoading : routeQuery.isLoading;
  const isFetching = queryParams.mode === 'radius' ? radiusQuery.isFetching : routeQuery.isFetching;
  const isPlaceholderData =
    queryParams.mode === 'radius'
      ? Boolean((radiusQuery as any).isPlaceholderData)
      : Boolean((routeQuery as any).isPlaceholderData);
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
    return rawTravelsData;
  }, [rawTravelsData]);

  // Фильтруем только по категориям на клиенте (радиус уже применен на бэкенде)
  const filteredTravelsData = useMemo(() => {
    return filterTravelsByCategories(allTravelsData, filterValues.categories);
  }, [allTravelsData, filterValues.categories]);

  return useMemo(() => ({
    allTravelsData,
    filteredTravelsData,
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
