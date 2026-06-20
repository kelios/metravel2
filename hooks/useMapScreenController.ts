import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';

import { useRouteStore } from '@/stores/routeStore';
import type { Point as MapPoint } from '@/components/MapPage/Map/types';
import type { MapUiApi } from '@/types/mapUi';
import type { TravelCoords } from '@/types/types';
import {
  getActiveOverlayLayers,
  getExclusiveGroupSiblings,
  WEATHER_TEMP_LAYER_ID,
  WEATHER_TEMP_LABELS_LAYER_ID,
} from '@/config/mapWebLayers';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/screens/tabs/map.styles';
import { buildCanonicalUrl } from '@/utils/seo';

// Модульные хуки для карты
import { useMapCoordinates } from '@/hooks/map/useMapCoordinates';
import { useMapFilters } from '@/hooks/map/useMapFilters';
import { useMapDataController } from '@/hooks/map/useMapDataController';
import { useMapPanelState, useMapResponsive } from '@/hooks/map/useMapPanelState';
import { useRouteController } from '@/hooks/map/useRouteController';
import {
  FiltersPanelComponent,
  FiltersProviderComponent,
  preloadMapFiltersPanel,
} from '@/hooks/map/mapFiltersPanelLoader';

// Lazy-load filters panel components — only needed when the user opens the filters drawer
/**
 * Главный контроллер экрана карты (facade pattern).
 * Объединяет специализированные контроллеры и предоставляет единый API для компонента.
 */
const parseUrlCoordinate = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

