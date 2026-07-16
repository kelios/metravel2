import React, {
  memo,
  useCallback,
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
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Feather from '@expo/vector-icons/Feather';
import { Title } from '@/ui/paper';

import { Travel } from '@/types/types';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import TravelListItem from '@/components/listTravel/TravelListItem';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { getNearbyTravelsSubtitle } from '@/constants/nearby';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import { useNearTravelData } from '@/hooks/useNearTravelData';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import { TravelMap } from '@/components/MapPage/TravelMap';
import { translate as i18nT } from '@/i18n'


// ✅ ОПТИМИЗАЦИЯ: Lazy import для map-компонента (тяжёлый, Leaflet внутри)
const MapClientSideComponent = React.lazy(() =>
  Promise.resolve(import('@/components/MapPage/TravelMap')).then((module) => ({ default: module.TravelMap }))
);
const MapComponent = Platform.OS === 'web' ? MapClientSideComponent : TravelMap;

type Segment = 'list' | 'map';

type NearTravelListProps = {
  travel: Pick<Travel, 'id'>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onTravelsLoaded?: (travels: Travel[]) => void;
  showHeader?: boolean;
  embedded?: boolean;
  // Gate the near-request on the section's real viewport visibility (web observer).
  fetchEnabled?: boolean;
};

const TravelCardSkeleton = ({ colors }: { colors: ReturnType<typeof useThemedColors> }) => {
  // ✅ РЕДИЗАЙН: Стили скелетона с поддержкой темной темы
  const skeletonStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      marginBottom: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
                             showRoute = false,
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
  }), [colors]);

  if (!canRenderMap) {
    return (
      <View style={[mapStyles.mapPlaceholder, { height }]}>
        <Text style={mapStyles.placeholderText}>
          {isLoading ? i18nT('travel:components.travel.NearTravelList.zagruzka_karty_1215cf9a') : i18nT('travel:components.travel.NearTravelList.net_tochek_dlya_karty_4c27ee19')}
        </Text>
      </View>
    );
  }

  return (
    <React.Suspense fallback={<ActivityIndicator size="small" color={colors.primaryDark} accessibilityLabel={i18nT('travel:components.travel.NearTravelList.zagruzka_karty_dafc7f62')} />}>
      <MapComponent
        travelData={points}
        compact
        height={height}
        showRouteLine={showRoute}
      />
    </React.Suspense>
  );
});

