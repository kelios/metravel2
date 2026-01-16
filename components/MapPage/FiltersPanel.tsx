// FiltersPanel.tsx
import React from 'react';
import { View, Platform, UIManager } from 'react-native';
import FiltersPanelFooter from '@/components/MapPage/FiltersPanelFooter';
import FiltersPanelHeader from '@/components/MapPage/FiltersPanelHeader';
import FiltersPanelBody from '@/components/MapPage/FiltersPanelBody';
import useFiltersPanelModel from '@/components/MapPage/useFiltersPanelModel';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { MapUiApi } from '@/src/types/mapUi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

interface FiltersPanelProps {
  filters: {
    categories: CategoryOption[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: CategoryOption[];
    radius: string;
    address: string;
  };
  onFilterChange: (field: string, value: any) => void;
  resetFilters: () => void;
  travelsData: { categoryName?: string }[]; // Все данные для подсчета категорий
  filteredTravelsData?: { categoryName?: string }[]; // Отфильтрованные данные для отображения количества
  isMobile: boolean;
  closeMenu: () => void;
  mode: 'radius' | 'route';
  setMode: (m: 'radius' | 'route') => void;
  transportMode: 'car' | 'bike' | 'foot';
  setTransportMode: (m: 'car' | 'bike' | 'foot') => void;
  startAddress: string;
  endAddress: string;
  routeDistance: number | null;
  routePoints?: RoutePoint[];
  onRemoveRoutePoint?: (id: string) => void;
  onClearRoute?: () => void;
  swapStartEnd?: () => void;
  routeHintDismissed?: boolean;
  onRouteHintDismiss?: () => void;
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
  routingLoading?: boolean;
  routingError?: string | boolean | null;
  onBuildRoute?: () => void;
  mapUiApi?: MapUiApi | null;
  userLocation?: { latitude: number; longitude: number } | null;
  onPlaceSelect?: (place: any) => void;
  onOpenList?: () => void;
  hideTopControls?: boolean;
  hideFooterCta?: boolean;
  hideFooterReset?: boolean;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
                                                     filters,
                                                     filterValue,
                                                     onFilterChange,
                                                     resetFilters,
                                                     travelsData,
                                                     filteredTravelsData, // Отфильтрованные данные для отображения
                                                     isMobile,
                                                     closeMenu,
                                                     mode,
                                                     setMode,
                                                     transportMode,
                                                     setTransportMode,
                                                     startAddress,
                                                     endAddress,
                                                     routeDistance,
                                                     routePoints = [],
                                                     onRemoveRoutePoint,
                                                     onClearRoute,
                                                     swapStartEnd: _swapStartEnd,
                                                     routeHintDismissed = false,
                                                     onRouteHintDismiss,
                                                     onAddressSelect,
                                                     routingLoading,
                                                     routingError,
                                                     onBuildRoute,
                                                     mapUiApi,
                                                     userLocation,
                                                     onPlaceSelect,
                                                     onOpenList,
                                                     hideTopControls = false,
                                                     hideFooterCta = false,
                                                     hideFooterReset = false,
}) => {
  const {
    colors,
    styles,
    safeRemoveRoutePoint,
    safeResetFilters,
    safeCloseMenu,
    handleSetMode,
    hasActiveFilters,
    canBuildRoute,
    ctaLabel,
    totalPoints,
  } = useFiltersPanelModel({
    isMobile,
    filterValue,
    travelsData,
    filteredTravelsData,
    mode,
    routePoints,
    routingLoading,
    routeDistance,
    onClearRoute,
    setMode,
    onRemoveRoutePoint,
    resetFilters,
    closeMenu,
    routeHintDismissed,
    onRouteHintDismiss,
  });

  return (
    <View style={styles.card} testID="filters-panel">
      {/* ✅ УЛУЧШЕНИЕ: Компактный header */}
      {!hideTopControls && (
        <FiltersPanelHeader
          colors={colors}
          styles={styles}
          isMobile={isMobile}
          totalPoints={totalPoints}
          mode={mode}
          radiusValue={filterValue.radius}
          onClose={safeCloseMenu}
          onModeChange={handleSetMode}
          routingLoading={routingLoading}
          routingError={routingError}
          routeDistance={routeDistance}
          transportMode={transportMode}
        />
      )}

      <FiltersPanelBody
        colors={colors}
        styles={styles}
        mode={mode}
        filters={filters}
        filterValue={filterValue}
        travelsData={travelsData}
        mapUiApi={mapUiApi}
        isMobile={isMobile}
        totalPoints={totalPoints}
        hasFilters={hasActiveFilters}
        canBuildRoute={canBuildRoute}
        onFilterChange={onFilterChange}
        onReset={safeResetFilters}
        onOpenList={onOpenList}
        transportMode={transportMode}
        setTransportMode={setTransportMode}
        startAddress={startAddress}
        endAddress={endAddress}
        routePoints={routePoints}
        onRemoveRoutePoint={safeRemoveRoutePoint}
        onClearRoute={onClearRoute}
        onAddressSelect={onAddressSelect}
        userLocation={userLocation}
        onPlaceSelect={onPlaceSelect}
      />

      {/* Sticky footer CTA */}
      {!hideFooterCta && (
        <FiltersPanelFooter
          styles={styles}
          mode={mode}
          canBuildRoute={canBuildRoute}
          routePointsLength={routePoints.length}
          routingLoading={routingLoading}
          ctaLabel={ctaLabel}
          hideFooterReset={hideFooterReset}
          onReset={safeResetFilters}
          onBuildRoute={onBuildRoute}
        />
      )}
    </View>
  );
};

export default React.memo(FiltersPanel);
