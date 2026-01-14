/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState, useEffect, useTransition } from 'react';
import { View, StyleSheet, Pressable, Text, Platform, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet';
import { MapPeekPreview } from './MapPeekPreview';
import TravelListPanel from './TravelListPanel';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import { useMapPanelStore } from '@/stores/mapPanelStore';
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
}

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  mapComponent,
  travelsData,
  coordinates,
  transportMode,
  buildRouteTo,
  onCenterOnUser: _onCenterOnUser,
  onOpenFilters: _onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const bottomSheetRef = useRef<MapBottomSheetRef>(null);
  const lastPanelOpenTsRef = useRef<number>(0);

  const [uiTab, setUiTab] = useState<'list' | 'filters'>('list');
  const [contentTab, setContentTab] = useState<'list' | 'filters'>('list');
  const [, startTransition] = useTransition();
  const [sheetState, setSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const sheetStateRef = useRef<'collapsed' | 'half' | 'full'>('collapsed');

  const openNonce = useMapPanelStore((s) => s.openNonce);
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'half' | 'full') => {
    sheetStateRef.current = state;
    setSheetState(state);
  }, []);

  useEffect(() => {
    if (!openNonce) return;
    setUiTab('filters');
    setContentTab('filters');
    lastPanelOpenTsRef.current = Date.now();
    bottomSheetRef.current?.snapToHalf();
  }, [openNonce]);

  useEffect(() => {
    if (!toggleNonce) return;
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('filters');
      setContentTab('filters');
      lastPanelOpenTsRef.current = Date.now();
      bottomSheetRef.current?.snapToHalf();
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
        />
      );

    return (
      <View style={styles.sheetRoot}>
        <View style={styles.sheetTopControls}>
          <View style={styles.sheetTopRow}>
            <View style={styles.sheetTopPrimary}>
              <SegmentedControl
                options={[
                  { key: 'list', label: 'Список', icon: 'list' },
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

            {uiTab === 'filters' && typeof filtersPanelProps?.props?.resetFilters === 'function' && (
              <Pressable
                testID="map-panel-reset"
                style={styles.sheetIconButton}
                onPress={() => {
                  filtersPanelProps?.props?.resetFilters?.();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Сбросить фильтры"
              >
                <MaterialIcons name="refresh" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

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
    styles.sheetTopPrimary,
    styles.sheetTopRow,
    styles.sheetBody,
    styles.sheetRoot,
    styles.sheetTopControls,
    transportMode,
    travelsData,
  ]);

  const sheetTitle = uiTab === 'filters' ? 'Фильтры' : 'Места рядом';
  const sheetSubtitle = uiTab === 'list' ? `${travelsData.length} мест` : undefined;

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapComponent}
      </View>

      {/* Bottom Sheet */}
      <MapBottomSheet
        ref={bottomSheetRef}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        peekContent={peekContent}
        onStateChange={handleSheetStateChange}
        bottomInset={
          Platform.OS === 'web' && sheetState !== 'collapsed' ? LAYOUT.tabBarHeight : 0
        }
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
    sheetTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sheetTopPrimary: {
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
