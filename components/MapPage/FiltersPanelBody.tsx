import React from 'react';
import { ScrollView } from 'react-native';
import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings';
import FiltersPanelRadiusSection from '@/components/MapPage/FiltersPanelRadiusSection';
import FiltersPanelRouteSection from '@/components/MapPage/FiltersPanelRouteSection';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/types/mapUi';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

interface FiltersPanelBodyProps {
  colors: ThemedColors;
  styles: any;
  mode: 'radius' | 'route';
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
  travelsData: { categoryName?: string }[];
  mapUiApi?: MapUiApi | null;
  isMobile: boolean;
  totalPoints: number;
  hasFilters: boolean;
  canBuildRoute: boolean;
  onFilterChange: (field: string, value: any) => void;
  onReset: () => void;
  onOpenList?: () => void;
  transportMode: 'car' | 'bike' | 'foot';
  setTransportMode: (mode: 'car' | 'bike' | 'foot') => void;
  startAddress: string;
  endAddress: string;
  routingLoading?: boolean;
  routingError?: string | boolean | null;
  routeDistance?: number | null;
  routeDuration?: number | null;
  routeElevationGain?: number | null;
  routeElevationLoss?: number | null;
  routePoints: RoutePoint[];
  onRemoveRoutePoint: (id: string) => void;
  onClearRoute?: () => void;
  swapStartEnd?: () => void;
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
  onAddressClear?: (isStart: boolean) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  onPlaceSelect?: (place: any) => void;
}

const FiltersPanelBody: React.FC<FiltersPanelBodyProps> = ({
  colors,
  styles,
  mode,
  filters,
  filterValue,
  travelsData,
  mapUiApi,
  isMobile,
  totalPoints,
  hasFilters,
  canBuildRoute,
  onFilterChange,
  onReset,
  onOpenList,
  transportMode,
  setTransportMode,
  startAddress,
  endAddress,
  routingLoading,
  routingError,
  routeDistance,
  routeDuration,
  routeElevationGain,
  routeElevationLoss,
  routePoints,
  onRemoveRoutePoint,
  onClearRoute,
  swapStartEnd,
  onAddressSelect,
  onAddressClear,
  userLocation,
  onPlaceSelect,
}) => {
  return (
    <ScrollView
      testID="filters-panel-scroll"
      style={styles.content}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {mode === 'radius' ? (
        <FiltersPanelRadiusSection
          colors={colors}
          styles={styles}
          isMobile={isMobile}
          filters={filters}
          filterValue={filterValue}
          travelsData={travelsData}
          onFilterChange={onFilterChange}
        />
      ) : (
        <FiltersPanelRouteSection
          colors={colors}
          styles={styles}
          mode={mode}
          transportMode={transportMode}
          setTransportMode={setTransportMode}
          startAddress={startAddress}
          endAddress={endAddress}
          routingLoading={routingLoading}
          routingError={routingError}
          routeDistance={routeDistance}
          routeDuration={routeDuration}
          routeElevationGain={routeElevationGain}
          routeElevationLoss={routeElevationLoss}
          routePoints={routePoints}
          onRemoveRoutePoint={onRemoveRoutePoint}
          onClearRoute={onClearRoute}
          swapStartEnd={swapStartEnd}
          onAddressSelect={onAddressSelect}
          onAddressClear={onAddressClear}
        />
      )}

      <FiltersPanelMapSettings
        colors={colors}
        styles={styles}
        isMobile={isMobile}
        mode={mode}
        mapUiApi={mapUiApi}
        totalPoints={totalPoints}
        hasFilters={hasFilters}
        canBuildRoute={canBuildRoute}
        onReset={onReset}
        hideReset={isMobile}
        onOpenList={onOpenList}
      />

      {mode === 'radius' && userLocation && onPlaceSelect && (
        <QuickRecommendations
          places={travelsData}
          userLocation={userLocation}
          transportMode={transportMode}
          onPlaceSelect={onPlaceSelect}
          maxItems={3}
          radiusKm={filterValue.radius ? Number(filterValue.radius) : undefined}
        />
      )}
    </ScrollView>
  );
};

export default React.memo(FiltersPanelBody);
