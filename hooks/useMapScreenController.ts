import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { fetchFiltersMap, fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/map';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useResponsive } from '@/hooks/useResponsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedColors } from '@/hooks/useTheme';
import { getStyles } from '@/app/(tabs)/map.styles';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/src/utils/filterQuery';
import type { MapUiApi } from '@/src/types/mapUi';
import type { TravelCoords } from '@/src/types/types';
import { logError, logMessage } from '@/src/utils/logger';
import {
  loadMapFilterValues,
  saveMapFilterValues,
  type MapFilterValues,
  type StorageLike,
} from '@/src/utils/mapFiltersStorage';
import { usePanelController } from '@/hooks/usePanelController';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Filters {
  categories: { id: string; name: string }[];
  radius: { id: string; name: string }[];
  address: string;
}

// Pressable forwards its ref to the underlying View.
type PressableRef = React.ElementRef<typeof View>;
type ViewRef = React.ElementRef<typeof View>;

const DEFAULT_COORDINATES: Coordinates = { latitude: 53.9006, longitude: 27.559 };

function getWebStorage(): StorageLike | null {
  if (Platform.OS !== 'web') return null;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function filterTravelsByCategories(all: TravelCoords[], selectedCategories: string[]): TravelCoords[] {
  if (!selectedCategories.length) return all;
  const selectedNormalized = selectedCategories.map((c) => c.trim()).filter(Boolean);
  if (!selectedNormalized.length) return all;

  return all.filter((travel) => {
    if (!travel.categoryName) return false;
    const travelCategories = travel.categoryName
      .split(',')
      .map((cat) => cat.trim())
      .filter(Boolean);

    return selectedNormalized.some((selectedCategory) =>
      travelCategories.some((travelCategory) => travelCategory.trim() === selectedCategory.trim())
    );
  });
}

export function useMapScreenController() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { isPhone, isLargePhone, width } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const insets = useSafeAreaInsets();
  const themedColors = useThemedColors();
  const { isPanelVisible, openPanel, closePanel, panelStyle, overlayStyle } = usePanelController(isMobile);


  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);

  // State
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [filters, setFilters] = useState<Filters>({ categories: [], radius: [], address: '' });

  const webStorage = getWebStorage();
  const [filterValues, setFilterValues] = useState<MapFilterValues>(() => {
    if (!webStorage) return { categories: [], radius: '60', address: '' };
    return loadMapFilterValues(webStorage);
  });

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

  const [rightPanelTab, setRightPanelTab] = useState<'filters' | 'travels'>('filters');

  const lastIsMobileRef = useRef(isMobile);

  useEffect(() => {
    if (lastIsMobileRef.current === isMobile) return;
    lastIsMobileRef.current = isMobile;
    if (isMobile) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isMobile, openPanel, closePanel]);

  const filtersTabRef = useRef<PressableRef>(null);
  const panelRef = useRef<ViewRef>(null);
  const [routeHintDismissed, setRouteHintDismissed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapReady) return;
    const frame = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(frame);
  }, [mapReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
  }, [isPanelVisible, isMobile]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (isFocused) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') {
      active.blur();
    }
  }, [isFocused]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!isMobile) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    if (isPanelVisible) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = prevOverflow || '';
    }
    return () => {
      body.style.overflow = prevOverflow || '';
    };
  }, [isMobile, isPanelVisible]);

  useEffect(() => {
    if (!isMobile || !isPanelVisible) return;
    const id = requestAnimationFrame(() => {
      const node = filtersTabRef.current;
      node?.focus?.();
    });
    return () => cancelAnimationFrame(id);
  }, [isMobile, isPanelVisible]);

  const debounceTime = isMobile ? 300 : 500;
  const debouncedCoordinates = useDebouncedValue(coordinates, debounceTime);
  const debouncedFilterValues = useDebouncedValue(filterValues, 300);

  const routePointsKey = useMemo(
    () => (routePoints.length > 0 ? routePoints.map((p) => p.join(',')).join('|') : ''),
    [routePoints]
  );
  const debouncedRoutePointsKey = useDebouncedValue(routePointsKey, debounceTime);

  const normalizedCategoryIds = useMemo(
    () => mapCategoryNamesToIds(filterValues.categories, filters.categories),
    [filterValues.categories, filters.categories]
  );

  const backendFilters = useMemo(
    () => buildTravelQueryParams(normalizedCategoryIds.length ? { categories: normalizedCategoryIds } : {}),
    [normalizedCategoryIds]
  );

  const routeSignature = useMemo(
    () => (fullRouteCoords.length > 0 ? fullRouteCoords.map((p) => `${p[0]},${p[1]}`).join('|') : ''),
    [fullRouteCoords]
  );

  const fullRouteCoordsRef = useRef<[number, number][]>([]);
  useEffect(() => {
    if (!routeSignature) {
      fullRouteCoordsRef.current = [];
      return;
    }
    fullRouteCoordsRef.current = fullRouteCoords;
  }, [routeSignature, fullRouteCoords]);

  const mapQueryDescriptor = useMemo(
    () => ({
      lat: debouncedCoordinates?.latitude,
      lng: debouncedCoordinates?.longitude,
      radius: debouncedFilterValues.radius || '60',
      address: debouncedFilterValues.address || '',
      mode,
      routePointsKey: debouncedRoutePointsKey,
      routeKey: routeSignature,
      transportMode,
      filtersKey: JSON.stringify(backendFilters),
    }),
    [
      debouncedCoordinates?.latitude,
      debouncedCoordinates?.longitude,
      debouncedFilterValues.radius,
      debouncedFilterValues.address,
      mode,
      debouncedRoutePointsKey,
      routeSignature,
      transportMode,
      backendFilters,
    ]
  );

  useEffect(() => {
    let isMounted = true;
    const loadFilters = async () => {
      try {
        const data = await fetchFiltersMap();
        if (!isMounted) return;
        setFilters({
          categories: (data.categories || [])
            .filter((cat) => cat != null)
            .map((cat: unknown, idx: number) => {
              const name = typeof cat === 'string' ? cat : (cat as { name?: unknown })?.name;
              const realId =
                cat && typeof cat === 'object' && (cat as { id?: unknown }).id !== undefined
                  ? (cat as { id?: unknown }).id
                  : idx;

              return {
                id: String(realId),
                name: String(name ?? cat ?? '').trim(),
              };
            })
            .filter((cat) => cat.name),
          radius: [
            { id: '60', name: '60' },
            { id: '100', name: '100' },
            { id: '200', name: '200' },
            { id: '500', name: '500' },
            { id: '600', name: '600' },
          ],
          address: data.categoryTravelAddress?.[0] || '',
        });
      } catch (error) {
        if (isMounted) {
          logError(error, { scope: 'map', step: 'loadFilters' });
        }
      }
    };

    loadFilters();
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    data: allTravelsDataRaw = [],
    isLoading: loading,
    isFetching,
    isPlaceholderData,
    isError: mapError,
    error: mapErrorDetails,
    refetch: refetchMapData,
  } = useQuery<TravelCoords[]>({
    queryKey: ['travelsForMap', mapQueryDescriptor],
    enabled:
      isFocused &&
      (mode === 'radius' || (mode === 'route' && fullRouteCoords.length >= 2)) &&
      typeof debouncedCoordinates?.latitude === 'number' &&
      typeof debouncedCoordinates?.longitude === 'number' &&
      !Number.isNaN(debouncedCoordinates.latitude) &&
      !Number.isNaN(debouncedCoordinates.longitude),
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [
        string,
        {
          lat?: number;
          lng?: number;
          radius: string;
          address: string;
          mode: 'radius' | 'route';
          routePointsKey: string;
          routeKey: string;
          transportMode: typeof transportMode;
          filtersKey: string;
        },
      ];

      if (typeof params.lat !== 'number' || typeof params.lng !== 'number') {
        return [];
      }

      let parsedFilters: { categories?: Array<number | string> } = {};
      try {
        const parsed: unknown = params.filtersKey ? JSON.parse(params.filtersKey) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          parsedFilters = {};
        } else {
          const categories = (parsed as { categories?: unknown }).categories;
          if (Array.isArray(categories)) {
            parsedFilters.categories = categories
              .filter((c): c is number | string => typeof c === 'number' || typeof c === 'string')
              .slice(0, 50);
          }
        }
      } catch (error) {
        logError(error, { scope: 'map', step: 'parseFilters' });
        parsedFilters = {};
      }

      try {
        if (params.mode === 'radius') {
          const result = await fetchTravelsForMap(0, 100, {
            lat: params.lat.toString(),
            lng: params.lng.toString(),
            radius: params.radius,
            categories: parsedFilters.categories,
          });
          return Object.values(result || {}) as TravelCoords[];
        }

        if (params.mode === 'route' && params.routeKey) {
          const coords = fullRouteCoordsRef.current;
          if (coords.length < 2) return [];

          const result = await fetchTravelsNearRoute(coords, 2);
          if (result && typeof result === 'object') {
            return (Array.isArray(result) ? result : Object.values(result)) as unknown as TravelCoords[];
          }
          return [];
        }

        return [];
      } catch (error) {
        logError(error, { scope: 'map', step: 'fetchTravelsForMap' });
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const invalidateTravelsQuery = useCallback(() => {
    refetchMapData();
  }, [refetchMapData]);

  const allTravelsData = useMemo(() => {
    if (!Array.isArray(allTravelsDataRaw)) return [];
    return allTravelsDataRaw;
  }, [allTravelsDataRaw]);

  useEffect(() => {
    let isMounted = true;
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          setCoordinates(DEFAULT_COORDINATES);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isMounted) return;

        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setCoordinates({ latitude: lat, longitude: lng });
        } else {
          logMessage('[map] Invalid coordinates from location service', 'warning', {
            scope: 'map',
            step: 'getLocation',
            coords: location.coords,
          });
          setCoordinates(DEFAULT_COORDINATES);
        }
      } catch (error) {
        if (!isMounted) return;
        logError(error, { scope: 'map', step: 'getLocation' });
        setCoordinates(DEFAULT_COORDINATES);
      }
    };

    getLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterChange = useCallback((field: keyof MapFilterValues, value: MapFilterValues[keyof MapFilterValues]) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFilterChangeForPanel = useCallback((field: string, value: unknown) => {
    if (field === 'categories') {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        handleFilterChange('categories', value);
      }
      return;
    }

    if (field === 'radius') {
      if (typeof value === 'string') {
        handleFilterChange('radius', value);
      }
      return;
    }

    if (field === 'address') {
      if (typeof value === 'string') {
        handleFilterChange('address', value);
      }
    }
  }, [handleFilterChange]);

  useEffect(() => {
    if (!webStorage) return;
    saveMapFilterValues(webStorage, filterValues);
  }, [filterValues, webStorage]);

  const resetFilters = useCallback(() => {
    setFilterValues({ categories: [], radius: '60', address: '' });
    routeStore.clearRoute();
    setMode('radius');
  }, [routeStore, setMode]);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
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

  const buildRouteTo = useCallback((item: TravelCoords) => {
    if (!item?.coord) return;
    const parsed = CoordinateConverter.fromLooseString(String(item.coord));
    if (!parsed) return;
    setCoordinates({ latitude: parsed.lat, longitude: parsed.lng });
  }, []);

  const handleBuildRoute = useCallback(() => {
    if (routeStorePoints.length >= 2) {
      const points: [number, number][] = routeStorePoints.map((p) => [p.coordinates.lng, p.coordinates.lat]);
      setRoutePoints(points);
      return;
    }
    logMessage('[map] Not enough route points to build route', 'warning', {
      scope: 'map',
      step: 'buildRoute',
      pointsLength: routeStorePoints.length,
    });
  }, [routeStorePoints, setRoutePoints]);

  const travelsData = useMemo(
    () => filterTravelsByCategories(allTravelsData, filterValues.categories),
    [allTravelsData, filterValues.categories]
  );

  const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
  const canonical = useMemo(() => `${SITE}${pathname || '/map'}`, [SITE, pathname]);

  const HEADER_HEIGHT_WEB = 88;
  const headerOffset = Platform.OS === 'web' ? HEADER_HEIGHT_WEB : 0;

  const styles = useMemo(
    () => getStyles(isMobile, insets.top, headerOffset, width, themedColors),
    [isMobile, insets.top, headerOffset, width, themedColors]
  );

  const selectFiltersTab = useCallback(() => setRightPanelTab('filters'), []);
  const selectTravelsTab = useCallback(() => setRightPanelTab('travels'), []);


  const closeRightPanel = useCallback(() => {
    if (Platform.OS === 'web' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    closePanel();
  }, [closePanel]);

  const mapPanelCoordinates = useMemo(() => {
    if (coordinates) {
      return { latitude: coordinates.latitude, longitude: coordinates.longitude };
    }
    return null;
  }, [coordinates]);

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
      setMapUiApi,
    ]
  );

  const setRouteHintDismissedTrue = useCallback(() => setRouteHintDismissed(true), []);

  const filtersPanelProps = useMemo(
    () => {
      const props = {
      filters: {
        categories: filters.categories
          .filter((c) => c && c.name)
          .map((c) => ({ id: Number(c.id) || 0, name: String(c.name || '').trim() }))
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
    },
    [
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
    ]
  );

  return {
    canonical,
    isFocused,
    isMobile,
    themedColors,
    styles,
    mapReady,
    mapPanelProps,
    rightPanelTab,
    rightPanelVisible: isPanelVisible,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel: openPanel,
    closeRightPanel,
    panelStyle,
    overlayStyle,
    filtersPanelProps,
    travelsData,
    allTravelsData,

    loading,
    isFetching,
    isPlaceholderData,
    mapError,
    mapErrorDetails,
    refetchMapData,

    invalidateTravelsQuery,
    buildRouteTo,

    filtersTabRef,
    panelRef,
  };
}
