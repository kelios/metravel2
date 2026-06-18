/**
 * useMapMobileDerivations - derived memoized values for MapMobileLayout.
 * Pure: no side effects, no refs.
 */
import { useMemo } from 'react'

import { formatPlaces } from '@/utils/pluralize'

type FiltersMode = 'radius' | 'route' | undefined

interface FiltersContextShape {
  filterValue?: {
    radius?: string
    categoryTravelAddress?: unknown
    [key: string]: unknown
  }
  filters?: {
    radius?: ReadonlyArray<{ id: string; name: string }>
    categoryTravelAddress?: ReadonlyArray<unknown>
    [key: string]: unknown
  }
  overlayOptions?: ReadonlyArray<{ id: string; title: string }>
  enabledOverlays?: Record<string, boolean>
  routePoints?: ReadonlyArray<unknown>
  routingLoading?: boolean
  routeDistance?: number | null
  [key: string]: unknown
}

export interface MapMobileCategoryChip {
  id: string
  name: string
  selected: boolean
}

export interface MapMobileDerivations {
  quickRadiusValue: string
  quickCategoriesValue: string
  quickOverlaysValue: string
  activeRadius: string
  quickFilterSelected: string[]
  quickRadiusOptions: ReadonlyArray<{ id: string; name: string }>
  quickCategoryOptions: ReadonlyArray<unknown>
  quickOverlayOptions: ReadonlyArray<{ id: string; title: string }>
  quickEnabledOverlays: Record<string, boolean>
  selectedCategories: string[]
  canBuildRoute: boolean
  routingLoading: boolean
  routeDistance: number | null | undefined
  routePointsCount: number
  filterToolbarSummary: string
  panelTabsOptions: Array<{ key: string; label: string; icon?: string }>
  /** Chips for the top overlay: selected categories first, then a few popular. */
  topCategoryChips: MapMobileCategoryChip[]
  /** True when more categories exist than shown in the chips row. */
  hasMoreCategories: boolean
}

/** How many category chips to surface in the top overlay before "Ещё…". */
const TOP_CATEGORY_CHIP_LIMIT = 8

