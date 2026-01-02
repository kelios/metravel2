// app/map/index.tsx
import React, {
    Suspense,
    lazy,
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
} from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import TravelListPanel from '@/components/MapPage/TravelListPanel';
import SwipeablePanel from '@/components/MapPage/SwipeablePanel';
import { fetchFiltersMap, fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/map';
import InstantSEO from '@/components/seo/InstantSEO';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/src/utils/filterQuery';
import { useResponsive } from '@/hooks/useResponsive';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ErrorDisplay';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { getStyles } from './map.styles';
import { useThemedColors } from '@/hooks/useTheme';
import { CoordinateConverter } from '@/utils/coordinateConverter';

// Ensure RouteHint is bundled (used inside FiltersPanel)
import '@/components/MapPage/RouteHint';

interface Coordinates { latitude: number; longitude: number; }
interface FilterValues { categories: string[]; radius: string; address: string; }
interface Filters {
    categories: { id: string; name: string }[];
    radius: { id: string; name: string }[];
    address: string;
}

const DEFAULT_COORDINATES = { latitude: 53.9006, longitude: 27.5590 };

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));

export default function MapScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const { isPhone, isLargePhone, width } = useResponsive();
    const themedColors = useThemedColors();
    const insets = useSafeAreaInsets();
    const isMobile = isPhone || isLargePhone;
    const queryClient = useQueryClient();

    // State
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
    const [filters, setFilters] = useState<Filters>({ categories: [], radius: [], address: '' });

    // ✅ УЛУЧШЕНИЕ: Загружаем сохраненные фильтры из localStorage
    const [filterValues, setFilterValues] = useState<FilterValues>(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            try {
                const saved = localStorage.getItem('map-filters');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Валидация: проверяем что это объект с нужными полями
                    if (parsed && typeof parsed === 'object' &&
                        Array.isArray(parsed.categories) &&
                        typeof parsed.radius === 'string') {
                        return {
                            categories: parsed.categories,
                            radius: parsed.radius || '60',
                            address: parsed.address || '',
                        };
                    }
                }
            } catch (error) {
                console.warn('[map] Failed to load saved filters:', error);
            }
        }
        // Значения по умолчанию
        return {
            categories: [],
            radius: '60',
            address: '',
        };
    });
    
    // ✅ NEW: Use RouteStore via adapter for route state management
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
    const [rightPanelVisible, setRightPanelVisible] = useState(true);
    const filtersTabRef = useRef<any>(null);
    const panelRef = useRef<any>(null);
    const [routeHintDismissed, setRouteHintDismissed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    useEffect(() => {
        if (mapReady) return;
        const frame = requestAnimationFrame(() => setMapReady(true));
        return () => cancelAnimationFrame(frame);
    }, [mapReady]);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        // Leaflet relies on container size; when we show/hide the side panel we change
        // available width via paddingRight, so force a resize event to trigger invalidate.
        window.dispatchEvent(new Event('resize'));
    }, [rightPanelVisible, isMobile]);

    // A11y: when screen loses focus on web, drop focus to avoid staying inside aria-hidden tree
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        if (isFocused) return;
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.blur === 'function') {
            active.blur();
        }
    }, [isFocused]);

    // Scroll lock for mobile overlay on web
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        if (!isMobile) return;
        const body = document.body;
        const prevOverflow = body.style.overflow;
        if (rightPanelVisible) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflow = prevOverflow || '';
        }
        return () => {
            body.style.overflow = prevOverflow || '';
        };
    }, [isMobile, rightPanelVisible]);

    // Focus first tabbable in panel when overlay открывается на мобильном
    useEffect(() => {
        if (!isMobile || !rightPanelVisible) return;
        const id = requestAnimationFrame(() => {
            const node: any = filtersTabRef.current;
            if (node && typeof node.focus === 'function') {
                node.focus();
            }
        });
        return () => cancelAnimationFrame(id);
    }, [isMobile, rightPanelVisible]);

    // ✅ ОПТИМИЗАЦИЯ: Debounce для фильтров и координат (меньше на мобильных)
    const debounceTime = isMobile ? 300 : 500;
    const debouncedCoordinates = useDebouncedValue(coordinates, debounceTime);
    const debouncedFilterValues = useDebouncedValue(filterValues, 300);
    // ✅ ИСПРАВЛЕНИЕ: Создаем стабильный строковый ключ для routePoints вместо массива
    const routePointsKey = useMemo(
        () => routePoints.length > 0 ? routePoints.map(p => p.join(',')).join('|') : '',
        [routePoints]
    );
    const debouncedRoutePointsKey = useDebouncedValue(routePointsKey, debounceTime);

    const normalizedCategoryIds = useMemo(
        () => mapCategoryNamesToIds(filterValues.categories, filters.categories),
        [filterValues.categories, filters.categories]
    );

    const backendFilters = useMemo(
        () =>
            buildTravelQueryParams(
                normalizedCategoryIds.length ? { categories: normalizedCategoryIds } : {},
            ),
        [normalizedCategoryIds]
    );

    const routeSignature = useMemo(
        () =>
            fullRouteCoords.length > 0
                ? fullRouteCoords.map((p) => `${p[0]},${p[1]}`).join('|')
                : '',
        [fullRouteCoords]
    );

    // Keep the actual coordinate array out of react-query keys; store it in a ref.
    // This avoids refetch/cancel loops caused by new array references with the same coordinates.
    const fullRouteCoordsRef = useRef<[number, number][]>([]);
    useEffect(() => {
        if (!routeSignature) {
            fullRouteCoordsRef.current = [];
            return;
        }
        fullRouteCoordsRef.current = fullRouteCoords;
    }, [routeSignature, fullRouteCoords]);

    // ✅ ИСПРАВЛЕНИЕ: Используем только примитивные значения в queryKey для предотвращения cancelled запросов
    const mapQueryDescriptor = useMemo(
        () => ({
            lat: debouncedCoordinates?.latitude,
            lng: debouncedCoordinates?.longitude,
            radius: debouncedFilterValues.radius || '60',
            address: debouncedFilterValues.address || '',
            mode,
            routePointsKey: debouncedRoutePointsKey, // Строка вместо массива
            routeKey: routeSignature,
            transportMode,
            filtersKey: JSON.stringify(backendFilters), // Строка вместо объекта
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

    // Load filters on mount
    useEffect(() => {
        let isMounted = true;
        const loadFilters = async () => {
            try {
                const data = await fetchFiltersMap();
                if (!isMounted) return;
                // Transform Filters to match our interface
                setFilters({
                    categories: (data.categories || [])
                        .filter((cat: any) => cat != null) // Filter out null/undefined
                        .map((cat: any, idx: number) => {
                            // Handle both string and object formats
                            const name = typeof cat === 'string' ? cat : (cat?.name || String(cat) || '');
                            // ✅ ИСПРАВЛЕНИЕ: Используем реальный ID категории с бэкенда, если он есть, иначе используем индекс
                            const realId = (cat && typeof cat === 'object' && cat.id !== undefined) 
                                ? cat.id 
                                : idx;
                            return {
                                id: String(realId), // Сохраняем как строку для совместимости, но используем реальный ID
                                name: String(name).trim(),
                            };
                        })
                        .filter((cat: any) => cat.name), // Filter out empty names
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
                    console.error('Error loading filters:', error);
                }
            }
        };
        loadFilters();
        return () => {
            isMounted = false;
        };
    }, []);

    // ✅ РЕАЛИЗАЦИЯ: Всегда запрашиваем все данные с единым слоем нормализации фильтров
    const {
        data: allTravelsData = [],
        isLoading: loading,
        isFetching,
        isPlaceholderData,
        isError: mapError,
        error: mapErrorDetails,
        refetch: refetchMapData,
    } = useQuery<any[]>({
        queryKey: ['travelsForMap', mapQueryDescriptor],
        enabled:
            isFocused &&
            (mode === 'radius' || (mode === 'route' && fullRouteCoords.length >= 2)) &&
            typeof debouncedCoordinates?.latitude === 'number' &&
            typeof debouncedCoordinates?.longitude === 'number' &&
            !isNaN(debouncedCoordinates.latitude) &&
            !isNaN(debouncedCoordinates.longitude),
        queryFn: async ({ queryKey }): Promise<any[]> => {
            const [, params] = queryKey as [
                string,
                {
                    lat?: number;
                    lng?: number;
                    radius: string;
                    address: string;
                    mode: 'radius' | 'route';
                    routePointsKey: string; // ✅ Строка вместо массива
                    routeKey: string;
                    transportMode: typeof transportMode;
                    filtersKey: string; // ✅ Строка вместо объекта
                },
            ];

            if (typeof params.lat !== 'number' || typeof params.lng !== 'number') {
                return [];
            }

            let data: any[] = [];
            
            // ✅ ИСПРАВЛЕНИЕ: Парсим фильтры из строки
            const parsedFilters = params.filtersKey ? JSON.parse(params.filtersKey) : {};

            try {
                if (params.mode === 'radius') {
                    const result = await fetchTravelsForMap(0, 100, {
                        lat: params.lat.toString(),
                        lng: params.lng.toString(),
                        radius: params.radius,
                        categories: parsedFilters.categories,
                    });
                    data = Object.values(result || {});
                } else if (params.mode === 'route' && params.routeKey) {
                    const coords = fullRouteCoordsRef.current;
                    if (coords.length < 2) return [];

                    const result = await fetchTravelsNearRoute(coords, 2);
                    if (result && typeof result === 'object') {
                        data = Array.isArray(result) ? result : Object.values(result);
                    }
                }
            } catch (error) {
                // ✅ ИСПРАВЛЕНИЕ: Логируем ошибку и пробрасываем дальше
                console.error('Error fetching travels for map:', error);
                throw error;
            }

            return data;
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // Get user location
    useEffect(() => {
        let isMounted = true;
        const getLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!isMounted) return;
                if (status !== 'granted') {
                    // If user denied permissions, fall back to default coords explicitly.
                    setCoordinates(DEFAULT_COORDINATES);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (!isMounted) return;

                setCoordinates({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            } catch (error) {
                if (!isMounted) return;
                console.error('Error getting location:', error);
                // If geolocation fails, fall back to default coords explicitly.
                setCoordinates(DEFAULT_COORDINATES);
            }
        };

        getLocation();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleFilterChange = useCallback((field: string, value: any) => {
        setFilterValues(prev => ({ ...prev, [field]: value }));
    }, []);

    // ✅ УЛУЧШЕНИЕ: Сохраняем фильтры в localStorage при изменении
    useEffect(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('map-filters', JSON.stringify(filterValues));
            } catch (error) {
                console.warn('[map] Failed to save filters:', error);
            }
        }
    }, [filterValues]);

    const resetFilters = useCallback(() => {
        setFilterValues({ categories: [], radius: '60', address: '' });
        // Полный сброс: очищаем маршрут и возвращаемся к режиму радиуса
        routeStore.clearRoute();
        setMode('radius');
    }, [routeStore, setMode]);

    const handleMapClick = useCallback((lng: number, lat: number) => {
        if (mode === 'route' && routePoints.length < 2) {
            const newPoint: [number, number] = [lng, lat];
            setRoutePoints([...routePoints, newPoint]);
        }
    }, [mode, routePoints, setRoutePoints]);

    // handleClearRoute now comes from routeStore adapter

    const buildRouteTo = useCallback((item: any) => {
        if (!item?.coord) return;
        const parsed = CoordinateConverter.fromLooseString(String(item.coord));
        if (!parsed) return;
        setCoordinates({ latitude: parsed.lat, longitude: parsed.lng });
    }, []);

    // handleAddressSelect now comes from routeStore adapter
    const handleSetFullRouteCoords = setFullRouteCoords;

    // ✅ РЕАЛИЗАЦИЯ: Фильтрация данных на фронтенде по выбранным категориям
    const travelsData = useMemo(() => {
        // Если категории не выбраны, возвращаем все данные
        if (!filterValues.categories || filterValues.categories.length === 0) {
            return allTravelsData;
        }

        // Фильтруем данные по выбранным категориям
        return allTravelsData.filter((travel) => {
            if (!travel.categoryName) return false;
            
            // categoryName может быть строкой с одной или несколькими категориями через запятую
            const travelCategories = travel.categoryName
                .split(',')
                .map((cat: string) => cat.trim())
                .filter(Boolean);
            
            // Проверяем, есть ли хотя бы одна выбранная категория среди категорий путешествия
            return filterValues.categories.some((selectedCategory) =>
                travelCategories.some((travelCategory: string) =>
                    travelCategory.trim() === selectedCategory.trim()
                )
            );
        });
    }, [allTravelsData, filterValues.categories]);

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = useMemo(() => `${SITE}${pathname || '/map'}`, [SITE, pathname]);
    
    const HEADER_HEIGHT_WEB = 88; // matches reserved header height in (tabs)/_layout
    const headerOffset = Platform.OS === 'web' ? HEADER_HEIGHT_WEB : 0;

    const styles = useMemo(
        () => getStyles(isMobile, insets.top, headerOffset, width, themedColors),
        [isMobile, insets.top, headerOffset, width, themedColors],
    );
    const mapPanelPlaceholder = (
        <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={themedColors.primary} />
            <Text style={styles.mapPlaceholderText}>Загружаем карту…</Text>
        </View>
    );

    // Функция рендеринга содержимого панели
    const renderPanelContent = useCallback(() => (
        <>
            {/* Табы для переключения */}
            {rightPanelVisible && (
                <View style={styles.tabsContainer}>
                    <View style={styles.tabsSegment}>
                        <Pressable
                            ref={filtersTabRef as any}
                            style={({ pressed }) => [
                                styles.tab,
                                rightPanelTab === 'filters' && styles.tabActive,
                                pressed && styles.tabPressed,
                            ]}
                            onPress={() => setRightPanelTab('filters')}
                            hitSlop={8}
                            android_ripple={{ color: themedColors.overlayLight }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: rightPanelTab === 'filters' }}
                        >
                            <View style={[styles.tabIconBubble, rightPanelTab === 'filters' && styles.tabIconBubbleActive]}>
                                <IconMaterial
                                    name="filter-list"
                                    size={18}
                                    color={rightPanelTab === 'filters' ? themedColors.textOnPrimary : themedColors.primary}
                                />
                            </View>
                            <View style={styles.tabLabelColumn}>
                                <Text style={[styles.tabText, rightPanelTab === 'filters' && styles.tabTextActive]}>
                                    Фильтры
                                </Text>
                                <Text style={[styles.tabHint, rightPanelTab === 'filters' && styles.tabHintActive]}>
                                    Настрой параметров
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.tab,
                                rightPanelTab === 'travels' && styles.tabActive,
                                pressed && styles.tabPressed,
                            ]}
                            onPress={() => setRightPanelTab('travels')}
                            hitSlop={8}
                            android_ripple={{ color: themedColors.overlayLight }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: rightPanelTab === 'travels' }}
                        >
                            <View style={[styles.tabIconBubble, rightPanelTab === 'travels' && styles.tabIconBubbleActive]}>
                                <IconMaterial
                                    name="list"
                                    size={18}
                                    color={rightPanelTab === 'travels' ? themedColors.textOnPrimary : themedColors.primary}
                                />
                            </View>
                            <View style={styles.tabLabelColumn}>
                                <Text style={[styles.tabText, rightPanelTab === 'travels' && styles.tabTextActive]}>
                                    Список
                                </Text>
                                <Text style={[styles.tabHint, rightPanelTab === 'travels' && styles.tabHintActive]}>
                                    {travelsData.length} мест
                                </Text>
                            </View>
                        </Pressable>
                    </View>

                    <Pressable
                        style={({ pressed }) => [
                            styles.closePanelButton,
                            pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => setRightPanelVisible(false)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Скрыть панель"
                    >
                        <IconMaterial name="chevron-right" size={22} color={themedColors.textMuted} />
                    </Pressable>
                </View>
            )}

            {/* Контент панели */}
            <View style={styles.panelContent}>
                {rightPanelTab === 'filters' ? (
                    <FiltersPanel
                        filters={{
                            categories: filters.categories
                                .filter(c => c && c.name)
                                .map(c => ({
                                    id: Number(c.id) || 0,
                                    name: String(c.name || '').trim()
                                }))
                                .filter(c => c.name),
                            radius: filters.radius.map(r => ({ id: r.id, name: r.name })),
                            address: filters.address,
                        }}
                        filterValue={filterValues}
                        onFilterChange={handleFilterChange}
                        resetFilters={resetFilters}
                        travelsData={allTravelsData}
                        filteredTravelsData={travelsData}
                        isMobile={isMobile}
                        mode={mode}
                        setMode={setMode}
                        transportMode={transportMode}
                        setTransportMode={setTransportMode}
                        startAddress={startAddress}
                        endAddress={endAddress}
                        routeDistance={routeDistance}
                        routePoints={routeStorePoints}
                        onRemoveRoutePoint={(id: string) => routeStore.removePoint(id)}
                        onClearRoute={handleClearRoute}
                        swapStartEnd={routeStore.swapStartEnd}
                        routeHintDismissed={routeHintDismissed}
                        onRouteHintDismiss={() => setRouteHintDismissed(true)}
                        onAddressSelect={handleAddressSelect}
                        routingLoading={routingLoading}
                        routingError={routingError}
                        onBuildRoute={() => {
                            // ✅ Конвертируем точки из routeStore в формат [lng, lat][]
                            // Валидация теперь в setRoutePoints
                            if (routeStorePoints.length >= 2) {
                                const points: [number, number][] = routeStorePoints
                                    .map(p => [p.coordinates.lng, p.coordinates.lat]);
                                setRoutePoints(points);
                            } else {
                                console.warn('[map] Not enough route points to build route:', routeStorePoints.length);
                            }
                        }}
                        closeMenu={() => setRightPanelVisible(false)}
                    />
                ) : (
                    <View style={styles.travelsListContainer}>
                        {loading && !isPlaceholderData ? (
                            <View style={styles.loader}>
                                <ActivityIndicator size="small" color={themedColors.primary} />
                                <Text style={styles.loaderText}>Загрузка...</Text>
                            </View>
                        ) : mapError ? (
                            <View style={styles.errorContainer}>
                                <ErrorDisplay
                                    message={getUserFriendlyNetworkError(mapErrorDetails)}
                                    onRetry={() => refetchMapData()}
                                    variant="error"
                                />
                            </View>
                        ) : (
                            <>
                                {isFetching && isPlaceholderData && (
                                    <View style={styles.updatingIndicator}>
                                        <ActivityIndicator size="small" color={themedColors.primary} />
                                        <Text style={styles.updatingText}>Обновление...</Text>
                                    </View>
                                )}
                                <TravelListPanel
                                    travelsData={travelsData}
                                    buildRouteTo={buildRouteTo}
                                    isMobile={isMobile}
                                    isLoading={loading && !isPlaceholderData}
                                    onRefresh={() => {
                                        queryClient.invalidateQueries({ queryKey: ['travelsForMap'] });
                                    }}
                                    isRefreshing={isFetching && !isPlaceholderData}
                                />
                            </>
                        )}
                    </View>
                )}
            </View>
        </>
    ), [
        rightPanelVisible,
        rightPanelTab,
        travelsData,
        filters,
        filterValues,
        allTravelsData,
        isMobile,
        mode,
        transportMode,
        startAddress,
        endAddress,
        routeDistance,
        routeStorePoints,
        routeHintDismissed,
        loading,
        isPlaceholderData,
        mapError,
        isFetching,
        themedColors,
        styles,
        handleFilterChange,
        resetFilters,
        setMode,
        setTransportMode,
        routeStore,
        handleClearRoute,
        handleAddressSelect,
        routingLoading,
        routingError,
        setRoutePoints,
        buildRouteTo,
        mapErrorDetails,
        refetchMapData,
        queryClient,
    ]);

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="map"
                    title="Карта путешествий | MeTravel"
                    description="Интерактивная карта с маршрутами и местами для путешествий"
                    canonical={canonical}
                />
            )}
            <SafeAreaView style={styles.container}>
                <View
                    style={styles.content}
                >
                    <View style={styles.mapArea}>
                        {mapReady ? (
                            <Suspense fallback={mapPanelPlaceholder}>
                                <LazyMapPanel
                                    travelsData={travelsData}
                                    coordinates={coordinates ?? DEFAULT_COORDINATES}
                                    routePoints={routePoints}
                                    mode={mode}
                                    setRoutePoints={setRoutePoints}
                                    onMapClick={handleMapClick}
                                    transportMode={transportMode}
                                    setRouteDistance={setRouteDistance}
                                    setFullRouteCoords={handleSetFullRouteCoords}
                                    radius={filterValues.radius}
                                />
                            </Suspense>
                        ) : (
                            mapPanelPlaceholder
                        )}
                    </View>

                    {/* ✅ ИСПРАВЛЕНИЕ: RouteHint и RouteStats перенесены в боковую панель */}

                    {/* Кнопка для показа/скрытия панели */}
                    {!rightPanelVisible && (
                        <Pressable
                            style={styles.togglePanelButton}
                            onPress={() => setRightPanelVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Показать панель"
                        >
                            <IconMaterial name="menu" size={24} color={themedColors.textOnPrimary} />
                        </Pressable>
                    )}

                    {/* Overlay для мобильных устройств */}
                    {isMobile && (
                        <Pressable
                            style={[
                                styles.overlay,
                                rightPanelVisible ? styles.overlayVisible : styles.overlayHidden,
                            ]}
                            onPress={() => setRightPanelVisible(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть панель"
                        />
                    )}

                    {/* Правая панель с табами */}
                    {isMobile ? (
                        <SwipeablePanel
                            isOpen={rightPanelVisible}
                            onClose={() => setRightPanelVisible(false)}
                            swipeDirection="right"
                            threshold={80}
                            style={[
                                styles.rightPanel,
                                rightPanelVisible
                                    ? styles.rightPanelMobileOpen
                                    : styles.rightPanelMobileClosed,
                            ]}
                        >
                            <View
                                accessibilityLabel="Панель карты"
                                id="map-panel"
                                ref={panelRef}
                                tabIndex={-1}
                                style={{ flex: 1 }}
                            >
                                {renderPanelContent()}
                            </View>
                        </SwipeablePanel>
                    ) : (
                        <View
                            style={[
                                styles.rightPanel,
                                !rightPanelVisible ? styles.rightPanelDesktopClosed : null,
                            ]}
                            accessibilityLabel="Панель карты"
                            id="map-panel"
                            ref={panelRef}
                            tabIndex={-1}
                        >
                            {renderPanelContent()}
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
}
