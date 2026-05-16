import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'

import { fetchPlacesCatalog } from '@/api/places'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import {
  filterCatalogPlaces,
  groupCatalogPlaces,
  groupCatalogCountries,
  type CatalogPlace,
} from '@/utils/placesCatalog'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH, getSiteBaseUrl } from '@/utils/seo'
import ContributionBanner from '@/components/common/ContributionBanner'

const MAP_FOCUS_RADIUS_KM = '5'
const PLACES_PAGE_SIZE = 20
const LOAD_MORE_SCROLL_THRESHOLD = 420
const MOBILE_COUNTRIES_COLLAPSED_LIMIT = 6
const PRESSED_OPACITY = { opacity: 0.72 } as const
const DEFAULT_CATEGORY_SELECTION = [
  'Замок',
  'Руины замка',
  'Дворец',
  'Руины дворца',
  'Экологическая тропа',
  'Колесо обозрения',
  'Водохранилище',
  'Озеро',
  'Река',
  'Ручей',
] as const
const FEATURED_CATEGORY_LABEL = 'Замки, дворцы, экотропы и вода'
type CategoryCollection = {
  id: string
  title: string
  hint: string
  icon: React.ComponentProps<typeof Feather>['name']
  categories: readonly string[]
}

const INTERESTING_CATEGORY_COLLECTIONS: readonly CategoryCollection[] = [
  {
    id: 'featured',
    title: FEATURED_CATEGORY_LABEL,
    hint: 'для первой поездки',
    icon: 'star',
    categories: DEFAULT_CATEGORY_SELECTION,
  },
  {
    id: 'history',
    title: 'История и руины',
    hint: 'замки, форты, усадьбы',
    icon: 'archive',
    categories: [
      'Замок',
      'Руины замка',
      'Дворец',
      'Руины дворца',
      'Усадьба',
      'Руины усадьбы',
      'Форт',
      'Крепость',
      'Башня',
      'Брама',
    ],
  },
  {
    id: 'nature',
    title: 'Природа и вода',
    hint: 'озера, реки, тропы',
    icon: 'droplet',
    categories: [
      'Озеро',
      'Водохранилище',
      'Река',
      'Ручей',
      'Водопад',
      'Родник',
      'Экологическая тропа',
      'Заповедник',
      'Национальный парк',
      'Гора',
      'Скала',
    ],
  },
  {
    id: 'family',
    title: 'Для прогулки с семьей',
    hint: 'парки, зоопарки, обзорные',
    icon: 'users',
    categories: [
      'Парк',
      'Детский парк',
      'Зоопарк',
      'Парк развлечений',
      'Обзорная точка',
      'Колесо обозрения',
      'Музей',
      'Площадь',
      'Место отдыха',
    ],
  },
] as const

