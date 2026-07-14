import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';

import { useRouteStore } from '@/stores/routeStore';
import type { Point as MapPoint } from '@/components/MapPage/Map/types';
import type { MapMovePayload } from '@/components/MapPage/Map/types';
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
import { mapCategoryNamesToIds, isCategoryFilterUnresolved } from '@/utils/filterQuery';
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig';

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

const getFirstParamText = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
};

// F-49 — approximate great-circle distance in km between two lat/lng points.
// Used only to decide whether the map center moved far enough from the active
// query anchor to surface the "Search this area" affordance, so a cheap
// haversine is plenty (no need for the full CoordinateConverter on this path).
const EARTH_RADIUS_KM = 6371;
const SAME_LOCATION_EPSILON = 0.00001;
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
  const {
    coordinates,
    coordinatesSource,
    coordinatesAreFallback,
    error: geoError,
    refreshLocation,
  } = useMapCoordinates();

  // Actual current user location reported by the map implementation (web Leaflet).
  // This should be the primary source for radius-mode queries.
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const handleUserLocationChange = useCallback(
    (loc: { latitude: number; longitude: number } | null) => {
      setUserLocation((prev) => {
        if (!loc) return prev === null ? prev : null;
        if (
          prev &&
          Math.abs(prev.latitude - loc.latitude) < SAME_LOCATION_EPSILON &&
          Math.abs(prev.longitude - loc.longitude) < SAME_LOCATION_EPSILON
        ) {
          return prev;
        }
        return loc;
      });
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
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const handleMapMove = useCallback((center: MapMovePayload) => {
    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
    setMapCenter({ latitude: center.latitude, longitude: center.longitude });
    if (center.userInitiated) {
      setIsFollowingUser(false);
    }
  }, []);

  // URL params → initial filter values
  const params = useLocalSearchParams<{
    categories?: string;
    radius?: string;
    lat?: string;
    lng?: string;
    placeId?: string;
    placeTitle?: string;
    placeAddress?: string;
    placeCategory?: string;
    placeTravelUrl?: string;
    placeImageUrl?: string;
  }>();
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
  }, [params.lat, params.lng]);

  const urlSelectedPlace = useMemo<MapPoint | null>(() => {
    if (!urlCoordinates) return null;
    const title = getFirstParamText(params.placeTitle);
    const address = getFirstParamText(params.placeAddress);
    const category = getFirstParamText(params.placeCategory) || getFirstParamText(params.categories);
    const id = getFirstParamText(params.placeId) || `url-${urlCoordinates.latitude},${urlCoordinates.longitude}`;
    const coord = `${urlCoordinates.latitude},${urlCoordinates.longitude}`;

    if (!title && !address && !category) return null;

    return {
      id,
      coord,
      address: address || title || category || coord,
      categoryName: category || undefined,
      urlTravel: getFirstParamText(params.placeTravelUrl) || undefined,
      travelImageThumbUrl: getFirstParamText(params.placeImageUrl) || undefined,
    };
  }, [
    params.categories,
    params.placeAddress,
    params.placeCategory,
    params.placeId,
    params.placeImageUrl,
    params.placeTitle,
    params.placeTravelUrl,
    urlCoordinates,
  ]);

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
    try {
      mapUiApi?.centerOnUser?.();
    } catch {
      // noop
    }
  }, [mapUiApi, refreshLocation]);

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
      // Fallback to the canonical default center when no cached or current
      // location is available (single source, see constants/mapConfig).
      return { latitude: DEFAULT_MAP_CENTER.latitude, longitude: DEFAULT_MAP_CENTER.longitude };
    }
    return { latitude: source.latitude, longitude: source.longitude };
  }, [coordinates, queryCoordinates]);

  // The panel center is a non-user fallback only when it resolves to the raw
  // default center: there is no explicit anchor (search-area / URL pin / real
  // user location) AND the geolocation coordinates themselves are the default.
  // In that case the map must not draw a real "you are here" marker even though
  // the default center sits in Minsk.
  const mapPanelCoordinatesAreFallback = useMemo(() => {
    const hasExplicitAnchor = !!(searchAreaCenter || urlCoordinates || userLocation);
    return !hasExplicitAnchor && coordinatesAreFallback;
  }, [searchAreaCenter, urlCoordinates, userLocation, coordinatesAreFallback]);

  // Map panel props
  const mapPanelProps = useMemo(
    () => ({
      travelsData,
      coordinates: mapPanelCoordinates,
      coordinatesAreFallback: mapPanelCoordinatesAreFallback,
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
      // Серверный счётчик результатов (учитывает where.query, BE #695) — для бейджа
      // «На карте подходит», чтобы он показывал полный total, а не длину загруженной
      // страницы (≤30).
      resultsTotal: travelsCount,
      isMobile,
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation,
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
    showAllPlaces,
    zoomIn,
    zoomOut,
    canSearchThisArea,
    handleSearchThisArea,
    panelRef,
    geoError,
    userLocation,
    coordinates,
    coordinatesSource,
    transportMode,
    selectedPlace,
    clearSelectedPlace,
  ]);
}
