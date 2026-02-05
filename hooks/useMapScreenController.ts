import { useCallback, useMemo, useRef, useState } from 'react';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { FiltersProvider } from '@/contexts/FiltersContext';
import type { MapUiApi } from '@/src/types/mapUi';

// Модульные хуки для карты
import {
  useMapCoordinates,
  useMapFilters,
  useMapDataController,
  useMapUIController,
  useRouteController,
} from '@/hooks/map';

/**
 * Главный контроллер экрана карты (facade pattern).
 * Объединяет специализированные контроллеры и предоставляет единый API для компонента.
 */
export function useMapScreenController() {
  // Map API reference
  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);
  const handleMapUiApiReady = useCallback((api: MapUiApi | null) => {
    setMapUiApi(api);
  }, []);

  // Coordinates
  const { coordinates } = useMapCoordinates();

  // Actual current user location reported by the map implementation (web Leaflet).
  // This should be the primary source for radius-mode queries.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const handleUserLocationChange = useCallback(
    (loc: { latitude: number; longitude: number } | null) => {
      setUserLocation(loc);
    },
    []
  );

  // Filters
  const {
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters: resetFiltersBase,
  } = useMapFilters();

  // UI Controller
  const uiController = useMapUIController();
  const {
    isFocused,
    isMobile,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    panelStyle,
    overlayStyle,
    panelRef,
    themedColors,
    styles,
    canonical,
  } = uiController;

  // Route Controller
  const routeController = useRouteController({ mapUiApi });
  const {
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routePoints,
    routeStorePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    onRemoveRoutePoint,
    swapStartEnd,
    routingLoading,
    routingError,
    setRoutingLoading,
    setRoutingError,
    handleMapClick,
    buildRouteTo,
  } = routeController;

  // buildRouteTo depends on mapUiApi; mapUiApi is typically attached after first render.
  // Keep an always-fresh reference to avoid stale closures for consumers of this hook.
  const buildRouteToRef = useRef(buildRouteTo);
  buildRouteToRef.current = buildRouteTo;

  const buildRouteToStable = useCallback((item: any) => {
    return buildRouteToRef.current?.(item);
  }, []);

  // Data Controller
  const queryCoordinates = useMemo(() => {
    return userLocation ?? coordinates;
  }, [userLocation, coordinates]);

  const dataController = useMapDataController({
    coordinates: queryCoordinates,
    filterValues,
    filters,
    mode,
    fullRouteCoords,
    isFocused,
    isMobile,
  });
  const {
    allTravelsData,
    travelsData,
    loading,
    isFetching,
    isPlaceholderData,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
  } = dataController;

  // Reset filters and route
  const resetFilters = useCallback(() => {
    resetFiltersBase();
    handleClearRoute();
    setMode('radius');
  }, [resetFiltersBase, handleClearRoute, setMode]);

  // Center on user location
  const centerOnUser = useCallback(() => {
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

  // Map panel coordinates (with safe defaults)
  const mapPanelCoordinates = useMemo(() => {
    const source = queryCoordinates ?? coordinates;
    if (!source || !Number.isFinite(source.latitude) || !Number.isFinite(source.longitude)) {
      // Default to Minsk coordinates
      return { latitude: 53.9006, longitude: 27.559 };
    }
    return { latitude: source.latitude, longitude: source.longitude };
  }, [coordinates, queryCoordinates]);

  // Map panel props
  const mapPanelProps = useMemo(
    () => ({
      travelsData,
      coordinates: mapPanelCoordinates,
      routePoints,
      fullRouteCoords,
      mode,
      transportMode,
      radius: filterValues.radius,
      setRoutePoints,
      setRouteDistance,
      setRouteDuration,
      setFullRouteCoords,
      setRouteElevationStats,
      setRoutingLoading,
      setRoutingError,
      onMapClick: handleMapClick,
      onMapUiApiReady: handleMapUiApiReady,
      onUserLocationChange: handleUserLocationChange,
    }),
    [
      travelsData,
      mapPanelCoordinates,
      routePoints,
      fullRouteCoords,
      mode,
      transportMode,
      filterValues.radius,
      setRoutePoints,
      setRouteDistance,
      setRouteDuration,
      setFullRouteCoords,
      setRouteElevationStats,
      setRoutingLoading,
      setRoutingError,
      handleMapClick,
      handleMapUiApiReady,
      handleUserLocationChange,
    ]
  );

  // Filters panel props (now using FiltersProvider pattern)
  const filtersPanelProps = useMemo(() => {
    // Context value for FiltersProvider
    const contextValue = {
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
      routeDuration,
      routeElevationGain,
      routeElevationLoss,
      routePoints: routeStorePoints,
      onRemoveRoutePoint,
      onClearRoute: handleClearRoute,
      swapStartEnd,
      routeHintDismissed: false,
      onAddressSelect: handleAddressSelect,
      onAddressClear: handleAddressClear,
      routingLoading,
      routingError,
      onBuildRoute: () => {
        try {
          // если в режиме route недостаточно точек, buildRouteTo сам должен быть безопасным
          // (логика в useRouteController)
          // здесь просто делегируем
          buildRouteToStable?.({});
        } catch {
          // noop
        }
      },
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation: queryCoordinates,
      onPlaceSelect: buildRouteToStable,
      onOpenList: selectTravelsTab,
      hideTopControls: false,
      hideFooterCta: false,
      hideFooterReset: false,
    };

    return { Component: FiltersProvider, contextValue, props: contextValue, Panel: FiltersPanel };
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
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    routeStorePoints,
    onRemoveRoutePoint,
    handleClearRoute,
    swapStartEnd,
    handleAddressSelect,
    handleAddressClear,
    routingLoading,
    routingError,
    mapUiApi,
    closeRightPanel,
    queryCoordinates,
    buildRouteToStable,
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
    buildRouteTo: buildRouteToStable,
    centerOnUser,

    // Refs
    panelRef,

    // Additional data for mobile layout
    coordinates,
    transportMode,
  };
}
