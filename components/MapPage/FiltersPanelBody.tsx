import React, { useMemo } from 'react'
import { Platform, ScrollView, Text, View } from 'react-native'

import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations'
import FiltersPanelRadiusSection from '@/components/MapPage/FiltersPanelRadiusSection'
import FiltersPanelRouteSection from '@/components/MapPage/FiltersPanelRouteSection'
import Button from '@/components/ui/Button'
import { getCategoryName, type CategoryOption } from '@/components/MapPage/categoryName'
import type { RoutePoint } from '@/types/route'
import type { LatLng } from '@/types/coordinates'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'

const MOBILE_QUICK_CHIPS_LIMIT = 2
const RECOMMENDATIONS_MAX_ITEMS = 3

interface FiltersPanelBodyProps {
  colors: ThemedColors
  styles: any
  mode: 'radius' | 'route'
  filters: {
    categories: CategoryOption[]
    categoryTravelAddress: CategoryOption[]
    radius: { id: string; name: string }[]
    address: string
  }
  filterValue: {
    categories: CategoryOption[]
    categoryTravelAddress: CategoryOption[]
    radius: string
    address: string
    searchQuery?: string
  }
  travelsData: { categoryName?: string; name?: string; address?: string }[]
  overlayOptions?: { id: string; title: string }[]
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  mapUiApi?: MapUiApi | null
  isMobile: boolean
  totalPoints: number
  isBusy?: boolean
  hasFilters: boolean
  canBuildRoute: boolean
  onFilterChange: (field: string, value: any) => void
  onReset: () => void
  onOpenList?: () => void
  transportMode: 'car' | 'bike' | 'foot'
  setTransportMode: (mode: 'car' | 'bike' | 'foot') => void
  startAddress: string
  endAddress: string
  routingLoading?: boolean
  routingError?: string | boolean | null
  routeDistance?: number | null
  routeDuration?: number | null
  routeElevationGain?: number | null
  routeElevationLoss?: number | null
  routePoints: RoutePoint[]
  onRemoveRoutePoint: (id: string) => void
  onClearRoute?: () => void
  swapStartEnd?: () => void
  onRetryRoute?: () => void
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void
  onAddressClear?: (isStart: boolean) => void
  userLocation?: { latitude: number; longitude: number } | null
  onPlaceSelect?: (place: any) => void
}

const FiltersPanelBody: React.FC<FiltersPanelBodyProps> = ({
  colors,
  styles,
  mode,
  filters,
  filterValue,
  travelsData,
  isMobile,
  totalPoints,
  isBusy,
  hasFilters,
  onFilterChange,
  onReset,
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
  onRetryRoute,
  onAddressSelect,
  onAddressClear,
  userLocation,
  onPlaceSelect,
}) => {
  const selectedCategoryNames = useMemo(
    () =>
      (Array.isArray(filterValue.categoryTravelAddress) ? filterValue.categoryTravelAddress : [])
        .map(getCategoryName)
        .filter(Boolean),
    [filterValue.categoryTravelAddress],
  )

  const nextRadiusOption = useMemo(() => {
    const radiusOptions = Array.isArray(filters.radius) ? filters.radius : []
    const idx = radiusOptions.findIndex(
      (option) => String(option.id) === String(filterValue.radius),
    )
    if (idx < 0) return radiusOptions[0] ?? null
    return radiusOptions[idx + 1] ?? null
  }, [filterValue.radius, filters.radius])

  const noPointsInRadius = mode === 'radius' && totalPoints === 0
  // #211 — empty-state показываем только когда запрос завершён: иначе «Ничего не
  // нашлось» мигает во время рефетча/дебаунса (смена вкладок, режимов, первый фетч).
  const showEmptyState = noPointsInRadius && !isBusy

  const mobileQuickChips = useMemo(() => {
    if (!isMobile || mode !== 'radius') return []
    // #232 — чип «Поиск: <запрос>» НЕ добавляем: он дублировал содержимое
    // самого поля поиска (FiltersPanelRadiusSection). Оставляем только сводку
    // категорий, которой нет во входе поиска.
    const chips: string[] = []
    if (selectedCategoryNames.length > 0) {
      chips.push(
        selectedCategoryNames.length === 1
          ? selectedCategoryNames[0]
          : `Категорий: ${selectedCategoryNames.length}`,
      )
    }
    return chips.slice(0, MOBILE_QUICK_CHIPS_LIMIT)
  }, [isMobile, mode, selectedCategoryNames])

  const showMobileQuickRow = isMobile && mode === 'radius' && mobileQuickChips.length > 0
  const showRecommendations = mode === 'radius' && userLocation && onPlaceSelect

  return (
    <ScrollView
      testID="filters-panel-scroll"
      style={styles.content}
      showsVerticalScrollIndicator={Platform.OS !== 'web'}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {showMobileQuickRow && (
        <View testID="filters-mobile-context">
          <View style={styles.mobileFiltersQuickRow} testID="filters-mobile-quick-row">
            <View style={styles.mobileFiltersQuickChips}>
              {mobileQuickChips.map((chip) => (
                <View key={chip} style={styles.mobileFiltersQuickChip}>
                  <Text style={styles.mobileFiltersQuickChipText} numberOfLines={1}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          </View>
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
            isMobile={isMobile}
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
            onRetryRoute={onRetryRoute}
            onAddressSelect={onAddressSelect}
            onAddressClear={onAddressClear}
          />
        )}
      </View>

      {showEmptyState && (
        <View style={styles.noPointsToast} testID="filters-empty-state">
          <Text style={styles.noPointsTitle}>Ничего не нашлось</Text>
          <Text style={styles.noPointsSubtitle}>
            Попробуйте увеличить радиус или сбросить фильтры
          </Text>
          <View style={styles.noPointsActions}>
            {nextRadiusOption && (
              <Button
                label={`Увеличить до ${nextRadiusOption.name} км`}
                onPress={() => onFilterChange('radius', nextRadiusOption.id)}
                accessibilityLabel={`Увеличить радиус до ${nextRadiusOption.name} километров`}
                size="sm"
                style={styles.ctaButton}
              />
            )}
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

      {/* Слои/настройки карты в панель не встраиваем ни на мобиле, ни на десктопе:
          они доступны через плавающую иконку «Слои» на самой карте (мобильный
          верхний тулбар / десктопный floating-control), чтобы не дублировать
          контролы оверлеев в двух местах. */}

      {showRecommendations && (
        <View style={styles.sectionCard} testID="filters-block-recommendations">
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>
              {noPointsInRadius ? 'Попробуйте рядом с вами' : 'Рядом с вами'}
            </Text>
            <Text style={styles.blockHint}>
              {noPointsInRadius
                ? 'Если в текущих фильтрах пусто, покажем ближайшие удачные варианты без жёсткого ограничения по радиусу.'
                : 'Ближайшие точки в текущем радиусе.'}
            </Text>
          </View>
          <QuickRecommendations
            places={travelsData}
            userLocation={userLocation}
            transportMode={transportMode}
            onPlaceSelect={onPlaceSelect}
            maxItems={RECOMMENDATIONS_MAX_ITEMS}
            radiusKm={
              noPointsInRadius
                ? undefined
                : filterValue.radius
                  ? Number(filterValue.radius)
                  : undefined
            }
          />
        </View>
      )}
    </ScrollView>
  )
}

export default React.memo(FiltersPanelBody)
