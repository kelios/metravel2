/**
 * useMapMobileDerivations - derived memoized values for MapMobileLayout.
 * Pure: no side effects, no refs.
 */
import { useMemo } from 'react'

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
}

export function useMapMobileDerivations(
  filtersContextProps: FiltersContextShape | undefined | null,
  filtersMode: FiltersMode,
  travelsData: ReadonlyArray<unknown>,
  isVeryNarrow: boolean,
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
        return 'Маршрут готов, можно открыть список точек'
      return routePointsCount > 0
        ? `Выбрано ${routePointsCount} из 2 точек`
        : 'Выберите старт и финиш кликом по карте'
    }

    const parts = [
      `${travelsData.length > 999 ? '999+' : travelsData.length} мест`,
      `${activeRadius} км`,
    ]

    if (selectedCategories.length === 1) {
      parts.push(selectedCategories[0]!)
    } else if (selectedCategories.length > 1) {
      parts.push(`${selectedCategories.length} кат.`)
    }

    return parts.join(' · ')
  }, [
    activeRadius,
    canBuildRoute,
    filtersMode,
    routeDistance,
    routePointsCount,
    routingLoading,
    selectedCategories,
    travelsData.length,
  ])

  const panelTabsOptions = useMemo(
    () => [
      {
        key: 'search',
        label: 'Поиск',
        icon: isVeryNarrow ? undefined : 'search',
      },
      {
        key: 'route',
        label: 'Маршрут',
        icon: isVeryNarrow ? undefined : 'alt-route',
      },
      { key: 'list', label: 'Точки', icon: isVeryNarrow ? undefined : 'list' },
    ],
    [isVeryNarrow],
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
  }
}