const NearTravelList: React.FC<NearTravelListProps> = memo(
  ({
     travel,
     onLayout,
     onTravelsLoaded,
     showHeader = true,
     embedded = false,
     fetchEnabled = true,
   }) => {
    const [viewMode, setViewMode] = useState<Segment>('list');
    const { width } = useWindowDimensions();
    const isMobile = width < METRICS.breakpoints.tablet;
    const isTablet =
      width >= METRICS.breakpoints.tablet &&
      width < METRICS.breakpoints.largeTablet;
    const colors = useThemedColors();
    const scrollViewRef = useRef<ScrollView>(null);
    const segmentOptions = useMemo(
      () => [
        { key: 'list', label: i18nT('travel:components.travel.NearTravelList.spisok_80236245'), icon: 'view-list', iconSource: 'material' as const },
        { key: 'map', label: i18nT('travel:components.travel.NearTravelList.karta_14701f05'), icon: 'map', iconSource: 'material' as const },
      ],
      []
    );

    const mapHeight = useMemo(() => {
      if (isMobile) return 320;
      if (isTablet) return embedded ? 440 : 400;
      return embedded ? 580 : 500;
    }, [embedded, isMobile, isTablet]);
    const listHeight = useMemo(() => isMobile ? 'auto' : isTablet ? 500 : 600, [isMobile, isTablet]);

    const numColumns = useMemo(() => {
      if (width < METRICS.breakpoints.tablet) return 1;
      if (width < METRICS.breakpoints.largeTablet) return 2;
      return 3;
    }, [width]);
    const loadMoreCount = useMemo(() => isMobile ? 4 : isTablet ? 6 : 8, [isMobile, isTablet]);

    const travelId = useMemo(() => {
      const id = Number(travel.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }, [travel.id]);

    const {
      travelsNear, displayedTravels, mapPoints,
      isLoading, isError, error, visibleCount,
      refetchTravelsNear, handleLoadMore,
    } = useNearTravelData(travelId, loadMoreCount, onTravelsLoaded, fetchEnabled);


    // ✅ РЕДИЗАЙН: Стили с поддержкой темной темы
    const styles = useMemo(() => StyleSheet.create({
      section: {
        marginTop: DESIGN_TOKENS.spacing.md,
        marginBottom: 40,
        paddingHorizontal: 16,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: DESIGN_TOKENS.radii.md,
        width: '100%',
        maxWidth: 1400,
        alignSelf: 'center',
        overflow: 'visible',
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
        overflow: 'visible',
      },
      header: {
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: 8,
      },
      title: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.3,
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
        overflow: 'visible',
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
        // overflow: visible to allow popup to extend beyond container
        overflow: 'visible',
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
        overflow: 'visible',
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

    const renderWebSearchLikeTravelItem = useCallback((item: Travel, index: number) => (
      <View
        key={keyExtractor(item)}
        style={[
          styles.travelItem,
          styles.webGridItem,
          index % 2 !== 0 && styles.travelItemOdd,
        ]}
      >
        <TravelListItem
          travel={item}
          isFirst={index === 0}
          isMobile={false}
          viewportWidth={width}
          cardWidth={width <= 640 ? Math.max(260, Math.min(320, width * 0.86)) : undefined}
          webTouchAction={width <= 640 ? 'pan-x pan-y' : undefined}
        />
      </View>
    ), [keyExtractor, styles.travelItem, styles.travelItemOdd, styles.webGridItem, width]);

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


    if (isError) {
      return (
        <View style={styles.errorContainer} onLayout={onLayout}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : i18nT('travel:components.travel.NearTravelList.ne_udalos_zagruzit_marshruty_poprobuyte_pozz_d6ce6b01')}
          </Text>
          <Button
            label={i18nT('travel:components.travel.NearTravelList.povtorit_popytku_c1893c28')}
            onPress={() => refetchTravelsNear()}
            variant="primary"
            size="md"
            style={styles.retryButton}
            labelStyle={styles.retryButtonText}
            accessibilityLabel={i18nT('travel:components.travel.NearTravelList.povtorit_popytku_c1893c28')}
          />
        </View>
      );
    }

    if (!isLoading && travelsNear.length === 0) {
      // Keep native behavior unchanged in this browser-focused fix. On web the
      // details page owns the section heading/anchor, so collapsing only this
      // child otherwise leaves a blank-looking navigation destination.
      if (embedded && Platform.OS !== 'web') {
        return null;
      }
      return (
        <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
          {showHeader && (
            <View style={styles.header}>
              <Title style={styles.title}>{i18nT('travel:components.travel.NearTravelList.ryadom_mozhno_posmotret_127cfa0d')}</Title>
              <Text style={styles.subtitle}>{getNearbyTravelsSubtitle()}</Text>
            </View>
          )}
          <View style={{ alignItems: 'center', paddingVertical: DESIGN_TOKENS.spacing.xl }}>
            <Feather name="map-pin" size={28} color={colors.textMuted} />
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: colors.textMuted,
                textAlign: 'center',
              }}
            >
              {i18nT('travel:components.travel.NearTravelList.ryadom_poka_net_drugih_marshrutov_28eabcfe')}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
        {showHeader && (
          <View style={styles.header}>
            <Title style={styles.title}>{i18nT('travel:components.travel.NearTravelList.ryadom_mozhno_posmotret_127cfa0d')}</Title>
            <Text style={styles.subtitle}>{i18nT('travel:components.travel.NearTravelList.marshruty_v_radiuse_60_km_62529086')}</Text>
          </View>
        )}

        {!isMobile ? (
          <>
            <SegmentedControl
              options={segmentOptions}
              value={viewMode}
              onChange={(key) => setViewMode(key as Segment)}
              accessibilityLabel={i18nT('travel:components.travel.NearTravelList.pereklyuchatel_vida_fe04e58c')}
            />

            {viewMode === 'map' ? (
              <View style={styles.mobileMapColumn}>
                <MapContainer
                  points={mapPoints}
                  height={mapHeight}
                  showRoute={false}
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
                  <View
                    testID={Platform.OS === 'web' && width <= 640 ? 'near-travel-web-rail' : undefined}
                    style={width <= 640 ? styles.webScrollContainer : undefined}
                  >
                    <View style={[styles.travelsGrid, webGridStyle]}>
                      {displayedTravels.map((item, index) => renderWebSearchLikeTravelItem(item, index))}
                    </View>
                  </View>

                  {visibleCount < travelsNear.length && (
                    <View style={styles.loadMoreContainer}>
                      <Button
                        label={i18nT('travel:components.travel.NearTravelList.pokazat_esche_value1_5bd22dbc', { value1: travelsNear.length - visibleCount })}
                        onPress={handleLoadMore}
                        variant="outline"
                        size="md"
                        style={styles.loadMoreButton}
                        labelStyle={styles.loadMoreButtonText}
                        accessibilityLabel={i18nT('travel:components.travel.NearTravelList.pokazat_esche_bfa76db8')}
                      />
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <>
            <SegmentedControl
              options={segmentOptions}
              value={viewMode}
              onChange={(key) => setViewMode(key as Segment)}
              accessibilityLabel={i18nT('travel:components.travel.NearTravelList.pereklyuchatel_vida_fe04e58c')}
              compact
              tone="subtle"
            />

            {viewMode === 'list' ? (
              embedded ? (
                <View style={styles.mobileListContent}>
                  {displayedTravels.map((item) => (
                    <View key={`travel-${item.id}`} style={styles.travelItem}>
                      <TravelTmlRound travel={item} />
                    </View>
                  ))}
                  {visibleCount < travelsNear.length && (
                    <View style={styles.loadMoreContainer}>
                      <Button
                        label={i18nT('travel:components.travel.NearTravelList.zagruzit_esche_42e10ade')}
                        onPress={handleLoadMore}
                        variant="outline"
                        size="md"
                        style={styles.loadMoreButton}
                        labelStyle={styles.loadMoreButtonText}
                        accessibilityLabel={i18nT('travel:components.travel.NearTravelList.zagruzit_esche_puteshestviy_91cbe3fc')}
                      />
                    </View>
                  )}
                </View>
              ) : (
              <FlashList
                data={displayedTravels}
                keyExtractor={keyExtractor}
                renderItem={renderTravelItem}
                {...({ estimatedItemSize: 300 } as any)}
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
                        label={i18nT('travel:components.travel.NearTravelList.zagruzit_esche_42e10ade')}
                        onPress={handleLoadMore}
                        variant="outline"
                        size="md"
                        style={styles.loadMoreButton}
                        labelStyle={styles.loadMoreButtonText}
                        accessibilityLabel={i18nT('travel:components.travel.NearTravelList.zagruzit_esche_puteshestviy_91cbe3fc')}
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
              )
            ) : (
              <View style={styles.mobileMapColumn}>
                <MapContainer
                  points={mapPoints}
                  height={mapHeight}
                  showRoute={false}
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
              <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel={i18nT('travel:components.travel.NearTravelList.poisk_mest_ryadom_cd19f801')} />
              <Text style={styles.loadingText}>{i18nT('travel:components.travel.NearTravelList.ischem_interesnye_mesta_ryadom_49948c94')}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);

export default NearTravelList;
