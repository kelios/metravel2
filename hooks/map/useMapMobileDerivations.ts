/**
 * useMapMobileDerivations - derived memoized values for MapMobileLayout.
 * Pure: no side effects, no refs.
 */
import { useMemo } from 'react'

import { formatPlaces } from '@/utils/pluralize'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { translate as i18nT } from '@/i18n'


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
  const activeRadius = filtersContextProps?.filterValue?.radius || String(DEFAULT_RADIUS_KM)

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
    if (!activeRadius) return i18nT('map:hooks.map.useMapMobileDerivations.vybor_9b7adb0c')
    return i18nT('map:hooks.map.useMapMobileDerivations.value1_km_1378ad0e', { value1: activeRadius })
  }, [activeRadius])
  const quickCategoriesValue = useMemo(() => {
    if (quickFilterSelected.length === 0) return i18nT('map:hooks.map.useMapMobileDerivations.vse_514353e4')
    if (quickFilterSelected.length === 1) return quickFilterSelected[0]
    return i18nT('map:hooks.map.useMapMobileDerivations.value1_vybrano_575ea4fd', { value1: quickFilterSelected.length })
  }, [quickFilterSelected])
  const quickOverlaysValue = useMemo(() => {
    const enabledCount = quickOverlayOptions.filter(
      (option: { id: string }) => Boolean(quickEnabledOverlays?.[option.id]),
    ).length
    if (enabledCount === 0) return i18nT('map:hooks.map.useMapMobileDerivations.vykl_f3a04629')
    if (enabledCount === 1) return i18nT('map:hooks.map.useMapMobileDerivations.1_vkl_d23f2fde')
    return i18nT('map:hooks.map.useMapMobileDerivations.value1_vkl_2f6b677c', { value1: enabledCount })
  }, [quickEnabledOverlays, quickOverlayOptions])

  const filterToolbarSummary = useMemo(() => {
    if (filtersMode === 'route') {
      if (routingLoading) return i18nT('map:hooks.map.useMapMobileDerivations.marshrut_obnovlyaetsya_a8a3d750')
      if (canBuildRoute && routeDistance != null)
        return i18nT('map:hooks.map.useMapMobileDerivations.marshrut_gotov_mozhno_otkryt_spisok_mest_cb473cc6')
      return routePointsCount > 0
        ? i18nT('map:hooks.map.useMapMobileDerivations.vybrano_value1_iz_2_tochek_6e4e2d24', { value1: routePointsCount })
        : i18nT('map:hooks.map.useMapMobileDerivations.otmette_na_karte_start_i_finish_a420b96f')
    }

    // Радиус намеренно НЕ дублируем в сводке: он уже показан отдельным
    // тап-чипом «N км» в ряду чипов и (на native) плавающей пилюлей на карте.
    const parts = [
      travelsData.length > 999 ? i18nT('map:hooks.map.useMapMobileDerivations.999_mest_c3798c1b') : formatPlaces(travelsData.length),
    ]

    if (selectedCategories.length === 1) {
      parts.push(selectedCategories[0]!)
    } else if (selectedCategories.length > 1) {
      parts.push(i18nT('map:hooks.map.useMapMobileDerivations.value1_kat_0f8b43c6', { value1: selectedCategories.length }))
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

  // Top-overlay chips: STABLE order — chips keep their position regardless of
  // selection (#230). Reordering selected-first made the row "jump" and made it
  // hard to re-tap a chip to toggle it off. Selection is shown by highlight only.
  const topCategoryChips = useMemo<MapMobileCategoryChip[]>(() => {
    const options = (quickCategoryOptions as ReadonlyArray<{ id: unknown; name: unknown }>) ?? []
    const selectedSet = new Set(quickFilterSelected.map((v) => String(v)))

    return options
      .map((opt) => ({
        id: String(opt?.id ?? '').trim(),
        name: String(opt?.name ?? '').trim(),
      }))
      .filter((opt) => opt.id && opt.name)
      .slice(0, TOP_CATEGORY_CHIP_LIMIT)
      .map((opt) => ({ ...opt, selected: selectedSet.has(opt.id) }))
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
      { key: 'list', label: i18nT('map:hooks.map.useMapMobileDerivations.mesta_23f3aec0'), icon: isNarrow ? undefined : 'list' },
      {
        key: 'route',
        label: i18nT('map:hooks.map.useMapMobileDerivations.marshrut_c71f4ede'),
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
