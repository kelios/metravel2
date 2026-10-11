import React, {
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { getNearbyTravelsSubtitle } from '@/constants/nearby';
import { Title } from '@/ui/paper';

import { Travel } from '@/types/types';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import TravelListItem from '@/components/listTravel/TravelListItem';
import {
  NEAR_RAIL_PADDING_VERTICAL,
  nearTravelRailStyles,
  nearTravelSkeletonSlots,
  useNearTravelRailLayout,
  useNearTravelRailSlotStyle,
  type NearTravelRailLayout,
} from '@/components/travel/NearTravelListSkeleton';
import { getTravelDetailsListColumnWidth } from '@/components/travel/utils/travelDetailsListLayout';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import CardRail from '@/components/ui/CardRail';
import { useNearTravelData } from '@/hooks/useNearTravelData';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import { TravelMap } from '@/components/MapPage/TravelMap';
import { translate as i18nT } from '@/i18n'
import { parseTravelCoords } from '@/utils/questForLocation';


// ✅ ОПТИМИЗАЦИЯ: Lazy import для map-компонента (тяжёлый, Leaflet внутри)
const MapClientSideComponent = React.lazy(() =>
  Promise.resolve(import('@/components/MapPage/TravelMap')).then((module) => ({ default: module.TravelMap }))
);
const MapComponent = Platform.OS === 'web' ? MapClientSideComponent : TravelMap;

// Карточка в горизонтальном ряду: по умолчанию UnifiedTravelCard ставит 'pan-y',
// и на тач-вебе свайп ряда, начатый на карточке, гасится.
const RAIL_CARD_TOUCH_ACTION = 'pan-x pan-y';

type NearTravelViewMode = 'list' | 'map';

type NearTravelViewToggle = {
  value: NearTravelViewMode;
  onChange: (mode: NearTravelViewMode) => void;
};

type NearTravelListFrameProps = {
  layout: NearTravelRailLayout;
  toggle: NearTravelViewToggle | null;
  // Режим «Карта»: вместо ряда.
  map?: React.ReactNode;
  slots: React.ReactElement[];
};

// #2367: переключатель и ряд — общий кадр загрузки и данных, поэтому смена
// каркаса на карточки не перемонтирует ряд. Геометрия — из NearTravelListSkeleton,
// его же повторяет каркас сайдбара.
function NearTravelListFrame({ layout, toggle, map, slots }: NearTravelListFrameProps) {
  const options = useMemo(
    () => [
      { key: 'list', label: i18nT('travel:components.travel.NearTravelList.spisok_80236245'), icon: 'view-list', iconSource: 'material' as const },
      { key: 'map', label: i18nT('travel:components.travel.NearTravelList.karta_14701f05'), icon: 'map', iconSource: 'material' as const },
    ],
    [],
  );
  const slotStyle = useNearTravelRailSlotStyle(layout);
  return (
    <>
      {toggle ? (
        <SegmentedControl
          options={options}
          value={toggle.value}
          onChange={(key) => toggle.onChange(key as NearTravelViewMode)}
          accessibilityLabel={i18nT('travel:components.travel.NearTravelList.pereklyuchatel_vida_fe04e58c')}
          compact={layout.isMobile}
          tone={layout.isMobile ? 'subtle' : 'default'}
        />
      ) : null}
      {map != null ? (
        <View style={nearTravelRailStyles.mapColumn}>{map}</View>
      ) : (
        <View style={layout.isMobile ? nearTravelRailStyles.mobileListContent : nearTravelRailStyles.listColumn}>
          <CardRail
            gap={layout.gap}
            contentPaddingHorizontal={0}
            contentPaddingVertical={NEAR_RAIL_PADDING_VERTICAL}
            contentStyle={layout.contentStyle}
            hideArrows={layout.isMobile}
            testID="near-travel-rail"
          >
            {slots.map((card) => (
              <View key={card.key} style={slotStyle} testID="near-travel-rail-slot">
                {card}
              </View>
            ))}
          </CardRail>
        </View>
      )}
    </>
  );
}

type NearTravelListProps = {
  travel: Pick<Travel, 'id'> & Partial<Pick<Travel, 'travelAddress' | 'coordsMeTravel'>>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onTravelsLoaded?: (travels: Travel[]) => void;
  showHeader?: boolean;
  embedded?: boolean;
  // Gate the near-request on the section's real viewport visibility (web observer).
  fetchEnabled?: boolean;
};

// Новый компонент для карты с ограниченной высотой
const MapContainer = memo(({
                             points,
                             height = 400,
                             showRoute = false,
                             isLoading = false,
                             isError = false,
                             onRetry,
                             colors,
                           }: {
  points: any[];
  height?: number;
  showRoute?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
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
    retryButton: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  if (!canRenderMap) {
    return (
      <View style={[mapStyles.mapPlaceholder, { height }]}>
        <Text style={mapStyles.placeholderText}>
          {isLoading
            ? i18nT('travel:components.travel.NearTravelList.zagruzka_karty_1215cf9a')
            : isError
              ? i18nT('travel:components.travel.NearTravelList.ne_udalos_zagruzit_marshruty_poprobuyte_pozz_d6ce6b01')
              : i18nT('travel:components.travel.NearTravelList.net_tochek_dlya_karty_4c27ee19')}
        </Text>
        {isError && onRetry ? (
          <Button
            label={i18nT('travel:components.travel.NearTravelList.povtorit_popytku_c1893c28')}
            onPress={onRetry}
            variant="primary"
            size="sm"
            style={mapStyles.retryButton}
          />
        ) : null}
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
    const [viewMode, setViewMode] = useState<NearTravelViewMode>('list');
    const railLayout = useNearTravelRailLayout();
    const { width, isMobile, numColumns } = railLayout;
    const isTablet =
      width >= METRICS.breakpoints.tablet &&
      width < METRICS.breakpoints.largeTablet;
    const colors = useThemedColors();
    const mapHeight = useMemo(() => {
      if (isMobile) return 320;
      if (isTablet) return embedded ? 440 : 400;
      return embedded ? 580 : 500;
    }, [embedded, isMobile, isTablet]);

    const travelId = useMemo(() => {
      const id = Number(travel.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }, [travel.id]);
    const mapOrigin = useMemo(() => {
      const coordinates = parseTravelCoords([
        ...(Array.isArray(travel.travelAddress) ? travel.travelAddress : []),
        ...(Array.isArray(travel.coordsMeTravel) ? travel.coordsMeTravel : []),
      ]);
      return coordinates.find(({ lat, lng }) => (
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      )) ?? null;
    }, [travel.coordsMeTravel, travel.travelAddress]);

    const {
      travelsNear, displayedTravels, mapPoints,
      isLoading, isMapLoading, isMapError, isError, error,
      refetchTravelsNear, refetchMapPoints,
    } = useNearTravelData(travelId, onTravelsLoaded, fetchEnabled, {
      enabled: viewMode === 'map',
      origin: mapOrigin,
    });
    const handleRetryMap = useCallback(() => {
      void refetchMapPoints();
    }, [refetchMapPoints]);
    const canShowMapMode = mapPoints.length > 0 || mapOrigin !== null;

    const viewToggle = useMemo<NearTravelViewToggle | null>(
      () => (canShowMapMode ? { value: viewMode, onChange: setViewMode } : null),
      [canShowMapMode, viewMode],
    );
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
      emptyState: {
        alignItems: 'center',
        paddingVertical: DESIGN_TOKENS.spacing.xl,
      },
      emptyText: {
        marginTop: 8,
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
      },
    }), [colors]);

    const keyExtractor = useCallback((item: Travel) => `travel-${item.id}`, []);

    const renderWebSearchLikeTravelItem = useCallback((item: Travel, index: number) => (
      <View key={keyExtractor(item)} style={nearTravelRailStyles.railCard}>
        <TravelListItem
          travel={item}
          isFirst={index === 0}
          isMobile={false}
          viewportWidth={width}
          // Ряд рисуется только при width >= 768 (2–3 колонки). На web
          // прокидываем реальную колонку ряда, иначе слот ~280 px просит
          // ступень w=720 (#1544). На native ширину карточки задаёт слот.
          cardWidth={
            Platform.OS === 'web'
              ? getTravelDetailsListColumnWidth(width, numColumns)
              : undefined
          }
          webTouchAction={RAIL_CARD_TOUCH_ACTION}
        />
      </View>
    ), [keyExtractor, numColumns, width]);

    // #2367: число похожих (1–6) неизвестно до ответа /near/, поэтому каркас и
    // карточки — один ряд одной высоты. Пока ответа нет (в том числе пока запрос
    // ждёт видимости секции), ряд стоит каркасами. Пустой ответ ряд не держит:
    // компактное сообщение (#164), единственный осознанный сдвиг.
    const isAwaitingNear = !isError && travelsNear.length === 0 && (isLoading || !fetchEnabled);
    const isEmptyNear = !isError && !isAwaitingNear && travelsNear.length === 0;

    const cards = useMemo(() => (isMobile
      ? displayedTravels.map((item) => (
        <TravelTmlRound key={keyExtractor(item)} travel={item} webTouchAction={RAIL_CARD_TOUCH_ACTION} />
      ))
      : displayedTravels.map((item, index) => renderWebSearchLikeTravelItem(item, index))
    ), [displayedTravels, isMobile, keyExtractor, renderWebSearchLikeTravelItem]);

    const header = showHeader ? (
      <View style={styles.header}>
        <Title style={styles.title}>{i18nT('travel:components.travel.NearTravelList.ryadom_mozhno_posmotret_127cfa0d')}</Title>
        <Text style={styles.subtitle}>{getNearbyTravelsSubtitle()}</Text>
      </View>
    ) : null;

    const mapView = viewMode === 'map' ? (
      <MapContainer
        points={mapPoints}
        height={mapHeight}
        showRoute={false}
        isLoading={isLoading || isMapLoading}
        isError={isMapError}
        onRetry={handleRetryMap}
        colors={colors}
      />
    ) : undefined;

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

    if (isEmptyNear) {
      // Native без пустой секции, как и до #2367: на web заголовок и якорь
      // секции принадлежат странице, и пустой ребёнок выглядел бы обрывом.
      if (embedded && Platform.OS !== 'web') {
        return null;
      }
      return (
        <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
          {header}
          <View style={styles.emptyState} testID="near-travel-empty">
            <Feather name="map-pin" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {i18nT('travel:components.travel.NearTravelList.ryadom_poka_net_drugih_marshrutov_28eabcfe')}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
        {header}

        {/* Тот же кадр, что каркас сайдбара: смена каркаса на карточки не перемонтирует ряд. */}
        <NearTravelListFrame
          layout={railLayout}
          toggle={viewToggle}
          map={mapView}
          slots={cards.length > 0 ? cards : nearTravelSkeletonSlots(railLayout)}
        />

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
