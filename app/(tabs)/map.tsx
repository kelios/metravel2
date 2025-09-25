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
    Platform,
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

interface Coordinates { latitude: number; longitude: number }
interface FilterValues { categories: string[]; radius: string; address: string }
interface Filters {
    categories: { id: string; name: string }[];
    radius: { id: string; name: string }[];
    address: string;
}

const DEFAULT_COORDINATES = { latitude: 53.9006, longitude: 27.5590 };

/** ui buttons без HTML <button> */
const stylesBase = StyleSheet.create({
    iconButton: {
        backgroundColor: 'rgba(74, 140, 140, 0.95)',
        borderRadius: 30,
        width: 52,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.95 }],
    },
    textButton: {
        backgroundColor: '#4a8c8c',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    textButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    textButtonLabel: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});

const IconFab = ({
                     name,
                     onPress,
                     style,
                     size = 24,
                 }: {
    name: string;
    onPress: () => void;
    style?: any;
    size?: number;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [stylesBase.iconButton, style, pressed && stylesBase.pressed]}
  >
      <Icon name={name} type="material" color="#fff" size={size} />
  </Pressable>
);

const TextButton = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [stylesBase.textButton, pressed && stylesBase.textButtonPressed]}
  >
      <Text style={stylesBase.textButtonLabel}>{title}</Text>
  </Pressable>
);

