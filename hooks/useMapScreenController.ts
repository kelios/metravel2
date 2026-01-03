import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/app/(tabs)/map.styles';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { MapUiApi } from '@/src/types/mapUi';
import type { TravelCoords } from '@/src/types/types';
import { logMessage } from '@/src/utils/logger';

// Модульные хуки для карты
import {
  useMapCoordinates,
  useMapFilters,
  useMapTravels,
  useMapPanelState,
  useMapResponsive,
} from '@/hooks/map';

const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
const HEADER_HEIGHT_WEB = 88;

/**
 * Главный контроллер экрана карты.
 * Объединяет модульные хуки и предоставляет единый API для компонента.
 */
export function useMapScreenController() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const themedColors = useThemedColors();

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
  const { coordinates, updateCoordinates } = useMapCoordinates();

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
      const parsed = CoordinateConverter.fromLooseString(String(item.coord));
      if (!parsed) return;
      updateCoordinates(parsed.lat, parsed.lng);
    },
    [updateCoordinates]
  );

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
  const canonical = useMemo(() => `${SITE}${pathname || '/map'}`, [pathname]);

  // Styles
  const headerOffset = Platform.OS === 'web' ? HEADER_HEIGHT_WEB : 0;
  const styles = useMemo(
    () => getStyles(isMobile, insets.top, headerOffset, width, themedColors),
    [isMobile, insets.top, headerOffset, width, themedColors]
  );

  // Map panel coordinates (null-safe)
  const mapPanelCoordinates = useMemo(() => {
    if (!coordinates) return null;
    return { latitude: coordinates.latitude, longitude: coordinates.longitude };
  }, [coordinates]);

  // Map panel props
  const mapPanelProps = useMemo(
    () => ({
      travelsData,
      coordinates: mapPanelCoordinates,
      routePoints,
      mode,
      setRoutePoints,
      setRouteDistance,
      setFullRouteCoords,
      onMapClick: handleMapClick,
      onMapReady: setMapUiApi,
    }),
    [
      travelsData,
      mapPanelCoordinates,
      routePoints,
      mode,
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

    // Refs
    filtersTabRef,
    panelRef,
  };
}
