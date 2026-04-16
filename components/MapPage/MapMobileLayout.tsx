/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { Suspense, useCallback, useMemo, useRef, useState, useEffect, useTransition } from 'react';
import { View, Text as RNText, Platform, InteractionManager, useWindowDimensions, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePathname } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet';
import { MapPeekPreview } from './MapPeekPreview';
import TravelListPanel from './TravelListPanel';
import { useThemedColors } from '@/hooks/useTheme';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import Button from '@/components/ui/Button';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles';

interface MapMobileLayoutProps {
  // Map props
  mapComponent: React.ReactNode;

  // Data
  travelsData: any[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  coordinates: { latitude: number; longitude: number } | null;
  transportMode: 'car' | 'bike' | 'foot';

  // Callbacks
  buildRouteTo: (item: any) => void;
  onCenterOnUser: () => void;
  onOpenFilters: () => void;

  // Panel props
  filtersPanelProps: any;

  // Optional
  onToggleFavorite?: (id: string | number) => void;
  favorites?: Set<string | number>;
  onResetFilters?: () => void;
  onExpandRadius?: () => void;
}

const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 430;
const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 350;
const PHONE_COMPACT_ACTIONS_MAX_WIDTH = 420;

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  mapComponent,
  travelsData,
  hasMore,
  onLoadMore,
  onRefresh,
  isRefreshing,
  coordinates,
  transportMode,
  buildRouteTo,
  onCenterOnUser: _onCenterOnUser,
  onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
  onResetFilters,
  onExpandRadius,
}) => {
  const colors = useThemedColors();
  const { width: viewportWidth } = useWindowDimensions();
  const isNarrow = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH;
  const isVeryNarrow = viewportWidth <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH;
  const compactSheetActions = viewportWidth <= PHONE_COMPACT_ACTIONS_MAX_WIDTH;
  const stackSheetToolbar = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH;
  const styles = useMemo(
    () => getMapMobileLayoutStyles(colors, { isNarrow, compactSheetActions, stackSheetToolbar }),
    [colors, isNarrow, compactSheetActions, stackSheetToolbar]
  );
  const bottomSheetRef = useRef<MapBottomSheetRef>(null);
  const pathname = usePathname();
  const isActiveWebRoute = Platform.OS === 'web' && (pathname === '/map' || String(pathname).startsWith('/map/'));
  const [consentBannerVisible, setConsentBannerVisible] = useState(false);

  const [uiTab, setUiTab] = useState<'list' | 'filters'>('list');
  const [contentTab, setContentTab] = useState<'list' | 'filters'>('list');
  const [, startTransition] = useTransition();
  const sheetStateRef = useRef<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed');
  const [sheetState, setSheetState] = useState<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed');

  const openNonce = useMapPanelStore((s) => s.openNonce);
  const requestedOpenTab = useMapPanelStore((s) => s.requestedTab);
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce);

  // Синхронизация состояния Bottom Sheet с глобальным store
  const setBottomSheetState = useBottomSheetStore((s) => s.setState);
  const bottomSheetState = useBottomSheetStore((s) => s.state);
  const collapseNonce = useBottomSheetStore((s) => s.collapseNonce);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'quarter' | 'half' | 'full') => {
    sheetStateRef.current = state;
    setSheetState(state);
    setBottomSheetState(state); // Синхронизация с store
  }, [setBottomSheetState]);

  useEffect(() => {
    if (!openNonce) return;
    const nextTab = requestedOpenTab === 'list' ? 'list' : 'filters';
    setUiTab(nextTab);
    setContentTab(nextTab);
    if (nextTab === 'list') {
      bottomSheetRef.current?.snapToHalf();
      return;
    }
    bottomSheetRef.current?.snapToFull();
  }, [openNonce, requestedOpenTab]);

  useEffect(() => {
    if (!toggleNonce) return;
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('list');
      setContentTab('list');
      bottomSheetRef.current?.snapToHalf();
      return;
    }
    bottomSheetRef.current?.snapToCollapsed();
  }, [toggleNonce]);

  useEffect(() => {
    if (!collapseNonce) return;
    if (sheetStateRef.current === 'collapsed') return;
    bottomSheetRef.current?.snapToCollapsed();
  }, [collapseNonce]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;

    const update = () => {
      setConsentBannerVisible(body.getAttribute('data-consent-banner-open') === 'true');
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-consent-banner-open'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const setTabDeferred = useCallback(
    (next: 'list' | 'filters') => {
      setUiTab(next);
      // Defer the heavy rerender (list/filters content) so the button highlight is instant.
      if (Platform.OS === 'web') {
        startTransition(() => {
          setContentTab(next);
        });
        return;
      }

      InteractionManager.runAfterInteractions(() => {
        setContentTab(next);
      });
    },
    [startTransition]
  );

  const handlePlacePress = useCallback((place: any) => {
    buildRouteTo(place);
    bottomSheetRef.current?.snapToCollapsed();
  }, [buildRouteTo]);

  const handleOpenList = useCallback(() => {
    setTabDeferred('list');
    bottomSheetRef.current?.snapToHalf();
  }, [setTabDeferred]);

  const handleToggleListPanel = useCallback(() => {
    if (sheetStateRef.current === 'collapsed') {
      setTabDeferred('list');
      bottomSheetRef.current?.snapToHalf();
      return;
    }
    bottomSheetRef.current?.snapToCollapsed();
  }, [setTabDeferred]);

  const filtersContextProps = filtersPanelProps?.props ?? filtersPanelProps?.contextValue;
  const filtersMode: 'radius' | 'route' | undefined = filtersContextProps?.mode;
  const setFiltersMode: ((m: 'radius' | 'route') => void) | undefined = filtersContextProps?.setMode;

  const canBuildRoute = useMemo(() => {
    if (filtersMode !== 'route') return false;
    const points = filtersContextProps?.routePoints;
    return Array.isArray(points) && points.length >= 2;
  }, [filtersMode, filtersContextProps?.routePoints]);

  const routingLoading = Boolean(filtersContextProps?.routingLoading);
  const routeDistance = filtersContextProps?.routeDistance as number | null | undefined;
  const routePointsCount = Array.isArray(filtersContextProps?.routePoints) ? filtersContextProps.routePoints.length : 0;
  const activeRadius = filtersContextProps?.filterValue?.radius || '60';

  const routeCtaLabel = useMemo(() => {
    if (routingLoading) return 'Строим…';
    if (routeDistance != null) return 'Пересчитать маршрут';
    return canBuildRoute ? 'Построить маршрут' : 'Добавьте старт и финиш';
  }, [routingLoading, routeDistance, canBuildRoute]);

  const filterToolbarSummary = useMemo(() => {
    if (filtersMode === 'route') {
      if (routingLoading) return 'Маршрут обновляется';
      if (canBuildRoute && routeDistance != null) return 'Маршрут готов, можно открыть список точек';
      return routePointsCount > 0
        ? `Выбрана ${routePointsCount} из 2 точек`
        : 'Выберите старт и финиш кликом по карте';
    }

    const selectedCategories = Array.isArray(filtersContextProps?.filterValue?.categories)
      ? filtersContextProps.filterValue.categories.length
      : 0;
    const categoriesLabel = selectedCategories > 0 ? `категорий: ${selectedCategories}` : 'все категории';
    return `${travelsData.length > 999 ? '999+' : travelsData.length} мест · ${activeRadius} км · ${categoriesLabel}`;
  }, [
    activeRadius,
    canBuildRoute,
    filtersContextProps?.filterValue?.categories,
    filtersMode,
    routeDistance,
    routePointsCount,
    routingLoading,
    travelsData.length,
  ]);

  const listTabsOptions = useMemo(
    () => [
      { key: 'list', label: 'Список', icon: isVeryNarrow ? undefined : 'list', badge: travelsData.length },
      { key: 'filters', label: 'Фильтры', icon: isVeryNarrow ? undefined : 'filter-list' },
    ],
    [isVeryNarrow, travelsData.length]
  );

  const modeTabsOptions = useMemo(
    () => [
      { key: 'radius', label: 'Радиус', icon: isVeryNarrow ? undefined : 'my-location' },
      { key: 'route', label: 'Маршрут', icon: isVeryNarrow ? undefined : 'alt-route' },
    ],
    [isVeryNarrow]
  );

  // Peek content for collapsed state
  const peekContent = useMemo(() => {
    if (contentTab === 'list') {
      return (
        <MapPeekPreview
          places={travelsData}
          userLocation={coordinates}
          transportMode={transportMode}
          onPlacePress={handlePlacePress}
          onExpandPress={() => bottomSheetRef.current?.snapToHalf()}
        />
      );
    }

    if (contentTab !== 'filters') return null;
    if (!filtersMode || typeof setFiltersMode !== 'function') return null;

    const showRouteCta = filtersMode === 'route' && typeof filtersContextProps?.onBuildRoute === 'function';

    return (
      <View style={styles.filtersPeek}>
        <SegmentedControl
          options={modeTabsOptions}
          value={filtersMode}
          onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
          compact={true}
          dense={isNarrow}
          tone="subtle"
          accessibilityLabel="Выбор режима поиска"
        />

        {showRouteCta && (
          <View style={styles.filtersPeekCtaRow}>
            <Button
              label={routeCtaLabel}
              onPress={() => {
                if (!canBuildRoute || routingLoading) return;
                filtersContextProps?.onBuildRoute?.();
              }}
              disabled={!canBuildRoute || routingLoading}
              accessibilityLabel="Построить маршрут"
              variant="primary"
              fullWidth
            />
          </View>
        )}
      </View>
    );
  }, [
    contentTab,
    travelsData,
    coordinates,
    transportMode,
    handlePlacePress,
    filtersMode,
    setFiltersMode,
    filtersContextProps,
    styles.filtersPeek,
    styles.filtersPeekCtaRow,
    canBuildRoute,
    routingLoading,
    routeCtaLabel,
    modeTabsOptions,
    isNarrow,
  ]);

  const sheetPeekContent = Platform.OS === 'web' ? null : peekContent;
  const quickActionsBottomOffset = consentBannerVisible ? 344 : 260;

  // Content based on active tab
  const sheetContent = useMemo(() => {
    const showModeToggle =
      (filtersMode === 'radius' || filtersMode === 'route') &&
      typeof setFiltersMode === 'function';
    const showTopFilterActions = uiTab === 'filters' && filtersMode === 'radius' && !stackSheetToolbar;
    // Keep the close affordance available on narrow mobile layouts too:
    // the compact toolbar stacks vertically, but the panel still needs an explicit close control.
    const showSheetCloseButton = true;

    const body =
      contentTab === 'filters' ? (
        (() => {
          const ProviderComponent = filtersPanelProps?.Component;
          const PanelComponent = filtersPanelProps?.Panel;
          const providerProps = filtersContextProps;

          if (!ProviderComponent || !PanelComponent || !providerProps) {
            return <View style={styles.sheetRoot} />;
          }

          const mergedProviderProps = {
            ...providerProps,
            onOpenList: () => {
              setTabDeferred('list');
              bottomSheetRef.current?.snapToHalf();
            },
          };

          return (
            <Suspense fallback={<View style={styles.sheetRoot} />}>
              <ProviderComponent {...mergedProviderProps}>
                {showModeToggle && (
                  <View style={styles.filtersModeBar} testID="map-mobile-mode-toggle">
                    <SegmentedControl
                      options={modeTabsOptions}
                      value={filtersMode}
                      onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
                      compact={true}
                      dense={isNarrow}
                      noOuterMargins={true}
                      tone="subtle"
                      accessibilityLabel="Выбор режима поиска"
                    />
                  </View>
                )}
                <PanelComponent
                  hideTopControls={true}
                  hideFooterCta={filtersMode === 'route'}
                  hideFooterReset={filtersMode !== 'radius'}
                />
              </ProviderComponent>
            </Suspense>
          );
        })()
      ) : (
        <TravelListPanel
          travelsData={travelsData}
          buildRouteTo={buildRouteTo}
          isMobile={true}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          userLocation={coordinates}
          transportMode={transportMode}
          onToggleFavorite={onToggleFavorite}
          favorites={favorites}
          onResetFilters={onResetFilters}
          onExpandRadius={onExpandRadius}
        />
      );

    return (
      <View style={styles.sheetRoot}>
        <View
          style={[
            styles.sheetToolbar,
            stackSheetToolbar ? styles.sheetToolbarStacked : styles.sheetToolbarInline,
          ]}
        >
          <View style={[styles.sheetToolbarLeft, stackSheetToolbar && styles.sheetToolbarFullWidth]}>
            <SegmentedControl
              options={listTabsOptions}
              value={uiTab}
              onChange={(key) => {
                const next = key === 'filters' ? 'filters' : 'list';
                setTabDeferred(next);
                if (next === 'filters') {
                  bottomSheetRef.current?.snapToFull();
                  return;
                }
                bottomSheetRef.current?.snapToHalf();
              }}
              compact={true}
              dense={isNarrow}
              noOuterMargins={true}
              tone="subtle"
              accessibilityLabel="Переключение между фильтрами и списком"
            />
            {uiTab === 'filters' && (
              <RNText style={styles.sheetToolbarSummary} numberOfLines={2} testID="map-mobile-toolbar-summary">
                {filterToolbarSummary}
              </RNText>
            )}
          </View>

          <View style={[styles.sheetToolbarActions, stackSheetToolbar && styles.sheetToolbarActionsStacked]}>
            {showTopFilterActions && (
              <>
                {typeof filtersContextProps?.resetFilters === 'function' && (
                  <Pressable
                    testID="map-panel-reset"
                    onPress={() => filtersContextProps?.resetFilters?.()}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.sheetCloseButton,
                      compactSheetActions && styles.sheetIconButtonCompact,
                      { borderColor: colors.borderLight },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Feather name="rotate-cw" size={15} color={colors.textMuted} />
                  </Pressable>
                )}
                <Pressable
                  testID="map-panel-show-results"
                  onPress={handleOpenList}
                  accessibilityRole="button"
                  accessibilityLabel={`Показать ${travelsData.length} мест`}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.sheetShowResultsButton,
                    compactSheetActions && styles.sheetShowResultsButtonCompact,
                    { backgroundColor: pressed ? colors.primaryDark : colors.primary },
                  ]}
                >
                  <Feather name="list" size={15} color={colors.textOnPrimary} />
                  {travelsData.length > 0 && (
                    <RNText style={[styles.sheetResultsBadge, { color: colors.primary }]} numberOfLines={1}>
                      {travelsData.length > 999 ? '999+' : String(travelsData.length)}
                    </RNText>
                  )}
                </Pressable>
              </>
            )}
            <Pressable
              testID="map-panel-open"
              onPress={handleToggleListPanel}
              accessibilityRole="button"
              accessibilityLabel="Вернуться к карте"
              hitSlop={6}
              style={({ pressed }) => [
                styles.sheetBackToMapButton,
                compactSheetActions && styles.sheetBackToMapButtonCompact,
                pressed && { opacity: 0.72 },
              ]}
            >
              <Feather name="map" size={15} color={colors.textMuted} />
              {!compactSheetActions && (
                <RNText style={styles.sheetBackToMapText}>Карта</RNText>
              )}
            </Pressable>
            {showSheetCloseButton && (
                <Pressable
                  testID="map-panel-close"
                  onPress={() => bottomSheetRef.current?.snapToCollapsed()}
                  accessibilityRole="button"
              accessibilityLabel="Закрыть панель"
              hitSlop={8}
              style={({ pressed }) => [
                styles.sheetCloseButton,
                compactSheetActions && styles.sheetIconButtonCompact,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
            )}
          </View>
        </View>

        <View style={styles.sheetBody}>{body}</View>
      </View>
    );
  }, [
    uiTab,
    contentTab,
    bottomSheetRef,
    colors.borderLight,
    colors.primary,
    colors.primaryDark,
    colors.textMuted,
    colors.textOnPrimary,
    buildRouteTo,
    coordinates,
    favorites,
    hasMore,
    filtersMode,
    filtersContextProps,
    filtersPanelProps?.Component,
    filtersPanelProps?.Panel,
    isRefreshing,
    onLoadMore,
    onRefresh,
    onToggleFavorite,
    handleOpenList,
    handleToggleListPanel,
    setTabDeferred,
    setFiltersMode,
    styles.sheetToolbarActions,
    styles.sheetCloseButton,
    styles.sheetBackToMapButton,
    styles.sheetBackToMapButtonCompact,
    styles.sheetBackToMapText,
    styles.sheetShowResultsButton,
    styles.sheetShowResultsButtonCompact,
    styles.sheetResultsBadge,
    styles.filtersModeBar,
    styles.sheetToolbarLeft,
    styles.sheetToolbarSummary,
    styles.sheetToolbarActionsStacked,
    styles.sheetBody,
    styles.sheetRoot,
    styles.sheetToolbar,
    styles.sheetToolbarInline,
    styles.sheetToolbarStacked,
    styles.sheetToolbarFullWidth,
    styles.sheetIconButtonCompact,
    transportMode,
    travelsData,
    onExpandRadius,
    onResetFilters,
    listTabsOptions,
    filterToolbarSummary,
    modeTabsOptions,
    compactSheetActions,
    isNarrow,
    stackSheetToolbar,
  ]);


  return (
    <GestureHandlerRootView
      style={styles.container}
      testID="map-mobile-layout"
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapComponent}
      </View>

      {/* Quick actions for mobile web */}
      {Platform.OS === 'web' && bottomSheetState === 'collapsed' && sheetState === 'collapsed' && (
        <View
          style={[
            styles.quickActionsRail,
            {
              bottom: Platform.OS === 'web'
                ? (`calc(${quickActionsBottomOffset}px + env(safe-area-inset-bottom, 0px))` as any)
                : quickActionsBottomOffset,
            },
          ]}
        >
          <CardActionPressable
            testID="map-panel-open"
            accessibilityRole="button"
            accessibilityLabel="Открыть список мест"
            onPress={handleToggleListPanel}
            style={styles.quickCircleButton}
          >
            <Feather name="menu" size={20} color={colors.text} />
          </CardActionPressable>
          <CardActionPressable
            accessibilityRole="button"
            accessibilityLabel="Открыть фильтры"
            onPress={onOpenFilters}
            style={styles.quickCircleButton}
          >
            <Feather name="sliders" size={20} color={colors.text} />
          </CardActionPressable>
        </View>
      )}

      {/* Bottom Sheet */}
      <MapBottomSheet
        ref={bottomSheetRef}
        peekContent={sheetPeekContent}
        onStateChange={handleSheetStateChange}
        bottomInset={0}
      >
        {sheetContent}
      </MapBottomSheet>
    </GestureHandlerRootView>
  );
};
