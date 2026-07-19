import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';

import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/screens/tabs/map.styles';
import { buildCanonicalUrl } from '@/utils/seo';
import { METRICS } from '@/constants/layout';

// Platform-agnostic поведенческое ядро карты (#991) — единый контракт web/native.
import { useMapController } from '@/components/map-core/useMapController';

// Модульные хуки для карты (screen-concerns)
import { useMapFilters } from '@/hooks/map/useMapFilters';
import { useMapPanelState, useMapResponsive } from '@/hooks/map/useMapPanelState';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import { useMapUrlAnchors } from '@/hooks/map/useMapUrlAnchors';
import { useMapFiltersPanelProps } from '@/hooks/map/useMapFiltersPanelProps';
import { preloadMapFiltersPanel } from '@/hooks/map/mapFiltersPanelLoader';

// Lazy-load filters panel components — only needed when the user opens the filters drawer
/**
 * Главный контроллер экрана карты (facade pattern).
 * Screen-concerns (панель/responsive/styles/SEO/фильтры/оверлеи UI) живут здесь;
 * поведенческое ядро (данные/режимы/роутинг/user-location/search-here) — в
 * platform-agnostic `useMapController` (components/map-core, #991).
 * Объединяет их и предоставляет единый API для компонента.
 */
export function useMapScreenController() {
  // URL anchors → initial filter values + deep-linked coordinates/place.
  // Остаётся на экране: initialCategories/initialRadius нужны useMapFilters,
  // а якоря координат/места уходят параметрами в поведенческое ядро.
  const { initialCategories, initialRadius, urlCoordinates, urlSelectedPlace } =
    useMapUrlAnchors();

  // Filters
  const {
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters: resetFiltersBase,
  } = useMapFilters({ initialCategories, initialRadius });

  // UI: responsive + panel state + theming + SEO (inlined from former useMapUIController)
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const themedColors = useThemedColors();

  const { isMobile, width: viewportWidth } = useMapResponsive();
  const usesWebBottomDock =
    Platform.OS === 'web' &&
    viewportWidth >= METRICS.breakpoints.tablet &&
    viewportWidth < METRICS.breakpoints.desktop;

  const {
    isFocused,
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
  } = useMapPanelState({ isMobile });

  const canonical = buildCanonicalUrl(pathname || '/map');

  const styles = useMemo(
    () => getStyles(isMobile, insets.top, themedColors, usesWebBottomDock),
    [isMobile, insets.top, themedColors, usesWebBottomDock]
  );

  useEffect(() => {
    if (!isMobile) return;

    void preloadMapFiltersPanel();
  }, [isMobile]);

  // Поведенческое ядро (#991): данные/режимы/роутинг/user-location/search-here
  // + собранный mapPanelProps — единый контракт обоих рендер-адаптеров.
  const {
    mapUiApi,
    coordinates,
    coordinatesSource,
    locationState,
    geoError,
    refreshLocation,
    openLocationSettings,
    userLocation,
    selectedPlace,
    clearSelectedPlace,
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routeStorePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    onRemoveRoutePoint,
    swapStartEnd,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    routingLoading,
    routingError,
    buildRouteToStable,
    focusPlaceStable,
    canSearchThisArea,
    handleSearchThisArea,
    allTravelsData,
    travelsData,
    total,
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
    resetCoreForFilters,
    fitToResults,
    centerOnUser,
    startManualRouteFromLocationState,
    zoomIn,
    zoomOut,
    mapPanelProps,
  } = useMapController({
    isMobile,
    isFocused,
    filters,
    filterValues,
    urlCoordinates,
    urlSelectedPlace,
  });

  // Счётчик мест в боковом меню: показываем общее число (backend total), а не
  // длину загруженной страницы. Текстовый поиск теперь серверный (where.query,
  // BE #695) и УЧТЁН в total — поэтому при поиске тоже берём backend total.
  // Фильтр категорий по имени (когда имя не смапилось в ID) остаётся клиентским
  // и в total не попадает — только для него показываем длину отфильтрованного
  // набора, чтобы бейдж не расходился с картой (#335).
  const hasCategoryFilter = Array.isArray(filterValues.categoryTravelAddress)
    && filterValues.categoryTravelAddress.length > 0;
  const travelsCount = hasCategoryFilter
    ? travelsData.length
    : Math.max(total ?? 0, travelsData.length);

  const {
    enabledOverlays,
    handleOverlayToggle,
    overlayOptions,
    resetOverlays,
  } = useMapOverlays(mapUiApi);

  // Reset filters, route and map overlays.
  // #213 — сброс должен возвращать карту к дефолтным слоям: гасим включённые
  // оверлеи (спутник/погода/природа), иначе Esri-слой остаётся поверх OSM.
  // Ядерная часть (search-area + route) — resetCoreForFilters из useMapController.
  const resetFilters = useCallback(() => {
    resetFiltersBase();
    resetOverlays();
    resetCoreForFilters();
  }, [resetFiltersBase, resetOverlays, resetCoreForFilters]);

  // «Показать всё»: сбросить фильтры/область поиска/маршрут и подогнать карту под
  // ВСЕ загруженные точки (fit ко всем маркерам). Служит и явной кнопкой сброса,
  // и escape-hatch на случай, когда геолокация отклонена/таймаут и карта «застряла»
  // на Минск-fallback — пользователь одним тапом видит все места.
  const showAllPlaces = useCallback(() => {
    resetFilters();
    // Даем сбросу отрисоваться, затем подгоняем карту под все точки на карте.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fitToResults);
    } else {
      fitToResults();
    }
  }, [resetFilters, fitToResults]);

  // Filters panel props (FiltersProvider pattern) — assembled from independent
  // memoized slices in useMapFiltersPanelProps. The controller re-exposes the
  // stable slices for narrow subscriptions in the screen.
  const {
    filtersValuesSlice,
    overlaySlice,
    routingSlice,
    filtersPanelProps,
  } = useMapFiltersPanelProps({
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters,
    allTravelsData,
    overlayOptions,
    enabledOverlays,
    handleOverlayToggle,
    resetOverlays,
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
    travelsData,
    travelsCount,
    isMobile,
    mapUiApi,
    closeRightPanel,
    userLocation,
    buildRouteToStable,
    focusPlaceStable,
    selectTravelsTab,
    loading,
    isFetching,
    isDebouncingFilters,
  });

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
    // Stable slices for narrow subscriptions in the screen (avoid depending on
    // the rebuilt flat contextValue).
    filtersValuesSlice,
    overlaySlice,
    routingSlice,

    // Travels data
    travelsData,
    allTravelsData,
    travelsCount,
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
    focusPlace: focusPlaceStable,
    centerOnUser,
    refreshLocation,
    openLocationSettings,
    startManualRouteFromLocationState,
    showAllPlaces,
    zoomIn,
    zoomOut,

    // F-49 — "Search this area"
    canSearchThisArea,
    handleSearchThisArea,

    // Refs
    panelRef,

    // Geolocation
    geoError,
    locationState,
    hasUserLocation: Boolean(userLocation),

    // Additional data for mobile layout
    coordinates,
    coordinatesSource,
    transportMode,

    // #207 — selected single marker for the mobile bottom card.
    selectedPlace,
    clearSelectedPlace,
    selectedPlaceUserLocation: userLocation,
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
    filtersValuesSlice,
    overlaySlice,
    routingSlice,
    travelsData,
    allTravelsData,
    travelsCount,
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
    focusPlaceStable,
    centerOnUser,
    refreshLocation,
    openLocationSettings,
    startManualRouteFromLocationState,
    showAllPlaces,
    zoomIn,
    zoomOut,
    canSearchThisArea,
    handleSearchThisArea,
    panelRef,
    geoError,
    locationState,
    userLocation,
    coordinates,
    coordinatesSource,
    transportMode,
    selectedPlace,
    clearSelectedPlace,
  ]);
}
