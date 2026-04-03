import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings';
import FiltersPanelRadiusSection from '@/components/MapPage/FiltersPanelRadiusSection';
import FiltersPanelRouteSection from '@/components/MapPage/FiltersPanelRouteSection';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/types/mapUi';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`;
  return `${count} мест`;
};

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
  const radiusValue = filterValue.radius || '60';
  const statusBadge =
    mode === 'radius'
      ? `${radiusValue} км`
      : canBuildRoute
        ? 'Можно строить'
        : 'Нужно 2 точки';
  const statusTitle =
    mode === 'radius'
      ? 'Сейчас на карте'
      : canBuildRoute
        ? 'Маршрут готов к расчёту'
        : 'Соберите маршрут';
  const statusDescription =
    mode === 'radius'
      ? `${getPlacesLabel(totalPoints)} в радиусе ${radiusValue} км. Меняйте поиск и категории, чтобы сразу видеть новый результат.`
      : canBuildRoute
        ? 'Старт и финиш уже выбраны. Проверьте транспорт и запускайте построение маршрута.'
        : 'Выберите транспорт, затем поставьте старт и финиш кликом по карте или через адресные поля.';

  return (
    <ScrollView
      testID="filters-panel-scroll"
      style={styles.content}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      <View style={styles.filtersStatusCard} testID="filters-panel-status">
        <View style={styles.filtersStatusHeader}>
          <Text style={styles.filtersStatusTitle} numberOfLines={1}>{statusTitle}</Text>
          <View style={styles.filtersStatusBadge}>
            <Text style={styles.filtersStatusBadgeText}>{statusBadge}</Text>
          </View>
        </View>
        <Text style={styles.filtersStatusDescription} numberOfLines={isMobile ? 2 : undefined}>{statusDescription}</Text>
      </View>

      <View style={styles.sectionCard} testID="filters-block-main">
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
      </View>

      <View style={styles.sectionCard} testID="filters-block-map-tools">
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Управление картой</Text>
          <Text style={styles.blockHint}>
            Масштаб, слои и оверлеи.
          </Text>
        </View>
        <CollapsibleSection
          title="Инструменты карты"
          icon="sliders"
          defaultOpen={false}
          tone="flat"
        >
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
            withContainer={false}
          />
        </CollapsibleSection>
      </View>

      {mode === 'radius' && userLocation && onPlaceSelect && (
        <View style={styles.sectionCard} testID="filters-block-recommendations">
          <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Рядом с вами</Text>
          <Text style={styles.blockHint}>
              Ближайшие точки в текущем радиусе.
          </Text>
        </View>
          <QuickRecommendations
            places={travelsData}
            userLocation={userLocation}
            transportMode={transportMode}
            onPlaceSelect={onPlaceSelect}
            maxItems={3}
            radiusKm={filterValue.radius ? Number(filterValue.radius) : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
};

export default React.memo(FiltersPanelBody);
