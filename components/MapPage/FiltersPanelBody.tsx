import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings';
import FiltersPanelRadiusSection from '@/components/MapPage/FiltersPanelRadiusSection';
import FiltersPanelRouteSection from '@/components/MapPage/FiltersPanelRouteSection';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import Button from '@/components/ui/Button';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/types/mapUi';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

const getCategoryName = (category: CategoryOption) => {
  if (typeof category === 'string') return category.trim();
  if (category && typeof category === 'object' && typeof category.value === 'string') {
    return category.value.trim();
  }
  if (category && typeof category === 'object' && typeof category.name === 'string') {
    return category.name.trim();
  }
  return '';
};

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
    categoryTravelAddress: CategoryOption[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: CategoryOption[];
    categoryTravelAddress: CategoryOption[];
    radius: string;
    address: string;
    searchQuery?: string;
  };
  travelsData: { categoryName?: string; name?: string; address?: string }[];
  overlayOptions?: { id: string; title: string }[];
  enabledOverlays?: Record<string, boolean>;
  onOverlayToggle?: (id: string, enabled: boolean) => void;
  onResetOverlays?: () => void;
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
  overlayOptions,
  enabledOverlays,
  onOverlayToggle,
  onResetOverlays,
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
  const radiusOptions = useMemo(() => (Array.isArray(filters.radius) ? filters.radius : []), [filters.radius]);
  const selectedCategoryNames = useMemo(
    () =>
      (Array.isArray(filterValue.categoryTravelAddress) ? filterValue.categoryTravelAddress : [])
        .map(getCategoryName)
        .filter(Boolean),
    [filterValue.categoryTravelAddress]
  );
  const activeSummaryChips = useMemo(() => {
    if (mode === 'route') {
      const routeChips = [`Точек: ${routePoints.length}`];
      if (transportMode === 'car') routeChips.push('На машине');
      if (transportMode === 'bike') routeChips.push('На велосипеде');
      if (transportMode === 'foot') routeChips.push('Пешком');
      return routeChips;
    }

    const chips: string[] = [];
    const searchQuery = String(filterValue.searchQuery || '').trim();
    if (searchQuery) {
      chips.push(`Поиск: ${searchQuery}`);
    }
    if (selectedCategoryNames.length > 0) {
      const preview = selectedCategoryNames.slice(0, 2).join(', ');
      chips.push(
        selectedCategoryNames.length > 2
          ? `Что посмотреть: ${preview} +${selectedCategoryNames.length - 2}`
          : `Что посмотреть: ${preview}`
      );
    }
    return chips;
  }, [filterValue.searchQuery, mode, routePoints.length, selectedCategoryNames, transportMode]);
  const currentRadiusIndex = useMemo(
    () => radiusOptions.findIndex((option) => String(option.id) === String(filterValue.radius)),
    [filterValue.radius, radiusOptions]
  );
  const nextRadiusOption = useMemo(() => {
    if (currentRadiusIndex < 0) return radiusOptions[0] ?? null;
    return radiusOptions[currentRadiusIndex + 1] ?? null;
  }, [currentRadiusIndex, radiusOptions]);
  const showNearbyFallback = mode === 'radius' && totalPoints === 0;
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
      ? `${getPlacesLabel(totalPoints)} в радиусе ${radiusValue} км. Меняйте категории и радиус, чтобы сразу видеть новый результат.`
      : canBuildRoute
        ? 'Старт и финиш уже выбраны. Проверьте транспорт и запускайте построение маршрута.'
        : 'Выберите транспорт, затем поставьте старт и финиш кликом по карте или через адресные поля.';
  const mobileContextHint =
    mode === 'radius'
      ? activeSummaryChips.length > 0
        ? 'Активные фильтры уже применены. Можно сразу вернуться к результатам.'
        : 'Сейчас показаны все места в выбранном радиусе. Уточняйте выдачу по категориям и радиусу.'
      : routePoints.length > 0
        ? 'Точки маршрута уже выбраны. После проверки можно вернуться к списку мест.'
        : 'Соберите маршрут здесь, а затем вернитесь к выдаче и карте.';
  const openListButtonLabel = 'Результаты';

  return (
    <ScrollView
      testID="filters-panel-scroll"
      style={styles.content}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true}
    >
      {isMobile && (
        <View style={styles.mobileFiltersContextCard} testID="filters-mobile-context">
          {activeSummaryChips.length > 0 ? (
            <View style={styles.mobileFiltersContextChips}>
              {activeSummaryChips.map((chip) => (
                <View key={chip} style={styles.mobileFiltersContextChip}>
                  <Text style={styles.mobileFiltersContextChipText} numberOfLines={1}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.mobileFiltersContextHint}>{mobileContextHint}</Text>
          )}
          {onOpenList ? (
            <Button
              label={openListButtonLabel}
              onPress={onOpenList}
              size="sm"
              variant="outline"
              style={styles.mobileFiltersContextButton}
              testID="filters-mobile-open-results"
            />
          ) : null}
        </View>
      )}

      {mode === 'route' && !canBuildRoute && (
        <View style={styles.filtersStatusCard} testID="filters-panel-status">
          <View style={styles.filtersStatusHeader}>
            <Text style={styles.filtersStatusTitle} numberOfLines={1}>{statusTitle}</Text>
            <View style={styles.filtersStatusBadge}>
              <Text style={styles.filtersStatusBadgeText}>{statusBadge}</Text>
            </View>
          </View>
          <Text style={styles.filtersStatusDescription} numberOfLines={isMobile ? 2 : undefined}>{statusDescription}</Text>
        </View>
      )}

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

      {mode === 'radius' && totalPoints === 0 && (
        <View style={styles.noPointsToast} testID="filters-empty-state">
          <Text style={styles.noPointsTitle}>В этом радиусе пока ничего нет</Text>
          <Text style={styles.noPointsSubtitle}>
            Попробуйте расширить поиск или быстро сбросить фильтры, чтобы снова увидеть места на карте.
          </Text>
          <View style={styles.noPointsActions}>
            {nextRadiusOption ? (
              <Button
                label={`Увеличить до ${nextRadiusOption.name} км`}
                onPress={() => onFilterChange('radius', nextRadiusOption.id)}
                accessibilityLabel={`Увеличить радиус до ${nextRadiusOption.name} километров`}
                size="sm"
                style={styles.ctaButton}
              />
            ) : null}
            {hasFilters && (
              <Button
                label="Сбросить всё"
                onPress={onReset}
                accessibilityLabel="Сбросить фильтры"
                size="sm"
                variant="outline"
                style={styles.ctaButton}
              />
            )}
          </View>
        </View>
      )}

      <View style={styles.sectionCard} testID="filters-block-map-tools">
        <CollapsibleSection
          title="Управление картой"
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
            overlayOptions={overlayOptions}
            enabledOverlays={enabledOverlays}
            onOverlayToggle={onOverlayToggle}
            onResetOverlays={onResetOverlays}
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
            <Text style={styles.blockTitle}>
              {showNearbyFallback ? 'Попробуйте рядом с вами' : 'Рядом с вами'}
            </Text>
            <Text style={styles.blockHint}>
              {showNearbyFallback
                ? 'Если в текущих фильтрах пусто, покажем ближайшие удачные варианты без жёсткого ограничения по радиусу.'
                : 'Ближайшие точки в текущем радиусе.'}
            </Text>
          </View>
          <QuickRecommendations
            places={travelsData}
            userLocation={userLocation}
            transportMode={transportMode}
            onPlaceSelect={onPlaceSelect}
            maxItems={3}
            radiusKm={showNearbyFallback ? undefined : filterValue.radius ? Number(filterValue.radius) : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
};

export default React.memo(FiltersPanelBody);
