/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState, useEffect, useTransition } from 'react';
import { View, StyleSheet, Platform, InteractionManager } from 'react-native';
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
  const styles = useMemo(() => getStyles(colors), [colors]);
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

  const filtersMode: 'radius' | 'route' | undefined = filtersPanelProps?.props?.mode;
  const setFiltersMode: ((m: 'radius' | 'route') => void) | undefined = filtersPanelProps?.props?.setMode;

  const canBuildRoute = useMemo(() => {
    if (filtersMode !== 'route') return false;
    const points = filtersPanelProps?.props?.routePoints;
    return Array.isArray(points) && points.length >= 2;
  }, [filtersMode, filtersPanelProps?.props?.routePoints]);

  const routingLoading = Boolean(filtersPanelProps?.props?.routingLoading);
  const routeDistance = filtersPanelProps?.props?.routeDistance as number | null | undefined;

  const routeCtaLabel = useMemo(() => {
    if (routingLoading) return 'Строим…';
    if (routeDistance != null) return 'Пересчитать маршрут';
    return canBuildRoute ? 'Построить маршрут' : 'Добавьте старт и финиш';
  }, [routingLoading, routeDistance, canBuildRoute]);

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

    const showRouteCta = filtersMode === 'route' && typeof filtersPanelProps?.props?.onBuildRoute === 'function';

    return (
      <View style={styles.filtersPeek}>
        <SegmentedControl
          options={[
            { key: 'radius', label: 'Радиус', icon: 'my-location' },
            { key: 'route', label: 'Маршрут', icon: 'alt-route' },
          ]}
          value={filtersMode}
          onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
          compact={true}
          tone="subtle"
          accessibilityLabel="Выбор режима поиска"
        />

        {showRouteCta && (
          <View style={styles.filtersPeekCtaRow}>
            <Button
              label={routeCtaLabel}
              onPress={() => {
                if (!canBuildRoute || routingLoading) return;
                filtersPanelProps?.props?.onBuildRoute?.();
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
    filtersPanelProps,
    styles.filtersPeek,
    styles.filtersPeekCtaRow,
    canBuildRoute,
    routingLoading,
    routeCtaLabel,
  ]);

  const sheetPeekContent = Platform.OS === 'web' ? null : peekContent;

  // Content based on active tab
  const sheetContent = useMemo(() => {
    const showModeToggle =
      uiTab === 'filters' &&
      (filtersMode === 'radius' || filtersMode === 'route') &&
      typeof setFiltersMode === 'function';

    const body =
      contentTab === 'filters' ? (
        (() => {
          const ProviderComponent = filtersPanelProps?.Component;
          const PanelComponent = filtersPanelProps?.Panel;
          const providerProps = filtersPanelProps?.props;

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
        <View style={styles.sheetToolbar}>
          <View style={styles.sheetToolbarLeft}>
            <SegmentedControl
              options={[
                { key: 'list', label: 'Список', icon: 'list', badge: travelsData.length },
                { key: 'filters', label: 'Фильтры', icon: 'filter-list' },
              ]}
              value={uiTab}
              onChange={(key) => {
                const next = key === 'filters' ? 'filters' : 'list';
                setTabDeferred(next);
                bottomSheetRef.current?.snapToHalf();
              }}
              compact={true}
              tone="subtle"
              accessibilityLabel="Переключение между фильтрами и списком"
            />
          </View>

          {showModeToggle && (
            <View style={styles.sheetToolbarRight}>
              <SegmentedControl
                options={[
                  { key: 'radius', label: 'Радиус', icon: 'my-location' },
                  { key: 'route', label: 'Маршрут', icon: 'alt-route' },
                ]}
                value={filtersMode}
                onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
                compact={true}
                tone="subtle"
                accessibilityLabel="Выбор режима поиска"
              />
            </View>
          )}

          {uiTab === 'filters' && !showModeToggle && typeof filtersPanelProps?.props?.resetFilters === 'function' && (
            <IconButton
              testID="map-panel-reset"
              icon={<Feather name="rotate-cw" size={18} color={colors.textMuted} />}
              label="Сбросить"
              size="sm"
              showLabel={false}
              onPress={() => {
                filtersPanelProps?.props?.resetFilters?.();
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
    filtersPanelProps,
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
    transportMode,
    travelsData,
    onExpandRadius,
    onResetFilters,
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

const getStyles = (colors: ThemedColors) =>
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
      flex: 1,
    },
    sheetToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingVertical: 2,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          flexDirection: 'column',
          alignItems: 'stretch',
          minHeight: 'auto' as any,
          paddingVertical: 8,
          paddingHorizontal: 8,
          position: 'sticky' as any,
          top: 0,
          zIndex: 10,
        },
      }),
    },
    sheetToolbarLeft: {
      flex: 1,
      minWidth: 0,
      ...Platform.select({
        web: {
          flex: 0,
          width: '100%',
          minHeight: 44,
        },
      }),
    },
    sheetToolbarRight: {
      flex: 1,
      minWidth: 0,
      ...Platform.select({
        web: {
          flex: 0,
          width: '100%',
        },
      }),
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
      flex: 1,
      ...Platform.select({
        web: {
          paddingHorizontal: 16,
        },
      }),
    },
    filtersPeek: {
      gap: 8,
    },
    filtersPeekCtaRow: {
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    fab: {
      bottom: 140,
      right: 12,
    },
  });
