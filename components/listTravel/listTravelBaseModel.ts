import { Platform } from 'react-native'
import type { ViewStyle } from 'react-native'
import { BREAKPOINTS } from './utils/listTravelConstants'
import { calculateColumns } from './utils/listTravelHelpers'

export function buildCardsGridDynamicStyle(cardsGridStyle: ViewStyle, gapSize: number): ViewStyle[] {
  const styleArray: ViewStyle[] = [cardsGridStyle]

  if (Platform.OS === 'web') {
    styleArray.push({
      gap: gapSize,
      rowGap: gapSize,
      columnGap: gapSize,
    })
  } else {
    styleArray.push({
      marginHorizontal: -(gapSize / 2),
    })
  }

  return styleArray
}

export function getSearchCardImageHeight(effectiveWidth: number): number {
  if (effectiveWidth < BREAKPOINTS.MOBILE) return 220
  if (effectiveWidth < BREAKPOINTS.TABLET) return 240
  if (effectiveWidth < BREAKPOINTS.DESKTOP) return 270
  return 300
}

export type ListDensityMode = 'comfortable' | 'compact'

/**
 * Compact density packs more cards per viewport: single-column mobile layouts
 * switch to a 2-up grid and multi-column layouts gain one extra column. Image
 * height is reduced so each card takes less vertical room.
 */
export function applyListDensity(
  base: {
    gridColumns: number
    isCardsSingleColumn: boolean
    imageHeight: number
  },
  density: ListDensityMode,
): { gridColumns: number; isCardsSingleColumn: boolean; imageHeight: number } {
  if (density !== 'compact') return base

  if (base.isCardsSingleColumn) {
    return {
      gridColumns: 2,
      isCardsSingleColumn: false,
      imageHeight: Math.max(140, Math.round(base.imageHeight * 0.62)),
    }
  }

  return {
    gridColumns: Math.min(base.gridColumns + 1, 4),
    isCardsSingleColumn: false,
    imageHeight: Math.max(150, Math.round(base.imageHeight * 0.78)),
  }
}

export function getSearchCardWidth({
  effectiveWidth,
  gapSize,
  gridColumns,
  contentPadding,
}: {
  effectiveWidth: number
  gapSize: number
  gridColumns: number
  contentPadding: number
}): number | undefined {
  if (Platform.OS !== 'web') return undefined

  const columns = Math.max(gridColumns, 1)
  const totalGap = gapSize * Math.max(columns - 1, 0)
  const paddedWidth = effectiveWidth - contentPadding * 2
  const resolvedWidth = (paddedWidth - totalGap) / columns

  return Number.isFinite(resolvedWidth) && resolvedWidth > 0 ? Math.round(resolvedWidth) : undefined
}

type ResponsiveParams = {
  isDesktopSize: boolean
  isLargePhone: boolean
  isPhone: boolean
  isPortrait: boolean
  isTabletSize: boolean
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

export type TravelFallbackStep = {
  id: 'light' | 'medium' | 'broad' | 'searchless'
  label: string
  params: Record<string, any>
  removedKeys: string[]
  search: string
}

const FALLBACK_RELAXATION_PRESETS: Array<{
  id: TravelFallbackStep['id']
  label: string
  removedKeys: string[]
  resetSearch?: boolean
}> = [
  {
    id: 'light',
    label: 'Ослабили часть уточняющих фильтров',
    removedKeys: ['year', 'month', 'over_nights_stay', 'companions', 'complexity'],
  },
  {
    id: 'medium',
    label: 'Убрали самые узкие уточнения и объекты',
    removedKeys: ['year', 'month', 'over_nights_stay', 'companions', 'complexity', 'transports', 'categoryTravelAddress'],
  },
  {
    id: 'broad',
    label: 'Оставили только самые общие условия',
    removedKeys: [
      'year',
      'month',
      'over_nights_stay',
      'companions',
      'complexity',
      'transports',
      'categoryTravelAddress',
      'categories',
      'countries',
    ],
  },
  {
    id: 'searchless',
    label: 'Убрали текстовый запрос и оставили похожие маршруты',
    removedKeys: [
      'year',
      'month',
      'over_nights_stay',
      'companions',
      'complexity',
      'transports',
      'categoryTravelAddress',
      'categories',
      'countries',
    ],
    resetSearch: true,
  },
]

const sortObjectKeys = (obj: Record<string, any>) => {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, any>>((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {})
}

const removeKeysFromParams = (params: Record<string, any>, keysToRemove: string[]) => {
  const blockedKeys = new Set(keysToRemove)
  return sortObjectKeys(
    Object.entries(params).reduce<Record<string, any>>((acc, [key, value]) => {
      if (blockedKeys.has(key)) return acc
      acc[key] = value
      return acc
    }, {}),
  )
}

const areFallbackInputsEqual = ({
  baseParams,
  nextParams,
  baseSearch,
  nextSearch,
}: {
  baseParams: Record<string, any>
  nextParams: Record<string, any>
  baseSearch: string
  nextSearch: string
}) => JSON.stringify(baseParams) === JSON.stringify(nextParams) && baseSearch === nextSearch

export function normalizeListTravelParam(value?: string | string[]) {
  if (Array.isArray(value)) return value.filter(Boolean).join(',')
  return value
}

export function buildListTravelFallbackSteps({
  queryParams,
  search,
}: {
  queryParams: Record<string, any>
  search: string
}): TravelFallbackStep[] {
  const normalizedParams = sortObjectKeys(queryParams || {})
  const normalizedSearch = String(search || '').trim()
  const steps: TravelFallbackStep[] = []

  FALLBACK_RELAXATION_PRESETS.forEach((preset) => {
    const params = removeKeysFromParams(normalizedParams, preset.removedKeys)
    const nextSearch = preset.resetSearch ? '' : normalizedSearch

    if (
      areFallbackInputsEqual({
        baseParams: normalizedParams,
        nextParams: params,
        baseSearch: normalizedSearch,
        nextSearch,
      })
    ) {
      return
    }

    const duplicate = steps.some((step) =>
      areFallbackInputsEqual({
        baseParams: step.params,
        nextParams: params,
        baseSearch: step.search,
        nextSearch,
      }),
    )
    if (duplicate) return

    steps.push({
      id: preset.id,
      label: preset.label,
      params,
      removedKeys: preset.removedKeys,
      search: nextSearch,
    })
  })

  return steps
}

const parseIdOrNameList = (raw: string): Array<number | string> =>
  raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => (/^\d+$/.test(token) ? Number(token) : token))

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

  // Категории в deep-link могут прийти как числовые id (?categories=1,5) или как имя
  // (?categoryTravelAddress=Озеро) — тап по чипу категории на странице путешествия ведёт
  // сюда по имени. Числовые токены оставляем числами, нечисловые — как имя-строку;
  // useListTravelFilters домапит имя→id, когда загрузятся опции фильтров.
  if (categories) filter.categories = parseIdOrNameList(categories)
  if (overNightsStay) filter.over_nights_stay = overNightsStay.split(',').map(Number).filter(Boolean)
  if (categoryTravelAddress) filter.categoryTravelAddress = parseIdOrNameList(categoryTravelAddress)
  if (sort) filter.sort = sort
  if (companions) filter.companions = companions.split(',').map(Number).filter(Boolean)
  if (complexity) filter.complexity = complexity.split(',').map(Number).filter(Boolean)
  if (month) filter.month = month.split(',').map(Number).filter(Boolean)

  return Object.keys(filter).length > 0 ? filter : undefined
}

