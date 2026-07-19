import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';

import { useRouteStore } from '@/stores/routeStore';
import type { Point as MapPoint } from '@/components/MapPage/Map/types';
import type { MapUiApi } from '@/types/mapUi';
import type { TravelCoords } from '@/types/types';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/screens/tabs/map.styles';
import { buildCanonicalUrl } from '@/utils/seo';
import { mapCategoryNamesToIds, isCategoryFilterUnresolved } from '@/utils/filterQuery';
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig';
import { METRICS } from '@/constants/layout';
import { parseWebViewJsonObject, toFiniteCoordinate } from '@/utils/webViewBridge';

// Модульные хуки для карты
import { useMapCoordinates } from '@/hooks/map/useMapCoordinates';
import { useMapFilters } from '@/hooks/map/useMapFilters';
import { useMapDataController } from '@/hooks/map/useMapDataController';
import { useMapPanelState, useMapResponsive } from '@/hooks/map/useMapPanelState';
import { useRouteController } from '@/hooks/map/useRouteController';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import { useMapUrlAnchors } from '@/hooks/map/useMapUrlAnchors';
import { useSearchThisArea } from '@/hooks/map/useSearchThisArea';
import { useMapFiltersPanelProps } from '@/hooks/map/useMapFiltersPanelProps';
import { preloadMapFiltersPanel } from '@/hooks/map/mapFiltersPanelLoader';

