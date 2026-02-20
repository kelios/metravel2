/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState, useEffect, useTransition } from 'react';
import { View, StyleSheet, Platform, InteractionManager, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePathname } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet';
import { MapPeekPreview } from './MapPeekPreview';
import TravelListPanel from './TravelListPanel';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import { MapFAB } from './MapFAB';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';

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
  onCenterOnUser,
  onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
  onResetFilters,
  onExpandRadius,
}) => {
  const colors = useThemedColors();
  const { width: viewportWidth } = useWindowDimensions();
  const isNarrow = viewportWidth <= 390;
  const isVeryNarrow = viewportWidth <= 350;
  const stackSheetToolbar = Platform.OS === 'web' || viewportWidth <= 460;
  const styles = useMemo(
    () => getStyles(colors, { isNarrow, stackSheetToolbar }),
    [colors, isNarrow, stackSheetToolbar]
  );
  const bottomSheetRef = useRef<MapBottomSheetRef>(null);
  const pathname = usePathname();
  const isActiveWebRoute = Platform.OS === 'web' && (pathname === '/map' || String(pathname).startsWith('/map/'));

  const [uiTab, setUiTab] = useState<'list' | 'filters'>('list');
  const [contentTab, setContentTab] = useState<'list' | 'filters'>('list');
  const [, startTransition] = useTransition();
  const sheetStateRef = useRef<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed');

  const openNonce = useMapPanelStore((s) => s.openNonce);
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce);

  // Синхронизация состояния Bottom Sheet с глобальным store
  const setBottomSheetState = useBottomSheetStore((s) => s.setState);
  const bottomSheetState = useBottomSheetStore((s) => s.state);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'quarter' | 'half' | 'full') => {
    sheetStateRef.current = state;
    setBottomSheetState(state); // Синхронизация с store
  }, [setBottomSheetState]);

  useEffect(() => {
    if (!openNonce) return;
    setUiTab('filters');
    setContentTab('filters');
    bottomSheetRef.current?.snapToFull();
  }, [openNonce]);

  useEffect(() => {
    if (!toggleNonce) return;
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('filters');
      setContentTab('filters');
      bottomSheetRef.current?.snapToFull();
      return;
    }
    bottomSheetRef.current?.snapToCollapsed();
  }, [toggleNonce]);

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

  const routeCtaLabel = useMemo(() => {
    if (routingLoading) return 'Строим…';
    if (routeDistance != null) return 'Пересчитать маршрут';
    return canBuildRoute ? 'Построить маршрут' : 'Добавьте старт и финиш';
  }, [routingLoading, routeDistance, canBuildRoute]);

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

  // Content based on active tab
  const sheetContent = useMemo(() => {
    const showModeToggle =
      (filtersMode === 'radius' || filtersMode === 'route') &&
      typeof setFiltersMode === 'function';

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
            <ProviderComponent {...mergedProviderProps}>
              <PanelComponent
                hideTopControls={true}
                hideFooterCta={filtersMode === 'route'}
                hideFooterReset={filtersMode !== 'radius'}
              />
            </ProviderComponent>
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
        <View style={[styles.sheetToolbar, stackSheetToolbar ? styles.sheetToolbarStacked : styles.sheetToolbarInline]}>
          <View style={[styles.sheetToolbarLeft, stackSheetToolbar && styles.sheetToolbarFullWidth]}>
            <SegmentedControl
              options={listTabsOptions}
              value={uiTab}
              onChange={(key) => {
                const next = key === 'filters' ? 'filters' : 'list';
                setTabDeferred(next);
                bottomSheetRef.current?.snapToHalf();
              }}
              compact={true}
              dense={isNarrow}
              tone="subtle"
              accessibilityLabel="Переключение между фильтрами и списком"
            />
          </View>

          {showModeToggle && (
            <View style={[styles.sheetToolbarRight, stackSheetToolbar && styles.sheetToolbarFullWidth]}>
              <SegmentedControl
                options={modeTabsOptions}
                value={filtersMode}
                onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
                compact={true}
                dense={isNarrow}
                tone="subtle"
                accessibilityLabel="Выбор режима поиска"
              />
            </View>
          )}

          {uiTab === 'filters' && !showModeToggle && typeof filtersContextProps?.resetFilters === 'function' && (
            <IconButton
              testID="map-panel-reset"
              icon={<Feather name="rotate-cw" size={18} color={colors.textMuted} />}
              label="Сбросить"
              size="sm"
              showLabel={false}
              onPress={() => {
                filtersContextProps?.resetFilters?.();
              }}
              style={styles.sheetIconButton}
            />
          )}
        </View>

        <View style={styles.sheetBody}>{body}</View>
      </View>
    );
  }, [
    uiTab,
    contentTab,
    bottomSheetRef,
    colors.textMuted,
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
    setTabDeferred,
    setFiltersMode,
    styles.sheetIconButton,
    styles.sheetToolbarLeft,
    styles.sheetToolbarRight,
    styles.sheetBody,
    styles.sheetRoot,
    styles.sheetToolbar,
    styles.sheetToolbarInline,
    styles.sheetToolbarStacked,
    styles.sheetToolbarFullWidth,
    transportMode,
    travelsData,
    onExpandRadius,
    onResetFilters,
    listTabsOptions,
    modeTabsOptions,
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

      {/* FAB for mobile web */}
      {Platform.OS === 'web' && bottomSheetState === 'collapsed' && (
        <MapFAB
          mainAction={{
            icon: 'my-location',
            label: 'Моё местоположение',
            onPress: onCenterOnUser,
          }}
          actions={[
            {
              icon: 'list',
              label: 'Открыть список',
              onPress: handleOpenList,
            },
            {
              icon: 'filter-list',
              label: 'Открыть фильтры',
              onPress: onOpenFilters,
            },
          ]}
          position="bottom-right"
          containerStyle={styles.fab}
          mainActionTestID="map-mobile-fab"
        />
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

const getStyles = (
  colors: ThemedColors,
  options: { isNarrow: boolean; stackSheetToolbar: boolean }
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web'
        ? ({
            height: '100%',
            maxHeight: '100vh',
            overflow: 'hidden',
          } as any)
        : null),
    },
    mapContainer: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? ({
            minHeight: 0,
            overflow: 'hidden',
          } as any)
        : null),
    },
    sheetRoot: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
    },
    sheetToolbar: {
      flexDirection: options.stackSheetToolbar ? 'column' : 'row',
      alignItems: options.stackSheetToolbar ? 'stretch' : 'center',
      gap: options.isNarrow ? 6 : 8,
      minHeight: options.stackSheetToolbar ? undefined : 44,
      paddingVertical: Platform.OS === 'web' ? (options.isNarrow ? 6 : 8) : (options.isNarrow ? 4 : 6),
      paddingHorizontal: options.isNarrow ? 4 : 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          position: 'sticky' as any,
          top: 0,
          zIndex: 10,
        },
      }),
    },
    sheetToolbarLeft: {
      flex: options.stackSheetToolbar ? 0 : 1,
      minWidth: 0,
    },
    sheetToolbarRight: {
      flex: options.stackSheetToolbar ? 0 : 1,
      minWidth: 0,
    },
    sheetToolbarInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sheetToolbarStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    sheetToolbarFullWidth: {
      width: '100%',
      minHeight: 40,
    },
    sheetIconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: 'transparent',
      flexShrink: 0,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
        },
      }),
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    sheetResetButton: {
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: 'transparent',
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
          boxShadow: 'none',
        } as any,
      }),
    },
    sheetBody: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
      ...Platform.select({
        web: {
          paddingHorizontal: options.isNarrow ? 8 : 16,
        },
      }),
    },
    filtersPeek: {
      gap: 8,
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingBottom: 4,
    },
    filtersPeekCtaRow: {
      paddingHorizontal: options.isNarrow ? 0 : 2,
      paddingBottom: 4,
    },
    fab: {
      bottom: options.isNarrow ? 124 : 140,
      right: options.isNarrow ? 10 : 12,
    },
  });
