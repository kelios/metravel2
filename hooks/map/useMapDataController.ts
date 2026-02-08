/**
 * Map data controller - manages travel data fetching and filtering
 * @module hooks/map/useMapDataController
 */

import { useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMapTravels } from './useMapTravels';

interface UseMapDataControllerOptions {
  /**
   * Current map coordinates
   */
  coordinates: { latitude: number; longitude: number } | null;

  /**
   * Current filter values
   */
  filterValues: any;

  /**
   * Available filters
   */
  filters: any;

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
  allTravelsData: any[];

  /**
   * Filtered travels data
   */
  travelsData: any[];

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
  mapErrorDetails: any;

  /**
   * Refetch data
   */
  refetchMapData: () => void;

  /**
   * Invalidate query
   */
  invalidateTravelsQuery: () => void;
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
  } = useMapTravels({
    coordinates: debouncedCoordinates,
    filterValues: debouncedFilterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
  });

  // Invalidate query callback (same as refetch for now)
  const invalidateTravelsQuery = refetchMapData;

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
  ]);
}
