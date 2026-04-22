/**
 * Map data controller - manages travel data fetching and filtering
 * @module hooks/map/useMapDataController
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TravelCoords } from '@/types/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Coordinates } from './useMapCoordinates';
import type { FiltersData } from './useMapFilters';
import type { MapFilterValues } from '@/utils/mapFiltersStorage';
import { useMapTravels } from './useMapTravels';

interface UseMapDataControllerOptions {
  /**
   * Current map coordinates
   */
  coordinates: Coordinates | null;

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
 *   coordinates,
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
    coordinates,
    filterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
    isMobile,
  } = options;

  // Debounced values for stable queries
  const debounceTime = isMobile ? 300 : 500;
  const debouncedCoordinates = useDebouncedValue(coordinates, debounceTime);
  const debouncedFilterValues = useDebouncedValue(filterValues, 300);
  const isDebouncingFilters =
    debouncedCoordinates !== coordinates || debouncedFilterValues !== filterValues;

  // Travels data
  const {
    allTravelsData,
    filteredTravelsData: travelsData,
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
    coordinates: debouncedCoordinates,
    filterValues: debouncedFilterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
  });

  // Invalidate query cache and refetch
  const queryClient = useQueryClient();
  const invalidateTravelsQuery = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['travelsForMap'] });
    void queryClient.invalidateQueries({ queryKey: ['travelsForMapRoute'] });
  }, [queryClient]);

  return useMemo(() => ({
    allTravelsData,
    travelsData,
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
  }), [
    allTravelsData,
    travelsData,
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
  ]);
}
