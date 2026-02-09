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
  StyleSheet,
  Text,
  View,
  Platform,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Title } from '@/ui/paper';

import { Travel } from '@/types/types';
import { fetchTravelsNear } from '@/api/map';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import Button from '@/components/ui/Button';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryConfigs } from '@/utils/reactQueryConfig';
import { queryKeys } from '@/queryKeys';

// ✅ ОПТИМИЗАЦИЯ: Lazy imports для map-компонентов
const MapClientSideComponent = React.lazy(() => import('@/components/map/Map'));
const SegmentedControl = React.lazy(() => import('@/components/MapPage/SegmentedControl'));

type Segment = 'list' | 'map';

type NearTravelListProps = {
  travel: Pick<Travel, 'id'>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onTravelsLoaded?: (travels: Travel[]) => void;
  showHeader?: boolean;
  embedded?: boolean;
};

const TravelCardSkeleton = ({ colors }: { colors: ReturnType<typeof useThemedColors> }) => {
  // ✅ РЕДИЗАЙН: Стили скелетона с поддержкой темной темы
  const skeletonStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      marginBottom: DESIGN_TOKENS.spacing.md,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    image: {
      width: '100%',
      height: 180,
      backgroundColor: colors.backgroundSecondary,
    },
    content: {
      padding: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      height: 20,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.sm,
      width: '70%',
    },
    description: {
      height: 16,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.sm,
      width: '90%',
    },
    meta: {
      height: 14,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.sm,
      width: '50%',
    },
  }), [colors]);

  return (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.image} />
    <View style={skeletonStyles.content}>
      <View style={skeletonStyles.title} />
      <View style={skeletonStyles.description} />
      <View style={skeletonStyles.meta} />
    </View>
  </View>
  );
};

