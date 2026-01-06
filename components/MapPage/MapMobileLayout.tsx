/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet';
import { MapPeekPreview } from './MapPeekPreview';
import { MapFAB } from './MapFAB';
import TravelListPanel from './TravelListPanel';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import { useMapPanelStore } from '@/stores/mapPanelStore';

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
}

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  mapComponent,
  travelsData,
  coordinates,
  transportMode,
  buildRouteTo,
  onCenterOnUser,
  onOpenFilters: _onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const bottomSheetRef = useRef<MapBottomSheetRef>(null);
  const lastPanelOpenTsRef = useRef<number>(0);

  const [activeTab, setActiveTab] = useState<'list' | 'filters'>('list');
  const [sheetState, setSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [webOverlayInteractive, setWebOverlayInteractive] = useState(false);

  const openNonce = useMapPanelStore((s) => s.openNonce);
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce);

  // FAB actions
  const fabActions = useMemo(() => [
    {
      icon: 'my-location',
      label: 'Моё местоположение',
      onPress: onCenterOnUser,
    },
    {
      icon: 'filter-list',
      label: 'Фильтры',
      onPress: () => {
        setActiveTab('filters');
        lastPanelOpenTsRef.current = Date.now();
        bottomSheetRef.current?.snapToHalf();
      },
    },
    {
      icon: 'route',
      label: 'Построить маршрут',
      onPress: () => {
        setActiveTab('filters');
        lastPanelOpenTsRef.current = Date.now();
        bottomSheetRef.current?.snapToFull();
        // Trigger mode change in filters
        filtersPanelProps?.props?.setMode?.('route');
      },
    },
  ], [onCenterOnUser, filtersPanelProps]);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'half' | 'full') => {
    setSheetState(state);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (sheetState === 'collapsed') {
      setWebOverlayInteractive(false);
      return;
    }

    // Prevent the opening click/tap from immediately hitting the overlay and closing the panel.
    setWebOverlayInteractive(false);
    const t = setTimeout(() => setWebOverlayInteractive(true), 250);
    return () => clearTimeout(t);
  }, [sheetState]);

  useEffect(() => {
    if (!openNonce) return;
    setActiveTab('filters');
    lastPanelOpenTsRef.current = Date.now();
    bottomSheetRef.current?.snapToHalf();
  }, [openNonce]);

  useEffect(() => {
    if (!toggleNonce) return;
    if (sheetState === 'collapsed') {
      setActiveTab('filters');
      lastPanelOpenTsRef.current = Date.now();
      bottomSheetRef.current?.snapToHalf();
      return;
    }
    bottomSheetRef.current?.snapToCollapsed();
  }, [toggleNonce, sheetState]);

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
    if (activeTab === 'list') {
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

    if (activeTab !== 'filters') return null;
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
            <Pressable
              style={[styles.primaryCta, (!canBuildRoute || routingLoading) && styles.primaryCtaDisabled]}
              onPress={() => {
                if (!canBuildRoute || routingLoading) return;
                filtersPanelProps?.props?.onBuildRoute?.();
              }}
              disabled={!canBuildRoute || routingLoading}
              accessibilityRole="button"
              accessibilityLabel="Построить маршрут"
              accessibilityState={{ disabled: !canBuildRoute || routingLoading }}
            >
              <Text style={styles.primaryCtaText}>{routeCtaLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [
    activeTab,
    travelsData,
    coordinates,
    transportMode,
    handlePlacePress,
    filtersMode,
    setFiltersMode,
    filtersPanelProps,
    styles.filtersPeek,
    styles.filtersPeekCtaRow,
    styles.primaryCta,
    styles.primaryCtaDisabled,
    styles.primaryCtaText,
    canBuildRoute,
    routingLoading,
    routeCtaLabel,
  ]);

  // Content based on active tab
  const sheetContent = useMemo(() => {
    const showModeToggle =
      activeTab === 'filters' &&
      (filtersMode === 'radius' || filtersMode === 'route') &&
      typeof setFiltersMode === 'function';

    const body =
      activeTab === 'filters' ? (
        (() => {
          const FilterComponent = filtersPanelProps.Component;
          return (
            <FilterComponent
              {...filtersPanelProps.props}
              isMobile={true}
              hideTopControls={true}
              hideFooterCta={filtersMode === 'route'}
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
        />
      );

    return (
      <View style={styles.sheetRoot}>
        <View style={styles.sheetTopControls}>
          <SegmentedControl
            options={[
              { key: 'list', label: 'Список', icon: 'list' },
              { key: 'filters', label: 'Фильтры', icon: 'filter-list' },
            ]}
            value={activeTab}
            onChange={(key) => {
              const next = key === 'filters' ? 'filters' : 'list';
              setActiveTab(next);
              bottomSheetRef.current?.snapToHalf();
            }}
            compact={true}
            accessibilityLabel="Переключение между фильтрами и списком"
          />

          {showModeToggle && (
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
          )}
        </View>

        <View style={styles.sheetBody}>{body}</View>
      </View>
    );
  }, [
    activeTab,
    bottomSheetRef,
    buildRouteTo,
    coordinates,
    favorites,
    filtersMode,
    filtersPanelProps,
    onToggleFavorite,
    setFiltersMode,
    styles.sheetBody,
    styles.sheetRoot,
    styles.sheetTopControls,
    transportMode,
    travelsData,
  ]);

  const sheetTitle = activeTab === 'filters' ? 'Фильтры' : 'Места рядом';
  const sheetSubtitle = activeTab === 'list' ? `${travelsData.length} мест` : undefined;

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapComponent}
      </View>

      {/* Web/mobile overlay to close sheet by tapping outside (e2e + UX parity) */}
      {Platform.OS === 'web' && sheetState !== 'collapsed' && (
        <Pressable
          testID="map-panel-overlay"
          style={styles.webOverlay}
          pointerEvents={webOverlayInteractive ? 'auto' : 'none'}
          onPress={() => {
            // Prevent immediate close on the same click/tap that opened the panel (RN-web event timing).
            const dt = Date.now() - lastPanelOpenTsRef.current;
            if (dt < 250) return;
            bottomSheetRef.current?.snapToCollapsed();
          }}
          accessibilityRole="button"
          accessibilityLabel="Закрыть панель карты"
        />
      )}

      {/* FAB */}
      <MapFAB
        mainAction={{
          icon: 'menu',
          label: 'Показать панель',
          onPress: () => bottomSheetRef.current?.snapToHalf(),
        }}
        actions={fabActions}
        expandOnMainPress={false}
        mainActionTestID="map-open-panel-button"
        position="bottom-right"
      />

      {/* Bottom Sheet */}
      <MapBottomSheet
        ref={bottomSheetRef}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        peekContent={peekContent}
        onStateChange={handleSheetStateChange}
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
    },
    mapContainer: {
      flex: 1,
    },
    webOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      zIndex: 10,
    },
    sheetRoot: {
      flex: 1,
    },
    sheetTopControls: {
      gap: 8,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    primaryCta: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    primaryCtaDisabled: {
      opacity: 0.5,
    },
    primaryCtaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
