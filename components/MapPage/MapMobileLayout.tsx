/**
 * MapMobileLayout - мобильная версия карты с Bottom Sheet
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet';
import { MapPeekPreview } from './MapPeekPreview';
import { MapFAB } from './MapFAB';
import TravelListPanel from './TravelListPanel';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

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

  const [activeTab, setActiveTab] = useState<'list' | 'filters'>('list');
  const [, setSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');

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
        bottomSheetRef.current?.snapToHalf();
      },
    },
    {
      icon: 'route',
      label: 'Построить маршрут',
      onPress: () => {
        setActiveTab('filters');
        bottomSheetRef.current?.snapToFull();
        // Trigger mode change in filters
        filtersPanelProps?.props?.setMode?.('route');
      },
    },
  ], [onCenterOnUser, filtersPanelProps]);

  const handleSheetStateChange = useCallback((state: 'collapsed' | 'half' | 'full') => {
    setSheetState(state);
  }, []);

  const handlePlacePress = useCallback((place: any) => {
    buildRouteTo(place);
    bottomSheetRef.current?.snapToCollapsed();
  }, [buildRouteTo]);

  // Peek content for collapsed state
  const peekContent = useMemo(() => {
    if (activeTab !== 'list') return null;

    return (
      <MapPeekPreview
        places={travelsData}
        userLocation={coordinates}
        transportMode={transportMode}
        onPlacePress={handlePlacePress}
        onExpandPress={() => bottomSheetRef.current?.snapToHalf()}
      />
    );
  }, [activeTab, travelsData, coordinates, transportMode, handlePlacePress]);

  // Content based on active tab
  const sheetContent = useMemo(() => {
    if (activeTab === 'filters') {
      const FilterComponent = filtersPanelProps.Component;
      return <FilterComponent {...filtersPanelProps.props} isMobile={true} />;
    }

    return (
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
  }, [activeTab, filtersPanelProps, travelsData, buildRouteTo, coordinates, transportMode, onToggleFavorite, favorites]);

  const sheetTitle = activeTab === 'filters' ? 'Фильтры' : 'Места рядом';
  const sheetSubtitle = activeTab === 'list' ? `${travelsData.length} мест` : undefined;

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapComponent}
      </View>

      {/* FAB */}
      <MapFAB
        mainAction={{
          icon: 'menu',
          label: 'Меню',
          onPress: () => bottomSheetRef.current?.snapToHalf(),
        }}
        actions={fabActions}
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
  });

