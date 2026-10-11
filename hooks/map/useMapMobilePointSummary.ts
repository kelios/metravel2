import { useCallback, useMemo } from 'react'
import { formatRadiusValue } from '@/constants/mapConfig'
import { translate as i18nT } from '@/i18n'
import { formatPlaceCountBadge, getPlacesLabel } from '@/components/MapPage/TravelListPanel/helpers'
import { getNextRadiusOption, shouldShowMapEmptyState } from '@/components/MapPage/mapEmptyState'
import { isMapFilterChipsRowVisible } from '@/components/MapPage/mapFilterChips'
import { qualifyMapPointCount, type MapPointCountScope } from '@/utils/mapPointCount'

interface PointSummaryParams {
  activeRadius: string
  totalCount?: number
  loadedCount: number
  filtersContextProps?: {
    filterValue?: { radius?: string }
    filters?: { radius?: { id: string; name: string }[] }
    resultsTotalScope?: MapPointCountScope
    isBusy?: boolean
    onFilterChange?: (field: string, value: unknown) => void
  } | null
  routeMode: 'radius' | 'route'
  sheetState: string
  hasSelectedPlace: boolean
  activePopover: string | null
  activeFilterItems?: ReadonlyArray<{ key: string; label: string }>
  onRemoveActiveFilter?: (key: string) => void
  onShowAllPlaces?: () => void
}

/** Existing mobile summary/chip model, shared by every map engine. */
export function useMapMobilePointSummary({
  activeRadius, totalCount, loadedCount, filtersContextProps,
  routeMode, sheetState, hasSelectedPlace, activePopover,
  activeFilterItems, onRemoveActiveFilter, onShowAllPlaces,
}: PointSummaryParams) {
  const radiusBadge = useMemo(() => {
    const n = Number(activeRadius)
    return Number.isFinite(n) && n > 0 ? String(n) : ''
  }, [activeRadius])
  const displayCount = totalCount ?? loadedCount
  const listBadge = useMemo(() => {
    if (!displayCount) return ''
    return formatPlaceCountBadge(displayCount)
  }, [displayCount])
  const currentRadiusKm = filtersContextProps?.filterValue?.radius ?? null
  const totalScope = filtersContextProps?.resultsTotalScope ?? (totalCount == null ? 'loaded' : 'radius')
  const listHeaderSummaryText = useMemo(() => {
    const countLabel = formatPlaceCountBadge(displayCount)
    const hasRadiusContext = currentRadiusKm != null && String(currentRadiusKm).trim() !== ''
    const summary = hasRadiusContext
      ? i18nT('map:components.MapPage.MapMobileLayout.value1_km_9e970651', {
          value1: countLabel, value2: getPlacesLabel(displayCount), value3: formatRadiusValue(currentRadiusKm),
        })
      : `${countLabel} ${getPlacesLabel(displayCount)}`
    return qualifyMapPointCount(summary, totalScope)
  }, [currentRadiusKm, displayCount, totalScope])

  const onFilterChange = filtersContextProps?.onFilterChange
  const handleRadiusSelect = useCallback(
    (id: string) => { onFilterChange?.('radius', id) }, [onFilterChange],
  )
  const radiusOptions = filtersContextProps?.filters?.radius
  const nextRadiusOption = useMemo(
    () => getNextRadiusOption(radiusOptions, currentRadiusKm), [radiusOptions, currentRadiusKm],
  )
  const showEmptyStateToast = shouldShowMapEmptyState({
    mode: routeMode === 'route' ? 'route' : 'radius',
    totalPoints: displayCount,
    isBusy: Boolean(filtersContextProps?.isBusy),
  }) && sheetState === 'collapsed' && !hasSelectedPlace && !activePopover
  const handleExpandRadiusFromToast = useCallback(
    (radiusId: string) => { onFilterChange?.('radius', radiusId) }, [onFilterChange],
  )
  const activeFiltersRowVisible = isMapFilterChipsRowVisible({
    mode: routeMode, items: activeFilterItems, canRemove: !!onRemoveActiveFilter,
  })
  const showAllPlacesButton = activeFiltersRowVisible ? undefined : onShowAllPlaces
  return {
    radiusBadge, listBadge, listHeaderSummaryText, handleRadiusSelect,
    nextRadiusOption, showEmptyStateToast, handleExpandRadiusFromToast, showAllPlacesButton,
  }
}
