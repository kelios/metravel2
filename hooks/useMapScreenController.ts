import { useCallback, useMemo, useState } from 'react';

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

  // Coordinates
  const { coordinates } = useMapCoordinates();

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
    filtersTabRef,
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
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setFullRouteCoords,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    onRemoveRoutePoint,
    swapStartEnd,
    routingLoading,
    routingError,
    handleMapClick,
    buildRouteTo,
  } = routeController;

  // Data Controller
  const dataController = useMapDataController({
    coordinates,
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
      routePoints: routeStorePoints,
      onRemoveRoutePoint,
      onClearRoute: handleClearRoute,
      swapStartEnd,
      routeHintDismissed: false,
      onRouteHintDismiss: () => {},
      onAddressSelect: handleAddressSelect,
      onAddressClear: handleAddressClear,
      routingLoading,
      routingError,
      onBuildRoute: () => {},
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation: coordinates,
      onPlaceSelect: buildRouteTo,
      onOpenList: selectTravelsTab,
      hideTopControls: false,
      hideFooterCta: false,
      hideFooterReset: false,
    };

    return { Component: FiltersProvider, contextValue, Panel: FiltersPanel };
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
    onRemoveRoutePoint,
    handleClearRoute,
    swapStartEnd,
    handleAddressSelect,
    handleAddressClear,
    routingLoading,
    routingError,
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
