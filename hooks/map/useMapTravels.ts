import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/map';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/src/utils/filterQuery';
import type { TravelCoords } from '@/src/types/types';
import { logError } from '@/src/utils/logger';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import type { Coordinates } from './useMapCoordinates';
import type { FiltersData } from './useMapFilters';
import type { MapFilterValues } from '@/src/utils/mapFiltersStorage';

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
  const isDefaultCoordinates = useMemo(() => {
    if (!coordinates) return true;
    // Default from useMapCoordinates.ts
    const DEFAULT_LAT = 53.9006;
    const DEFAULT_LNG = 27.559;
    return (
      Math.abs(Number(coordinates.latitude) - DEFAULT_LAT) < 0.000001 &&
      Math.abs(Number(coordinates.longitude) - DEFAULT_LNG) < 0.000001
    );
  }, [coordinates]);

  // Условие активации запроса
  const isEnabled = useMemo(() => {
    if (!isFocused) return false;

    const hasValidCoordinates =
      typeof coordinates?.latitude === 'number' &&
      typeof coordinates?.longitude === 'number' &&
      !Number.isNaN(coordinates.latitude) &&
      !Number.isNaN(coordinates.longitude);

    if (!hasValidCoordinates) return false;

    // In radius mode we should query around the user's real current location.
    // Avoid sending a query with placeholder default coords (e.g. Minsk), which results in irrelevant points.
    if (mode === 'radius') return !isDefaultCoordinates;
    if (mode === 'route' && fullRouteCoords.length >= 2) return true;

    return false;
  }, [isFocused, coordinates, mode, fullRouteCoords.length, isDefaultCoordinates]);

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
      
      if (__DEV__ && isEnabled) {
        console.info('[useMapTravels] Query params:', {
          lat: params.lat,
          lng: params.lng,
          radius: params.radius,
          mode: params.mode,
        });
      }
      
      return params;
    },
    [
      coordinates?.latitude,
      coordinates?.longitude,
      filterValues.radius,
      mode,
      routeSignature,
      backendFilters,
      isEnabled,
    ]
  );

  const {
    data: rawTravelsData = [],
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
  } = useQuery<TravelCoords[]>({
    queryKey: ['travelsForMap', queryParams],
    enabled: isEnabled,
    queryFn: async ({ signal }) => {
      const parsedFilters = parseBackendFilters(queryParams.filtersKey);

      if (queryParams.mode === 'radius') {
        const result = await fetchTravelsForMap(0, 100, {
          lat: queryParams.lat!.toString(),
          lng: queryParams.lng!.toString(),
          radius: queryParams.radius,
          categories: parsedFilters.categories,
        }, { signal });
        return Object.values(result || {}) as TravelCoords[];
      }

      if (queryParams.mode === 'route' && queryParams.routeKey) {
        // Восстанавливаем координаты из ключа
        const coords = queryParams.routeKey.split('|').map((p) => {
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

  // Нормализуем данные
  const allTravelsData = useMemo(() => {
    if (!Array.isArray(rawTravelsData)) return [];
    return rawTravelsData;
  }, [rawTravelsData]);

  // Фильтруем только по категориям на клиенте (радиус уже применен на бэкенде)
  const filteredTravelsData = useMemo(() => {
    return filterTravelsByCategories(allTravelsData, filterValues.categories);
  }, [allTravelsData, filterValues.categories]);

  return {
    allTravelsData,
    filteredTravelsData,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
  };
}
