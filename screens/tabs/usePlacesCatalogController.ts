import { useCallback, useDeferredValue, useEffect, useMemo, useState, type SetStateAction } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import type { PlacesCatalogSort } from '@/api/places'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'
import { getSiteBaseUrl } from '@/utils/seo'

import {
  type CategoryCollection,
  DEFAULT_CATEGORY_SELECTION,
  getInterestingCategoryCollections,
  LOAD_MORE_SCROLL_THRESHOLD,
  MAP_FOCUS_RADIUS_KM,
  PLACES_SEARCH_DEBOUNCE_MS,
  getActiveCategoryTitle,
  getCatalogLoadErrorDescription,
  isSameCategorySet,
  resolvePlacesCategorySelection,
} from './PlacesScreen.helpers'
import { usePlacesCatalogQueries } from './usePlacesCatalogQueries'

type PlacesCatalogControllerInput = {
  isCompact: boolean
  isWide: boolean
  hasMeasuredWidth: boolean
}

const isBlankQuery = (value: string) => !value.trim()
const allCategories: string[] = []
const starterCategories = [...DEFAULT_CATEGORY_SELECTION]

export function usePlacesCatalogController({ isCompact, isWide, hasMeasuredWidth }: PlacesCatalogControllerInput) {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; country?: string; q?: string }>()
  const [urlParamsApplied, setUrlParamsApplied] = useState(Platform.OS !== 'web')
  const [query, setQuery] = useState(() => Platform.OS !== 'web' && typeof params.q === 'string' ? params.q : '')
  // В запрос уходит значение после паузы ввода: `useDeferredValue` паузой не
  // был, и каждый набранный символ стоил бэкенду отдельного расчёта (#2184).
  // Очищенный поиск применяется сразу, иначе «Сбросить» слал бы запрос со
  // старым поиском и уже сброшенными фильтрами.
  const appliedQuery = useDebouncedValue(query, PLACES_SEARCH_DEBOUNCE_MS, isBlankQuery).trim()
  const [categoryQuery, setCategoryQuery] = useState('')
  const deferredCategoryQuery = useDeferredValue(categoryQuery)
  // Keep the first web frame neutral. The route effect applies explicit intent
  // after hydration (#2406), including an explicitly empty category parameter.
  const [explicitCategories, setExplicitCategories] = useState(() =>
    Platform.OS === 'web' ? undefined : resolvePlacesCategorySelection(params.category),
  )
  const normalizedQuery = query.trim()
  const selectedCategories = explicitCategories ?? (urlParamsApplied && !normalizedQuery ? starterCategories : allCategories)
  const [scopeRequested, setScopeRequested] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    Platform.OS !== 'web' && typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [filtersOpen, setFiltersOpenState] = useState(false)
  const [countryMenuVisible, setCountryMenuVisibleState] = useState(false)
  const [sortMenuVisible, setSortMenuVisible] = useState(false)
  const [sortMode, setSortMode] = useState<PlacesCatalogSort>('default')
  const [topBarHeight, setTopBarHeight] = useState(0)

  const handleTopBarLayout = useCallback((event: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return
    const height = Number(event?.nativeEvent?.layout?.height ?? 0)
    if (height > 0) setTopBarHeight((current) => (Math.abs(current - height) < 1 ? current : height))
  }, [])

  const showCollections = Platform.OS === 'web' && !isCompact
  // The first web frame matches SSG. Wait for the committed URL state and its
  // debounced search before enabling any list/scope/aggregate request.
  const queryReady = urlParamsApplied && appliedQuery === normalizedQuery
  const interestingCategoryCollections = useMemo(getInterestingCategoryCollections, [])
  const requestCatalogScope = useCallback(() => setScopeRequested(true), [])
  const setCountryMenuVisible = useCallback((next: boolean) => {
    if (next) requestCatalogScope()
    setCountryMenuVisibleState(next)
  }, [requestCatalogScope])
  const setFiltersOpen = useCallback((next: SetStateAction<boolean>) => {
    requestCatalogScope()
    setFiltersOpenState(next)
  }, [requestCatalogScope])
  const { collectionCounts, isScopeLoading, placesQuery, resetList, scope, scopeStatus, retryScope } = usePlacesCatalogQueries({
    q: appliedQuery || undefined,
    categories: selectedCategories,
    country: selectedCountry,
    sort: sortMode,
    collections: interestingCategoryCollections,
    enabled: queryReady,
    showCollections: showCollections && hasMeasuredWidth,
    scopeRequested: explicitCategories !== undefined || scopeRequested,
  })

  const visiblePlaces = useMemo(
    () => placesQuery.data?.pages.flatMap((page) => page.places) ?? [],
    [placesQuery.data],
  )
  const totalCount = placesQuery.data?.pages[0]?.count ?? 0
  const catalogTotal = scope?.count ?? 0
  const categoryFacets = useMemo(() => scope?.categoryFacets ?? [], [scope])
  const countryFacets = useMemo(() => scope?.countryFacets ?? [], [scope])
  const collectionCards = useMemo(
    () => interestingCategoryCollections.map((collection) => {
      const count = collectionCounts?.[collection.id]
      return { ...collection, count: count ?? 0, countReady: count !== undefined }
    }),
    [collectionCounts, interestingCategoryCollections],
  )
  const filteredCategoryFacets = useMemo(() => {
    const normalized = deferredCategoryQuery.trim().toLowerCase()
    const selectedSet = new Set(selectedCategories)
    const list = normalized
      ? categoryFacets.filter((facet) => facet.name.toLowerCase().includes(normalized))
      : categoryFacets
    const withSelected = selectedCategories.reduce<typeof list>((acc, name) =>
      acc.some((facet) => facet.name === name)
        ? acc
        : [{ id: null, name, count: 0 }, ...acc], list)
    return [...withSelected].sort((a, b) => {
      const aSelected = selectedSet.has(a.name)
      const bSelected = selectedSet.has(b.name)
      return aSelected === bSelected ? 0 : aSelected ? -1 : 1
    })
  }, [categoryFacets, deferredCategoryQuery, selectedCategories])

  const syncCategoryParams = useCallback((categories: string[]) => {
    setExplicitCategories(categories)
    router.setParams(categories.length > 0 ? { category: categories.join(',') } : { category: '' })
  }, [router])
  const handleQueryChange = useCallback((next: string) => {
    requestCatalogScope()
    setQuery(next)
    router.setParams(next ? { q: next } : { q: '' })
  }, [router, requestCatalogScope])

  useEffect(() => {
    const nextCategories = resolvePlacesCategorySelection(params.category)
    setExplicitCategories((current) =>
      current && nextCategories && isSameCategorySet(current, nextCategories) ? current : nextCategories,
    )
    const nextCountry = typeof params.country === 'string' && params.country.trim()
      ? params.country.trim()
      : null
    setSelectedCountry((current) => (current === nextCountry ? current : nextCountry))
    const nextQuery = typeof params.q === 'string' ? params.q : ''
    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setUrlParamsApplied(true)
  }, [params.category, params.country, params.q])

  const canLoadMore = queryReady && !placesQuery.isPlaceholderData && placesQuery.hasNextPage
  const loadMorePlaces = useCallback(() => {
    if (canLoadMore && !placesQuery.isFetchingNextPage) void placesQuery.fetchNextPage()
  }, [canLoadMore, placesQuery])
  // После сбоя дозагрузки страницу повторяет только кнопка в подвале списка:
  // автодогрузка по скроллу сама слала бы тяжёлый запрос на каждое движение.
  const loadMoreFailed = placesQuery.isFetchNextPageError
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!canLoadMore || placesQuery.isFetchingNextPage || loadMoreFailed) return
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const layoutHeight = Number(layoutMeasurement?.height ?? 0)
    const offsetY = Number(contentOffset?.y ?? 0)
    const contentHeight = Number(contentSize?.height ?? 0)
    if (layoutHeight && contentHeight && contentHeight - (layoutHeight + offsetY) <= LOAD_MORE_SCROLL_THRESHOLD) {
      loadMorePlaces()
    }
  }, [canLoadMore, loadMoreFailed, loadMorePlaces, placesQuery.isFetchingNextPage])
  const handleToggleCategory = useCallback((category: string) => {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category]
    syncCategoryParams(next)
  }, [selectedCategories, syncCategoryParams])
  const handleClearCategories = useCallback(() => {
    syncCategoryParams(allCategories)
  }, [syncCategoryParams])
  const handleExpandSearch = useCallback(() => {
    resetList({ categories: undefined })
    handleClearCategories()
  }, [handleClearCategories, resetList])
  const selectCategoryCollection = useCallback((collection: CategoryCollection) => {
    syncCategoryParams([...collection.categories])
  }, [syncCategoryParams])
  const handleSelectCountry = useCallback((country: string | null) => {
    requestCatalogScope()
    setSelectedCountry(country)
    setCountryMenuVisible(false)
    router.setParams(country ? { country } : { country: '' })
  }, [router, requestCatalogScope, setCountryMenuVisible])
  const handleSelectSort = useCallback((next: PlacesCatalogSort) => {
    if (next !== sortMode) {
      resetList({ sort: next, q: normalizedQuery || undefined })
      setSortMode(next)
    }
    setSortMenuVisible(false)
  }, [normalizedQuery, resetList, sortMode])
  const openOnMap = useCallback((place: CatalogPlace) => {
    if (!Number.isFinite(place.latNumber) || !Number.isFinite(place.lngNumber)) return
    router.push({
      pathname: '/map',
      params: {
        lat: String(place.latNumber),
        lng: String(place.lngNumber),
        radius: MAP_FOCUS_RADIUS_KM,
        // NB: no `categories` here. Passing the place category as a filter used
        // to leave the map EMPTY («Ничего не нашлось») whenever the category name
        // did not map to a filter id — including the point the user just opened.
        // The map opens unfiltered and focuses the point instead (`focusPlace=1`).
        focusPlace: '1',
        placeId: place.id,
        placeTitle: place.title,
        placeAddress: place.address || place.country || place.title,
        placeCategory: place.category,
        placeTravelUrl: place.urlTravel || '',
        // Id статьи `placeTravelUrl` из каталога (#1960): карточка на карте не
        // разбирает url и не запрашивает статью по slug.
        placeTravelId: place.travelId != null ? String(place.travelId) : '',
        placeImageUrl: place.travelImageThumbUrl || place.imageUrl || '',
      },
    })
  }, [router])
  const openTravel = useCallback((url: string) => {
    if (!url) return
    const internalRoute = normalizeRelatedTravelRoute(url)
    if (internalRoute) router.push(internalRoute as Href)
    else void openExternalUrlInNewTab(url, { allowRelative: true, baseUrl: getSiteBaseUrl() })
  }, [router])

  const hasActiveFilters = selectedCategories.length > 0 || Boolean(selectedCountry) || Boolean(normalizedQuery)
  const resetAll = useCallback(() => {
    setQuery('')
    setCategoryQuery('')
    setExplicitCategories(allCategories)
    setSelectedCountry(null)
    setCountryMenuVisibleState(false)
    router.setParams({ q: '', category: '', country: '' })
  }, [router])
  // Загруженный список остаётся на экране и при сбое фонового обновления или
  // дозагрузки: блок ошибки заменяет его, только когда показать нечего.
  // Restoration can leave a committed URL's query pending/idle before fetching
  // starts. It has no result yet: keep the grid instead of flashing empty (#3387).
  const isInitialLoading = !urlParamsApplied || placesQuery.isPending || (!queryReady && !placesQuery.data)
  const isResultsRefreshing = !isInitialLoading && (!queryReady || placesQuery.isPlaceholderData || placesQuery.isRefetching)
  const hasResultCount = placesQuery.data !== undefined && !isInitialLoading && !isResultsRefreshing
  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' =
    isInitialLoading || (visiblePlaces.length === 0 && isResultsRefreshing)
    ? 'loading'
    : visiblePlaces.length > 0
      ? 'list'
      : placesQuery.isError
        ? 'error'
        : 'empty'

  return {
    activeCategoryTitle: getActiveCategoryTitle(selectedCategories),
    appliedQuery,
    catalogTotal,
    categoryQuery,
    collectionCards,
    countryFacets,
    countryMenuVisible,
    deferredCategoryQuery,
    filteredCategoryFacets,
    filtersOpen,
    firstScreenCount: (isWide ? 3 : isCompact ? 1 : 2) * 2,
    handleClearCategories,
    handleExpandSearch,
    handleQueryChange,
    handleScroll,
    handleSelectCountry,
    handleSelectSort,
    handleToggleCategory,
    handleTopBarLayout,
    hasActiveFilters,
    hasCategorySearch: deferredCategoryQuery.trim().length > 0,
    hasMorePlaces: canLoadMore,
    isInitialLoading,
    isResultsRefreshing,
    hasResultCount,
    isScopeLoading,
    scopeStatus,
    retryScope,
    requestCatalogScope,
    loadErrorDescription: getCatalogLoadErrorDescription(placesQuery.error),
    loadMoreFailed,
    loadMorePlaces,
    openOnMap,
    openTravel,
    placesQuery,
    query,
    resetAll,
    resultsStatus,
    selectCategoryCollection,
    selectedCategories,
    selectedCountry,
    setCategoryQuery,
    setCountryMenuVisible,
    setFiltersOpen,
    setSortMenuVisible,
    showCollections,
    showCategoryScope: explicitCategories !== undefined || Boolean(normalizedQuery),
    sortMenuVisible,
    sortMode,
    showLoadedCounts: scope !== undefined,
    topBarHeight,
    totalCount,
    visiblePlaces,
  }
}
