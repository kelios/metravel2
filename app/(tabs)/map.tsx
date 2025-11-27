// app/map/index.tsx
import React, {
    useEffect,
    useState,
    useRef,
    useCallback,
    useMemo,
    Suspense,
    lazy,
} from 'react';
import {
    SafeAreaView,
    StyleSheet,
    View,
    Text,
    useWindowDimensions,
    ActivityIndicator,
    Pressable,
    Animated,
    PanResponder,
    Dimensions,
    ScrollView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import TravelListPanel from '@/components/MapPage/TravelListPanel';
import RouteStats from '@/components/MapPage/RouteStats';
import RouteHint from '@/components/MapPage/RouteHint';
import { fetchFiltersMap, fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/travels';
import InstantSEO from '@/components/seo/InstantSEO';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/src/utils/filterQuery';
import ErrorDisplay from '@/components/ErrorDisplay';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';

interface Coordinates { latitude: number; longitude: number; }
interface FilterValues { categories: string[]; radius: string; address: string; }
interface Filters {
    categories: { id: string; name: string }[];
    radius: { id: string; name: string }[];
    address: string;
}

const DEFAULT_COORDINATES = { latitude: 53.9006, longitude: 27.5590 };
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INFO_PANEL_MIN_HEIGHT = 100;
const FILTERS_PANEL_HEIGHT = 300;

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));