const parseCategoryParam = (value: unknown): string[] => {
  if (typeof value !== 'string') return [...DEFAULT_CATEGORY_SELECTION]
  const parsed = value
    .split(',')
    .map((item) => decodeURIComponent(item).trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : []
}

const isSameCategorySet = (left: string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

const getMatchingCollection = (categories: string[]): CategoryCollection | null =>
  INTERESTING_CATEGORY_COLLECTIONS.find((collection) =>
    isSameCategorySet(categories, collection.categories),
  ) ?? null

const getActiveCategoryTitle = (categories: string[]): string => {
  if (categories.length === 0) return 'Все места'
  const collection = getMatchingCollection(categories)
  if (collection) return collection.title
  if (categories.length <= 2) return categories.join(', ')
  return `${categories.length} категорий`
}

const normalizeInternalTravelRoute = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed

  try {
    const siteBase = new URL(getSiteBaseUrl())
    const parsed = new URL(trimmed, siteBase)
    if (parsed.host !== siteBase.host) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export default function PlacesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; country?: string }>()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isCompact = width < 760
  const isWide = width >= 1100
  const styles = useMemo(() => createStyles(colors, isCompact, isWide), [colors, isCompact, isWide])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    parseCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [visibleCount, setVisibleCount] = useState(PLACES_PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectionExpanded, setSelectionExpanded] = useState(false)
  const [countriesExpanded, setCountriesExpanded] = useState(false)

  const placesQuery = useQuery({
    queryKey: ['places-catalog'],
    queryFn: ({ signal }) => fetchPlacesCatalog(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 2400),
    refetchOnWindowFocus: false,
  })

  const allPlaces = useMemo(() => placesQuery.data ?? [], [placesQuery.data])
  const placesForCategoryCounts = useMemo(
    () => filterCatalogPlaces(allPlaces, '', null, selectedCountry),
    [allPlaces, selectedCountry],
  )
  const placesForCountryCounts = useMemo(
    () => filterCatalogPlaces(allPlaces, '', selectedCategories, null),
    [allPlaces, selectedCategories],
  )
  const categoryGroups = useMemo(
    () => {
      const selectedSet = new Set(selectedCategories)
      return groupCatalogPlaces(placesForCategoryCounts).sort((a, b) => {
        const aSelected = selectedSet.has(a.category)
        const bSelected = selectedSet.has(b.category)
        if (aSelected !== bSelected) return aSelected ? -1 : 1
        return 0
      })
    },
    [placesForCategoryCounts, selectedCategories],
  )
  const collectionCards = useMemo(
    () => INTERESTING_CATEGORY_COLLECTIONS.map((collection) => ({
      ...collection,
      count: filterCatalogPlaces(
        allPlaces,
        '',
        [...collection.categories],
        selectedCountry,
      ).length,
    })),
    [allPlaces, selectedCountry],
  )
  const countryGroups = useMemo(
    () => groupCatalogCountries(placesForCountryCounts),
    [placesForCountryCounts],
  )
  const visibleCountryGroups = useMemo(() => {
    if (!isCompact || countriesExpanded) return countryGroups
    const visible = countryGroups.slice(0, MOBILE_COUNTRIES_COLLAPSED_LIMIT)
    if (selectedCountry && !visible.some((group) => group.country === selectedCountry)) {
      const selected = countryGroups.find((group) => group.country === selectedCountry)
      if (selected) return [...visible.slice(0, MOBILE_COUNTRIES_COLLAPSED_LIMIT - 1), selected]
    }
    return visible
  }, [countryGroups, countriesExpanded, isCompact, selectedCountry])
  const filteredPlaces = useMemo(
    () => filterCatalogPlaces(allPlaces, deferredQuery, selectedCategories, selectedCountry),
    [allPlaces, deferredQuery, selectedCategories, selectedCountry],
  )
  const visiblePlaces = useMemo(
    () => filteredPlaces.slice(0, visibleCount),
    [filteredPlaces, visibleCount],
  )
  const hasMorePlaces = visibleCount < filteredPlaces.length
  const showLoadedCounts = !placesQuery.isLoading && !placesQuery.isError

  const activeCategoryTitle = getActiveCategoryTitle(selectedCategories)
  const pageDescription = selectedCategories.length > 0
    ? `Места выбранных категорий: ${selectedCategories.join(', ')}. Карточки точек, переход на карту и ссылка на путешествие.`
    : 'Каталог мест MeTravel: замки, музеи, парки, природные точки и другие места из путешествий.'

  // ─── SEO ───
  const seoHeading = useMemo(() => {
    const parts = ['Места']
    if (selectedCategories.length > 0) parts.push(activeCategoryTitle)
    if (selectedCountry) parts.push(selectedCountry)
    return parts.join(' — ')
  }, [activeCategoryTitle, selectedCategories.length, selectedCountry])
  const seoTitle = `${seoHeading} | MeTravel`
  const placesJsonLd = useMemo(() => {
    if (Platform.OS !== 'web' || !isFocused || visiblePlaces.length === 0) return undefined
    const base = getSiteBaseUrl().replace(/\/$/, '')
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: seoHeading,
      numberOfItems: filteredPlaces.length,
      itemListElement: visiblePlaces.slice(0, 12).map((place, index) => {
        const internal = place.urlTravel
          ? normalizeInternalTravelRoute(place.urlTravel)
          : null
        return {
          '@type': 'ListItem',
          position: index + 1,
          name: place.title,
          url: internal ? `${base}${internal}` : `${base}/places`,
        }
      }),
    }
    return (
      <script
        key="places-itemlist"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    )
  }, [filteredPlaces.length, isFocused, seoHeading, visiblePlaces])

  const syncCategoryParams = useCallback((categories: string[]) => {
    router.setParams(categories.length > 0 ? { category: categories.join(',') } : { category: '' })
  }, [router])

  useEffect(() => {
    setVisibleCount(PLACES_PAGE_SIZE)
  }, [deferredQuery, selectedCategories, selectedCountry])

  const loadMorePlaces = useCallback(() => {
    setVisibleCount((current) => Math.min(current + PLACES_PAGE_SIZE, filteredPlaces.length))
  }, [filteredPlaces.length])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMorePlaces || placesQuery.isLoading) return
    const nativeEvent = event?.nativeEvent
    const layoutHeight = Number(nativeEvent?.layoutMeasurement?.height ?? 0)
    const offsetY = Number(nativeEvent?.contentOffset?.y ?? 0)
    const contentHeight = Number(nativeEvent?.contentSize?.height ?? 0)
    if (!layoutHeight || !contentHeight) return

    const distanceToBottom = contentHeight - (layoutHeight + offsetY)
    if (distanceToBottom <= LOAD_MORE_SCROLL_THRESHOLD) {
      loadMorePlaces()
    }
  }, [hasMorePlaces, loadMorePlaces, placesQuery.isLoading])

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
    router.setParams(country ? { country } : { country: '' })
  }, [router])

  const openOnMap = useCallback((place: CatalogPlace) => {
    router.push({
      pathname: '/map',
      params: {
        lat: String(place.latNumber),
        lng: String(place.lngNumber),
        radius: MAP_FOCUS_RADIUS_KM,
        categories: place.category,
      },
    })
  }, [router])

  const openTravel = useCallback((place: CatalogPlace) => {
    if (!place.urlTravel) return
    const internalRoute = normalizeInternalTravelRoute(place.urlTravel)
    if (internalRoute) {
      router.push(internalRoute as any)
      return
    }
    void openExternalUrlInNewTab(place.urlTravel)
  }, [router])

  const hasActiveFilters = selectedCategories.length > 0 || !!selectedCountry || !!query
  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedCountry ? 1 : 0) +
    (query ? 1 : 0)
  const mobileFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedCountry ? 1 : 0) +
    (query ? 1 : 0)

  const resetAll = useCallback(() => {
    setQuery('')
    handleClearCategories()
    handleSelectCountry(null)
  }, [handleClearCategories, handleSelectCountry])

  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' = placesQuery.isLoading
    ? 'loading'
    : placesQuery.isError
      ? 'error'
      : filteredPlaces.length === 0
        ? 'empty'
        : 'list'

  let resultsContent: React.ReactNode
  if (resultsStatus === 'loading') {
    resultsContent = <SkeletonGrid styles={styles} isCompact={isCompact} isWide={isWide} />
  } else if (resultsStatus === 'error') {
    resultsContent = (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="alert-circle"
        title="Не удалось загрузить места"
        description="Попробуйте обновить каталог."
        actionLabel="Повторить"
        onAction={() => placesQuery.refetch()}
      />
    )
  } else if (resultsStatus === 'empty') {
    resultsContent = (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="map-pin"
        title="Места не найдены"
        description="Измените категорию, страну или поисковый запрос."
        actionLabel="Сбросить фильтры"
        onAction={resetAll}
      />
    )
  } else {
    resultsContent = (
      <View style={styles.cardsGrid}>
        {visiblePlaces.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            styles={styles}
            colors={colors}
            onOpenMap={openOnMap}
            onOpenTravel={openTravel}
          />
        ))}
        {hasMorePlaces ? (
          <View style={styles.loadMoreFooter}>
            <Text style={styles.loadMoreText}>
              Показано {visiblePlaces.length} из {filteredPlaces.length}
            </Text>
            <Button
              label="Показать ещё"
              variant="secondary"
              size="sm"
              onPress={loadMorePlaces}
            />
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      {Platform.OS === 'web' && isFocused ? (
        <InstantSEO
          headKey="places"
          title={seoTitle}
          description={pageDescription}
          canonical={buildCanonicalUrl('/places')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
          additionalTags={placesJsonLd}
        />
      ) : null}
      {Platform.OS === 'web'
        ? React.createElement('h1', { style: styles.srOnly as any }, seoHeading)
        : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={180}
      >

        {/* ─── Hero ─── */}
        <View style={styles.hero}>
          <View style={styles.heroTitleRow}>
            <Feather name="map-pin" size={18} color={colors.primary} />
            <Text style={styles.heroTitle}>Места</Text>
            {showLoadedCounts ? (
              <Text style={styles.heroCount}>· {allPlaces.length} в каталоге</Text>
            ) : null}
          </View>
        </View>

        {/* ─── Search bar ─── */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по названию или адресу..."
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Найти место"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Очистить поиск"
                style={({ pressed }) => [styles.searchClear, pressed && PRESSED_OPACITY]}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ─── Countries ─── */}
        <View style={styles.countrySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Страны</Text>
            {selectedCountry ? (
              <Pressable
                onPress={() => handleSelectCountry(null)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.clearLink, pressed && PRESSED_OPACITY]}
              >
                <Text style={styles.clearLinkText}>Все страны</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.countryWrap}>
            {placesQuery.isLoading ? (
              [80, 100, 70, 90, 110].map((w, i) => (
                <View key={i} style={[styles.skeletonChip, { width: w }]} />
              ))
            ) : (
              <>
                <Chip
                  label="Все"
                  count={showLoadedCounts ? placesForCountryCounts.length : undefined}
                  selected={!selectedCountry}
                  onPress={() => handleSelectCountry(null)}
                  style={styles.filterChipCompact}
                />
                {visibleCountryGroups.map((group) => (
                  <Chip
                    key={group.country}
                    label={group.country}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCountry === group.country}
                    onPress={() => handleSelectCountry(group.country)}
                    style={styles.filterChipCompact}
                  />
                ))}
                {isCompact && countryGroups.length > MOBILE_COUNTRIES_COLLAPSED_LIMIT ? (
                  <Chip
                    label={countriesExpanded
                      ? 'Свернуть'
                      : `Ещё ${countryGroups.length - visibleCountryGroups.length}`}
                    selected={false}
                    onPress={() => setCountriesExpanded((value) => !value)}
                    style={styles.filterChipCompact}
                  />
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* ─── Main layout ─── */}
        <View style={styles.layout}>
          {/* Sidebar / collapsible filter */}
          {isCompact ? (
            <View style={styles.mobileFilterBar}>
              <Pressable
                onPress={() => setFiltersOpen((v) => !v)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.mobileFilterToggle, pressed && PRESSED_OPACITY]}
              >
                <Feather name="sliders" size={16} color={activeFilterCount > 0 ? colors.primary : colors.text} />
                <Text style={[styles.mobileFilterToggleText, activeFilterCount > 0 && styles.mobileFilterToggleTextActive]}>
                  Категории
                </Text>
                {mobileFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{mobileFilterCount}</Text>
                  </View>
                ) : null}
                <Feather
                  name={filtersOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
              {hasActiveFilters ? (
                <Pressable
                  onPress={resetAll}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.resetBtn, pressed && PRESSED_OPACITY]}
                >
                  <Text style={styles.resetBtnText}>Сбросить</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {(!isCompact || filtersOpen) ? (
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sectionTitle}>Категории</Text>
                {selectedCategories.length > 0 ? (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>{selectedCategories.length}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.collectionSection}>
                <Text style={styles.hintText}>Интересные подборки</Text>
                <View style={styles.collectionList}>
                  {collectionCards.map((collection) => {
                    const selected = isSameCategorySet(selectedCategories, collection.categories)
                    return (
                      <View
                        key={collection.id}
                        style={[
                          styles.featuredCard,
                          selected && styles.featuredCardActive,
                        ]}
                      >
                        <Pressable
                          onPress={() => selectCategoryCollection(collection)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Подборка: ${collection.title}`}
                          style={({ pressed }) => [
                            styles.featuredSelectArea,
                            pressed && PRESSED_OPACITY,
                          ]}
                        >
                          <View style={styles.featuredIconWrap}>
                            <Feather name={collection.icon} size={14} color={colors.primaryText} />
                          </View>
                          <View style={styles.featuredTextBlock}>
                            <Text style={styles.featuredLabel}>
                              {collection.hint}
                            </Text>
                            <Text style={styles.featuredName} numberOfLines={2}>
                              {collection.title}
                            </Text>
                          </View>
                          {showLoadedCounts ? (
                            <Text style={styles.featuredCount}>{collection.count}</Text>
                          ) : null}
                        </Pressable>
                        {selected ? (
                          <Pressable
                            onPress={handleClearCategories}
                            accessibilityRole="button"
                            accessibilityLabel={`Очистить подборку ${collection.title}`}
                            hitSlop={8}
                            style={({ pressed }) => [styles.featuredClear, pressed && PRESSED_OPACITY]}
                          >
                            <Feather name="x" size={14} color={colors.primaryText} />
                          </Pressable>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              </View>

              <Text style={styles.hintText}>Или выберите категории вручную</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Все"
                  count={showLoadedCounts ? placesForCategoryCounts.length : undefined}
                  selected={selectedCategories.length === 0}
                  onPress={handleClearCategories}
                  style={styles.filterChipCompact}
                />
                {categoryGroups.map((group) => (
                  <Chip
                    key={group.category}
                    label={group.category}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCategories.includes(group.category)}
                    onPress={() => handleToggleCategory(group.category)}
                    style={styles.filterChipCompact}
                  />
                ))}
              </View>
              {!isCompact && hasActiveFilters ? (
                <Pressable
                  onPress={resetAll}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.sidebarResetBtn, pressed && PRESSED_OPACITY]}
                >
                  <Feather name="refresh-ccw" size={14} color={colors.textMuted} />
                  <Text style={styles.sidebarResetBtnText}>Сбросить фильтры</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Results */}
          <View style={styles.main}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsTitleBlock}>
                <Text style={styles.resultsTitle} numberOfLines={2}>{activeCategoryTitle}</Text>
                <Text style={styles.resultsMeta}>
                  {placesQuery.isLoading
                    ? 'Загружаем подборку...'
                    : `${filteredPlaces.length} ${getPlacesCountLabel(filteredPlaces.length)}`}
                </Text>
              </View>
              {selectedCategories.length > 0 && !isCompact ? (
                <Button
                  label="Все места"
                  variant="outline"
                  size="sm"
                  onPress={handleClearCategories}
                />
              ) : null}
            </View>

            {selectedCategories.length > 1 ? (
              <View style={styles.activeSelection}>
                <Pressable
                  onPress={() => setSelectionExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: selectionExpanded }}
                  accessibilityLabel={`Выбранные категории: ${selectedCategories.length}`}
                  style={({ pressed }) => [styles.activeSelectionHeader, pressed && PRESSED_OPACITY]}
                >
                  <Text style={styles.activeSelectionLabel}>
                    Выбранные категории
                  </Text>
                  <View style={styles.activeSelectionCount}>
                    <Text style={styles.activeSelectionCountText}>
                      {selectedCategories.length}
                    </Text>
                  </View>
                  <View style={styles.activeSelectionSpacer} />
                  <Feather
                    name={selectionExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primaryText}
                  />
                </Pressable>
                {selectionExpanded ? (
                  <View style={styles.chipRow}>
                    {selectedCategories.map((category) => (
                      <Pressable
                        key={category}
                        accessibilityRole="button"
                        accessibilityLabel={`Убрать категорию ${category}`}
                        onPress={() => handleToggleCategory(category)}
                        style={({ pressed }) => [styles.activeChip, pressed && PRESSED_OPACITY]}
                      >
                        <Text style={styles.activeChipText}>{category}</Text>
                        <Feather name="x" size={12} color={colors.textOnPrimary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {resultsContent}
          </View>
        </View>
        <ContributionBanner variant="places" />
      </ScrollView>
    </View>
  )
}

const PlaceCard = React.memo(function PlaceCard({
  place,
  styles,
  colors,
  onOpenMap,
  onOpenTravel,
}: {
  place: CatalogPlace
  styles: ReturnType<typeof createStyles>
  colors: ThemedColors
  onOpenMap: (place: CatalogPlace) => void
  onOpenTravel: (place: CatalogPlace) => void
}) {
  const imageUrl = place.imageUrl || place.travelImageThumbUrl || null

  return (
    <View style={[styles.card, styles.cardInner]}>
      <Pressable
        onPress={() => onOpenMap(place)}
        accessibilityRole="button"
        accessibilityLabel={`Открыть ${place.title} на карте`}
        style={({ pressed }) => [styles.cardMediaWrap, pressed && styles.cardPressed]}
      >
        {imageUrl ? (
          <ImageCardMedia
            src={imageUrl}
            alt={place.title}
            fit="contain"
            width="100%"
            height={styles.cardMediaWrap.height as number}
            borderRadius={0}
            blurBackground
            allowCriticalWebBlur={Platform.OS === 'web'}
            blurRadius={18}
            loading="lazy"
            priority="low"
            style={styles.cardMedia}
          />
        ) : (
          <View style={styles.cardMediaFallback} />
        )}
        <View style={styles.cardMediaScrim} />
        <View style={styles.categoryBadge}>
          <Feather name="tag" size={10} color={colors.textOnDark} />
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {place.category}
          </Text>
        </View>
      </Pressable>

      <View style={styles.cardBody}>
        <Pressable
          onPress={() => onOpenMap(place)}
          accessibilityRole="button"
          accessibilityLabel={`Открыть ${place.title} на карте`}
          style={({ pressed }) => [styles.cardTitlePressable, pressed && PRESSED_OPACITY]}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>
            {place.title}
          </Text>
        </Pressable>

        <View style={styles.cardMeta}>
          <Feather name="map-pin" size={12} color={colors.textMuted} />
          <Text style={styles.cardAddress} numberOfLines={1}>
            {place.address || place.country}
          </Text>
          {place.address && place.country ? (
            <Text style={styles.cardCountryTag} numberOfLines={1}>
              {place.country}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <Pressable
            onPress={() => onOpenMap(place)}
            accessibilityRole="button"
            accessibilityLabel={`Открыть ${place.title} на карте`}
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionBtnSecondary,
              pressed && PRESSED_OPACITY,
            ]}
          >
            <Feather name="map" size={14} color={colors.text} />
            <Text style={styles.cardActionBtnText}>На карте</Text>
          </Pressable>
          {place.urlTravel ? (
            <Pressable
              onPress={() => onOpenTravel(place)}
              accessibilityRole="button"
              accessibilityLabel={`Прочитать путешествие для ${place.title}`}
              style={({ pressed }) => [
                styles.cardActionBtn,
                styles.cardActionBtnPrimary,
                pressed && PRESSED_OPACITY,
              ]}
            >
              <Feather name="book-open" size={14} color={colors.textOnPrimary} />
              <Text style={[styles.cardActionBtnText, styles.cardActionBtnTextPrimary]}>
                Прочитать
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
})

function SkeletonGrid({
  styles,
  isCompact,
  isWide,
}: {
  styles: ReturnType<typeof createStyles>
  isCompact: boolean
  isWide: boolean
}) {
  const count = isCompact ? 4 : isWide ? 6 : 4
  return (
    <View style={styles.cardsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, styles.cardInner, styles.skeletonCard]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, { width: '45%', height: 20 }]} />
            <View style={[styles.skeletonLine, { width: '70%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '55%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '100%', height: 1 }]} />
            <View style={styles.skeletonActions}>
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

function StateBlock({
  styles,
  colors,
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  styles: ReturnType<typeof createStyles>
  colors: ThemedColors
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIconWrap}>
        <Feather name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.stateAction, pressed && PRESSED_OPACITY]}
      >
        <Text style={styles.stateActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  )
}

function getPlacesCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'место'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места'
  return 'мест'
}

const createStyles = (colors: ThemedColors, isCompact: boolean, isWide: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  srOnly: Platform.select({
    web: {
      position: 'absolute' as const,
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden' as const,
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    },
    default: { display: 'none' as const },
  }) as any,
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingBottom: DESIGN_TOKENS.spacing.xxl,
  },

  // ─── Hero (slim bar) ───
  hero: {
    marginHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    marginTop: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h2,
    letterSpacing: -0.4,
  },
  heroCount: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '600',
  },

  // ─── Search ───
  searchSection: {
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
  searchBox: {
    height: 52,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    } as any) : null),
  },
  searchIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    outlineStyle: 'none' as any,
  },
  searchClear: {
    padding: 6,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },

  // ─── Countries ───
  countrySection: {
    paddingBottom: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h3,
  },
  clearLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  clearLinkText: {
    color: colors.primary,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  countryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
  },
  filterChipCompact: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    minHeight: 30,
    borderRadius: DESIGN_TOKENS.radii.full,
  },
  skeletonChip: {
    height: 30,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 17,
  },

  // ─── Featured «Подборка» ───
  collectionSection: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  collectionList: {
    gap: 6,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  featuredCardActive: {
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
  },
  featuredSelectArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  featuredIconWrap: {
    width: 28,
    height: 28,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primaryAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featuredTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  featuredLabel: {
    color: colors.primaryText,
    fontSize: isCompact ? DESIGN_TOKENS.typography.sizes.sm : 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: isCompact ? 18 : 15,
  },
  featuredName: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 17,
  },
  featuredCount: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  featuredClear: {
    width: 24,
    height: 24,
    borderRadius: DESIGN_TOKENS.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },

  // ─── Layout ───
  layout: {
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: 'flex-start',
    gap: 0,
    marginTop: DESIGN_TOKENS.spacing.md,
  },

  // ─── Mobile filter bar ───
  mobileFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mobileFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    flex: 1,
  },
  mobileFilterToggleText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  mobileFilterToggleTextActive: {
    color: colors.primary,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '800',
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  resetBtnText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── Sidebar ───
  sidebar: {
    width: isCompact ? '100%' : 280,
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    borderRightWidth: isCompact ? 0 : StyleSheet.hairlineWidth,
    borderRightColor: colors.borderLight,
    borderBottomWidth: isCompact ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: colors.borderLight,
    ...(Platform.OS === 'web' && !isCompact ? ({
      position: 'sticky' as any,
      top: 0,
      maxHeight: '100vh',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: `${colors.borderLight} transparent`,
    } as any) : null),
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  selectedBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  selectedBadgeText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '800',
  },
  sidebarResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  sidebarResetBtnText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── Main / Results ───
  main: {
    flex: 1,
    minWidth: 0,
    width: isCompact ? '100%' : undefined,
    gap: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.xl,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.md,
  },
  resultsTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  resultsTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h1,
  },
  resultsMeta: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '500',
  },

  // ─── Active selection chips ───
  activeSelection: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  activeSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  activeSelectionLabel: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activeSelectionCount: {
    minWidth: 20,
    height: 20,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  activeSelectionCountText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  activeSelectionSpacer: {
    flex: 1,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  activeChipText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
  },

  // ─── Cards grid ───
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.md,
    alignItems: 'stretch',
  },

  // ─── Card ───
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: isCompact ? '100%' : isWide ? '30%' : '46%',
    minWidth: isCompact ? undefined : isWide ? 280 : 260,
    maxWidth: isCompact ? '100%' : isWide ? '33.333%' : '50%',
  },
  cardInner: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        boxShadow: colors.boxShadows.card,
      } as any,
      ios: colors.shadows.medium,
      android: { elevation: colors.shadows.medium.elevation },
      default: {},
    }),
  },
  cardPressed: {
    ...Platform.select({ web: { transform: 'scale(0.992)' } as any }),
    opacity: Platform.OS === 'web' ? 1 : 0.9,
  },

  // ─── Card media ───
  cardMediaWrap: {
    position: 'relative',
    width: '100%',
    height: isCompact ? 156 : isWide ? 170 : 160,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  cardMedia: {
    width: '100%',
    height: '100%',
  },
  cardMediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMediaScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: colors.overlayLight,
    pointerEvents: 'none',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 5,
    pointerEvents: 'none',
    ...Platform.select({
      web: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any,
    }),
  },
  categoryBadgeText: {
    color: colors.textOnDark,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Card body ───
  cardBody: {
    padding: isCompact ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  cardTitle: {
    fontSize: isCompact ? 15 : 16,
    lineHeight: isCompact ? 20 : 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  cardTitlePressable: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardAddress: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
  },
  cardCountryTag: {
    flexShrink: 0,
    maxWidth: '40%',
    color: colors.textSubtle ?? colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginTop: 2,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.full,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardActionBtnSecondary: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardActionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  cardActionBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  cardActionBtnTextPrimary: {
    color: colors.textOnPrimary,
  },

  // ─── Skeleton ───
  skeletonCard: {
    // visual style applied via cardInner; this only adds skeleton-specific overrides
    borderColor: colors.borderLight,
  },
  skeletonImage: {
    height: isCompact ? 156 : isWide ? 170 : 160,
    backgroundColor: colors.backgroundSecondary,
  },
  skeletonBody: {
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  skeletonLine: {
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    height: 14,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: 2,
  },

  // ─── Load more ───
  loadMoreFooter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  loadMoreText: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.bodySmall,
    fontWeight: '600',
  },

  // ─── State blocks ───
  stateBlock: {
    minHeight: 320,
    borderRadius: DESIGN_TOKENS.radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.xxl,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  stateTitle: {
    color: colors.text,
    ...DESIGN_TOKENS.typography.scale.h2,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    ...DESIGN_TOKENS.typography.scale.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  stateAction: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    minHeight: 44,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
  },
  stateActionText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
})