// F-49 — approximate great-circle distance in km between two lat/lng points.
// Used only to decide whether the map center moved far enough from the active
// query anchor to surface the "Search this area" affordance, so a cheap
// haversine is plenty (no need for the full CoordinateConverter on this path).
const EARTH_RADIUS_KM = 6371;
const distanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

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

  // F-49 — "Search this area" (Google/Organic-Maps style).
  // searchAreaCenter — explicit anchor chosen by tapping the floating button;
  // when set it takes priority over userLocation as the nearby-query anchor.
  // mapCenter — the latest center reported by the map on pan/zoom (debounced),
  // used only to decide whether the affordance should appear.
  const [searchAreaCenter, setSearchAreaCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const handleMapMove = useCallback((center: { latitude: number; longitude: number }) => {
    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
    setMapCenter({ latitude: center.latitude, longitude: center.longitude });
  }, []);

  // #207 — mobile bottom card for a tapped single marker (maps.me-style).
  // On mobile-web the Leaflet popup over the marker is suppressed and the
  // selected point is surfaced as a bottom card rendered by MapMobileLayout.
  const [selectedPlace, setSelectedPlace] = useState<MapPoint | null>(null);
  const handleMarkerSelect = useCallback((point: MapPoint | null) => {
    setSelectedPlace(point ?? null);
  }, []);
  const clearSelectedPlace = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // URL params → initial filter values
  const params = useLocalSearchParams<{ categories?: string; radius?: string; lat?: string; lng?: string }>();
  const initialCategories = useMemo(
    () => (params.categories ? params.categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined),
    // mount-only: captures the initial URL param; later filter changes are owned by useMapFilters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // mount-only: initial radius from URL; subsequent radius is owned by useMapFilters
  const initialRadius = useMemo(() => params.radius ?? undefined, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const urlCoordinates = useMemo(() => {
    const lat = parseUrlCoordinate(params.lat);
    const lng = parseUrlCoordinate(params.lng);
    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { latitude: lat, longitude: lng };
    // mount-only: initial coordinates from URL params, intentionally not reactive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const { isMobile } = useMapResponsive();

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
    () => getStyles(isMobile, insets.top, themedColors),
    [isMobile, insets.top, themedColors]
  );

  useEffect(() => {
    if (!isMobile) return;

    void preloadMapFiltersPanel();
  }, [isMobile]);

  // Route Controller
  const routeController = useRouteController({
    mapUiApi,
    originCoordinates: userLocation ?? coordinates,
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
  const focusPlaceStable = useCallback((item: TravelCoords) => {
    return focusPlaceRef.current?.(item);
  }, []);

  // Data Controller
  // F-49 — an explicit "Search this area" pick (searchAreaCenter) wins over every
  // implicit anchor, including the initial URL coordinates: tapping the button is a
  // deliberate "search HERE now" intent. With no explicit pick we keep the prior
  // precedence (URL deep-link → real user location → resolved/default center).
  const queryCoordinates = useMemo(() => {
    return searchAreaCenter ?? urlCoordinates ?? userLocation ?? coordinates;
  }, [searchAreaCenter, urlCoordinates, userLocation, coordinates]);

  // The active anchor the nearby query currently revolves around (mirrors
  // queryCoordinates' precedence minus the explicit pick), used as the reference
  // point for the "moved far enough" check below.
  const activeAnchor = useMemo(
    () => urlCoordinates ?? userLocation ?? coordinates,
    [urlCoordinates, userLocation, coordinates],
  );

  // F-49 — threshold for "significant move": the map center must drift away from
  // the *current* query anchor by more than ~30% of the active search radius
  // (clamped to a 1.5–25 km sane band so tiny/huge radii still feel right). Below
  // that the existing results already cover the viewport, so we hide the button.
  const canSearchThisArea = useMemo(() => {
    if (mode !== 'radius') return false;
    if (!mapCenter) return false;
    const anchor = searchAreaCenter ?? activeAnchor;
    if (!anchor || !Number.isFinite(anchor.latitude) || !Number.isFinite(anchor.longitude)) {
      return false;
    }
    const radiusKm = Number(filterValues.radius) || 30;
    const thresholdKm = Math.min(25, Math.max(1.5, radiusKm * 0.3));
    return distanceKm(anchor, mapCenter) > thresholdKm;
  }, [mode, mapCenter, searchAreaCenter, activeAnchor, filterValues.radius]);

  const handleSearchThisArea = useCallback(() => {
    setMapCenter((center) => {
      if (center) setSearchAreaCenter({ latitude: center.latitude, longitude: center.longitude });
      return center;
    });
  }, []);

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

  // Счётчик мест в боковом меню: показываем общее число (backend total), а не
  // длину загруженной страницы. Текстовый поиск и фильтр категорий — чисто
  // клиентские фильтры (см. filterTravelsByCategories/BySearchQuery в
  // useMapTravels), их backend total не учитывает. Поэтому при активном клиентском
  // фильтре показываем длину уже отфильтрованного набора (то же множество, что
  // отрисовано маркерами и в списке «Места рядом»), иначе бейдж расходится с
  // картой (#335).
  const hasTextSearch = Boolean(filterValues.searchQuery && filterValues.searchQuery.trim());
  const hasCategoryFilter = Array.isArray(filterValues.categoryTravelAddress)
    && filterValues.categoryTravelAddress.length > 0;
  const travelsCount = hasTextSearch || hasCategoryFilter
    ? travelsData.length
    : Math.max(total ?? 0, travelsData.length);

  const activeOverlayLayers = useMemo(() => getActiveOverlayLayers(), []);
  const overlayOptions = useMemo(
    () =>
      activeOverlayLayers
        .filter(
          (layer) =>
            layer.kind.startsWith('osm-overpass-') ||
            layer.kind === 'weather-temp-labels' ||
            Boolean(layer.url),
        )
        .map((layer) => ({
          id: layer.id,
          title: layer.title,
          category: layer.category,
          subtitle: layer.subtitle,
          badge: layer.badge,
        })),
    [activeOverlayLayers],
  );
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    getActiveOverlayLayers().forEach((layer) => {
      initial[layer.id] = Boolean(layer.defaultEnabled);
    });
    return initial;
  });

  const handleOverlayToggle = useCallback((id: string, enabled: boolean) => {
    setEnabledOverlays((prev) => {
      if (prev[id] === enabled) return prev;
      const next = { ...prev, [id]: enabled };

      // Radio-поведение внутри exclusiveGroup: включение одного слоя
      // выключает остальные слои той же группы (три погодных heatmap-тайла).
      if (enabled) {
        for (const siblingId of getExclusiveGroupSiblings(id)) {
          if (next[siblingId]) next[siblingId] = false;
        }
      }

      // Связка «Температура» ↔ числовые подписи °C: подписи не входят в
      // heatmap-группу, но следуют за заливкой температуры, чтобы пользователь
      // сразу видел реальные градусы числами.
      if (id === WEATHER_TEMP_LAYER_ID) {
        next[WEATHER_TEMP_LABELS_LAYER_ID] = enabled;
      } else if (prev[WEATHER_TEMP_LAYER_ID] && next[WEATHER_TEMP_LAYER_ID] === false) {
        // Температура выключилась косвенно (включили другой heatmap той же группы) —
        // убираем «осиротевшие» °C-подписи, чтобы числа температуры не висели
        // поверх карты осадков/облачности. Кейс «подписи отдельно без заливки»
        // (temp и так был выключен) при этом не трогаем.
        next[WEATHER_TEMP_LABELS_LAYER_ID] = false;
      }

      return next;
    });
  }, []);

  const resetOverlays = useCallback(() => {
    setEnabledOverlays(() => {
      const next: Record<string, boolean> = {};
      activeOverlayLayers.forEach((layer) => {
        next[layer.id] = Boolean(layer.defaultEnabled);
      });
      return next;
    });
  }, [activeOverlayLayers]);

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
  }, [resetFiltersBase, resetOverlays]);

  // Center on user location
  const centerOnUser = useCallback(() => {
    // F-49 — returning to the GPS anchor clears the explicit "search this area"
    // pick so the nearby query revolves around the user again.
    setSearchAreaCenter(null);
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [mapUiApi]);

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
      handleMapMove,
      isMobile,
      handleMarkerSelect,
      clearSelectedPlace,
    ]
  );

  // Filters panel props (FiltersProvider pattern).
  //
  // Stabilization: the FiltersProvider needs a single flat context object, but
  // rebuilding that whole object on every routing-state change cascaded invalidations
  // (mapComponent, mobile layout, helpers). We split it into independent memoized
  // slices with narrow deps — changing one slice (e.g. route metrics) no longer
  // reconstructs the others (filter values / overlay / list-actions). The final
  // flat `contextValue` is composed from those stable slices.

  // Slice 1 — filter option lists + selected values (changes only on filter edits).
  const filterOptionsSlice = useMemo(
    () => ({
      categories: filters.categories
        .filter((c) => c && c.name)
        .map((c) => ({ id: c.id, name: String(c.name || '').trim() }))
        .filter((c) => c.name),
      categoryTravelAddress: resolvedCategoryTravelAddressOptions,
      radius: filters.radius.map((r) => ({ id: r.id, name: r.name })),
      address: filters.address,
    }),
    [filters.categories, filters.radius, filters.address, resolvedCategoryTravelAddressOptions]
  );

  const filtersValuesSlice = useMemo(
    () => ({
      filters: filterOptionsSlice,
      filterValue: filterValues,
      onFilterChange: handleFilterChangeForPanel,
      resetFilters,
    }),
    [filterOptionsSlice, filterValues, handleFilterChangeForPanel, resetFilters]
  );

  // Slice 2 — overlay layer state (changes only on overlay toggles).
  const overlaySlice = useMemo(
    () => ({
      overlayOptions,
      enabledOverlays,
      onOverlayToggle: handleOverlayToggle,
      onResetOverlays: resetOverlays,
    }),
    [overlayOptions, enabledOverlays, handleOverlayToggle, resetOverlays]
  );

  const onBuildRoute = useCallback(() => {
    try {
      useRouteStore.getState().forceRebuild();
    } catch {
      // noop
    }
  }, []);

  // Slice 3 — routing state + actions (changes on route building / mode switches).
  const routingSlice = useMemo(
    () => ({
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
      onBuildRoute,
    }),
    [
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
      onBuildRoute,
    ]
  );

  // Slice 4 — list/data + map-api + panel actions (changes on data refresh / api ready).
  const listActionsSlice = useMemo(
    () => ({
      travelsData: allTravelsData,
      filteredTravelsData: travelsData,
      isMobile,
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation: queryCoordinates,
      onPlaceSelect: buildRouteToStable,
      onPlaceFocus: focusPlaceStable,
      onOpenList: selectTravelsTab,
      // #211 — карта/список грузятся или фильтры дебаунсятся: не показывать
      // empty-state «Ничего не нашлось», пока идёт запрос (иначе мигает при
      // смене вкладок/режимов и при первичной загрузке).
      isBusy: loading || isFetching || isDebouncingFilters,
      hideTopControls: false,
      hideFooterCta: false,
      hideFooterReset: !isMobile,
    }),
    [
      allTravelsData,
      travelsData,
      isMobile,
      mapUiApi,
      closeRightPanel,
      queryCoordinates,
      buildRouteToStable,
      focusPlaceStable,
      selectTravelsTab,
      loading,
      isFetching,
      isDebouncingFilters,
    ]
  );

  const filtersPanelProps = useMemo(() => {
    const contextValue = {
      ...filtersValuesSlice,
      ...overlaySlice,
      ...routingSlice,
      ...listActionsSlice,
    };

    return {
      Component: FiltersProviderComponent,
      contextValue,
      props: contextValue,
      Panel: FiltersPanelComponent,
    };
  }, [filtersValuesSlice, overlaySlice, routingSlice, listActionsSlice]);

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
    zoomIn,
    zoomOut,

    // F-49 — "Search this area"
    canSearchThisArea,
    handleSearchThisArea,

    // Refs
    panelRef,

    // Geolocation
    geoError,
    hasUserLocation: Boolean(userLocation),

    // Additional data for mobile layout
    coordinates,
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
    zoomIn,
    zoomOut,
    canSearchThisArea,
    handleSearchThisArea,
    panelRef,
    geoError,
    userLocation,
    coordinates,
    transportMode,
    selectedPlace,
    clearSelectedPlace,
  ]);
}