export function useMapMobileDerivations(
  filtersContextProps: FiltersContextShape | undefined | null,
  filtersMode: FiltersMode,
  travelsData: ReadonlyArray<unknown>,
  isNarrow: boolean,
): MapMobileDerivations {
  const canBuildRoute = useMemo(() => {
    if (filtersMode !== 'route') return false
    const points = filtersContextProps?.routePoints
    return Array.isArray(points) && points.length >= 2
  }, [filtersMode, filtersContextProps?.routePoints])

  const routingLoading = Boolean(filtersContextProps?.routingLoading)
  const routeDistance = filtersContextProps?.routeDistance as
    | number
    | null
    | undefined
  const routePointsCount = Array.isArray(filtersContextProps?.routePoints)
    ? filtersContextProps!.routePoints!.length
    : 0
  const activeRadius = filtersContextProps?.filterValue?.radius || '60'

  const quickFilterSelected = useMemo<string[]>(
    () =>
      (filtersContextProps?.filterValue?.categoryTravelAddress as
        | string[]
        | undefined) ?? [],
    [filtersContextProps?.filterValue?.categoryTravelAddress],
  )
  const quickRadiusOptions = useMemo(
    () => filtersContextProps?.filters?.radius ?? [],
    [filtersContextProps?.filters?.radius],
  )
  const quickCategoryOptions = useMemo(
    () => filtersContextProps?.filters?.categoryTravelAddress ?? [],
    [filtersContextProps?.filters?.categoryTravelAddress],
  )
  const quickOverlayOptions = useMemo(
    () => filtersContextProps?.overlayOptions ?? [],
    [filtersContextProps?.overlayOptions],
  )
  const quickEnabledOverlays = useMemo(
    () => filtersContextProps?.enabledOverlays ?? {},
    [filtersContextProps?.enabledOverlays],
  )
  const categoryTravelAddress = filtersContextProps?.filterValue
    ?.categoryTravelAddress
  const selectedCategories = useMemo(
    () =>
      Array.isArray(categoryTravelAddress)
        ? (categoryTravelAddress as unknown[])
            .map((value: unknown) => String(value ?? '').trim())
            .filter(Boolean)
        : [],
    [categoryTravelAddress],
  )
  const quickRadiusValue = useMemo(() => {
    if (!activeRadius) return 'Выбор'
    return `${activeRadius} км`
  }, [activeRadius])
  const quickCategoriesValue = useMemo(() => {
    if (quickFilterSelected.length === 0) return 'Все'
    if (quickFilterSelected.length === 1) return quickFilterSelected[0]
    return `${quickFilterSelected.length} выбрано`
  }, [quickFilterSelected])
  const quickOverlaysValue = useMemo(() => {
    const enabledCount = quickOverlayOptions.filter(
      (option: { id: string }) => Boolean(quickEnabledOverlays?.[option.id]),
    ).length
    if (enabledCount === 0) return 'Выкл'
    if (enabledCount === 1) return '1 вкл'
    return `${enabledCount} вкл`
  }, [quickEnabledOverlays, quickOverlayOptions])

  const filterToolbarSummary = useMemo(() => {
    if (filtersMode === 'route') {
      if (routingLoading) return 'Маршрут обновляется'
      if (canBuildRoute && routeDistance != null)
        return 'Маршрут готов, можно открыть список мест'
      return routePointsCount > 0
        ? `Выбрано ${routePointsCount} из 2 точек`
        : 'Отметьте на карте старт и финиш'
    }

    // Радиус намеренно НЕ дублируем в сводке: он уже показан отдельным
    // тап-чипом «N км» в ряду чипов и (на native) плавающей пилюлей на карте.
    const parts = [
      travelsData.length > 999 ? '999+ мест' : formatPlaces(travelsData.length),
    ]

    if (selectedCategories.length === 1) {
      parts.push(selectedCategories[0]!)
    } else if (selectedCategories.length > 1) {
      parts.push(`${selectedCategories.length} кат.`)
    }

    return parts.join(' · ')
  }, [
    canBuildRoute,
    filtersMode,
    routeDistance,
    routePointsCount,
    routingLoading,
    selectedCategories,
    travelsData.length,
  ])

  // Top-overlay chips: selected categories first (so the active filter is always
  // visible), then fill up to the limit with the remaining options.
  const topCategoryChips = useMemo<MapMobileCategoryChip[]>(() => {
    const options = (quickCategoryOptions as ReadonlyArray<{ id: unknown; name: unknown }>) ?? []
    const selectedSet = new Set(quickFilterSelected.map((v) => String(v)))

    const normalized = options
      .map((opt) => ({
        id: String(opt?.id ?? '').trim(),
        name: String(opt?.name ?? '').trim(),
      }))
      .filter((opt) => opt.id && opt.name)

    const selected = normalized
      .filter((opt) => selectedSet.has(opt.id))
      .map((opt) => ({ ...opt, selected: true }))

    const rest = normalized
      .filter((opt) => !selectedSet.has(opt.id))
      .map((opt) => ({ ...opt, selected: false }))

    return [...selected, ...rest].slice(0, TOP_CATEGORY_CHIP_LIMIT)
  }, [quickCategoryOptions, quickFilterSelected])

  const hasMoreCategories = useMemo(() => {
    const total = Array.isArray(quickCategoryOptions)
      ? quickCategoryOptions.length
      : 0
    return total > topCategoryChips.length
  }, [quickCategoryOptions, topCategoryChips.length])

  // Stage 1: only two tabs — Места и Маршрут. Фильтры/поиск открываются
  // отдельной кнопкой-иконкой, а не вкладкой (решает усечение «Маршрут»).
  const panelTabsOptions = useMemo(
    () => [
      { key: 'list', label: 'Места', icon: isNarrow ? undefined : 'list' },
      {
        key: 'route',
        label: 'Маршрут',
        icon: isNarrow ? undefined : 'alt-route',
      },
    ],
    [isNarrow],
  )

  return {
    quickRadiusValue,
    quickCategoriesValue,
    quickOverlaysValue,
    activeRadius,
    quickFilterSelected,
    quickRadiusOptions,
    quickCategoryOptions,
    quickOverlayOptions,
    quickEnabledOverlays,
    selectedCategories,
    canBuildRoute,
    routingLoading,
    routeDistance,
    routePointsCount,
    filterToolbarSummary,
    panelTabsOptions,
    topCategoryChips,
    hasMoreCategories,
  }
}