export default function MapScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isMobile = width <= 768;
    const queryClient = useQueryClient();

    // State
    const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDINATES);
    const [filters, setFilters] = useState<Filters>({ categories: [], radius: [], address: '' });
    const [filterValues, setFilterValues] = useState<FilterValues>({
        categories: [],
        radius: '60', // Радиус по умолчанию 60 км
        address: '',
    });
    const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
    const [mode, setMode] = useState<'radius' | 'route'>('radius');
    const [transportMode, setTransportMode] = useState<'car' | 'bike' | 'foot'>('car');
    const [routeDistance, setRouteDistance] = useState<number | null>(null);
    const [fullRouteCoords, setFullRouteCoords] = useState<[number, number][]>([]);
    const [startAddress, setStartAddress] = useState('');
    const [endAddress, setEndAddress] = useState('');
    const [menuVisible, setMenuVisible] = useState(!isMobile);
    const [infoPanelHeight, setInfoPanelHeight] = useState(INFO_PANEL_MIN_HEIGHT);
    const [rightPanelTab, setRightPanelTab] = useState<'filters' | 'travels'>('filters');
    const [rightPanelVisible, setRightPanelVisible] = useState(true);
    const [routeHintDismissed, setRouteHintDismissed] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    useEffect(() => {
        if (mapReady) return;
        const frame = requestAnimationFrame(() => setMapReady(true));
        return () => cancelAnimationFrame(frame);
    }, [mapReady]);

    // ✅ ОПТИМИЗАЦИЯ: Debounce для фильтров и координат
    const debouncedCoordinates = useDebouncedValue(coordinates, 500);
    const debouncedFilterValues = useDebouncedValue(filterValues, 300);
    const debouncedRoutePoints = useDebouncedValue(routePoints, 500);

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
            debouncedRoutePoints.length > 0
                ? debouncedRoutePoints.map((p) => `${p[0]},${p[1]}`).join('|')
                : '',
        [debouncedRoutePoints]
    );

    const mapQueryDescriptor = useMemo(
        () => ({
            lat: debouncedCoordinates.latitude,
            lng: debouncedCoordinates.longitude,
            radius: debouncedFilterValues.radius || '60',
            address: debouncedFilterValues.address || '',
            mode,
            routePoints: debouncedRoutePoints,
            routeKey: routeSignature,
            transportMode,
            filters: backendFilters,
        }),
        [
            debouncedCoordinates.latitude,
            debouncedCoordinates.longitude,
            debouncedFilterValues.radius,
            debouncedFilterValues.address,
            mode,
            debouncedRoutePoints,
            routeSignature,
            transportMode,
            backendFilters,
        ]
    );

    // Refs for animations
    const panY = useRef(new Animated.Value(0)).current;
    const filtersPanelY = useRef(new Animated.Value(-FILTERS_PANEL_HEIGHT)).current;

    // Load filters on mount
    useEffect(() => {
        const loadFilters = async () => {
            try {
                const data = await fetchFiltersMap();
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
                console.error('Error loading filters:', error);
            }
        };
        loadFilters();
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
            (mode === 'radius' || (mode === 'route' && debouncedRoutePoints.length >= 2)) &&
            !isNaN(debouncedCoordinates.latitude) &&
            !isNaN(debouncedCoordinates.longitude),
        queryFn: async ({ queryKey }): Promise<any[]> => {
            const [, params] = queryKey as [
                string,
                {
                    lat: number;
                    lng: number;
                    radius: string;
                    address: string;
                    mode: 'radius' | 'route';
                    routePoints: [number, number][];
                    routeKey: string;
                    transportMode: typeof transportMode;
                    filters: Record<string, any>;
                },
            ];

            let data: any[] = [];

            try {
                if (params.mode === 'radius') {
                    const result = await fetchTravelsForMap(0, 100, {
                        lat: params.lat.toString(),
                        lng: params.lng.toString(),
                        radius: params.radius,
                        categories: params.filters.categories,
                    });
                    data = Object.values(result || {});
                } else if (params.mode === 'route' && params.routePoints.length >= 2) {
                    const result = await fetchTravelsNearRoute(params.routePoints, 2);
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
        const getLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                setCoordinates({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            } catch (error) {
                console.error('Error getting location:', error);
            }
        };

        getLocation();
    }, []);

    const handleFilterChange = useCallback((field: string, value: any) => {
        setFilterValues(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleTextFilterChange = useCallback((value: string) => {
        setFilterValues(prev => ({ ...prev, address: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilterValues({ categories: [], radius: '60', address: '' });
        // Не сбрасываем маршрут при сбросе фильтров, только если пользователь явно хочет
        // setRoutePoints([]);
        // setStartAddress('');
        // setEndAddress('');
        // setRouteDistance(null);
    }, []);

    const handleMapClick = useCallback((lng: number, lat: number) => {
        if (mode === 'route' && routePoints.length < 2) {
            const newPoint: [number, number] = [lng, lat];
            if (routePoints.length === 0) {
                setRoutePoints([newPoint]);
                setStartAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            } else {
                setRoutePoints([routePoints[0], newPoint]);
                setEndAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        }
    }, [mode, routePoints]);

    const handleRemoveRoutePoint = useCallback((index: number) => {
        setRoutePoints(prev => prev.filter((_, i) => i !== index));
        if (index === 0) {
            setStartAddress('');
        } else {
            setEndAddress('');
        }
        if (routePoints.length === 2) {
            setRouteDistance(null);
        }
    }, [routePoints.length]);

    const handleClearRoute = useCallback(() => {
        setRoutePoints([]);
        setStartAddress('');
        setEndAddress('');
        setRouteDistance(null);
    }, []);

    const buildRouteTo = useCallback((item: any) => {
        if (item.coord) {
            const [lat, lng] = item.coord.split(',').map(Number);
            setCoordinates({ latitude: lat, longitude: lng });
        }
    }, []);

    const closeMenu = useCallback(() => {
        setMenuVisible(false);
    }, []);

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
    
    const styles = useMemo(() => getStyles(isMobile, insets.top), [isMobile, insets.top]);
    const mapPanelPlaceholder = (
        <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#4a8c8c" />
            <Text style={styles.mapPlaceholderText}>Загружаем карту…</Text>
        </View>
    );

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
                <View style={styles.content}>
                    {mapReady ? (
                        <Suspense fallback={mapPanelPlaceholder}>
                            <LazyMapPanel
                                travelsData={travelsData}
                                coordinates={coordinates}
                                routePoints={routePoints}
                                mode={mode}
                                setRoutePoints={setRoutePoints}
                                onMapClick={handleMapClick}
                                transportMode={transportMode}
                                setRouteDistance={setRouteDistance}
                                setFullRouteCoords={setFullRouteCoords}
                                radius={filterValues.radius}
                            />
                        </Suspense>
                    ) : (
                        mapPanelPlaceholder
                    )}

                    {/* ✅ ИСПРАВЛЕНИЕ: RouteHint и RouteStats перенесены в боковую панель */}

                    {/* Кнопка для показа/скрытия панели */}
                    {!rightPanelVisible && (
                        <Pressable
                            style={styles.togglePanelButton}
                            onPress={() => setRightPanelVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Показать панель"
                        >
                            <IconMaterial name="menu" size={24} color="#fff" />
                        </Pressable>
                    )}

                    {/* Overlay для мобильных устройств */}
                    {rightPanelVisible && isMobile && (
                        <Pressable
                            style={styles.overlay}
                            onPress={() => setRightPanelVisible(false)}
                        />
                    )}

                    {/* Правая панель с табами */}
                    {rightPanelVisible && (
                        <View style={styles.rightPanel}>
                            {/* Табы для переключения */}
                                <View style={styles.tabsContainer}>
                                    <View style={styles.tabsSegment}>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.tab,
                                                rightPanelTab === 'filters' && styles.tabActive,
                                                pressed && styles.tabPressed,
                                            ]}
                                            onPress={() => setRightPanelTab('filters')}
                                            hitSlop={8}
                                            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: rightPanelTab === 'filters' }}
                                        >
                                            <View style={[styles.tabIconBubble, rightPanelTab === 'filters' && styles.tabIconBubbleActive]}>
                                                <IconMaterial
                                                    name="filter-list"
                                                    size={18}
                                                    color={rightPanelTab === 'filters' ? '#fff' : '#4a8c8c'}
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
                                            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: rightPanelTab === 'travels' }}
                                        >
                                            <View style={[styles.tabIconBubble, rightPanelTab === 'travels' && styles.tabIconBubbleActive]}>
                                                <IconMaterial
                                                    name="list"
                                                    size={18}
                                                    color={rightPanelTab === 'travels' ? '#fff' : '#4a8c8c'}
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
                                        <IconMaterial name="chevron-right" size={22} color="#4a5568" />
                                    </Pressable>
                                </View>

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
                                    // ✅ РЕАЛИЗАЦИЯ: Передаем все данные для подсчета категорий, но отфильтрованные для отображения
                                    travelsData={allTravelsData} // Все данные для подсчета категорий
                                    filteredTravelsData={travelsData} // Отфильтрованные данные для отображения количества
                                    isMobile={isMobile}
                                    closeMenu={closeMenu}
                                    mode={mode}
                                    setMode={setMode}
                                    transportMode={transportMode}
                                    setTransportMode={setTransportMode}
                                    startAddress={startAddress}
                                    endAddress={endAddress}
                                    routeDistance={routeDistance}
                                    routePoints={routePoints}
                                    onRemoveRoutePoint={handleRemoveRoutePoint}
                                    onClearRoute={handleClearRoute}
                                    routeHintDismissed={routeHintDismissed}
                                    onRouteHintDismiss={() => setRouteHintDismissed(true)}
                                />
                            ) : (
                                <View style={styles.travelsListContainer}>
                                    {loading && !isPlaceholderData ? (
                                        <View style={styles.loader}>
                                            <ActivityIndicator size="small" />
                                            <Text style={styles.loaderText}>Загрузка...</Text>
                                        </View>
                                    ) : mapError ? (
                                        // ✅ ИСПРАВЛЕНИЕ: Отображение ошибки загрузки данных
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
                                                    <ActivityIndicator size="small" />
                                                    <Text style={styles.updatingText}>Обновление...</Text>
                                                </View>
                                            )}
                                            <TravelListPanel
                                                travelsData={travelsData}
                                                buildRouteTo={buildRouteTo}
                                                isMobile={isMobile}
                                                isLoading={loading && !isPlaceholderData}
                                                onRefresh={() => {
                                                    // Обновление данных через React Query
                                                    queryClient.invalidateQueries({ queryKey: ['travelsForMap'] });
                                                }}
                                                isRefreshing={isFetching && !isPlaceholderData}
                                            />
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
}

const getStyles = (isMobile: boolean, insetTop: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    togglePanelButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4a8c8c',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 1001,
    },
    rightPanel: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: isMobile ? '100%' : 360,
        maxWidth: isMobile ? '100%' : 400,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
    },
    tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: isMobile ? insetTop + 6 : 8,
        paddingBottom: 10,
        paddingHorizontal: isMobile ? 12 : 8,
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
        columnGap: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isMobile ? 0.08 : 0.05,
        shadowRadius: 8,
        elevation: isMobile ? 5 : 2,
        zIndex: 1001,
    },
    tabsSegment: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        padding: 4,
        columnGap: 6,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        gap: 10,
    },
    tabActive: {
        backgroundColor: '#4a8c8c',
    },
    tabPressed: {
        opacity: 0.92,
    },
    tabIconBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e2e8f0',
    },
    tabIconBubbleActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    tabLabelColumn: {
        flex: 1,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2933',
    },
    tabTextActive: {
        color: '#fff',
    },
    tabHint: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
    },
    tabHintActive: {
        color: 'rgba(255,255,255,0.85)',
    },
    panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    closePanelButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eef2f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    travelsListContainer: {
        flex: 1,
        padding: 12,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loaderText: {
        marginTop: 8,
        color: '#666',
        fontSize: 14,
    },
    updatingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f0f7ff',
        borderRadius: 8,
        marginBottom: 8,
    },
    updatingText: {
        marginLeft: 8,
        color: '#4a8c8c',
        fontSize: 12,
        fontWeight: '500',
    },
    mapPlaceholder: {
        flex: 1,
        minHeight: 260,
        borderRadius: 20,
        backgroundColor: '#fff',
        marginLeft: 16,
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e2e8f0',
    },
    mapPlaceholderText: {
        marginTop: 8,
        fontSize: 14,
        color: '#8c99a6',
    },
    errorContainer: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
    },
});