export function getListTravelViewportState(params: ResponsiveParams): ViewportState {
  // rawWidth уже из useResponsive (hydration-safe): SSR и первый клиентский рендер дают 0,
  // после гидрации — реальную ширину. Прямое чтение window.innerWidth здесь давало
  // расхождение SSR→клиент и React error #418.
  const effectiveResponsiveWidth = params.rawWidth
  const resolvedIsPortrait = params.isPortrait
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

export function buildListTravelSearchPendingState({
  isInitialLoading,
  isUserIdLoading,
  isNextPageLoading,
  search,
  debSearch,
  isFetching,
  isEmpty,
}: {
  isInitialLoading: boolean
  isUserIdLoading: boolean
  isNextPageLoading: boolean
  search: string
  debSearch: string
  isFetching: boolean
  isEmpty: boolean
}) {
  const showInitialLoading = isInitialLoading || isUserIdLoading
  const showNextPageLoading = isNextPageLoading
  const normalizedSearchValue = search.trim()
  const normalizedDebouncedSearchValue = debSearch.trim()
  const isSearchInputPending = normalizedSearchValue !== normalizedDebouncedSearchValue
  const isSearchFetchPending =
    !showInitialLoading &&
    !showNextPageLoading &&
    normalizedSearchValue.length > 0 &&
    normalizedSearchValue === normalizedDebouncedSearchValue &&
    isFetching
  const isSearchPending = !isUserIdLoading && (isSearchInputPending || isSearchFetchPending)
  const showEmptyState = !isUserIdLoading && !isSearchPending && isEmpty

  return { showInitialLoading, showNextPageLoading, isSearchPending, showEmptyState }
}

type ListTravelFallbackCandidate<S, Q extends { data: any[] }> = {
  step: S
  query: Q
}

type ListTravelFallbackStageQuery = {
  isInitialLoading: boolean
  isFetching: boolean
  data: any[]
}

export function isListTravelFallbackStageExhausted(query: ListTravelFallbackStageQuery): boolean {
  return !query.isInitialLoading && !query.isFetching && !query.data.length
}

export function isListTravelAnyFallbackLoading(queries: Array<{ isInitialLoading: boolean }>): boolean {
  return queries.some((query) => query.isInitialLoading)
}

export function selectListTravelFallbackMatch<S, Q extends { data: any[] }>({
  isEmpty,
  fallbackStepLight,
  fallbackStepMedium,
  fallbackStepBroad,
  fallbackStepSearchless,
  fallbackQueryLight,
  fallbackQueryMedium,
  fallbackQueryBroad,
  fallbackQuerySearchless,
}: {
  isEmpty: boolean
  fallbackStepLight: S
  fallbackStepMedium: S
  fallbackStepBroad: S
  fallbackStepSearchless: S
  fallbackQueryLight: Q
  fallbackQueryMedium: Q
  fallbackQueryBroad: Q
  fallbackQuerySearchless: Q
}): ListTravelFallbackCandidate<S, Q> | null {
  if (!isEmpty) return null

  const candidates: Array<ListTravelFallbackCandidate<S, Q>> = [
    { step: fallbackStepLight, query: fallbackQueryLight },
    { step: fallbackStepMedium, query: fallbackQueryMedium },
    { step: fallbackStepBroad, query: fallbackQueryBroad },
    { step: fallbackStepSearchless, query: fallbackQuerySearchless },
  ]

  return candidates.find((candidate) => candidate.step && candidate.query.data.length > 0) ?? null
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
  if (filter.draftsOnly === true) count += 1
  if (filter.publishedOnly === true) count += 1
  if (debSearch && debSearch.trim().length > 0) count += 1

  return count
}
