import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useRouteStore } from '@/stores/routeStore';
import type { MapUiApi } from '@/types/mapUi';
import type { TravelCoords } from '@/types/types';
import { WEB_MAP_OVERLAY_LAYERS } from '@/config/mapWebLayers';

// Модульные хуки для карты
import { useMapCoordinates } from '@/hooks/map/useMapCoordinates';
import { useMapFilters } from '@/hooks/map/useMapFilters';
import { useMapDataController } from '@/hooks/map/useMapDataController';
import { useMapUIController } from '@/hooks/map/useMapUIController';
import { useRouteController } from '@/hooks/map/useRouteController';

// Lazy-load filters panel components — only needed when the user opens the filters drawer
const loadFiltersPanelModule = () => import('@/components/MapPage/FiltersPanel');
const loadFiltersProviderModule = () =>
  import('@/context/MapFiltersContext').then((m) => ({ default: m.FiltersProvider }));

const LazyFiltersPanel = lazy(loadFiltersPanelModule);
const LazyFiltersProvider = lazy(loadFiltersProviderModule);

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
  const { coordinates, error: geoError } = useMapCoordinates();

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

  // URL params → initial filter values
  const params = useLocalSearchParams<{ categories?: string; radius?: string }>();
  const initialCategories = useMemo(
    () => (params.categories ? params.categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialRadius = useMemo(() => params.radius ?? undefined, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Filters
  const {
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters: resetFiltersBase,
  } = useMapFilters({ initialCategories, initialRadius });

  // UI Controller
  const uiController = useMapUIController();
  const {
    isFocused,
    isMobile,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    panelRef,
    themedColors,
    styles,
    canonical,
  } = uiController;

  useEffect(() => {
    if (!isMobile) return;

    void loadFiltersPanelModule();
    void loadFiltersProviderModule();
  }, [isMobile]);

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

  const buildRouteToStable = useCallback((item: TravelCoords) => {
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
    hasMore,
    onLoadMore,
    isFetchingNextPage,
    isDebouncingFilters,
  } = dataController;

  const overlayOptions = useMemo(
    () =>
      WEB_MAP_OVERLAY_LAYERS
        .filter((layer) => layer.kind.startsWith('osm-overpass-') || Boolean(layer.url))
        .map((layer) => ({
          id: layer.id,
          title: layer.title,
        })),
    [],
  );
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    WEB_MAP_OVERLAY_LAYERS.forEach((layer) => {
      initial[layer.id] = Boolean(layer.defaultEnabled);
    });
    return initial;
  });

  const handleOverlayToggle = useCallback((id: string, enabled: boolean) => {
    setEnabledOverlays((prev) => {
      if (prev[id] === enabled) return prev;
      return { ...prev, [id]: enabled };
    });
  }, []);

  const resetOverlays = useCallback(() => {
    setEnabledOverlays(() => {
      const next: Record<string, boolean> = {};
      WEB_MAP_OVERLAY_LAYERS.forEach((layer) => {
        next[layer.id] = Boolean(layer.defaultEnabled);
      });
      return next;
    });
  }, []);

  const controlledOverlayIds = useMemo(
    () => overlayOptions.map((layer) => layer.id),
    [overlayOptions],
  );

  // Apply overlay state even if the user toggled it before the map API became ready.
  useEffect(() => {
    if (!mapUiApi) return;
    controlledOverlayIds.forEach((id) => {
      try {
        mapUiApi.setOverlayEnabled(id, Boolean(enabledOverlays[id]));
      } catch {
        // noop
      }
    });
  }, [controlledOverlayIds, enabledOverlays, mapUiApi]);

  const resolvedCategoryTravelAddressOptions = useMemo(() => {
    const apiOptions = Array.isArray(filters.categoryTravelAddress)
      ? filters.categoryTravelAddress
          .filter((c) => c && c.name)
          .map((c) => ({
            id: c.id,
            name: String(c.name || '').trim(),
          }))
          .filter((c) => c.name)
      : [];

    if (apiOptions.length > 0) return apiOptions;

    const fallbackNames = new Set<string>();
    (Array.isArray(allTravelsData) ? allTravelsData : []).forEach((travel) => {
      String(travel?.categoryName || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => fallbackNames.add(entry));
    });

    return Array.from(fallbackNames)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((name) => ({
        id: name,
        name,
      }));
  }, [allTravelsData, filters.categoryTravelAddress]);

  // Reset filters and route
  const resetFilters = useCallback(() => {
    resetFiltersBase();
    // Atomic: clear route + set mode in one store update to avoid intermediate
    // render where mode='route' but fullRouteCoords=[] (disables travel query).
    useRouteStore.getState().clearRouteAndSetMode('radius');
  }, [resetFiltersBase]);

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
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('metravel:lastKnownCoords');
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<{ latitude: number; longitude: number }>;
            const lat = Number(parsed?.latitude);
            const lng = Number(parsed?.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return { latitude: lat, longitude: lng };
            }
          }
        } catch {
          // noop
        }
      }
      // Fallback to Minsk when no cached or current location is available.
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
            id: c.id,
            name: String(c.name || '').trim(),
          }))
          .filter((c) => c.name),
        categoryTravelAddress: resolvedCategoryTravelAddressOptions,
        radius: filters.radius.map((r) => ({ id: r.id, name: r.name })),
        address: filters.address,
      },
      filterValue: filterValues,
      onFilterChange: handleFilterChangeForPanel,
      resetFilters,
      overlayOptions,
      enabledOverlays,
      onOverlayToggle: handleOverlayToggle,
      onResetOverlays: resetOverlays,
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
          useRouteStore.getState().forceRebuild();
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
      hideFooterReset: !isMobile,
    };

    return { Component: LazyFiltersProvider, contextValue, props: contextValue, Panel: LazyFiltersPanel };
  }, [
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters,
    overlayOptions,
    enabledOverlays,
    handleOverlayToggle,
    resetOverlays,
    allTravelsData,
    resolvedCategoryTravelAddressOptions,
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

  return useMemo(() => ({
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
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
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
    isDebouncingFilters,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
    hasMore,
    onLoadMore,
    isFetchingNextPage,

    // Route actions
    buildRouteTo: buildRouteToStable,
    centerOnUser,

    // Refs
    panelRef,

    // Geolocation
    geoError,

    // Additional data for mobile layout
    coordinates,
    transportMode,
  }), [
    canonical,
    isFocused,
    isMobile,
    themedColors,
    styles,
    mapReady,
    mapPanelProps,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersPanelProps,
    travelsData,
    allTravelsData,
    loading,
    isFetching,
    isPlaceholderData,
    isDebouncingFilters,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
    hasMore,
    onLoadMore,
    isFetchingNextPage,
    buildRouteToStable,
    centerOnUser,
    panelRef,
    geoError,
    coordinates,
    transportMode,
  ]);
}
