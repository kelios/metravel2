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
  View,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Title } from 'react-native-paper';

import { Travel } from '@/src/types/types';
import { fetchTravelsNear } from '@/src/api/map';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import MapClientSideComponent from '@/components/Map';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';

const brandOrange = '#ff8c49'; // Оставляем для обратной совместимости, но используем DESIGN_TOKENS где возможно
const backgroundGray = '#f8f9fa';

type Segment = 'list' | 'map';

type NearTravelListProps = {
  travel: Pick<Travel, 'id'>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onTravelsLoaded?: (travels: Travel[]) => void;
  showHeader?: boolean;
  embedded?: boolean;
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
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
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
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
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
                             showRoute = true,
                             isLoading = false,
                           }: {
  points: any[];
  height?: number;
  showRoute?: boolean;
  isLoading?: boolean;
}) => {
  const canRenderMap = useMemo(
    () => typeof window !== 'undefined' && points.length > 0,
    [points.length]
  );

  if (!canRenderMap) {
    return (
      <View style={[styles.mapPlaceholder, { height }]}> 
        <Text style={styles.placeholderText}>
          {isLoading ? 'Загрузка карты...' : 'Нет точек для карты'}
        </Text>
      </View>
    );
  }

  return (
    <View 
      style={[styles.mapContainer, { height }]}
    >
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>
          {points.length} {points.length === 1 ? 'точка' :
          points.length < 5 ? 'точки' : 'точек'} на карте
        </Text>
      </View>

      <View style={styles.mapWrapper}>
        <MapClientSideComponent
          showRoute={showRoute}
          travel={{ data: points }}
        />
      </View>

      <View style={styles.mapFooter}>
        <Text style={styles.mapHint}>
          Приближайте и перемещайтесь для детального просмотра
        </Text>
      </View>
    </View>
  );
});