// Новый компонент для карты с ограниченной высотой
const MapContainer = memo(({
                             points,
                             height = 400,
                             showRoute = true,
                             isLoading = false,
                             colors,
                           }: {
  points: any[];
  height?: number;
  showRoute?: boolean;
  isLoading?: boolean;
  colors: ReturnType<typeof useThemedColors>;
}) => {
  const canRenderMap = useMemo(
    () => typeof window !== 'undefined' && points.length > 0,
    [points.length]
  );

  // ✅ РЕДИЗАЙН: Стили карты с поддержкой темной темы
  const mapStyles = useMemo(() => StyleSheet.create({
    mapPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    placeholderText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    mapContainer: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    mapHeader: {
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mapTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    mapWrapper: {
      flex: 1,
      minHeight: 300,
    },
    mapFooter: {
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      backgroundColor: colors.backgroundSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    mapHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  }), [colors]);

  if (!canRenderMap) {
    return (
      <View style={[mapStyles.mapPlaceholder, { height }]}>
        <Text style={mapStyles.placeholderText}>
          {isLoading ? 'Загрузка карты...' : 'Нет точек для карты'}
        </Text>
      </View>
    );
  }

  return (
    <View 
      style={[mapStyles.mapContainer, { height }]}
    >
      <View style={mapStyles.mapHeader}>
        <Text style={mapStyles.mapTitle}>
          {points.length} {points.length === 1 ? 'точка' :
          points.length < 5 ? 'точки' : 'точек'} на карте
        </Text>
      </View>

      <View style={mapStyles.mapWrapper}>
        <React.Suspense fallback={<ActivityIndicator size="small" color={colors.primary} />}>
          <MapClientSideComponent
            showRoute={showRoute}
            travel={{ data: points }}
          />
        </React.Suspense>
      </View>

      <View style={mapStyles.mapFooter}>
        <Text style={mapStyles.mapHint}>
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
    const [viewMode, setViewMode] = useState<Segment>('list');
    const [visibleCount, setVisibleCount] = useState(6);
    const { isPhone, isLargePhone, isTablet, width } = useResponsive();
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const scrollViewRef = useRef<ScrollView>(null);
    const [isQueryEnabled, setIsQueryEnabled] = useState(false);
    const segmentOptions = useMemo(
      () => [
        { key: 'list', label: 'Список' },
        { key: 'map', label: 'Карта' },
      ],
      []
    );

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

    const numColumns = useMemo(() => {
      if (width <= 640) return 1;
      if (width <= 1024) return 2;
      return 3;
    }, [width]);

    // Адаптивное количество колонок
    const loadMoreCount = useMemo(() => {
      if (isMobile) return 4;
      if (isTablet) return 6;
      return 8;
    }, [isMobile, isTablet]);

    const travelId = useMemo(() => {
      const id = Number(travel.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }, [travel.id]);

    // Small delay to prioritize main content rendering (keeps old behavior, but fetch is handled by React Query).
    useEffect(() => {
      setIsQueryEnabled(false);
      setVisibleCount(6);
      const timer = setTimeout(() => setIsQueryEnabled(true), 300);
      return () => clearTimeout(timer);
    }, [travelId]);

    const {
      data: travelsNear = [],
      isLoading,
      isError,
      error,
      refetch: refetchTravelsNear,
    } = useQuery<Travel[]>({
      queryKey: queryKeys.travelsNear(travelId as number),
      enabled: isQueryEnabled && travelId != null,
      queryFn: ({ signal }) => fetchTravelsNear(travelId as number, signal) as any,
      select: (data) => (Array.isArray(data) ? data.slice(0, 50) : []),
      placeholderData: keepPreviousData,
      ...queryConfigs.paginated,
      refetchOnMount: false,
    });

    useEffect(() => {
      if (!travelsNear.length) return;
      onTravelsLoaded?.(travelsNear);
    }, [onTravelsLoaded, travelsNear]);

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


    // ✅ РЕДИЗАЙН: Стили с поддержкой темной темы
    const styles = useMemo(() => StyleSheet.create({
      section: {
        marginTop: DESIGN_TOKENS.spacing.md,
        marginBottom: 40,
        paddingHorizontal: 16,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 20,
        width: '100%',
        maxWidth: 1400,
        alignSelf: 'center',
        shadowColor: colors.text,
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
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
        fontFamily: 'System',
        letterSpacing: -0.5,
      },
      subtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.textSecondary,
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
        minHeight: 500,
      },
      mobileMapColumn: {
        width: '100%',
        minHeight: 300,
      },
      scrollView: {
        flex: 1,
      },
      scrollContent: {
        paddingBottom: DESIGN_TOKENS.spacing.lg,
      },
      travelsGrid: {
        width: '100%',
        gap: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: 8,
        ...Platform.select({
          web: {
            display: 'grid' as any,
          } as any,
          default: {},
        }),
      },
      webScrollContainer: {
        ...Platform.select({
          web: {
            overflowX: 'auto' as any,
            overflowY: 'hidden' as any,
            WebkitOverflowScrolling: 'touch' as any,
            paddingBottom: DESIGN_TOKENS.spacing.xxs,
            scrollSnapType: 'x mandatory' as any,
            scrollBehavior: 'smooth' as any,
            touchAction: 'pan-x pan-y' as any,
            cursor: 'grab' as any,
            userSelect: 'none' as any,
            msOverflowStyle: 'none' as any,
            scrollbarWidth: 'none' as any,
          } as any,
          default: {},
        }),
      },
      webGridItem: {
        flex: 1,
        minWidth: 0,
        ...Platform.select({
          web: {
            scrollSnapAlign: 'start' as any,
          } as any,
          default: {},
        }),
      },
      travelItem: {
        marginBottom: DESIGN_TOKENS.spacing.md,
        ...Platform.select({
          web: {
            marginBottom: 0,
          },
        }),
      },
      travelItemOdd: {},
      mobileListContent: {
        paddingBottom: DESIGN_TOKENS.spacing.lg,
      },
      mapContainer: {
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
      mapHeader: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.surfaceElevated,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      mapTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        color: colors.textSecondary,
        textAlign: 'center',
      },
      mapWrapper: {
        flex: 1,
        minHeight: 300,
      },
      mapFooter: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        backgroundColor: colors.backgroundSecondary,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      },
      mapHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
      },
      mapPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
      },
      placeholderText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
      },
      loadMoreContainer: {
        padding: DESIGN_TOKENS.spacing.lg,
        alignItems: 'center',
      },
      loadMoreButton: {
        backgroundColor: colors.surface,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: 12,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 2,
        borderColor: colors.primary,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        minHeight: 44,
        ...Platform.select({
          web: {
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          },
        }),
      },
      loadMoreButtonText: {
        color: colors.primaryText,
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
      },
      loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.backgroundSecondary,
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
        color: colors.textSecondary,
        fontWeight: '500',
      },
      errorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.xs,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 20,
        marginHorizontal: DESIGN_TOKENS.spacing.lg,
      },
      errorText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.danger,
        textAlign: 'center',
        marginBottom: DESIGN_TOKENS.spacing.xs,
        lineHeight: 22,
      },
      retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: 12,
        borderRadius: DESIGN_TOKENS.radii.md,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        minHeight: 44,
        ...Platform.select({
          web: {
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          },
        }),
      },
      retryButtonText: {
        color: colors.surface,
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
      },
      skeletonContainer: {
        gap: DESIGN_TOKENS.spacing.lg,
        paddingHorizontal: 8,
      },
    }), [colors]);

    const renderTravelItem = useCallback(({ item, index }: { item: Travel; index: number }) => (
      <View style={[
        styles.travelItem,
        index % 2 !== 0 && styles.travelItemOdd
      ]}>
        <TravelTmlRound
          travel={item}
        />
      </View>
    ), [styles.travelItem, styles.travelItemOdd]);

    const keyExtractor = useCallback((item: Travel) => `travel-${item.id}`, []);
    const webGridStyle = useMemo(() => {
      if (Platform.OS !== 'web') return undefined;
      if (width <= 640) {
        return {
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(260px, 86vw)',
          gap: DESIGN_TOKENS.spacing.md,
          alignItems: 'stretch',
          width: 'max-content',
        };
      }
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
        gap: DESIGN_TOKENS.spacing.md,
        alignItems: 'stretch',
        width: '100%',
      };
    }, [numColumns, width]);

    const displayedTravels = useMemo(
      () => travelsNear.slice(0, visibleCount),
      [travelsNear, visibleCount]
    );

    if (isError) {
      return (
        <View style={styles.errorContainer} onLayout={onLayout}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Не удалось загрузить маршруты. Попробуйте позже.'}
          </Text>
          <Button
            label="Повторить попытку"
            onPress={() => refetchTravelsNear()}
            variant="primary"
            size="md"
            style={styles.retryButton}
            labelStyle={styles.retryButtonText}
            accessibilityLabel="Повторить попытку"
          />
        </View>
      );
    }

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
            <React.Suspense fallback={<ActivityIndicator size="small" color={colors.primary} />}>
              <SegmentedControl
                options={segmentOptions}
                value={viewMode}
                onChange={(key) => setViewMode(key as Segment)}
                accessibilityLabel="Переключатель вида"
              />
            </React.Suspense>

            {viewMode === 'map' ? (
              <View style={styles.mobileMapColumn}>
                <MapContainer
                  points={mapPoints}
                  height={mapHeight}
                  showRoute={true}
                  isLoading={isLoading}
                  colors={colors}
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
                  <View style={width <= 640 ? styles.webScrollContainer : undefined}>
                    <View style={[styles.travelsGrid, webGridStyle]}>
                      {displayedTravels.map((item, index) => (
                        <View
                          key={keyExtractor(item)}
                          style={[
                            styles.travelItem,
                            Platform.OS === 'web' && styles.webGridItem,
                            index % 2 !== 0 && styles.travelItemOdd,
                          ]}
                        >
                          <TravelTmlRound travel={item} />
                        </View>
                      ))}
                    </View>
                  </View>

                  {visibleCount < travelsNear.length && (
                    <View style={styles.loadMoreContainer}>
                      <Button
                        label={`Показать ещё ${Math.min(loadMoreCount, travelsNear.length - visibleCount)} из ${travelsNear.length - visibleCount}`}
                        onPress={handleLoadMore}
                        variant="outline"
                        size="md"
                        style={styles.loadMoreButton}
                        labelStyle={styles.loadMoreButtonText}
                        accessibilityLabel="Показать ещё"
                      />
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <>
            <React.Suspense fallback={<ActivityIndicator size="small" color={colors.primary} />}>
              <SegmentedControl
                options={segmentOptions}
                value={viewMode}
                onChange={(key) => setViewMode(key as Segment)}
                accessibilityLabel="Переключатель вида"
              />
            </React.Suspense>

            {viewMode === 'list' ? (
              <FlashList
                data={displayedTravels}
                keyExtractor={keyExtractor}
                renderItem={renderTravelItem}
                drawDistance={500}
                contentContainerStyle={styles.mobileListContent}
                scrollEnabled={!embedded}
                onEndReached={embedded ? undefined : handleLoadMore}
                onEndReachedThreshold={embedded ? undefined : 0.2}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  visibleCount < travelsNear.length ? (
                    <View style={styles.loadMoreContainer}>
                      <Button
                        label="Загрузить ещё"
                        onPress={handleLoadMore}
                        variant="outline"
                        size="md"
                        style={styles.loadMoreButton}
                        labelStyle={styles.loadMoreButtonText}
                        accessibilityLabel="Загрузить ещё путешествий"
                      />
                    </View>
                  ) : isLoading ? (
                    <View style={styles.skeletonContainer}>
                      {[1, 2].map((i) => (
                        <TravelCardSkeleton key={i} colors={colors} />
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
                  colors={colors}
                />
              </View>
            )}
          </>
        )}

        {/* Индикатор загрузки при первоначальной загрузке */}
        {isLoading && travelsNear.length === 0 && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Ищем интересные места рядом...</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);

export default NearTravelList;
