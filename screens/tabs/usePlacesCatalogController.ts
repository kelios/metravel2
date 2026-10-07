import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
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
  getInterestingCategoryCollections,
  LOAD_MORE_SCROLL_THRESHOLD,
  MAP_FOCUS_RADIUS_KM,
  PLACES_SEARCH_DEBOUNCE_MS,
  getActiveCategoryTitle,
  getCatalogLoadErrorDescription,
  isSameCategorySet,
  parseCategoryParam,
} from './PlacesScreen.helpers'
import { usePlacesCatalogQueries } from './usePlacesCatalogQueries'

type PlacesCatalogControllerInput = {
  isCompact: boolean
  isWide: boolean
  hasMeasuredWidth: boolean
}

const isBlankQuery = (value: string) => !value.trim()

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    Platform.OS === 'web' ? [] : parseCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    Platform.OS !== 'web' && typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countryMenuVisible, setCountryMenuVisible] = useState(false)
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
  const queryReady = urlParamsApplied && appliedQuery === query.trim()
  const interestingCategoryCollections = useMemo(getInterestingCategoryCollections, [])
  const { collectionCounts, isScopeLoading, placesQuery, scope } = usePlacesCatalogQueries({
    q: appliedQuery || undefined,
    categories: selectedCategories,
    country: selectedCountry,
    sort: sortMode,
    collections: interestingCategoryCollections,
    enabled: queryReady,
    showCollections: showCollections && hasMeasuredWidth,
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
    router.setParams(categories.length > 0 ? { category: categories.join(',') } : { category: '' })
  }, [router])
  const handleQueryChange = useCallback((next: string) => {
    setQuery(next)
    router.setParams(next ? { q: next } : { q: '' })
  }, [router])

  useEffect(() => {
    const nextCategories = parseCategoryParam(params.category)
    setSelectedCategories((current) =>
      isSameCategorySet(current, nextCategories) ? current : nextCategories,
    )
    const nextCountry = typeof params.country === 'string' && params.country.trim()
      ? params.country.trim()
      : null
    setSelectedCountry((current) => (current === nextCountry ? current : nextCountry))
    const nextQuery = typeof params.q === 'string' ? params.q : ''
    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setUrlParamsApplied(true)
  }, [params.category, params.country, params.q])

  const loadMorePlaces = useCallback(() => {
    if (placesQuery.hasNextPage && !placesQuery.isFetchingNextPage) void placesQuery.fetchNextPage()
  }, [placesQuery])
  // После сбоя дозагрузки страницу повторяет только кнопка в подвале списка:
  // автодогрузка по скроллу сама слала бы тяжёлый запрос на каждое движение.
  const loadMoreFailed = placesQuery.isFetchNextPageError
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!placesQuery.hasNextPage || placesQuery.isFetchingNextPage || loadMoreFailed) return
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const layoutHeight = Number(layoutMeasurement?.height ?? 0)
    const offsetY = Number(contentOffset?.y ?? 0)
    const contentHeight = Number(contentSize?.height ?? 0)
    if (layoutHeight && contentHeight && contentHeight - (layoutHeight + offsetY) <= LOAD_MORE_SCROLL_THRESHOLD) {
      loadMorePlaces()
    }
  }, [loadMoreFailed, loadMorePlaces, placesQuery.hasNextPage, placesQuery.isFetchingNextPage])
  const handleToggleCategory = useCallback((category: string) => {
    setSelectedCategories((current) => {
      const next = current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
      syncCategoryParams(next)
      return next
    })
  }, [syncCategoryParams])
  const handleClearCategories = useCallback(() => {
    setSelectedCategories([])
    syncCategoryParams([])
  }, [syncCategoryParams])
  const selectCategoryCollection = useCallback((collection: CategoryCollection) => {
    const next = [...collection.categories]
    setSelectedCategories(next)
    syncCategoryParams(next)
  }, [syncCategoryParams])
  const handleSelectCountry = useCallback((country: string | null) => {
    setSelectedCountry(country)
    setCountryMenuVisible(false)
    router.setParams(country ? { country } : { country: '' })
  }, [router])
  const handleSelectSort = useCallback((next: PlacesCatalogSort) => {
    setSortMode(next)
    setSortMenuVisible(false)
  }, [])
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
  const openTravel = useCallback((place: CatalogPlace) => {
    if (!place.urlTravel) return
    const internalRoute = normalizeRelatedTravelRoute(place.urlTravel)
    if (internalRoute) router.push(internalRoute as Href)
    else void openExternalUrlInNewTab(place.urlTravel, { allowRelative: true, baseUrl: getSiteBaseUrl() })
  }, [router])

  const hasActiveFilters = selectedCategories.length > 0 || Boolean(selectedCountry) || Boolean(query)
  const resetAll = useCallback(() => {
    handleQueryChange('')
    setCategoryQuery('')
    handleClearCategories()
    handleSelectCountry(null)
  }, [handleClearCategories, handleQueryChange, handleSelectCountry])
  // Загруженный список остаётся на экране и при сбое фонового обновления или
  // дозагрузки: блок ошибки заменяет его, только когда показать нечего.
  const isInitialLoading = !urlParamsApplied || placesQuery.isLoading || (!queryReady && !placesQuery.data)
  const isResultsRefreshing = !isInitialLoading && (!queryReady || placesQuery.isPlaceholderData || placesQuery.isRefetching)
  const hasResultCount = placesQuery.data !== undefined && !isInitialLoading && !isResultsRefreshing
  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' = isInitialLoading
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
    handleQueryChange,
    handleScroll,
    handleSelectCountry,
    handleSelectSort,
    handleToggleCategory,
    handleTopBarLayout,
    hasActiveFilters,
    hasCategorySearch: deferredCategoryQuery.trim().length > 0,
    hasMorePlaces: placesQuery.hasNextPage,
    isInitialLoading,
    isResultsRefreshing,
    hasResultCount,
    isScopeLoading,
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
    sortMenuVisible,
    sortMode,
    showLoadedCounts: scope !== undefined,
    topBarHeight,
    totalCount,
    visiblePlaces,
  }
}
