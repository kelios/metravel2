import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/app/(tabs)/map.styles';
import type { MapUiApi } from '@/src/types/mapUi';
import type { TravelCoords } from '@/src/types/types';
import { logMessage } from '@/src/utils/logger';

import {
  loadMapFilterValues,
  saveMapFilterValues,
  type StorageLike,
} from '@/src/utils/mapFiltersStorage';

// Модульные хуки для карты
import {
  useMapCoordinates,
  useMapFilters,
  useMapTravels,
  useMapPanelState,
  useMapResponsive,
} from '@/hooks/map';
import { getSiteBaseUrl, buildCanonicalUrl } from '@/utils/seo';

const HEADER_HEIGHT_WEB = 88;

/**
 * Главный контроллер экрана карты.
 * Объединяет модульные хуки и предоставляет единый API для компонента.
 */
export function useMapScreenController() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const themedColors = useThemedColors();

  const webStorage = useMemo<StorageLike | null>(() => {
    if (Platform.OS !== 'web') return null;
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  }, []);

  // Responsive
  const { isMobile, width } = useMapResponsive();

  // Panel state
  const {
    isFocused,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
  } = useMapPanelState({ isMobile });

  // Map API reference
  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);

  // Coordinates
  const { coordinates } = useMapCoordinates();

  // Filters
  const {
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters: resetFiltersBase,
  } = useMapFilters();

  // Route store
  const routeStore = useRouteStoreAdapter();
  const {
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setFullRouteCoords,
    handleClearRoute,
    handleAddressSelect,
    points: routeStorePoints,
    isBuilding: routingLoading,
    error: routingError,
  } = routeStore;

  const didRestorePersistedUiStateRef = useMemo(() => ({ current: false }), []);

  useEffect(() => {
    if (!webStorage) return;
    if (didRestorePersistedUiStateRef.current) return;

    didRestorePersistedUiStateRef.current = true;

    const persisted = loadMapFilterValues(webStorage);
    if (persisted.lastMode) setMode(persisted.lastMode);
    if (persisted.transportMode) setTransportMode(persisted.transportMode);
  }, [setMode, setTransportMode, webStorage, didRestorePersistedUiStateRef]);

  useEffect(() => {
    if (!webStorage) return;
    saveMapFilterValues(webStorage, {
      ...filterValues,
      lastMode: mode,
      transportMode,
    });
  }, [filterValues, mode, transportMode, webStorage]);

  // Route hint state
  const [routeHintDismissed, setRouteHintDismissed] = useState(false);
  const setRouteHintDismissedTrue = useCallback(() => setRouteHintDismissed(true), []);

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

  // Invalidate query callback
  const invalidateTravelsQuery = useCallback(() => {
    refetchMapData();
  }, [refetchMapData]);

  // Reset filters and route
  const resetFilters = useCallback(() => {
    resetFiltersBase();
    routeStore.clearRoute();
    setMode('radius');
  }, [resetFiltersBase, routeStore, setMode]);

  // Handle map click for route building
  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        logMessage('[map] Invalid coordinates received', 'warning', { scope: 'map', lng, lat });
        return;
      }

      if (mode === 'route' && routePoints.length < 2) {
        const newPoint: [number, number] = [lng, lat];
        setRoutePoints([...routePoints, newPoint]);
      }
    },
    [mode, routePoints, setRoutePoints]
  );

  // Build route to travel item
  const buildRouteTo = useCallback(
    (item: TravelCoords) => {
      if (!item?.coord) return;
      const rawCoordStr = String(item.coord);
      const parsed = CoordinateConverter.fromLooseString(rawCoordStr);
      const coordStr = parsed ? CoordinateConverter.toString(parsed) : rawCoordStr;

      try {
        mapUiApi?.focusOnCoord?.(coordStr, { zoom: 14 });
      } catch {
        // noop
      }

      try {
        // Open popup after the map starts moving so user immediately sees the exact point.
        setTimeout(() => {
          try {
            mapUiApi?.openPopupForCoord?.(coordStr);
          } catch {
            // noop
          }
        }, 420);
      } catch {
        // noop
      }
    },
    [mapUiApi]
  );

  const centerOnUser = useCallback(() => {
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

  // Build route from store points
  const handleBuildRoute = useCallback(() => {
    if (routeStorePoints.length >= 2) {
      const points: [number, number][] = routeStorePoints.map((p) => [
        p.coordinates.lng,
        p.coordinates.lat,
      ]);
      setRoutePoints(points);
      return;
    }
    logMessage('[map] Not enough route points to build route', 'warning', {
      scope: 'map',
      step: 'buildRoute',
      pointsLength: routeStorePoints.length,
    });
  }, [routeStorePoints, setRoutePoints]);

  // Canonical URL
  const canonical = buildCanonicalUrl(pathname || '/map');

  // Styles
  const headerOffset = Platform.OS === 'web' ? HEADER_HEIGHT_WEB : 0;
  const styles = useMemo(
    () => getStyles(isMobile, insets.top, headerOffset, width, themedColors),
    [isMobile, insets.top, headerOffset, width, themedColors]
  );

  // Map panel coordinates (with safe defaults)
  const mapPanelCoordinates = useMemo(() => {
    if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
      // Default to Minsk coordinates
      return { latitude: 53.9006, longitude: 27.559 };
    }
    return { latitude: coordinates.latitude, longitude: coordinates.longitude };
  }, [coordinates]);

  // Map panel props
  const mapPanelProps = useMemo(
    () => ({
      travelsData,
      coordinates: mapPanelCoordinates,
      routePoints,
      mode,
      transportMode,
      radius: filterValues.radius,
      setRoutePoints,
      setRouteDistance,
      setFullRouteCoords,
      onMapClick: handleMapClick,
      onMapUiApiReady: setMapUiApi,
    }),
    [
      travelsData,
      mapPanelCoordinates,
      routePoints,
      mode,
      transportMode,
      filterValues.radius,
      setRoutePoints,
      setRouteDistance,
      setFullRouteCoords,
      handleMapClick,
    ]
  );

  // Filters panel props
  const filtersPanelProps = useMemo(() => {
    const props = {
      filters: {
        categories: filters.categories
          .filter((c) => c && c.name)
          .map((c) => ({
            id: Number(c.id) || 0,
            name: String(c.name || '').trim(),
          }))
          .filter((c) => c.name),
        radius: filters.radius.map((r) => ({ id: r.id, name: r.name })),
        address: filters.address,
      },
      filterValue: filterValues,
      onFilterChange: handleFilterChangeForPanel,
      resetFilters,
      travelsData: allTravelsData,
      filteredTravelsData: travelsData,
      isMobile,
      mode,
      setMode,
      transportMode,
      setTransportMode,
      startAddress,
      endAddress,
      routeDistance,
      routePoints: routeStorePoints,
      onRemoveRoutePoint: routeStore.removePoint,
      onClearRoute: handleClearRoute,
      swapStartEnd: routeStore.swapStartEnd,
      routeHintDismissed,
      onRouteHintDismiss: setRouteHintDismissedTrue,
      onAddressSelect: handleAddressSelect,
      routingLoading,
      routingError,
      onBuildRoute: handleBuildRoute,
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation: coordinates,
      onPlaceSelect: buildRouteTo,
      onOpenList: selectTravelsTab,
    };

    return { Component: FiltersPanel, props };
  }, [
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters,
    allTravelsData,
    travelsData,
    isMobile,
    mode,
    setMode,
    transportMode,
    setTransportMode,
    startAddress,
    endAddress,
    routeDistance,
    routeStorePoints,
    routeStore.removePoint,
    handleClearRoute,
    routeStore.swapStartEnd,
    routeHintDismissed,
    setRouteHintDismissedTrue,
    handleAddressSelect,
    routingLoading,
    routingError,
    handleBuildRoute,
    mapUiApi,
    closeRightPanel,
    coordinates,
    buildRouteTo,
    selectTravelsTab,
  ]);

  return {
    // SEO
    canonical,

    // State
    isFocused,
    isMobile,
    themedColors,
    styles,
    mapReady,

    // Map
    mapPanelProps,

    // Panel
    rightPanelTab,
    rightPanelVisible,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    panelStyle,
    overlayStyle,

    // Filters
    filtersPanelProps,

    // Travels data
    travelsData,
    allTravelsData,
    loading,
    isFetching,
    isPlaceholderData,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,

    // Route actions
    buildRouteTo,
    centerOnUser,

    // Refs
    filtersTabRef,
    panelRef,

    // Additional data for mobile layout
    coordinates,
    transportMode,
  };
}