// Lazy-load filters panel components — only needed when the user opens the filters drawer
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
  const {
    coordinates,
    coordinatesSource,
    coordinatesAreFallback,
    locationState,
    currentLocation,
    error: geoError,
    refreshLocation,
    openLocationSettings,
  } = useMapCoordinates();
  // Trusted user position is owned by useMapCoordinates. Viewport/search/URL
  // anchors are intentionally separate and can never become a route origin.
  const userLocation = currentLocation;

  // isFollowingUser is owned by the controller (centering). The F-49 "search
  // this area" viewport state lives in useSearchThisArea (declared after route +
  // filters so it can read mode/radius); a user gesture resets following via the
  // onUserInitiatedMove callback wired into that hook below.
  const [isFollowingUser, setIsFollowingUser] = useState(false);

  // URL anchors → initial filter values + deep-linked coordinates/place.
  const { initialCategories, initialRadius, urlCoordinates, urlSelectedPlace } =
    useMapUrlAnchors();

  // #207 — mobile bottom card for a tapped single marker (maps.me-style).
  // On mobile-web the Leaflet popup over the marker is suppressed and the
  // selected point is surfaced as a bottom card rendered by MapMobileLayout.
  const [selectedPlace, setSelectedPlace] = useState<MapPoint | null>(() => urlSelectedPlace);
  const handlePlaceSelect = useCallback((point: MapPoint | null) => {
    setSelectedPlace(point ?? null);
  }, []);
  const clearSelectedPlace = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  useEffect(() => {
    if (urlSelectedPlace) setSelectedPlace(urlSelectedPlace);
  }, [urlSelectedPlace]);

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

  // Route Controller
  const routeController = useRouteController({
    mapUiApi,
    originCoordinates: userLocation,
  });
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
    addRoutePointFromTravel,
    focusPlace,
  } = routeController;

  // buildRouteTo depends on mapUiApi; mapUiApi is typically attached after first render.
  // Keep an always-fresh reference to avoid stale closures for consumers of this hook.
  const buildRouteToRef = useRef(buildRouteTo);
  buildRouteToRef.current = buildRouteTo;

  const buildRouteToStable = useCallback((item: TravelCoords) => {
    return buildRouteToRef.current?.(item);
  }, []);

  const focusPlaceRef = useRef(focusPlace);
  focusPlaceRef.current = focusPlace;
  const addRoutePointFromTravelRef = useRef(addRoutePointFromTravel);
  addRoutePointFromTravelRef.current = addRoutePointFromTravel;
  const handleMarkerSelect = useCallback(
    (point: MapPoint | null) => {
      if (!point) {
        handlePlaceSelect(null);
        return;
      }
      // Capture the tap into the route ONLY while the route is still being built
      // (fewer than 2 points). Once a 2-point route exists — e.g. one built from a
      // popup's «Маршрут» button — tapping another marker must OPEN its popup, not
      // keep extending the route. The route line/card stay visible because they are
      // gated on mode==='route', which we leave intact. (#FIX-2)
      const routeState = useRouteStore.getState();
      if (routeState.mode === 'route' && routeState.points.length < 2) {
        addRoutePointFromTravelRef.current?.(point as unknown as TravelCoords);
        return;
      }
      handlePlaceSelect(point);
    },
    [handlePlaceSelect],
  );
  // #539 — tapping a list/panel place card must focus the marker AND show the
  // place card on mobile. `focusPlace` only centers + tries to open the Leaflet
  // popup, but on mobile that popup is suppressed (we surface a bottom card via
  // `selectedPlace`). Without also setting `selectedPlace` here the mobile tap
  // appeared to do nothing (the map shifted but nothing opened). So on mobile we
  // reuse the SAME single model as a marker tap: surface the tapped item as the
  // selected place (→ MapPlaceBottomCard) in addition to centering the map.
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const focusPlaceStable = useCallback((item: TravelCoords) => {
    if (isMobileRef.current && item?.coord) {
      // Mirror handleMarkerSelect (#FIX-2): only feed the route while it is still
      // incomplete; a fully-built 2-point route releases the tap so the place card opens.
      const routeState = useRouteStore.getState();
      if (routeState.mode === 'route' && routeState.points.length < 2) {
        addRoutePointFromTravelRef.current?.(item);
        return;
      }
      setSelectedPlace(item as unknown as MapPoint);
    }
    return focusPlaceRef.current?.(item);
  }, []);

  // F-49 — "Search this area" viewport state. Declared here (after route +
  // filters) so it can read the active mode/radius; a user gesture resets the
  // controller-owned follow flag via onUserInitiatedMove.
  const onUserInitiatedMove = useCallback(() => setIsFollowingUser(false), []);
  const {
    searchAreaCenter,
    setSearchAreaCenter,
    canSearchThisArea,
    handleMapMove,
    handleSearchThisArea,
  } = useSearchThisArea({
    mode,
    radius: filterValues.radius,
    onUserInitiatedMove,
  });

  // Data Controller
  // F-49 — an explicit "Search this area" pick (searchAreaCenter) wins over every
  // implicit anchor, including the initial URL coordinates: tapping the button is a
  // deliberate "search HERE now" intent. With no explicit pick we keep the prior
  // precedence (URL deep-link → real user location → resolved/default center).
  const queryCoordinates = useMemo(() => {
    return searchAreaCenter ?? urlCoordinates ?? userLocation ?? coordinates;
  }, [searchAreaCenter, urlCoordinates, userLocation, coordinates]);

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
    total,
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

  const mapClusterFilters = useMemo(() => {
    const categoryIds = mapCategoryNamesToIds(filterValues.categories, filters.categories);
    const categoryTravelAddressIds = mapCategoryNamesToIds(
      filterValues.categoryTravelAddress,
      filters.categoryTravelAddress,
    );
    const category = Array.from(new Set([...categoryIds, ...categoryTravelAddressIds]));
    const query = String(filterValues.searchQuery || '').trim();
    const lat = Number(queryCoordinates?.latitude);
    const lng = Number(queryCoordinates?.longitude);
    const radius = Number(filterValues.radius);

    return {
      ...(query ? { query } : {}),
      ...(category.length ? { category } : {}),
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
      ...(Number.isFinite(radius) && radius > 0 ? { radius } : {}),
    };
  }, [
    filterValues.categories,
    filterValues.categoryTravelAddress,
    filterValues.radius,
    filterValues.searchQuery,
    filters.categories,
    filters.categoryTravelAddress,
    queryCoordinates?.latitude,
    queryCoordinates?.longitude,
  ]);

  // Категория выбрана в фильтре, но её имя не смапилось в числовой backend-ID
  // (частый кейс: API категорий пуст → чипы берут имена из точек с id=name).
  // Тогда серверный кластер-эндпоинт получает пустой category и возвращает ВСЁ,
  // перекрывая клиентский name-фильтр → снятие категории не убирает маркеры.
  // Флаг говорит карте откатиться на клиентски-отфильтрованный по имени набор.
  const categoryFilterUnresolved = useMemo(
    () =>
      isCategoryFilterUnresolved(
        [filterValues.categories, filterValues.categoryTravelAddress],
        mapClusterFilters.category,
      ),
    [filterValues.categories, filterValues.categoryTravelAddress, mapClusterFilters.category],
  );

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
  const resetFilters = useCallback(() => {
    resetFiltersBase();
    resetOverlays();
    // F-49 — a full reset drops the explicit "search this area" anchor too.
    setSearchAreaCenter(null);
    // Atomic: clear route + set mode in one store update to avoid intermediate
    // render where mode='route' but fullRouteCoords=[] (disables travel query).
    useRouteStore.getState().clearRouteAndSetMode('radius');
  }, [resetFiltersBase, resetOverlays, setSearchAreaCenter]);

  // «Показать всё»: сбросить фильтры/область поиска/маршрут и подогнать карту под
  // ВСЕ загруженные точки (fit ко всем маркерам). Служит и явной кнопкой сброса,
  // и escape-hatch на случай, когда геолокация отклонена/таймаут и карта «застряла»
  // на Минск-fallback — пользователь одним тапом видит все места.
  const showAllPlaces = useCallback(() => {
    resetFilters();
    // Даем сбросу отрисоваться, затем подгоняем карту под все точки на карте.
    const fitAll = () => {
      try {
        mapUiApi?.fitToResults?.();
      } catch {
        // noop
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fitAll);
    } else {
      fitAll();
    }
  }, [resetFilters, mapUiApi]);

  // Center on user location
  const centerOnUser = useCallback(() => {
    // F-49 — returning to the GPS anchor clears the explicit "search this area"
    // pick so the nearby query revolves around the user again.
    setSearchAreaCenter(null);
    setIsFollowingUser(true);
    void refreshLocation?.();
    if (!userLocation) return;
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [mapUiApi, refreshLocation, userLocation, setSearchAreaCenter]);

  const startManualRouteFromLocationState = useCallback(() => {
    setIsFollowingUser(false);
    useRouteStore.getState().clearRouteAndSetMode('route');
  }, []);

  useEffect(() => {
    if (!isFollowingUser) return;
    if (!userLocation) return;
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [isFollowingUser, mapUiApi, userLocation]);

  // #211 — не терять контекст карты при возврате в режим «Места» (radius).
  // Режим «Маршрут» уводит вьюпорт к общереспубликанскому виду (fit по маршруту).
  // При возврате в radius рецентрируем карту на пользователя, чтобы запрос точек
  // шёл вокруг него, а не вокруг уехавшего вью — иначе пользователь падает в
  // пустое состояние «Ничего не нашлось». Фильтры (радиус/категории) при этом
  // не трогаем — они остаются на месте.
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    if (prev === 'route' && mode === 'radius') {
      // Рецентрируем только если знаем реальное местоположение пользователя;
      // иначе оставляем текущий вид (URL-координаты / последний центр радиуса).
      if (userLocation) {
        try {
          mapUiApi?.centerOnUser?.();
        } catch {
          // noop
        }
      }
    }
  }, [mode, mapUiApi, userLocation]);

  const zoomIn = useCallback(() => {
    try {
      mapUiApi?.zoomIn?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

  const zoomOut = useCallback(() => {
    try {
      mapUiApi?.zoomOut?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

  // Map panel coordinates (with safe defaults)
  const mapPanelCoordinates = useMemo(() => {
    const source = queryCoordinates ?? coordinates;
    if (!source || !Number.isFinite(source.latitude) || !Number.isFinite(source.longitude)) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('metravel:lastKnownCoords');
          if (raw) {
            const parsed = parseWebViewJsonObject(raw);
            const cached = parsed
              ? toFiniteCoordinate(parsed.latitude, parsed.longitude)
              : null;
            if (cached) return cached;
          }
        } catch {
          // noop
        }
      }
      // Fallback to the canonical default center when no cached or current
      // location is available (single source, see constants/mapConfig).
      return { latitude: DEFAULT_MAP_CENTER.latitude, longitude: DEFAULT_MAP_CENTER.longitude };
    }
    return { latitude: source.latitude, longitude: source.longitude };
  }, [coordinates, queryCoordinates]);

  // Viewport trust is explicit: search/URL anchors are never a user fix, and the
  // only trusted branch is currentLocation from useMapCoordinates. Numeric
  // equality with Minsk (or any other coordinate) is deliberately irrelevant.
  const mapPanelCoordinatesAreFallback = useMemo(() => {
    // Query precedence is search-area → URL → current location → viewport.
    // Only the explicit current-location branch is trusted. URL/search anchors
    // remain viewport positions even when their numeric values happen to match GPS.
    if (searchAreaCenter || urlCoordinates) return true;
    if (userLocation) return false;
    return coordinatesAreFallback;
  }, [searchAreaCenter, urlCoordinates, userLocation, coordinatesAreFallback]);

  // Map panel props
  const mapPanelProps = useMemo(
    () => ({
      travelsData,
      coordinates: mapPanelCoordinates,
      coordinatesAreFallback: mapPanelCoordinatesAreFallback,
      userLocation,
      routePoints,
      fullRouteCoords,
      mode,
      transportMode,
      radius: filterValues.radius,
      mapClusterFilters,
      categoryFilterUnresolved,
      setRoutePoints,
      setRouteDistance,
      setRouteDuration,
      setFullRouteCoords,
      setRouteElevationStats,
      setRoutingLoading,
      setRoutingError,
      onMapClick: handleMapClick,
      onMapUiApiReady: handleMapUiApiReady,
      onRequestUserLocation: refreshLocation,
      // F-49 — report map center on pan/zoom so we can offer "Search this area".
      onMapMove: handleMapMove,
      // #207 — on mobile-web a marker tap surfaces a bottom card instead of the
      // Leaflet popup; desktop keeps the anchored popup behaviour.
      onMarkerSelect: isMobile ? handleMarkerSelect : undefined,
      onMapBackgroundTap: isMobile ? clearSelectedPlace : undefined,
      suppressLeafletPopupOnSelect: isMobile,
    }),
    [
      travelsData,
      mapPanelCoordinates,
      mapPanelCoordinatesAreFallback,
      routePoints,
      fullRouteCoords,
      mode,
      transportMode,
      filterValues.radius,
      mapClusterFilters,
      categoryFilterUnresolved,
      setRoutePoints,
      setRouteDistance,
      setRouteDuration,
      setFullRouteCoords,
      setRouteElevationStats,
      setRoutingLoading,
      setRoutingError,
      handleMapClick,
      handleMapUiApiReady,
      refreshLocation,
      userLocation,
      handleMapMove,
      isMobile,
      handleMarkerSelect,
      clearSelectedPlace,
    ]
  );

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
