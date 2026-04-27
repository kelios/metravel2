import { Platform } from 'react-native'
import { BREAKPOINTS } from './utils/listTravelConstants'
import { calculateColumns } from './utils/listTravelHelpers'

type ResponsiveParams = {
  isDesktopSize: boolean
  isLargePhone: boolean
  isPhone: boolean
  isPortrait: boolean
  isTabletSize: boolean
  isTestEnv: boolean
  rawWidth: number
}

type ViewportState = {
  contentPadding: number
  effectiveWidth: number
  gapSize: number
  gridColumns: number
  isCardsSingleColumn: boolean
  isDesktop: boolean
  isMobileDevice: boolean
  isTablet: boolean
  resolvedIsPortrait: boolean
  sidebarWidth: number
  usesOverlaySidebar: boolean
  width: number
}

type SearchParams = {
  categories?: string | string[]
  category__travel__address?: string | string[]
  category_travel_address?: string | string[]
  categoryTravelAddress?: string | string[]
  companions?: string | string[]
  complexity?: string | string[]
  month?: string | string[]
  over__nights__stay?: string | string[]
  over_nights_stay?: string | string[]
  search?: string | string[]
  sort?: string | string[]
}

export function normalizeListTravelParam(value?: string | string[]) {
  if (Array.isArray(value)) return value.filter(Boolean).join(',')
  return value
}

export function buildListTravelInitialFilter(params: SearchParams) {
  const filter: Record<string, any> = {}
  const categories = normalizeListTravelParam(params.categories)
  const companions = normalizeListTravelParam(params.companions)
  const complexity = normalizeListTravelParam(params.complexity)
  const month = normalizeListTravelParam(params.month)
  const sort = normalizeListTravelParam(params.sort)
  const overNightsStay = normalizeListTravelParam(params.over_nights_stay ?? params.over__nights__stay)
  const categoryTravelAddress = normalizeListTravelParam(
    params.categoryTravelAddress ?? params.category_travel_address ?? params.category__travel__address,
  )

  if (categories) filter.categories = categories.split(',').map(Number).filter(Boolean)
  if (overNightsStay) filter.over_nights_stay = overNightsStay.split(',').map(Number).filter(Boolean)
  if (categoryTravelAddress) {
    filter.categoryTravelAddress = categoryTravelAddress.split(',').map(Number).filter(Boolean)
  }
  if (sort) filter.sort = sort
  if (companions) filter.companions = companions.split(',').map(Number).filter(Boolean)
  if (complexity) filter.complexity = complexity.split(',').map(Number).filter(Boolean)
  if (month) filter.month = month.split(',').map(Number).filter(Boolean)

  return Object.keys(filter).length > 0 ? filter : undefined
}

export function getListTravelViewportState(params: ResponsiveParams): ViewportState {
  const effectiveResponsiveWidth =
    Platform.OS === 'web' && !params.isTestEnv && typeof window !== 'undefined'
      ? window.innerWidth
      : params.rawWidth
  const effectiveResponsiveHeight =
    Platform.OS === 'web' && !params.isTestEnv && typeof window !== 'undefined'
      ? window.innerHeight
      : 0
  const resolvedIsPortrait =
    Platform.OS === 'web' && !params.isTestEnv && typeof window !== 'undefined'
      ? effectiveResponsiveHeight > effectiveResponsiveWidth
      : params.isPortrait
  const isMobileDevice =
    Platform.OS === 'web'
      ? effectiveResponsiveWidth < BREAKPOINTS.TABLET
      : params.isPhone || params.isLargePhone || (params.isTabletSize && resolvedIsPortrait)
  const usesOverlaySidebar =
    Platform.OS === 'web'
      ? effectiveResponsiveWidth < BREAKPOINTS.DESKTOP
      : isMobileDevice
  const isTablet =
    Platform.OS === 'web'
      ? effectiveResponsiveWidth >= BREAKPOINTS.TABLET && effectiveResponsiveWidth < BREAKPOINTS.DESKTOP
      : params.isTabletSize
  const isDesktop =
    Platform.OS === 'web'
      ? effectiveResponsiveWidth >= BREAKPOINTS.DESKTOP
      : params.isDesktopSize

  const width = effectiveResponsiveWidth
  const isCardsSingleColumn = width < BREAKPOINTS.MOBILE

  // Adaptive sidebar width: smoothly scales with viewport so the panel fits
  // narrow desktops (~1440px) without crowding the cards grid, and gets a bit
  // more breathing room on wide monitors.
  const sidebarWidth = usesOverlaySidebar
    ? 0
    : Math.round(Math.min(340, Math.max(260, width * 0.2)))

  // Compact web widths use overlay filters; the docked sidebar appears from desktop widths.
  const effectiveWidth = !usesOverlaySidebar ? width - sidebarWidth : width

  // Gap is based on effectiveWidth (content area) so it stays proportional
  // when sidebar appears/disappears at the 1024px threshold
  const gapSize =
    effectiveWidth < BREAKPOINTS.XS
      ? 6
      : effectiveWidth < BREAKPOINTS.SM
        ? 8
        : effectiveWidth < BREAKPOINTS.MOBILE
          ? 10
          : effectiveWidth < BREAKPOINTS.TABLET
            ? 12
            : effectiveWidth < BREAKPOINTS.DESKTOP
              ? 14
              : 16
  const contentPadding =
    effectiveWidth < BREAKPOINTS.XS
      ? 8
      : effectiveWidth < BREAKPOINTS.SM
        ? 10
        : effectiveWidth < BREAKPOINTS.MOBILE
          ? 12
          : effectiveWidth < BREAKPOINTS.TABLET
            ? 12
            : effectiveWidth < BREAKPOINTS.DESKTOP
              ? 14
              : effectiveWidth < BREAKPOINTS.DESKTOP_LARGE
                ? 16
                : 20

  let gridColumns: number
  if (isCardsSingleColumn) {
    gridColumns = 1
  } else if (usesOverlaySidebar) {
    gridColumns = calculateColumns(width, resolvedIsPortrait ? 'portrait' : 'landscape')
  } else if (!isTablet || !resolvedIsPortrait) {
    gridColumns = calculateColumns(effectiveWidth, 'landscape')
  } else {
    gridColumns = calculateColumns(effectiveWidth, 'portrait')
  }

  // On large desktop (>=1920px content area) allow 4 columns for compact layout
  if (!usesOverlaySidebar && effectiveWidth >= BREAKPOINTS.DESKTOP_LARGE) {
    gridColumns = Math.min(gridColumns, 4)
  } else if (!usesOverlaySidebar && effectiveWidth >= BREAKPOINTS.DESKTOP) {
    gridColumns = Math.min(gridColumns, 3)
  }

  return {
    contentPadding,
    effectiveWidth,
    gapSize,
    gridColumns,
    isCardsSingleColumn,
    isDesktop,
    isMobileDevice,
    isTablet,
    resolvedIsPortrait,
    sidebarWidth,
    usesOverlaySidebar,
    width,
  }
}

export function getListTravelActiveFiltersCount(filter: Record<string, any>, debSearch: string) {
  let count = 0
  const filterKeys = [
    'categories',
    'transports',
    'categoryTravelAddress',
    'companions',
    'complexity',
    'month',
    'over_nights_stay',
  ] as const

  for (const key of filterKeys) {
    const value = filter[key]
    if (Array.isArray(value) && value.length > 0) {
      count += value.length
    }
  }

  if (filter.year) count += 1
  if (filter.sort) count += 1
  if (filter.moderation !== undefined) count += 1
  if (debSearch && debSearch.trim().length > 0) count += 1

  return count
}
