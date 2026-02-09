// FiltersPanel.tsx
import React from 'react';
import { View, Platform, UIManager } from 'react-native';
import FiltersPanelFooter from '@/components/MapPage/FiltersPanelFooter';
import FiltersPanelHeader from '@/components/MapPage/FiltersPanelHeader';
import FiltersPanelBody from '@/components/MapPage/FiltersPanelBody';
import useFiltersPanelModel from '@/components/MapPage/useFiltersPanelModel';
import { useFiltersContext } from '@/context/MapFiltersContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Simplified FiltersPanel - uses FiltersContext instead of props
 *
 * Props reduced from 30+ to just visibility flags.
 * All state comes from FiltersContext.
 *
 * @example
 * ```typescript
 * <FiltersProvider filters={...} filterValue={...} ...>
 *   <FiltersPanel hideTopControls={false} />
 * </FiltersProvider>
 * ```
 */
interface FiltersPanelProps {
  hideTopControls?: boolean;
  hideFooterCta?: boolean;
  hideFooterReset?: boolean;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  hideTopControls = false,
  hideFooterCta = false,
  hideFooterReset = false,
}) => {
  // Get all state from context (instead of props)
  const {
    filters,
    filterValue,
    onFilterChange,
    resetFilters,
    travelsData,
    filteredTravelsData,
    isMobile,
    closeMenu,
    mode,
    setMode,
    transportMode,
    setTransportMode,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    routePoints,
    onRemoveRoutePoint,
    onClearRoute,
    routeHintDismissed,
    onRouteHintDismiss,
    onAddressSelect,
    onAddressClear,
    routingLoading,
    routingError,
    onBuildRoute,
    mapUiApi,
    userLocation,
    onPlaceSelect,
    onOpenList,
  } = useFiltersContext();
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
          routeDuration={routeDuration}
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
        routingLoading={routingLoading}
        routingError={routingError}
        routeDistance={routeDistance}
        routeDuration={routeDuration}
        routeElevationGain={routeElevationGain}
        routeElevationLoss={routeElevationLoss}
        routePoints={routePoints}
        onRemoveRoutePoint={safeRemoveRoutePoint}
        onClearRoute={onClearRoute}
        onAddressSelect={onAddressSelect}
        onAddressClear={onAddressClear}
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
          totalPoints={totalPoints}
        />
      )}
    </View>
  );
};

export default React.memo(FiltersPanel);
