import React from 'react';
import { Platform, ScrollView } from 'react-native';
import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings';
import FiltersPanelRadiusSection from '@/components/MapPage/FiltersPanelRadiusSection';
import FiltersPanelRouteSection from '@/components/MapPage/FiltersPanelRouteSection';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/src/types/mapUi';

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
  routePoints: RoutePoint[];
  onRemoveRoutePoint: (id: string) => void;
  onClearRoute?: () => void;
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
  routePoints,
  onRemoveRoutePoint,
  onClearRoute,
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
          routePoints={routePoints}
          onRemoveRoutePoint={onRemoveRoutePoint}
          onClearRoute={onClearRoute}
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

      {Platform.OS !== 'web' && mode === 'radius' && userLocation && onPlaceSelect && (
        <QuickRecommendations
          places={travelsData}
          userLocation={userLocation}
          transportMode={transportMode}
          onPlaceSelect={onPlaceSelect}
          maxItems={3}
        />
      )}
    </ScrollView>
  );
};

export default React.memo(FiltersPanelBody);
