// components/map-core/useMapController.ts
//
// #991 [FE-MAP][M2] — Platform-agnostic поведенческий контракт карты.
//
// Ядро поведения /map, вырезанное из hooks/useMapScreenController.ts БЕЗ
// изменения логики: данные точек (useMapDataController), режимы radius/route
// (useRouteController + routeStore), user-location (useMapCoordinates),
// «Искать в этой области» F-49 (useSearchThisArea), выбор места #207,
// маркер-тап→маршрут #FIX-2/#539, cluster-фильтры и mode-переходы #211.
//
// Потребители: hooks/useMapScreenController (web+native screen-фасад /map).
// Оба рендер-адаптера (Map.web и Map.ios) получают ОДИН И ТОТ ЖЕ
// `mapPanelProps`, собранный здесь, — это и есть единый поведенческий
// контракт web/native.
//
// Screen-concerns (panel/responsive/styles/SEO/filters-панель/overlays UI)
// сюда НЕ входят. Швы с экраном — параметрами:
//  - `isMobile` — responsive принадлежит экрану; ядру нужен только для
//    гейтов mobile-попапа (#207) и focusPlaceStable (#539);
//  - `isFocused` — жизненный цикл экрана (useMapPanelState);
//  - `filters`/`filterValues` — производятся useMapFilters на экране (панель),
//    ядро читает их для data-запроса, cluster-фильтров и радиуса search-here;
//  - `urlCoordinates`/`urlSelectedPlace` — якоря из useMapUrlAnchors; сам хук
//    остаётся на экране, т.к. его initialCategories/initialRadius нужны
//    useMapFilters (иначе цикл filters↔url между слоями).
// Обратно ядро отдаёт `mapUiApi` (для useMapOverlays на экране) и
// `resetCoreForFilters`/`fitToResults` — ядерные части композитных
// resetFilters/showAllPlaces экрана.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useRouteStore } from '@/stores/routeStore';
import type { Point as MapPoint } from '@/components/MapPage/Map/types';
import type { MapUiApi } from '@/types/mapUi';
import type { TravelCoords } from '@/types/types';
import { mapCategoryNamesToIds, isCategoryFilterUnresolved } from '@/utils/filterQuery';
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig';
import { parseWebViewJsonObject, toFiniteCoordinate } from '@/utils/webViewBridge';
import type { MapFilterValues } from '@/utils/mapFiltersStorage';

import { useMapCoordinates } from '@/hooks/map/useMapCoordinates';
import type { FiltersData } from '@/hooks/map/useMapFilters';
import { useMapDataController } from '@/hooks/map/useMapDataController';
import { useRouteController } from '@/hooks/map/useRouteController';
import { useSearchThisArea } from '@/hooks/map/useSearchThisArea';

export interface UseMapControllerParams {
  /** Responsive-флаг экрана: гейты mobile-попапа (#207) и focusPlaceStable (#539). */
  isMobile: boolean;
  /** Фокус экрана (useMapPanelState) — гейтит data-запросы. */
  isFocused: boolean;
  /** Данные фильтров с экрана (useMapFilters). */
  filters: FiltersData;
  /** Значения фильтров с экрана (useMapFilters). */
  filterValues: MapFilterValues;
  /** Deep-link координаты из useMapUrlAnchors (экран). */
  urlCoordinates: { latitude: number; longitude: number } | null;
  /** Deep-link выбранное место из useMapUrlAnchors (экран). */
  urlSelectedPlace: MapPoint | null;
}

/**
 * Platform-agnostic поведенческий контроллер карты (#991). Web-рендер и
 * native-WebView — тонкие адаптеры над возвращаемым отсюда `mapPanelProps`.
 */
export function useMapController({
  isMobile,
  isFocused,
  filters,
  filterValues,
  urlCoordinates,
  urlSelectedPlace,
}: UseMapControllerParams) {
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

  // Ядерная часть композитного resetFilters экрана (#213): сброс поверх-фильтровых
  // якорей поведения. Screen добавляет resetFiltersBase + resetOverlays.
  const resetCoreForFilters = useCallback(() => {
    // F-49 — a full reset drops the explicit "search this area" anchor too.
    setSearchAreaCenter(null);
    // Atomic: clear route + set mode in one store update to avoid intermediate
    // render where mode='route' but fullRouteCoords=[] (disables travel query).
    useRouteStore.getState().clearRouteAndSetMode('radius');
  }, [setSearchAreaCenter]);

  // Ядерная часть showAllPlaces экрана: подгонка карты под все загруженные точки.
  const fitToResults = useCallback(() => {
    try {
      mapUiApi?.fitToResults?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

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

  // Map panel props — единый поведенческий контракт для ОБОИХ рендер-адаптеров
  // (Map.web и Map.ios): web и native получают идентичный набор данных/колбеков.
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

  return {
    // Imperative map API (screen: useMapOverlays; adapters attach via mapPanelProps)
    mapUiApi,

    // Geolocation
    coordinates,
    coordinatesSource,
    locationState,
    geoError,
    refreshLocation,
    openLocationSettings,
    userLocation,

    // #207 — selected single marker for the mobile bottom card.
    selectedPlace,
    clearSelectedPlace,

    // Route state + actions (useRouteController pass-through для панели фильтров)
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

    // F-49 — "Search this area"
    canSearchThisArea,
    handleSearchThisArea,

    // Travels data
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

    // Derived filters
    categoryFilterUnresolved,

    // Core actions (screen composes resetFilters/showAllPlaces on top)
    resetCoreForFilters,
    fitToResults,
    centerOnUser,
    startManualRouteFromLocationState,
    zoomIn,
    zoomOut,

    // Единый контракт рендер-адаптеров web/native
    mapPanelProps,
  };
}
