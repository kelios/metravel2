/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState, useEffect, useTransition } from 'react';
import { View, StyleSheet, Platform, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { LAYOUT } from '@/constants/layout';

interface MapMobileLayoutProps {
  // Map props
  mapComponent: React.ReactNode;

  // Data
  travelsData: any[];
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
  const lastPanelOpenTsRef = useRef<number>(0);

  const [uiTab, setUiTab] = useState<'list' | 'filters'>('list');
  const [contentTab, setContentTab] = useState<'list' | 'filters'>('list');
  const [, startTransition] = useTransition();
  const [_sheetState, setSheetState] = useState<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed');
  const sheetStateRef = useRef<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed');

  const openNonce = useMapPanelStore((s) => s.openNonce);
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce);

  // Синхронизация состояния Bottom Sheet с глобальным store
  const setBottomSheetState = useBottomSheetStore((s) => s.setState);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'quarter' | 'half' | 'full') => {
    sheetStateRef.current = state;
    setSheetState(state);
    setBottomSheetState(state); // Синхронизация с store
  }, [setBottomSheetState]);

  useEffect(() => {
    if (!openNonce) return;
    setUiTab('filters');
    setContentTab('filters');
    lastPanelOpenTsRef.current = Date.now();
    bottomSheetRef.current?.snapToFull();
  }, [openNonce]);

  useEffect(() => {
    if (!toggleNonce) return;
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('filters');
      setContentTab('filters');
      lastPanelOpenTsRef.current = Date.now();
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

  // Content based on active tab
  const sheetContent = useMemo(() => {
    const showModeToggle =
      uiTab === 'filters' &&
      (filtersMode === 'radius' || filtersMode === 'route') &&
      typeof setFiltersMode === 'function';

    const body =
      contentTab === 'filters' ? (
        (() => {
          const FilterComponent = filtersPanelProps?.Component;
          if (!FilterComponent) {
            return <View style={styles.sheetRoot} />;
          }
          return (
            <FilterComponent
              {...filtersPanelProps.props}
              isMobile={true}
              hideTopControls={true}
              hideFooterCta={filtersMode === 'route'}
              hideFooterReset={true}
            />
          );
        })()
      ) : (
        <TravelListPanel
          travelsData={travelsData}
          buildRouteTo={buildRouteTo}
          isMobile={true}
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
                accessibilityLabel="Выбор режима поиска"
              />
            </View>
          )}

          {uiTab === 'filters' && !showModeToggle && typeof filtersPanelProps?.props?.resetFilters === 'function' && (
            <IconButton
              testID="map-panel-reset"
              icon={<Feather name="rotate-cw" size={18} color={colors.textMuted} />}
              label="Сбросить фильтры"
              size="sm"
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
    filtersMode,
    filtersPanelProps,
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
  ]);


  return (
    <GestureHandlerRootView style={styles.container} testID="map-mobile-layout">
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapComponent}
      </View>

      {/* FAB for mobile web */}
      {Platform.OS === 'web' && (
        <MapFAB
          mainAction={{
            icon: 'my-location',
            label: 'Моё местоположение',
            onPress: onCenterOnUser,
          }}
          actions={[{
            icon: 'filter-list',
            label: 'Открыть фильтры',
            onPress: onOpenFilters,
          }]}
          position="bottom-right"
          containerStyle={styles.fab}
          mainActionTestID="map-mobile-fab"
        />
      )}

      {/* Bottom Sheet */}
      <MapBottomSheet
        ref={bottomSheetRef}
        peekContent={peekContent}
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
      gap: 8,
      maxHeight: 48,
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetToolbarLeft: {
      flex: 1,
      minWidth: 0,
    },
    sheetToolbarRight: {
      flex: 1,
      minWidth: 0,
    },
    sheetIconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexShrink: 0,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    sheetBody: {
      flex: 1,
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
