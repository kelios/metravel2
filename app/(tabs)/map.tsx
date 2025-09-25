// app/map/index.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Icon } from 'react-native-elements';
import * as Location from 'expo-location';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import FiltersPanel from '@/components/MapPage/FiltersPanel';
import MapPanel from '@/components/MapPage/MapPanel';
import TravelListPanel from '@/components/MapPage/TravelListPanel';
import { fetchFiltersMap, fetchTravelsForMap, fetchTravelsNearRoute } from '@/src/api/travels';
import InstantSEO from '@/components/seo/InstantSEO';

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
const INFO_PANEL_MAX_HEIGHT = SCREEN_HEIGHT * 0.7;
const FILTERS_PANEL_HEIGHT = 300;

// Высота нижней «чёрной» плашки + запас
const BOTTOM_BAR_HEIGHT = 64;

export default function MapScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = useMemo(() => `${SITE}${pathname || '/map'}`, [SITE, pathname]);

    const { width, height } = useWindowDimensions();
    const isMobile = width <= 768;

    // Анимации
    const infoPanelTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT - INFO_PANEL_MIN_HEIGHT)).current;
    const filtersPanelTranslateY = useRef(new Animated.Value(-FILTERS_PANEL_HEIGHT)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const routeInfoOpacity = useRef(new Animated.Value(0)).current;

    const [activeView, setActiveView] = useState<'map' | 'filters' | 'list'>('map');

    // Основные состояния
    const [mode, setMode] = useState<'radius' | 'route'>('radius');
    const [filters, setFilters] = useState<Filters>({ categories: [], radius: [], address: '' });
    const [filterValue, setFilterValue] = useState<FilterValues>({ categories: [], radius: '', address: '' });
    const [rawTravelsData, setRawTravelsData] = useState<any[]>([]);
    const [travelsData, setTravelsData] = useState<any[]>([]);
    const [placesAlongRoute, setPlacesAlongRoute] = useState<any[]>([]);
    const [fullRouteCoords, setFullRouteCoords] = useState<[number, number][]>([]);
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
    const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
    const [routeDistance, setRouteDistance] = useState<number | null>(null);
    const [startAddress, setStartAddress] = useState('');
    const [endAddress, setEndAddress] = useState('');
    const [transportMode, setTransportMode] = useState<'car' | 'bike' | 'foot'>('car');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(isMobile ? 10 : 20);

    // скрытие объектов
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

    const dataCache = useRef<Record<string, any[]>>({});
    const isLoading = useRef(false);

    // Панель перетаскивания — только «ручка»
    const dragPanResponder = useRef(
      PanResponder.create({
          onStartShouldSetPanResponder: () => activeView === 'list',
          onMoveShouldSetPanResponder: (_, g) =>
            activeView === 'list' && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
          onPanResponderMove: (_, g) => {
              const newHeight = Math.max(
                INFO_PANEL_MIN_HEIGHT,
                Math.min(INFO_PANEL_MAX_HEIGHT, INFO_PANEL_MAX_HEIGHT - g.dy)
              );
              infoPanelTranslateY.setValue(SCREEN_HEIGHT - newHeight);
          },
          onPanResponderRelease: (_, g) => {
              const threshold = INFO_PANEL_MAX_HEIGHT * 0.25;
              const shouldExpand = g.dy < -threshold;
              const shouldCollapse = g.dy > threshold;

              if (shouldExpand) expandListPanel();
              else if (shouldCollapse) collapseListPanel();
              else resetListPanel();
          },
      })
    ).current;

    // Анимации
    const showFiltersPanel = useCallback(() => {
        setActiveView('filters');
        Animated.parallel([
            Animated.timing(filtersPanelTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
        ]).start();
    }, [filtersPanelTranslateY, overlayOpacity]);

    const hideFiltersPanel = useCallback(() => {
        Animated.parallel([
            Animated.timing(filtersPanelTranslateY, { toValue: -FILTERS_PANEL_HEIGHT, duration: 300, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setActiveView('map'));
    }, [filtersPanelTranslateY, overlayOpacity]);

    const expandListPanel = useCallback(() => {
        setActiveView('list');
        Animated.timing(infoPanelTranslateY, {
            toValue: SCREEN_HEIGHT - INFO_PANEL_MAX_HEIGHT,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [infoPanelTranslateY]);

    const collapseListPanel = useCallback(() => {
        Animated.timing(infoPanelTranslateY, {
            toValue: SCREEN_HEIGHT - INFO_PANEL_MIN_HEIGHT,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setActiveView('map'));
    }, [infoPanelTranslateY]);

    const resetListPanel = useCallback(() => {
        Animated.timing(infoPanelTranslateY, {
            toValue: SCREEN_HEIGHT - INFO_PANEL_MIN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [infoPanelTranslateY]);

    const showRouteInfo = useCallback(() => {
        Animated.timing(routeInfoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, [routeInfoOpacity]);

    const hideRouteInfo = useCallback(() => {
        Animated.timing(routeInfoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, [routeInfoOpacity]);

    // Геолокация
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    if (isMounted) setCoordinates({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                } else {
                    if (isMounted) setCoordinates(DEFAULT_COORDINATES);
                }
            } catch (e) {
                console.warn('Геолокация недоступна:', e);
                if (isMounted) setCoordinates(DEFAULT_COORDINATES);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    // Загрузка фильтров
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const newData = await fetchFiltersMap();
                if (isMounted && newData) {
                    setFilters({
                        categories: newData.categories || [],
                        radius: newData.radius || [],
                        address: '',
                    });
                    if (newData.radius?.length > 0) {
                        setFilterValue(prev => ({ ...prev, radius: newData.radius[0].id }));
                    }
                }
            } catch (e) {
                console.error('Ошибка загрузки фильтров:', e);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    // Показ/скрытие информации о маршруте
    useEffect(() => {
        if (routePoints.length >= 2) showRouteInfo();
        else hideRouteInfo();
    }, [routePoints.length, showRouteInfo, hideRouteInfo]);

    // Ключ кэша
    const getCacheKey = useCallback(() => {
        if (!coordinates) return '';
        return mode === 'route'
          ? `route:${JSON.stringify(fullRouteCoords)}:${transportMode}`
          : `radius:${filterValue.radius}:${coordinates.latitude}:${coordinates.longitude}:p${currentPage}:n${itemsPerPage}`;
    }, [mode, fullRouteCoords, filterValue.radius, coordinates, transportMode, currentPage, itemsPerPage]);

    // Загрузка данных
    useEffect(() => {
        if (!coordinates || (mode === 'radius' && !filterValue.radius)) return;
        if (mode === 'route' && fullRouteCoords.length < 2) return;

        let isMounted = true;
        const key = getCacheKey();
        if (isLoading.current) return;
        isLoading.current = true;

        (async () => {
            try {
                if (dataCache.current[key]) {
                    if (isMounted) {
                        if (mode === 'route') setPlacesAlongRoute(dataCache.current[key]);
                        else setRawTravelsData(dataCache.current[key]);
                    }
                    isLoading.current = false;
                    return;
                }

                let data: any[] = [];
                if (mode === 'route') {
                    data = await fetchTravelsNearRoute(fullRouteCoords, 20000);
                } else {
                    data = await fetchTravelsForMap(currentPage, itemsPerPage, {
                        radius: filterValue.radius,
                        lat: coordinates.latitude,
                        lng: coordinates.longitude,
                    });
                }

                if (isMounted) {
                    if (mode === 'route') setPlacesAlongRoute(data);
                    else setRawTravelsData(data);
                    dataCache.current[key] = data;
                }
            } catch (e) {
                console.error('Ошибка загрузки данных:', e);
                if (isMounted) {
                    if (mode === 'route') setPlacesAlongRoute([]);
                    else setRawTravelsData([]);
                }
            } finally {
                isLoading.current = false;
            }
        })();

        return () => { isMounted = false; };
    }, [filterValue.radius, currentPage, itemsPerPage, fullRouteCoords, coordinates, mode, getCacheKey, transportMode]);

    // Фильтрация данных (категории/адрес)
    useEffect(() => {
        const normalize = (s: string) => s.trim().toLowerCase();
        const selectedCategories = filterValue.categories.map(normalize);
        const source = mode === 'route' ? placesAlongRoute : rawTravelsData;

        const filtered = source.filter((item: any) => {
            const id = item.id || item._id || item.slug || String(item.uid || '');
            if (id && hiddenIds.has(String(id))) return false;

            const itemCategories = (item.categoryName || '')
              .split(',')
              .map((cat: string) => normalize(cat))
              .filter(Boolean);

            const categoryMatch =
              selectedCategories.length === 0 ||
              itemCategories.some((cat: string) => selectedCategories.includes(cat));

            const addressMatch =
              !filterValue.address ||
              (item.address && item.address.toLowerCase().includes(filterValue.address.toLowerCase()));

            return categoryMatch && addressMatch;
        });

        setTravelsData(filtered);
    }, [filterValue.categories, filterValue.address, rawTravelsData, placesAlongRoute, mode, hiddenIds]);

    const onFilterChange = useCallback((field: keyof FilterValues, value: any) => {
        setFilterValue(prev => ({ ...prev, [field]: value }));
        if (field !== 'categories') setCurrentPage(1);
    }, []);

    const onTextFilterChange = useCallback((value: string) => {
        setFilterValue(prev => ({ ...prev, address: value }));
        setCurrentPage(1);
    }, []);

    const resetFilters = useCallback(() => {
        dataCache.current = {};
        setFilterValue({
            radius: filters.radius[0]?.id || '',
            categories: [],
            address: '',
        });
        setStartAddress('');
        setEndAddress('');
        setRoutePoints([]);
        setPlacesAlongRoute([]);
        setRouteDistance(null);
        setFullRouteCoords([]);
        setTravelsData([]);
        setHiddenIds(new Set());
        setCurrentPage(1);
    }, [filters.radius]);

    const decodeEntities = (s: string) =>
      s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    const formatAddress = useCallback((address: string): string => {
        if (!address) return '';
        return decodeEntities(address).replace(/\s+/g, ' ').trim();
    }, []);

    const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
        try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
              { headers: { 'User-Agent': 'metravel-app/1.0 (contact@metravel.by)', 'Referer': SITE } }
            );
            const data = await response.json();
            return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } catch (error) {
            console.warn('Ошибка получения адреса:', error);
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    }, [SITE]);

    const handleMapClick = useCallback(
      async (lng: number, lat: number) => {
          const address = await getAddressFromCoords(lat, lng);
          const formattedAddress = formatAddress(address);

          if (routePoints.length >= 2) {
              setStartAddress(formattedAddress);
              setEndAddress('');
              setRoutePoints([[lng, lat]]);
              setMode('radius');
          } else if (routePoints.length === 0) {
              setStartAddress(formattedAddress);
              setRoutePoints([[lng, lat]]);
          } else {
              setEndAddress(formattedAddress);
              setRoutePoints(prev => [...prev, [lng, lat]]);
              setMode('route');
          }
      },
      [routePoints.length, getAddressFromCoords, formatAddress]
    );

    const buildRouteTo = useCallback(
      async (destination: any) => {
          if (!coordinates) return;
          try {
              const [lat, lng] = destination.coord.split(',').map(Number);
              const destinationAddress = await getAddressFromCoords(lat, lng);
              const formattedAddress = formatAddress(destinationAddress);

              setRoutePoints([
                  [coordinates.longitude, coordinates.latitude],
                  [lng, lat],
              ]);
              setStartAddress('Моё местоположение');
              setEndAddress(formattedAddress);
              setMode('route');

              setFilterValue(prev => ({ ...prev, categories: [], address: '' }));
          } catch (error) {
              console.error('Ошибка построения маршрута:', error);
          }
      },
      [coordinates, getAddressFromCoords, formatAddress]
    );

    const clearRoute = useCallback(() => {
        setRoutePoints([]);
        setPlacesAlongRoute([]);
        setMode('radius');
        setStartAddress('');
        setEndAddress('');
        setRouteDistance(null);
        setFullRouteCoords([]);
        setCurrentPage(1);
    }, []);

    const hideTravel = useCallback((id: string | number) => {
        if (id == null) return;
        setHiddenIds(prev => {
            const next = new Set(prev);
            next.add(String(id));
            return next;
        });
    }, []);

    const resetHidden = useCallback(() => setHiddenIds(new Set()), []);

    const truncateAddress = useCallback((address: string, maxLength: number = 40): string => {
        if (!address) return '';
        return address.length <= maxLength ? address : address.substring(0, maxLength - 3) + '...';
    }, []);

    const currentData = mode === 'route' ? placesAlongRoute : travelsData;
    const hasActiveRoute = routePoints.length >= 2;
    const styles = getStyles(isMobile, width, height);

    if (!coordinates) {
        return (
          <>
              {isFocused && (
                <InstantSEO
                  headKey="map"
                  title="Карта маршрутов | Metravel"
                  description="Найдите интересные маршруты и места рядом с вами."
                  canonical={canonical}
                  image={`${SITE}/og-preview.jpg`}
                  ogType="website"
                />
              )}
              <SafeAreaView style={styles.safeContainer}>
                  <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#4a8c8c" />
                      <Text style={styles.loadingText}>Определяем ваше местоположение…</Text>
                  </View>
              </SafeAreaView>
          </>
        );
    }

    return (
      <>
          {isFocused && (
            <InstantSEO
              headKey="map"
              title="Карта маршрутов | Metravel"
              description="Найдите интересные маршруты и места рядом с вами."
              canonical={canonical}
              image={`${SITE}/og-preview.jpg`}
              ogType="website"
            />
          )}

          <SafeAreaView style={styles.safeContainer}>
              <View style={styles.container}>
                  {/* Карта */}
                  <View style={styles.mapContainer}>
                      <MapPanel
                        travelsData={currentData}
                        coordinates={coordinates}
                        routePoints={routePoints}
                        placesAlongRoute={placesAlongRoute}
                        mode={mode}
                        setRoutePoints={setRoutePoints}
                        onMapClick={handleMapClick}
                        transportMode={transportMode}
                        setRouteDistance={setRouteDistance}
                        setFullRouteCoords={setFullRouteCoords}
                      />
                  </View>

                  {/* Панель информации о маршруте */}
                  {hasActiveRoute && (
                    <Animated.View style={[styles.routeInfoPanel, { opacity: routeInfoOpacity }]}>
                        <View style={styles.routeInfoHeader}>
                            <Text style={styles.routeInfoTitle}>Маршрут</Text>
                            <Pressable onPress={clearRoute} style={styles.closeRouteButton} hitSlop={8}>
                                <Icon name="close" type="material" color="#666" size={20} />
                            </Pressable>
                        </View>

                        <View style={styles.routeDetails}>
                            <View style={styles.routePoint}>
                                <View style={styles.pointIndicator}><Text style={styles.pointNumber}>A</Text></View>
                                <View style={styles.pointInfo}>
                                    <Text style={styles.pointLabel}>Старт:</Text>
                                    <Text style={styles.pointAddress} numberOfLines={2}>
                                        {truncateAddress(formatAddress(startAddress))}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.routeDivider} />

                            <View style={styles.routePoint}>
                                <View style={styles.pointIndicator}><Text style={styles.pointNumber}>B</Text></View>
                                <View style={styles.pointInfo}>
                                    <Text style={styles.pointLabel}>Финиш:</Text>
                                    <Text style={styles.pointAddress} numberOfLines={2}>
                                        {truncateAddress(formatAddress(endAddress))}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.routeStats}>
                            <View style={styles.statItem}>
                                <Icon name="straighten" type="material" color="#4a8c8c" size={16} />
                                <Text style={styles.statText}>Дистанция: {routeDistance ? `${routeDistance.toFixed(1)} км` : '...'}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Icon name="place" type="material" color="#4a8c8c" size={16} />
                                <Text style={styles.statText}>Найдено {currentData.length} объектов</Text>
                            </View>
                        </View>
                    </Animated.View>
                  )}

                  {/* Мобильная навигация */}
                  {isMobile && (
                    <>
                        <View style={styles.bottomNav}>
                            <Pressable style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]} onPress={showFiltersPanel}>
                                <Icon name="filter-list" type="material" color="#4a8c8c" size={24} />
                                <Text style={styles.navButtonText}>Фильтры</Text>
                            </Pressable>

                            <Pressable style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]} onPress={expandListPanel}>
                                <Icon name="list" type="material" color="#4a8c8c" size={24} />
                                <Text style={styles.navButtonText}>Список</Text>
                            </Pressable>

                            <Pressable
                              style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
                              onPress={() => setMode(mode === 'radius' ? 'route' : 'radius')}
                            >
                                <Icon name={mode === 'radius' ? 'route' : 'my-location'} type="material" color="#4a8c8c" size={24} />
                                <Text style={styles.navButtonText}>{mode === 'radius' ? 'Маршрут' : 'Рядом'}</Text>
                            </Pressable>
                        </View>

                        {/* Панель фильтров */}
                        <Animated.View style={[styles.filtersPanel, { transform: [{ translateY: filtersPanelTranslateY }] }]}>
                            <View style={styles.panelHeader}>
                                <Text style={styles.panelTitle}>Фильтры</Text>
                                <Pressable onPress={hideFiltersPanel} hitSlop={8}>
                                    <Icon name="close" type="material" color="#666" size={24} />
                                </Pressable>
                            </View>
                            <ScrollView style={styles.filtersContent}>
                                <FiltersPanel
                                  filters={filters}
                                  filterValue={filterValue}
                                  onFilterChange={onFilterChange}
                                  onTextFilterChange={onTextFilterChange}
                                  resetFilters={resetFilters}
                                  travelsData={currentData}
                                  isMobile={true}
                                  closeMenu={hideFiltersPanel}
                                  startAddress={startAddress}
                                  endAddress={endAddress}
                                  transportMode={transportMode}
                                  setTransportMode={setTransportMode}
                                  mode={mode}
                                  setMode={setMode}
                                  routeDistance={routeDistance}
                                />
                            </ScrollView>
                        </Animated.View>

                        {/* Панель списка */}
                        <Animated.View
                          style={[styles.infoPanel, { transform: [{ translateY: infoPanelTranslateY }] }]}
                        >
                            <View style={styles.dragHandle} {...dragPanResponder.panHandlers}>
                                <View style={styles.dragHandleBar} />
                            </View>

                            <TravelListPanel
                              travelsData={currentData}
                              currentPage={currentPage}
                              itemsPerPage={itemsPerPage}
                              itemsPerPageOptions={[5, 10, 15]}
                              onPageChange={setCurrentPage}
                              onItemsPerPageChange={setItemsPerPage}
                              buildRouteTo={buildRouteTo}
                              // новое: скрыть объект
                              onHideTravel={(id: string | number) => hideTravel(id)}
                              hiddenIds={[...hiddenIds]}
                              onResetHidden={resetHidden}
                              // НОВОЕ: кнопка «свернуть/закрыть список»
                              onClosePanel={collapseListPanel}
                            />
                        </Animated.View>

                        {/* Overlay */}
                        <Animated.View
                          style={[styles.overlay, { opacity: overlayOpacity }]}
                          pointerEvents={activeView === 'filters' ? 'auto' : 'none'}
                        >
                            <Pressable style={styles.overlayPressable} onPress={hideFiltersPanel} />
                        </Animated.View>
                    </>
                  )}

                  {/* Десктоп версия */}
                  {!isMobile && (
                    <>
                        <View style={styles.desktopFiltersPanel}>
                            <FiltersPanel
                              filters={filters}
                              filterValue={filterValue}
                              onFilterChange={onFilterChange}
                              onTextFilterChange={onTextFilterChange}
                              resetFilters={resetFilters}
                              travelsData={currentData}
                              isMobile={false}
                              closeMenu={() => {}}
                              startAddress={startAddress}
                              endAddress={endAddress}
                              transportMode={transportMode}
                              setTransportMode={setTransportMode}
                              mode={mode}
                              setMode={setMode}
                              routeDistance={routeDistance}
                            />
                        </View>

                        <View style={styles.desktopInfoPanel}>
                            <TravelListPanel
                              travelsData={currentData}
                              currentPage={currentPage}
                              itemsPerPage={itemsPerPage}
                              itemsPerPageOptions={[10, 20, 30, 50]}
                              onPageChange={setCurrentPage}
                              onItemsPerPageChange={setItemsPerPage}
                              buildRouteTo={buildRouteTo}
                              onHideTravel={(id: string | number) => hideTravel(id)}
                              hiddenIds={[...hiddenIds]}
                              onResetHidden={resetHidden}
                            />
                            {hasActiveRoute && (
                              <Pressable
                                style={({ pressed }) => [styles.clearRouteButton, pressed && styles.clearRouteButtonPressed]}
                                onPress={clearRoute}
                              >
                                  <Text style={styles.clearRouteText}>Очистить маршрут</Text>
                              </Pressable>
                            )}
                        </View>
                    </>
                  )}
              </View>
          </SafeAreaView>
      </>
    );
}

const getStyles = (isMobile: boolean, width: number, height: number) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    container: {
        flex: 1,
        position: 'relative',
    },
    mapContainer: {
        flex: 1,
    },

    // Панель информации о маршруте
    routeInfoPanel: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
        zIndex: 2001,
        borderWidth: 1,
        borderColor: 'rgba(74, 140, 140, 0.1)',
    },
    routeInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    routeInfoTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
    },
    closeRouteButton: { padding: 4 },
    routeDetails: { marginBottom: 12 },
    routePoint: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    pointIndicator: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#4a8c8c',
        justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
    },
    pointNumber: { color: '#fff', fontWeight: '700', fontSize: 12 },
    pointInfo: { flex: 1 },
    pointLabel: { fontSize: 12, color: '#666', marginBottom: 2, fontWeight: '600' },
    pointAddress: { fontSize: 14, color: '#2c3e50', fontWeight: '500', lineHeight: 18 },
    routeDivider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 8, marginLeft: 36 },
    routeStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statItem: { flexDirection: 'row', alignItems: 'center' },
    statText: { fontSize: 12, color: '#4a8c8c', fontWeight: '600', marginLeft: 6 },

    // Мобильная навигация
    bottomNav: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderTopWidth: 0,
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
        zIndex: 1000,
        minHeight: BOTTOM_BAR_HEIGHT,
    },
    navButton: { alignItems: 'center', padding: 8, minWidth: 70 },
    navButtonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
    navButtonText: { fontSize: 12, color: 'black', marginTop: 4, textAlign: 'center', fontWeight: '600' },

    // Мобильные панели
    filtersPanel: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: FILTERS_PANEL_HEIGHT,
        backgroundColor: '#fff',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
        zIndex: 2002,
    },
    filtersContent: { flex: 1 },
    infoPanel: {
        position: 'absolute',
        left: 0, right: 0,
        height: INFO_PANEL_MAX_HEIGHT,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        paddingBottom: BOTTOM_BAR_HEIGHT + 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 14,
        zIndex: 2001,
    },
    panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    panelTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
    dragHandle: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
    dragHandleBar: { width: 48, height: 5, backgroundColor: '#ddd', borderRadius: 3 },

    // Десктоп панели
    desktopFiltersPanel: {
        position: 'absolute',
        top: 20, left: 20,
        width: 320,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
        maxHeight: height - 40,
    },
    desktopInfoPanel: {
        position: 'absolute',
        top: 20, right: 20, bottom: 20,
        width: 380,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },

    // Кнопки
    clearRouteButton: {
        backgroundColor: '#ff6b6b',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    clearRouteButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    clearRouteText: { color: '#fff', fontWeight: '600', fontSize: 16 },

    // Overlay
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 999 },
    overlayPressable: { flex: 1 },

    // Загрузка
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' },
});
