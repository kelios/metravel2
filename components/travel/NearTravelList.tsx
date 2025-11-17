import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Title } from 'react-native-paper';

import { Travel } from '@/src/types/types';
import { fetchTravelsNear } from '@/src/api/travels';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import MapClientSideComponent from '@/components/Map';

const brandOrange = '#ff8c49';
const lightOrange = '#ffede2';
const backgroundGray = '#f8f9fa';

type Segment = 'list' | 'map';

type NearTravelListProps = {
  travel: Pick<Travel, 'id'>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onTravelsLoaded?: (travels: Travel[]) => void;
};

const SegmentSwitch = ({
                         value,
                         onChange,
                       }: {
  value: Segment;
  onChange: (val: Segment) => void;
}) => (
  <View style={segmentStyles.container}>
    <Pressable
      onPress={() => onChange('list')}
      style={({ pressed }) => [
        segmentStyles.button,
        value === 'list' && segmentStyles.activeButton,
        pressed && segmentStyles.pressedButton,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Показать списком"
      accessibilityState={{ selected: value === 'list' }}
    >
      <Text style={[segmentStyles.text, value === 'list' && segmentStyles.activeText]}>
        Список
      </Text>
    </Pressable>
    <Pressable
      onPress={() => onChange('map')}
      style={({ pressed }) => [
        segmentStyles.button,
        value === 'map' && segmentStyles.activeButton,
        pressed && segmentStyles.pressedButton,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Показать на карте"
      accessibilityState={{ selected: value === 'map' }}
    >
      <Text style={[segmentStyles.text, value === 'map' && segmentStyles.activeText]}>
        Карта
      </Text>
    </Pressable>
  </View>
);

const TravelCardSkeleton = () => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.image} />
    <View style={skeletonStyles.content}>
      <View style={skeletonStyles.title} />
      <View style={skeletonStyles.description} />
      <View style={skeletonStyles.meta} />
    </View>
  </View>
);

// Новый компонент для карты с ограниченной высотой
const MapContainer = memo(({
                             points,
                             height = 400,
                             showRoute = true
                           }: {
  points: any[];
  height?: number;
  showRoute?: boolean;
}) => {
  const [mapHeight, setMapHeight] = useState(height);
  const [isLoading, setIsLoading] = useState(true);

  const canRenderMap = useMemo(
    () => typeof window !== 'undefined' && points.length > 0,
    [points.length]
  );

  if (!canRenderMap) {
    return (
      <View style={[styles.mapPlaceholder, { height }]}>
        <Text style={styles.placeholderIcon}>🌍</Text>
        <Text style={styles.placeholderText}>Загрузка карты...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapContainer, { height }]}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>
          🗺️ {points.length} {points.length === 1 ? 'точка' :
          points.length < 5 ? 'точки' : 'точек'} на карте
        </Text>
      </View>

      <View style={styles.mapWrapper}>
        <MapClientSideComponent
          showRoute={showRoute}
          travel={{ data: points }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <View style={styles.mapFooter}>
        <Text style={styles.mapHint}>
          🔍 Приближайте и перемещайтесь для детального просмотра
        </Text>
      </View>
    </View>
  );
});

const NearTravelList: React.FC<NearTravelListProps> = memo(
  ({ travel, onLayout, onTravelsLoaded }) => {
    const [travelsNear, setTravelsNear] = useState<Travel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<Segment>('list');
    const [visibleCount, setVisibleCount] = useState(6);
    const { width, height } = useWindowDimensions();
    const listRef = useRef<FlatList>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    // Адаптивные высоты для карты
    const mapHeight = useMemo(() => {
      if (isMobile) return 320;
      if (isTablet) return 400;
      return 500; // desktop
    }, [isMobile, isTablet]);

    const listHeight = useMemo(() => {
      if (isMobile) return 'auto';
      if (isTablet) return 500;
      return 600; // desktop
    }, [isMobile, isTablet]);

    // Адаптивное количество колонок
    const numColumns = useMemo(() => {
      if (isMobile) return 1;
      if (isTablet) return 2;
      return 3;
    }, [isMobile, isTablet]);

    const initialLoadCount = useMemo(() => {
      if (isMobile) return 6;
      if (isTablet) return 8;
      return 12;
    }, [isMobile, isTablet]);

    const loadMoreCount = useMemo(() => {
      if (isMobile) return 4;
      if (isTablet) return 6;
      return 8;
    }, [isMobile, isTablet]);

    // ✅ ИСПРАВЛЕНИЕ: Используем useRef для предотвращения бесконечных запросов
    const hasLoadedRef = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);

    // Оптимизированная загрузка данных с защитой от повторных запросов
    const fetchNearbyTravels = useCallback(async () => {
      if (!travel.id || hasLoadedRef.current) return;

      // Отменяем предыдущий запрос, если он существует
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      hasLoadedRef.current = true;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000);

      try {
        setIsLoading(true);
        setError(null);

        const travelId = Number(travel.id);
        if (!Number.isFinite(travelId)) {
          throw new Error('Некорректный идентификатор путешествия');
        }

        const data = await fetchTravelsNear(travelId);
        if (!controller.signal.aborted) {
          const travelsArray = Array.isArray(data) ? data.slice(0, 50) : [];
          setTravelsNear(travelsArray);
          onTravelsLoaded?.(travelsArray);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        
        if (e.name === 'AbortError') {
          setError('Превышено время ожидания загрузки');
        } else {
          setError('Не удалось загрузить маршруты. Попробуйте позже.');
        }
        console.error('Fetch error:', e);
        hasLoadedRef.current = false; // Разрешаем повторную попытку при ошибке
      } finally {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, [travel.id]); // ✅ УБРАНО: onTravelsLoaded из зависимостей для предотвращения бесконечных запросов

    // ✅ ИСПРАВЛЕНИЕ: Загружаем данные только один раз при монтировании или изменении travel.id
    useEffect(() => {
      if (!travel.id) return;
      
      hasLoadedRef.current = false; // Сбрасываем флаг при изменении travel.id
      
      const timer = setTimeout(() => {
        fetchNearbyTravels();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        if (controllerRef.current) {
          controllerRef.current.abort();
        }
      };
    }, [travel.id]); // ✅ ИСПРАВЛЕНИЕ: Зависим только от travel.id, не от fetchNearbyTravels

    // ✅ ИСПРАВЛЕНИЕ: Вызываем onTravelsLoaded только после успешной загрузки
    useEffect(() => {
      if (travelsNear.length > 0 && onTravelsLoaded) {
        onTravelsLoaded(travelsNear);
      }
    }, [travelsNear.length]); // ✅ Зависим только от длины массива, не от самого массива или функции

    // Оптимизированное преобразование точек для карты
    const mapPoints = useMemo(() => {
      if (!travelsNear.length) return [];

      const points = [];
      for (let i = 0; i < Math.min(travelsNear.length, 20); i++) {
        const item = travelsNear[i];
        if (!item.points || !Array.isArray(item.points)) continue;

        for (let j = 0; j < item.points.length; j++) {
          const point = item.points[j];
          if (!point?.coord) continue;

          const [lat, lng] = String(point.coord).split(',').map(n => parseFloat(n.trim()));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          points.push({
            id: `${item.id}-${j}`,
            coord: `${lat},${lng}`,
            address: point.address || item.title || '',
            travelImageThumbUrl: point.travelImageThumbUrl || item.travel_image_thumb_url || '',
            categoryName: point.categoryName || item.countryName || '',
            articleUrl: point.urlTravel,
          });

          if (points.length >= 50) break;
        }
        if (points.length >= 50) break;
      }
      return points;
    }, [travelsNear]);

    const handleLoadMore = useCallback(() => {
      if (visibleCount < travelsNear.length) {
        setVisibleCount(prev => Math.min(prev + loadMoreCount, travelsNear.length));
      }
    }, [visibleCount, travelsNear.length, loadMoreCount]);

    const renderTravelItem = useCallback(({ item, index }: { item: Travel; index: number }) => (
      <View style={[
        styles.travelItem,
        index % 2 !== 0 && styles.travelItemOdd
      ]}>
        <TravelTmlRound
          travel={item}
          priority={index < 6}
        />
      </View>
    ), []);

    const keyExtractor = useCallback((item: Travel) => `travel-${item.id}`, []);

    if (error) {
      return (
        <View style={styles.errorContainer} onLayout={onLayout}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={fetchNearbyTravels}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>🔄 Повторить попытку</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const displayedTravels = travelsNear.slice(0, visibleCount);

    return (
      <View style={styles.section} onLayout={onLayout}>
        <View style={styles.header}>
          <Title style={styles.title}>Рядом можно посмотреть</Title>
          <Text style={styles.subtitle}>Маршруты в радиусе ~60 км</Text>
        </View>

        {/* Десктоп и планшет: параллельное отображение */}
        {!isMobile ? (
          <View style={styles.desktopContainer}>
            <View style={[styles.listColumn, { height: listHeight }]}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <View style={styles.travelsGrid}>
                  {displayedTravels.map((item, index) => (
                    <View
                      key={keyExtractor(item)}
                      style={[
                        styles.travelItem,
                        index % 2 !== 0 && styles.travelItemOdd
                      ]}
                    >
                      {renderTravelItem({ item, index })}
                    </View>
                  ))}
                </View>

                {visibleCount < travelsNear.length && (
                  <View style={styles.loadMoreContainer}>
                    <TouchableOpacity
                      onPress={handleLoadMore}
                      style={styles.loadMoreButton}
                    >
                      <Text style={styles.loadMoreButtonText}>
                        Показать ещё {Math.min(loadMoreCount, travelsNear.length - visibleCount)} из {travelsNear.length - visibleCount}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.mapColumn}>
              <MapContainer
                points={mapPoints}
                height={mapHeight}
                showRoute={true}
              />
            </View>
          </View>
        ) : (
          /* Мобильный: переключатель между видами */
          <>
            <SegmentSwitch value={viewMode} onChange={setViewMode} />

            {viewMode === 'list' ? (
              <FlatList
                data={displayedTravels}
                keyExtractor={keyExtractor}
                renderItem={renderTravelItem}
                contentContainerStyle={styles.mobileListContent}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.2}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                maxToRenderPerBatch={2}
                windowSize={3}
                ListFooterComponent={
                  visibleCount < travelsNear.length ? (
                    <View style={styles.loadMoreContainer}>
                      <TouchableOpacity
                        onPress={handleLoadMore}
                        style={styles.loadMoreButton}
                      >
                        <Text style={styles.loadMoreButtonText}>
                          📥 Загрузить ещё
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : isLoading ? (
                    <View style={styles.skeletonContainer}>
                      {[1, 2].map(i => <TravelCardSkeleton key={i} />)}
                    </View>
                  ) : null
                }
              />
            ) : (
              <View style={styles.mobileMapColumn}>
                <MapContainer
                  points={mapPoints}
                  height={mapHeight}
                  showRoute={true}
                />
              </View>
            )}
          </>
        )}

        {/* Индикатор загрузки при первоначальной загрузке */}
        {isLoading && travelsNear.length === 0 && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={brandOrange} />
              <Text style={styles.loadingText}>Ищем интересные места рядом...</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);

export default NearTravelList;

/* ========================= Styles ========================= */

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    marginBottom: 40,
    paddingHorizontal: Math.max(16, Platform.OS === 'web' ? '4%' : 16),
    paddingVertical: 24,
    backgroundColor: backgroundGray,
    borderRadius: 20,
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '500',
  },
  desktopContainer: {
    flexDirection: 'row',
    gap: 24,
    minHeight: 600,
  },
  listColumn: {
    flex: 1.2,
    minHeight: 500,
  },
  mapColumn: {
    flex: 1,
    minWidth: 300,
  },
  mobileMapColumn: {
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  travelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  travelItem: {
    flex: 1,
    minWidth: 280,
    maxWidth: '100%',
    marginBottom: 16,
  },
  travelItemOdd: {
    opacity: 0.95,
  },
  mobileListContent: {
    paddingBottom: 16,
  },

  // Стили для контейнера карты
  mapContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f7fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    textAlign: 'center',
  },
  mapWrapper: {
    flex: 1,
    minHeight: 300,
  },
  mapFooter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f7fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mapHint: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#edf2f7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  placeholderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
  },

  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: brandOrange,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadMoreButtonText: {
    color: brandOrange,
    fontSize: 15,
    fontWeight: '600',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 249, 250, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },

  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: backgroundGray,
    borderRadius: 20,
    marginHorizontal: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: brandOrange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  skeletonContainer: {
    gap: 16,
    paddingHorizontal: 8,
  },
});

const segmentStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#edf2f7',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    alignSelf: 'center',
    maxWidth: 300,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  activeButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pressedButton: {
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#718096',
  },
  activeText: {
    color: brandOrange,
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 12,
  },
  content: {
    gap: 8,
  },
  title: {
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    width: '80%',
  },
  description: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    width: '60%',
  },
  meta: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    width: '40%',
  },
});