export default function MapScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    const canonical = useMemo(() => `${SITE}${pathname || '/map'}`, [SITE, pathname]);

    const { width, height } = useWindowDimensions();
    const isMobile = width <= 768;
    const styles = useMemo(() => getStyles(isMobile, width, height), [isMobile, width, height]);

    const [mode, setMode] = useState<'radius' | 'route'>('radius');
    const [filters, setFilters] = useState<Filters>({
        categories: [],
        radius: [],
        address: '',
    });
    const [filterValue, setFilterValue] = useState<FilterValues>({
        categories: [],
        radius: '',
        address: '',
    });
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

    const [filtersVisible, setFiltersVisible] = useState(!isMobile);
    const [infoVisible, setInfoVisible] = useState(!isMobile);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(isMobile ? 10 : 20);

    const dataCache = useRef<Record<string, any[]>>({});
    const isLoading = useRef(false);

    // геолокация
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    if (isMounted) setCoordinates(loc.coords);
                } else {
                    if (isMounted) setCoordinates(DEFAULT_COORDINATES);
                }
            } catch (error) {
                console.warn('Геолокация недоступна:', error);
                if (isMounted) setCoordinates(DEFAULT_COORDINATES);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    // загрузка фильтров
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
                        setFilterValue((prev) => ({
                            ...prev,
                            radius: newData.radius[0].id,
                        }));
                    }
                }
            } catch (error) {
                console.error('Ошибка загрузки фильтров:', error);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    // ключ кэша — учитываем и пагинацию
    const getCacheKey = useCallback(() => {
        if (!coordinates) return '';
        return mode === 'route'
          ? `route:${JSON.stringify(fullRouteCoords)}:${transportMode}`
          : `radius:${filterValue.radius}:${coordinates.latitude}:${coordinates.longitude}:p${currentPage}:n${itemsPerPage}`;
    }, [
        mode,
        fullRouteCoords,
        filterValue.radius,
        coordinates,
        transportMode,
        currentPage,
        itemsPerPage,
    ]);

    // загрузка данных
    useEffect(() => {
        if (!coordinates || (mode === 'radius' && !filterValue.radius)) return;

        let isMounted = true;
        const key = getCacheKey();
        if (isLoading.current) return;
        isLoading.current = true;

        (async () => {
            try {
                // кэш
                if (dataCache.current[key]) {
                    if (isMounted) {
                        if (mode === 'route') setPlacesAlongRoute(dataCache.current[key]);
                        else setRawTravelsData(dataCache.current[key]);
                    }
                    return;
                }

                let data: any[] = [];
                if (mode === 'route' && fullRouteCoords.length >= 2) {
                    data = await fetchTravelsNearRoute(fullRouteCoords, 20000);
                } else if (mode === 'radius') {
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
            } catch (error) {
                console.error('Ошибка загрузки данных:', error);
                if (isMounted) {
                    if (mode === 'route') setPlacesAlongRoute([]);
                    else setRawTravelsData([]);
                }
            } finally {
                isLoading.current = false;
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [
        filterValue.radius,
        currentPage,
        itemsPerPage,
        fullRouteCoords,
        coordinates,
        mode,
        getCacheKey,
        transportMode,
    ]);

    // фильтрация данных
    useEffect(() => {
        const normalize = (s: string) => s.trim().toLowerCase();
        const selectedCategories = filterValue.categories.map(normalize);
        const source = mode === 'route' ? placesAlongRoute : rawTravelsData;

        const filtered = source.filter((item: any) => {
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
    }, [filterValue.categories, filterValue.address, rawTravelsData, placesAlongRoute, mode]);

    const onFilterChange = useCallback((field: keyof FilterValues, value: any) => {
        setFilterValue((prev) => ({ ...prev, [field]: value }));
        if (field !== 'categories') setCurrentPage(1);
    }, []);

    const onTextFilterChange = useCallback((value: string) => {
        setFilterValue((prev) => ({ ...prev, address: value }));
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
        setCurrentPage(1);
    }, [filters.radius]);

    const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
        try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`
            );
            const data = await response.json();
            return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } catch (error) {
            console.warn('Ошибка получения адреса:', error);
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    }, []);

    const handleMapClick = useCallback(
      async (lng: number, lat: number) => {
          const address = await getAddressFromCoords(lat, lng);

          if (routePoints.length >= 2) {
              setStartAddress(address);
              setEndAddress('');
              setRoutePoints([[lng, lat]]);
          } else if (routePoints.length === 0) {
              setStartAddress(address);
              setRoutePoints([[lng, lat]]);
          } else {
              setEndAddress(address);
              setRoutePoints((prev) => [...prev, [lng, lat]]);
              setMode('route');
          }
      },
      [routePoints.length, getAddressFromCoords]
    );

    const buildRouteTo = useCallback(
      async (destination: any) => {
          if (!coordinates) return;
          try {
              const [lat, lng] = destination.coord.split(',').map(Number);
              const destinationAddress = await getAddressFromCoords(lat, lng);

              setRoutePoints([
                  [coordinates.longitude, coordinates.latitude],
                  [lng, lat],
              ]);
              setStartAddress('Моё местоположение');
              setEndAddress(destinationAddress);
              setMode('route');

              setFilterValue((prev) => ({ ...prev, categories: [], address: '' }));
          } catch (error) {
              console.error('Ошибка построения маршрута:', error);
          }
      },
      [coordinates, getAddressFromCoords]
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

    if (!coordinates) {
        return (
          <>
              {isFocused && (
                <InstantSEO
                  headKey="map"
                  title="Карта маршрутов | Metravel"
                  description="Найдите интересные маршруты и места рядом с вами. Постройте маршрут или исследуйте локации поблизости на карте Metravel."
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

    const currentData = mode === 'route' ? placesAlongRoute : travelsData;
    const hasActiveRoute = routePoints.length >= 2;

    return (
      <>
          {isFocused && (
            <InstantSEO
              headKey="map"
              title="Карта маршрутов | Metravel"
              description="Найдите интересные маршруты и места рядом с вами. Постройте маршрут или исследуйте локации поблизости на карте Metravel."
              canonical={canonical}
              image={`${SITE}/og-preview.jpg`}
              ogType="website"
            />
          )}

          <SafeAreaView style={styles.safeContainer}>
              <View style={styles.container}>
                  {/* Плавающая панель фильтров (и на десктопе, и на мобиле) */}
                  {filtersVisible ? (
                    <View style={styles.filtersPanelContainer} pointerEvents="box-none">
                        <FiltersPanel
                          filters={filters}
                          filterValue={filterValue}
                          onFilterChange={onFilterChange}
                          onTextFilterChange={onTextFilterChange}
                          resetFilters={resetFilters}
                          travelsData={currentData}
                          isMobile={isMobile}
                          closeMenu={() => setFiltersVisible(false)}
                          startAddress={startAddress}
                          endAddress={endAddress}
                          transportMode={transportMode}
                          setTransportMode={setTransportMode}
                          mode={mode}
                          setMode={setMode}
                          routeDistance={routeDistance}
                        />
                    </View>
                  ) : (
                    <View style={styles.filtersButtonContainer} pointerEvents="box-none">
                        <IconFab
                          name="filter-list"
                          onPress={() => setFiltersVisible(true)}
                          style={styles.floatingButton}
                        />
                    </View>
                  )}

                  {/* Основной контент */}
                  <View style={styles.mainContent}>
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

                      {/* Панель информации */}
                      {infoVisible && (
                        <View style={styles.infoPanel}>
                            <TravelListPanel
                              travelsData={currentData}
                              currentPage={currentPage}
                              itemsPerPage={itemsPerPage}
                              itemsPerPageOptions={isMobile ? [5, 10, 15] : [10, 20, 30, 50]}
                              onPageChange={setCurrentPage}
                              onItemsPerPageChange={setItemsPerPage}
                              buildRouteTo={buildRouteTo}
                            />
                            {hasActiveRoute && <TextButton title="Очистить маршрут" onPress={clearRoute} />}
                        </View>
                      )}

                      {/* Кнопка сворачивания инфо-панели */}
                      <View style={styles.toggleInfoButton}>
                          <IconFab
                            name={infoVisible ? 'keyboard-arrow-down' : 'keyboard-arrow-up'}
                            onPress={() => setInfoVisible(!infoVisible)}
                            style={styles.floatingButton}
                            size={20}
                          />
                      </View>
                  </View>
              </View>
          </SafeAreaView>
      </>
    );
}

const getStyles = (isMobile: boolean, width: number, height: number) =>
  StyleSheet.create({
      safeContainer: {
          flex: 1,
          backgroundColor: '#f8f9fa',
      },
      container: {
          flex: 1,
          padding: isMobile ? 8 : 16,
      },
      mainContent: {
          flex: 1,
          flexDirection: isMobile ? 'column' : 'row',
          position: 'relative',
      },

      // 👇 Делает панель фильтров плавающей всегда
      filtersPanelContainer: {
          position: 'absolute',
          top: isMobile ? 80 : 16,
          left: 16,
          right: undefined,
          zIndex: 1000,
          width: isMobile ? width - 32 : 350,
          maxWidth: '100%',
      },

      filtersButtonContainer: {
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 999,
      },

      mapContainer: {
          flex: 1,
          borderRadius: 16,
          overflow: 'hidden',
          marginRight: isMobile ? 0 : 12,
      },

      infoPanel: {
          width: isMobile ? '100%' : 380,
          height: isMobile ? height * 0.4 : '100%',
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 12,
          ...(isMobile
            ? {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
            }
            : {}),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
      },

      toggleInfoButton: {
          position: 'absolute',
          [isMobile ? 'bottom' : 'top']: 20,
          [isMobile ? 'right' : 'left']: 20,
          zIndex: 999,
      },

      floatingButton: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
      },

      loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
      },
      loadingText: {
          marginTop: 16,
          fontSize: 16,
          color: '#666',
          textAlign: 'center',
      },
  });