const NearTravelList: React.FC<NearTravelListProps> = memo(
  ({
     travel,
     onLayout,
     onTravelsLoaded,
     showHeader = true,
     embedded = false,
   }) => {
    const [travelsNear, setTravelsNear] = useState<Travel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<Segment>('list');
    const [visibleCount, setVisibleCount] = useState(6);
    const { isPhone, isLargePhone, isTablet } = useResponsive();
    const scrollViewRef = useRef<ScrollView>(null);

    const isMobile = isPhone || isLargePhone;

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
    const loadMoreCount = useMemo(() => {
      if (isMobile) return 4;
      if (isTablet) return 6;
      return 8;
    }, [isMobile, isTablet]);

    // ✅ ИСПРАВЛЕНИЕ: Используем useRef для предотвращения бесконечных запросов
    const hasLoadedRef = useRef(false);
    const onTravelsLoadedRef = useRef(onTravelsLoaded);
    useEffect(() => {
      onTravelsLoadedRef.current = onTravelsLoaded;
    }, [onTravelsLoaded]);
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
          onTravelsLoadedRef.current?.(travelsArray);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        
        // ✅ УЛУЧШЕНИЕ: Понятные сообщения об ошибках
        if (e.name === 'AbortError') {
          setError('Превышено время ожидания загрузки. Проверьте подключение к интернету.');
        } else {
          setError('Не удалось загрузить маршруты. Проверьте подключение и попробуйте позже.');
        }
        if (__DEV__) {
          console.error('Fetch error:', e);
        }
        hasLoadedRef.current = false; // Разрешаем повторную попытку при ошибке
      } finally {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, [travel.id]);

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
    }, [travel.id, fetchNearbyTravels]);

    // ✅ ИСПРАВЛЕНИЕ: Вызываем onTravelsLoaded только после успешной загрузки
    useEffect(() => {
      if (travelsNear.length > 0 && onTravelsLoaded) {
        onTravelsLoaded(travelsNear);
      }
    }, [travelsNear, onTravelsLoaded]);

    // Оптимизированное преобразование точек для карты
    const mapPoints = useMemo(() => {
      if (!travelsNear.length) return [];

      const points = [];
      for (let i = 0; i < Math.min(travelsNear.length, 20); i++) {
        const item = travelsNear[i];
        const itemAny = item as any;
        const itemPoints =
          (Array.isArray(itemAny?.points) && itemAny.points) ||
          (Array.isArray(itemAny?.travelAddress) && itemAny.travelAddress) ||
          (Array.isArray(itemAny?.travel_address) && itemAny.travel_address) ||
          (Array.isArray(itemAny?.travel_points) && itemAny.travel_points) ||
          (Array.isArray(itemAny?.pointsList) && itemAny.pointsList) ||
          null;
        if (!itemPoints) continue;

        for (let j = 0; j < itemPoints.length; j++) {
          const point = itemPoints[j];
          const coordRaw =
            point?.coord ??
            point?.coordinates ??
            point?.location ??
            (point?.lat != null && point?.lng != null ? `${point.lat},${point.lng}` : null) ??
            (point?.latitude != null && point?.longitude != null ? `${point.latitude},${point.longitude}` : null);
          if (!coordRaw) continue;

          const [lat, lng] = String(coordRaw)
            .split(',')
            .map((n) => parseFloat(String(n).trim()));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          points.push({
            id: `${item.id}-${j}`,
            coord: `${lat},${lng}`,
            address: point.address || point.title || item.name || '',
            travelImageThumbUrl:
              point.travelImageThumbUrl ||
              point.travel_image_thumb_url ||
              point.image ||
              item.travel_image_thumb_url ||
              '',
            categoryName: point.categoryName || point.category_name || item.countryName || '',
            articleUrl: point.urlTravel || point.articleUrl || point.article_url,
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
        />
      </View>
    ), []);

    const keyExtractor = useCallback((item: Travel) => `travel-${item.id}`, []);

    if (error) {
      return (
        <View style={styles.errorContainer} onLayout={onLayout}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={fetchNearbyTravels}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Повторить попытку</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const displayedTravels = travelsNear.slice(0, visibleCount);

    return (
      <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
        {showHeader && (
          <View style={styles.header}>
            <Title style={styles.title}>Рядом можно посмотреть</Title>
            <Text style={styles.subtitle}>Маршруты в радиусе ~60 км</Text>
          </View>
        )}

        {!isMobile ? (
          <>
            <SegmentSwitch value={viewMode} onChange={setViewMode} />

            {viewMode === 'map' ? (
              <View style={styles.mobileMapColumn}>
                <MapContainer
                  points={mapPoints}
                  height={mapHeight}
                  showRoute={true}
                  isLoading={isLoading}
                />
              </View>
            ) : (
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
                        style={[styles.travelItem, index % 2 !== 0 && styles.travelItemOdd]}
                      >
                        {renderTravelItem({ item, index })}
                      </View>
                    ))}
                  </View>

                  {visibleCount < travelsNear.length && (
                    <View style={styles.loadMoreContainer}>
                      <TouchableOpacity onPress={handleLoadMore} style={styles.loadMoreButton}>
                        <Text style={styles.loadMoreButtonText}>
                          Показать ещё {Math.min(loadMoreCount, travelsNear.length - visibleCount)} из{' '}
                          {travelsNear.length - visibleCount}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <>
            <SegmentSwitch value={viewMode} onChange={setViewMode} />

            {viewMode === 'list' ? (
              <FlatList
                data={displayedTravels}
                keyExtractor={keyExtractor}
                renderItem={renderTravelItem}
                contentContainerStyle={styles.mobileListContent}
                scrollEnabled={!embedded}
                nestedScrollEnabled={!embedded}
                onEndReached={embedded ? undefined : handleLoadMore}
                onEndReachedThreshold={embedded ? undefined : 0.2}
                showsVerticalScrollIndicator={false}
                initialNumToRender={6}
                maxToRenderPerBatch={2}
                windowSize={3}
                ListFooterComponent={
                  visibleCount < travelsNear.length ? (
                    <View style={styles.loadMoreContainer}>
                      <Pressable
                        onPress={handleLoadMore}
                        style={[styles.loadMoreButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                        accessibilityRole="button"
                        accessibilityLabel="Загрузить ещё путешествий"
                      >
                        <Text style={styles.loadMoreButtonText}>Загрузить ещё</Text>
                      </Pressable>
                    </View>
                  ) : isLoading ? (
                    <View style={styles.skeletonContainer}>
                      {[1, 2].map((i) => (
                        <TravelCardSkeleton key={i} />
                      ))}
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
                  isLoading={isLoading}
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
    marginTop: DESIGN_TOKENS.spacing.md,
    marginBottom: 40,
    paddingHorizontal: 16,
    paddingVertical: DESIGN_TOKENS.spacing.md,
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
  embeddedSection: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '500',
  },
  desktopContainer: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
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
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
  travelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.lg,
  },
  travelItem: {
    flex: 1,
    minWidth: 280,
    maxWidth: '100%',
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  travelItemOdd: {
    opacity: 0.95,
  },
  mobileListContent: {
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },

  // Стили для контейнера карты
  mapContainer: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    ...DESIGN_TOKENS.shadowsNative.medium,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
  },
  mapHeader: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: DESIGN_TOKENS.colors.borderLight,
  },
  mapTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.textSubtle,
    textAlign: 'center',
  },
  mapWrapper: {
    flex: 1,
    minHeight: 300,
  },
  mapFooter: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: DESIGN_TOKENS.colors.borderLight,
  },
  mapHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
  },

  loadMoreContainer: {
    padding: DESIGN_TOKENS.spacing.lg,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 12,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
          transform: 'translateY(-1px)',
        },
      },
    }),
  },
  loadMoreButtonText: {
    color: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    fontSize: DESIGN_TOKENS.typography.sizes.md,
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
    gap: DESIGN_TOKENS.spacing.lg,
  },
  loadingText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: '#4a5568',
    fontWeight: '500',
  },

  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xs,
    backgroundColor: backgroundGray,
    borderRadius: 20,
    marginHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 12,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: '#3a7a7a', // Темнее primary для hover
          transform: 'translateY(-1px)',
        },
      },
    }),
  },
  retryButtonText: {
    color: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },

  skeletonContainer: {
    gap: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: 8,
  },
});

const segmentStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.lg, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    padding: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    alignSelf: 'center',
    maxWidth: 300,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        },
      },
    }),
  },
  activeButton: {
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
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
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
  },
  activeText: {
    color: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.lg,
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
    gap: DESIGN_TOKENS.spacing.sm,
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