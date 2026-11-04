/**
 * Map data controller - manages travel data fetching and filtering
 * @module hooks/map/useMapDataController
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TravelCoords } from '@/types/types';
import { useDebouncedValueWithPending } from '@/hooks/useDebouncedValue';
import type { Coordinates, CoordinatesSource } from './useMapCoordinates';
import type { FiltersData } from './useMapFilters';
import type { MapFilterValues } from '@/utils/mapFiltersStorage';
import { useMapTravels } from './useMapTravels';
import { queryKeys } from '@/api/queryKeys';
import type { MapPointCountScope } from '@/utils/mapPointCount';
import { resolveMapRadiusKm } from '@/constants/mapConfig';
import { trackMapPlaceSearch } from '@/utils/mapAnalytics';

interface UseMapDataControllerOptions {
  /**
   * Current map coordinates
   */
  anchor: { coordinates: Coordinates | null; source: CoordinatesSource };

  /**
   * Current filter values
   */
  filterValues: MapFilterValues;

  /**
   * Available filters
   */
  filters: FiltersData;

  /**
   * Map mode (radius or route)
   */
  mode: 'radius' | 'route';

  /**
   * Full route coordinates for route mode
   */
  fullRouteCoords: [number, number][];

  /**
   * Is screen focused
   */
  isFocused: boolean;

  /**
   * Is mobile device
   */
  isMobile: boolean;
}

interface UseMapDataControllerResult {
  /**
   * All travels data (unfiltered)
   */
  allTravelsData: TravelCoords[];

  /**
   * Filtered travels data
   */
  travelsData: TravelCoords[];

  /**
   * Total number of places reported by the backend (not the loaded page length)
   */
  total: number;
  totalScope: MapPointCountScope;

  /**
   * Is loading initial data
   */
  loading: boolean;

  /**
   * Is fetching (background refresh)
   */
  isFetching: boolean;

  /**
   * Is showing placeholder data
   */
  isPlaceholderData: boolean;

  /**
   * Error state
   */
  mapError: boolean;

  /**
   * Error details
   */
  mapErrorDetails: unknown;

  /**
   * Refetch data
   */
  refetchMapData: () => void;

  /**
   * Invalidate query
   */
  invalidateTravelsQuery: () => void;

  hasMore: boolean;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;

  /**
   * True while coordinates or filters are debouncing before the next query.
   * Lets UI surface a pending-state indicator immediately on filter change,
   * before `isFetching` flips to true.
   */
  isDebouncingFilters: boolean;
  radiusQuery: { radius: MapFilterValues['radius']; source: CoordinatesSource };
}

/**
 * Manages travel data fetching, debouncing, and filtering
 *
 * Features:
 * - Debounced coordinates and filters for performance
 * - Automatic refetching on parameter changes
 * - Loading and error states
 * - Query invalidation
 *
 * @example
 * ```typescript
 * const {
 *   travelsData,
 *   loading,
 *   mapError,
 *   refetchMapData,
 * } = useMapDataController({
 *   anchor,
 *   filterValues,
 *   filters,
 *   mode: 'radius',
 *   fullRouteCoords: [],
 *   isFocused: true,
 *   isMobile: false,
 * });
 * ```
 */
export function useMapDataController(
  options: UseMapDataControllerOptions
): UseMapDataControllerResult {
  const {
    anchor,
    filterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
    isMobile,
  } = options;

  // Debounced values for stable queries
  const debounceTime = isMobile ? 300 : 500;
  const [debouncedAnchor, coordsPending] = useDebouncedValueWithPending(
    anchor,
    debounceTime,
  );
  const [debouncedFilterValues, filtersPending] = useDebouncedValueWithPending(
    filterValues,
    300,
  );
  const isDebouncingFilters = coordsPending || filtersPending;

  // Travels data
  const {
    allTravelsData,
    filteredTravelsData: travelsData,
    total,
    totalScope,
    radiusSearchOutcome,
    isLoading: loading,
    isFetching,
    isPlaceholderData,
    isError: mapError,
    error: mapErrorDetails,
    refetch: refetchMapData,
    hasMore,
    loadMore,
    isFetchingNextPage,
  } = useMapTravels({
    coordinates: debouncedAnchor.coordinates,
    filterValues: debouncedFilterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
  });

  const searchTerm = String(filterValues.searchQuery ?? '').trim();
  const debouncedSearchTerm = String(debouncedFilterValues.searchQuery ?? '').trim();
  const searchRadius = resolveMapRadiusKm(debouncedFilterValues.radius);
  const lastReportedSearch = useRef<{ term: string; radius: number } | null>(null);
  useEffect(() => {
    if (!searchTerm) {
      lastReportedSearch.current = null;
      return;
    }
    if (isDebouncingFilters || searchTerm !== debouncedSearchTerm || !radiusSearchOutcome) return;
    const last = lastReportedSearch.current;
    if (last?.term === searchTerm && last.radius === searchRadius) return;

    lastReportedSearch.current = { term: searchTerm, radius: searchRadius };
    trackMapPlaceSearch(radiusSearchOutcome, isMobile, searchRadius);
  }, [debouncedSearchTerm, isDebouncingFilters, isMobile, radiusSearchOutcome, searchRadius, searchTerm]);

  // Invalidate query cache and refetch
  const queryClient = useQueryClient();
  const invalidateTravelsQuery = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.travelsForMapAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.travelsForMapRouteAll() });
  }, [queryClient]);

  return useMemo(() => ({
    allTravelsData,
    travelsData,
    total,
    totalScope,
    loading,
    isFetching,
    isPlaceholderData,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
    hasMore,
    onLoadMore: loadMore,
    isFetchingNextPage,
    isDebouncingFilters,
    radiusQuery: { radius: debouncedFilterValues.radius, source: debouncedAnchor.source },
  }), [
    allTravelsData,
    travelsData,
    total,
    totalScope,
    loading,
    isFetching,
    isPlaceholderData,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
    hasMore,
    loadMore,
    isFetchingNextPage,
    isDebouncingFilters,
    debouncedFilterValues.radius,
    debouncedAnchor.source,
  ]);
}
