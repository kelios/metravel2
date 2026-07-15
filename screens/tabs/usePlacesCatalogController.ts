import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'

import { fetchPlacesCatalog } from '@/api/places'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'

import {
  type CategoryCollection,
  getInterestingCategoryCollections,
  LOAD_MORE_SCROLL_THRESHOLD,
  MAP_FOCUS_RADIUS_KM,
  PLACES_PAGE_SIZE,
  getActiveCategoryTitle,
  isSameCategorySet,
  parseCategoryParam,
} from './PlacesScreen.helpers'

type PlacesCatalogControllerInput = {
  isCompact: boolean
  isWide: boolean
}

export function usePlacesCatalogController({ isCompact, isWide }: PlacesCatalogControllerInput) {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; country?: string; q?: string }>()
  const [query, setQuery] = useState(() => typeof params.q === 'string' ? params.q : '')
  const deferredQuery = useDeferredValue(query)
  const [categoryQuery, setCategoryQuery] = useState('')
  const deferredCategoryQuery = useDeferredValue(categoryQuery)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    parseCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countryMenuVisible, setCountryMenuVisible] = useState(false)
  const [topBarHeight, setTopBarHeight] = useState(0)

  const handleTopBarLayout = useCallback((event: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return
    const height = Number(event?.nativeEvent?.layout?.height ?? 0)
    if (height > 0) setTopBarHeight((current) => (Math.abs(current - height) < 1 ? current : height))
  }, [])

  const listParams = useMemo(() => ({
    q: deferredQuery.trim() || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    country: selectedCountry ?? undefined,
  }), [deferredQuery, selectedCategories, selectedCountry])

  const placesQuery = useInfiniteQuery({
    queryKey: ['places-catalog', 'list', listParams],
    queryFn: ({ pageParam, signal }) =>
      fetchPlacesCatalog({ page: pageParam, perPage: PLACES_PAGE_SIZE, ...listParams }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.places.length, 0)
      return loaded < lastPage.count ? allPages.length + 1 : undefined
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 2400),
    refetchOnWindowFocus: false,
  })

  const facetsParams = useMemo(
    () => ({ q: deferredQuery.trim() || undefined, country: selectedCountry ?? undefined }),
    [deferredQuery, selectedCountry],
  )
  const facetsQuery = useQuery({
    queryKey: ['places-catalog', 'facets', facetsParams],
    queryFn: ({ signal }) => fetchPlacesCatalog({ page: 1, perPage: 1, ...facetsParams }, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  const showCollections = Platform.OS === 'web' && !isCompact
  const interestingCategoryCollections = useMemo(getInterestingCategoryCollections, [])
  const collectionCountsParams = useMemo(
    () => ({ country: selectedCountry ?? undefined }),
    [selectedCountry],
  )
  const collectionCountQueries = useQueries({
    queries: interestingCategoryCollections.map((collection) => ({
      queryKey: ['places-catalog', 'collection', collection.id, collectionCountsParams],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchPlacesCatalog({
        page: 1,
        perPage: 1,
        categories: [...collection.categories],
        ...collectionCountsParams,
      }, signal),
      enabled: showCollections,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60 * 1000,
      gcTime: 20 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    })),
  })

  const visiblePlaces = useMemo(
    () => placesQuery.data?.pages.flatMap((page) => page.places) ?? [],
    [placesQuery.data],
  )
  const totalCount = placesQuery.data?.pages[0]?.count ?? 0
  const catalogTotal = facetsQuery.data?.count ?? 0
  const categoryFacets = useMemo(() => facetsQuery.data?.categoryFacets ?? [], [facetsQuery.data])
  const countryFacets = useMemo(() => facetsQuery.data?.countryFacets ?? [], [facetsQuery.data])
  const collectionCards = useMemo(
    () => interestingCategoryCollections.map((collection, index) => ({
      ...collection,
      count: collectionCountQueries[index]?.data?.count ?? 0,
      countReady: Boolean(collectionCountQueries[index]?.data),
    })),
    [collectionCountQueries, interestingCategoryCollections],
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
  }, [params.category])
  useEffect(() => {
    const nextCountry = typeof params.country === 'string' && params.country.trim()
      ? params.country.trim()
      : null
    setSelectedCountry((current) => (current === nextCountry ? current : nextCountry))
  }, [params.country])
  useEffect(() => {
    const nextQuery = typeof params.q === 'string' ? params.q : ''
    setQuery((current) => (current === nextQuery ? current : nextQuery))
  }, [params.q])

  const loadMorePlaces = useCallback(() => {
    if (placesQuery.hasNextPage && !placesQuery.isFetchingNextPage) void placesQuery.fetchNextPage()
  }, [placesQuery])
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!placesQuery.hasNextPage || placesQuery.isFetchingNextPage) return
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const layoutHeight = Number(layoutMeasurement?.height ?? 0)
    const offsetY = Number(contentOffset?.y ?? 0)
    const contentHeight = Number(contentSize?.height ?? 0)
    if (layoutHeight && contentHeight && contentHeight - (layoutHeight + offsetY) <= LOAD_MORE_SCROLL_THRESHOLD) {
      loadMorePlaces()
    }
  }, [loadMorePlaces, placesQuery.hasNextPage, placesQuery.isFetchingNextPage])
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
  const openOnMap = useCallback((place: CatalogPlace) => {
    if (!Number.isFinite(place.latNumber) || !Number.isFinite(place.lngNumber)) return
    router.push({
      pathname: '/map',
      params: {
        lat: String(place.latNumber),
        lng: String(place.lngNumber),
        radius: MAP_FOCUS_RADIUS_KM,
        categories: place.category,
        placeId: place.id,
        placeTitle: place.title,
        placeAddress: place.address || place.country || place.title,
        placeCategory: place.category,
        placeTravelUrl: place.urlTravel || '',
        placeImageUrl: place.travelImageThumbUrl || place.imageUrl || '',
      },
    })
  }, [router])
  const openTravel = useCallback((place: CatalogPlace) => {
    if (!place.urlTravel) return
    const internalRoute = normalizeRelatedTravelRoute(place.urlTravel)
    if (internalRoute) router.push(internalRoute as Href)
    else void openExternalUrlInNewTab(place.urlTravel)
  }, [router])

  const hasActiveFilters = selectedCategories.length > 0 || Boolean(selectedCountry) || Boolean(query)
  const resetAll = useCallback(() => {
    handleQueryChange('')
    setCategoryQuery('')
    handleClearCategories()
    handleSelectCountry(null)
  }, [handleClearCategories, handleQueryChange, handleSelectCountry])
  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' = placesQuery.isLoading
    ? 'loading'
    : placesQuery.isError
      ? 'error'
      : visiblePlaces.length === 0
        ? 'empty'
        : 'list'

  return {
    activeCategoryTitle: getActiveCategoryTitle(selectedCategories),
    catalogTotal,
    categoryQuery,
    collectionCards,
    countryFacets,
    countryMenuVisible,
    deferredCategoryQuery,
    deferredQuery,
    facetsQuery,
    filteredCategoryFacets,
    filtersOpen,
    firstScreenCount: (isWide ? 3 : isCompact ? 1 : 2) * 2,
    handleClearCategories,
    handleQueryChange,
    handleScroll,
    handleSelectCountry,
    handleToggleCategory,
    handleTopBarLayout,
    hasActiveFilters,
    hasCategorySearch: deferredCategoryQuery.trim().length > 0,
    hasMorePlaces: placesQuery.hasNextPage,
    isInitialLoading: placesQuery.isLoading,
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
    showCollections,
    showLoadedCounts: !facetsQuery.isLoading && !facetsQuery.isError,
    topBarHeight,
    totalCount,
    visiblePlaces,
  }
}
