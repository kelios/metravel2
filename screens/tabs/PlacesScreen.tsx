import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { fetchPlacesCatalog } from '@/api/places'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { Menu } from '@/ui/paper'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { type CatalogPlace } from '@/utils/placesCatalog'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH, getSiteBaseUrl } from '@/utils/seo'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'
import ContributionBanner from '@/components/common/ContributionBanner'

import {
  LOAD_MORE_SCROLL_THRESHOLD,
  MAP_FOCUS_RADIUS_KM,
  PLACES_PAGE_SIZE,
  PRESSED_OPACITY,
  getPlacesCountLabel,
} from './PlacesScreen.helpers'
import { PlaceCard, SkeletonGrid, StateBlock } from './PlacesScreen.parts'
import { createStyles } from './PlacesScreen.styles'

const parseSingleCategoryParam = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const first = value
    .split(',')
    .map((item) => decodeURIComponent(item).trim())
    .filter(Boolean)[0]
  return first ?? null
}

export default function PlacesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; country?: string; q?: string }>()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isCompact = width < 760
  const isWide = width >= 1100
  const styles = useMemo(() => createStyles(colors, isCompact, isWide), [colors, isCompact, isWide])
  const [query, setQuery] = useState(() =>
    typeof params.q === 'string' ? params.q : '',
  )
  const deferredQuery = useDeferredValue(query)
  const [categoryQuery, setCategoryQuery] = useState('')
  const deferredCategoryQuery = useDeferredValue(categoryQuery)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
    parseSingleCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countryMenuVisible, setCountryMenuVisible] = useState(false)
  // Height of the sticky topBar (web) so the sticky sidebar can sit just below it
  // instead of being hidden behind it.
  const [topBarHeight, setTopBarHeight] = useState(0)
  const handleTopBarLayout = useCallback((event: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return
    const height = Number(event?.nativeEvent?.layout?.height ?? 0)
    if (height > 0) setTopBarHeight((current) => (Math.abs(current - height) < 1 ? current : height))
  }, [])

  const listParams = useMemo(
    () => ({
      q: deferredQuery.trim() || undefined,
      categories: selectedCategory ? [selectedCategory] : undefined,
      country: selectedCountry ?? undefined,
    }),
    [deferredQuery, selectedCategory, selectedCountry],
  )

  // Main paginated list — filters go to the server (q/category/country) and pages
  // are fetched on demand instead of loading the whole 2000+ catalog into memory.
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

  // Facets (category / country chips + counts) come from a category-agnostic query
  // so the chip list stays complete while a category is selected. It mirrors the
  // active q/country filter, matching the map endpoint's cross-filtered counts.
  const facetsParams = useMemo(
    () => ({ q: deferredQuery.trim() || undefined, country: selectedCountry ?? undefined }),
    [deferredQuery, selectedCountry],
  )
  const facetsQuery = useQuery({
    queryKey: ['places-catalog', 'facets', facetsParams],
    queryFn: ({ signal }) =>
      fetchPlacesCatalog({ page: 1, perPage: 1, ...facetsParams }, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  const visiblePlaces = useMemo(
    () => placesQuery.data?.pages.flatMap((page) => page.places) ?? [],
    [placesQuery.data],
  )
  const totalCount = placesQuery.data?.pages[0]?.count ?? 0
  const catalogTotal = facetsQuery.data?.count ?? 0
  const categoryFacets = useMemo(() => facetsQuery.data?.categoryFacets ?? [], [facetsQuery.data])
  const countryFacets = useMemo(() => facetsQuery.data?.countryFacets ?? [], [facetsQuery.data])

  const filteredCategoryFacets = useMemo(() => {
    const normalized = deferredCategoryQuery.trim().toLowerCase()
    const list = normalized
      ? categoryFacets.filter((facet) => facet.name.toLowerCase().includes(normalized))
      : categoryFacets
    if (!selectedCategory) return list
    // Keep the selected category reachable even if the facet list is filtered.
    return list.some((facet) => facet.name === selectedCategory)
      ? list
      : [{ id: null, name: selectedCategory, count: 0 }, ...list]
  }, [categoryFacets, deferredCategoryQuery, selectedCategory])

  const hasMorePlaces = placesQuery.hasNextPage
  const showLoadedCounts = !facetsQuery.isLoading && !facetsQuery.isError
  // First grid row(s) are above the fold — decode those eagerly with high
  // priority so the first screen shows sharp photos instead of blur on load.
  const gridColumns = isWide ? 3 : isCompact ? 1 : 2
  const firstScreenCount = gridColumns * 2

  const activeCategoryTitle = selectedCategory ?? 'Все места'
  const pageDescription = selectedCategory
    ? `Места категории «${selectedCategory}». Карточки точек, переход на карту и ссылка на путешествие.`
    : 'Каталог мест MeTravel: замки, музеи, парки, природные точки и другие места из путешествий.'

  // ─── SEO ───
  const seoHeading = useMemo(() => {
    const parts = ['Места']
    if (selectedCategory) parts.push(selectedCategory)
    if (selectedCountry) parts.push(selectedCountry)
    return parts.join(' — ')
  }, [selectedCategory, selectedCountry])
  const seoTitle = `${seoHeading} | MeTravel`
  const seoPlaces = useMemo(() => visiblePlaces.slice(0, 12), [visiblePlaces])
  const placesJsonLd = useMemo(() => {
    if (Platform.OS !== 'web' || !isFocused || seoPlaces.length === 0) return undefined
    const base = getSiteBaseUrl().replace(/\/$/, '')
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: seoHeading,
      numberOfItems: totalCount,
      itemListElement: seoPlaces.map((place, index) => {
          const internal = place.urlTravel
            ? normalizeRelatedTravelRoute(place.urlTravel)
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
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }}
      />
    )
  }, [isFocused, seoHeading, seoPlaces, totalCount])

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next)
    router.setParams(next ? { q: next } : { q: '' })
  }, [router])

  // Sync URL params → state when ?category/?country change without a remount
  // (e.g. in-app navigation to /places?category=...). Guarded on value equality
  // so it never loops with the setParams calls in the handlers below.
  useEffect(() => {
    const nextCategory = parseSingleCategoryParam(params.category)
    setSelectedCategory((current) => (current === nextCategory ? current : nextCategory))
  }, [params.category])

  useEffect(() => {
    const nextCountry =
      typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null
    setSelectedCountry((current) => (current === nextCountry ? current : nextCountry))
  }, [params.country])

  useEffect(() => {
    const nextQuery = typeof params.q === 'string' ? params.q : ''
    setQuery((current) => (current === nextQuery ? current : nextQuery))
  }, [params.q])

  const loadMorePlaces = useCallback(() => {
    if (placesQuery.hasNextPage && !placesQuery.isFetchingNextPage) {
      void placesQuery.fetchNextPage()
    }
  }, [placesQuery])

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMorePlaces || placesQuery.isFetchingNextPage) return
    const nativeEvent = event?.nativeEvent
    const layoutHeight = Number(nativeEvent?.layoutMeasurement?.height ?? 0)
    const offsetY = Number(nativeEvent?.contentOffset?.y ?? 0)
    const contentHeight = Number(nativeEvent?.contentSize?.height ?? 0)
    if (!layoutHeight || !contentHeight) return

    const distanceToBottom = contentHeight - (layoutHeight + offsetY)
    if (distanceToBottom <= LOAD_MORE_SCROLL_THRESHOLD) {
      loadMorePlaces()
    }
  }, [hasMorePlaces, loadMorePlaces, placesQuery.isFetchingNextPage])

  const handleSelectCategory = useCallback((category: string | null) => {
    setSelectedCategory((current) => {
      const next = current === category ? null : category
      router.setParams(next ? { category: next } : { category: '' })
      return next
    })
  }, [router])

  const handleClearCategory = useCallback(() => {
    setSelectedCategory(null)
    router.setParams({ category: '' })
  }, [router])

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
    if (internalRoute) {
      router.push(internalRoute as any)
      return
    }
    void openExternalUrlInNewTab(place.urlTravel)
  }, [router])

  const hasActiveFilters = !!selectedCategory || !!selectedCountry || !!query
  const hasCategorySearch = deferredCategoryQuery.trim().length > 0

  const resetAll = useCallback(() => {
    handleQueryChange('')
    setCategoryQuery('')
    handleClearCategory()
    handleSelectCountry(null)
  }, [handleQueryChange, handleClearCategory, handleSelectCountry])

  const isInitialLoading = placesQuery.isLoading
  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' = isInitialLoading
    ? 'loading'
    : placesQuery.isError
      ? 'error'
      : visiblePlaces.length === 0
        ? 'empty'
        : 'list'

  // Compact "app" chrome — a sticky compact filter bar (search + Категории + страна
  // + Сбросить) pinned above a single scrolling column of cards. Used on every mobile
  // width, web and native alike, so /places renders identically across platforms; the
  // full stacked topBar/sidebar is desktop-only. Both platforms share one ScrollView
  // path (no native FlatList) to guarantee the same layout and scroll behaviour.
  const mobileCompact = isCompact

  const loadMoreBlock = hasMorePlaces ? (
    <View style={styles.loadMoreFooter}>
      <Text style={styles.loadMoreText}>
        Показано {visiblePlaces.length} из {totalCount}
      </Text>
      <Button
        label="Показать ещё"
        variant="secondary"
        size="sm"
        onPress={loadMorePlaces}
        loading={placesQuery.isFetchingNextPage}
      />
    </View>
  ) : null

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
        description="Проверьте соединение и попробуйте снова."
        actionLabel="Повторить"
        onAction={() => placesQuery.refetch()}
        pending={placesQuery.isFetching}
        pendingLabel="Загружаем…"
      />
    )
  } else if (resultsStatus === 'empty') {
    resultsContent = catalogTotal === 0 && !hasActiveFilters ? (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="inbox"
        title="Каталог пока пуст"
        description="Скоро здесь появятся места из путешествий."
        actionLabel="Обновить"
        onAction={() => placesQuery.refetch()}
        pending={placesQuery.isFetching}
        pendingLabel="Обновляем…"
      />
    ) : (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="map-pin"
        title={
          deferredQuery
            ? `По запросу «${deferredQuery}» ничего не найдено`
            : 'Места не найдены'
        }
        description={
          deferredQuery
            ? 'Попробуйте другое название или сбросьте фильтры.'
            : 'Измените категорию или страну.'
        }
        actionLabel="Сбросить фильтры"
        onAction={resetAll}
      />
    )
  } else {
    resultsContent = (
      <View style={styles.cardsGrid}>
        {visiblePlaces.map((place, index) => (
          <PlaceCard
            key={place.id}
            place={place}
            styles={styles}
            colors={colors}
            onOpenMap={openOnMap}
            onOpenTravel={openTravel}
            priority={index < firstScreenCount}
          />
        ))}
        {loadMoreBlock}
      </View>
    )
  }

  const pageChrome = (
    <>
        {mobileCompact ? null : (
        <View style={styles.topBar} onLayout={handleTopBarLayout}>
          <View style={styles.topBarMeta}>
            <View style={styles.heroTitleRow}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.heroTitle}>Места</Text>
              {showLoadedCounts ? (
                <Text style={styles.heroCount}>· {catalogTotal} в каталоге</Text>
              ) : null}
            </View>
            <Text style={styles.topBarHint} numberOfLines={1}>
              {activeCategoryTitle}
              {selectedCountry ? ` · ${selectedCountry}` : ''}
            </Text>
          </View>

          <View style={styles.topBarControls}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Поиск по названию или адресу..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel="Найти место"
              />
              {query ? (
                <Pressable
                  onPress={() => handleQueryChange('')}
                  accessibilityRole="button"
                  accessibilityLabel="Очистить поиск"
                  hitSlop={10}
                  style={({ pressed }) => [styles.searchClear, pressed && PRESSED_OPACITY]}
                >
                  <Feather name="x" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <Menu
              visible={countryMenuVisible}
              onDismiss={() => setCountryMenuVisible(false)}
              contentStyle={styles.countryMenuContent}
              anchor={
                <Pressable
                  onPress={() => setCountryMenuVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Выбрать страну"
                  accessibilityState={{ expanded: countryMenuVisible, disabled: facetsQuery.isLoading }}
                  disabled={facetsQuery.isLoading}
                  style={({ pressed }) => [
                    styles.countrySelect,
                    !!selectedCountry && styles.countrySelectActive,
                    pressed && !facetsQuery.isLoading && PRESSED_OPACITY,
                    facetsQuery.isLoading && styles.countrySelectDisabled,
                  ]}
                >
                  <Feather name="globe" size={16} color={selectedCountry ? colors.primary : colors.textMuted} />
                  <View style={styles.countrySelectTextBlock}>
                    <Text style={styles.countrySelectLabel}>Страна</Text>
                    <Text style={styles.countrySelectValue} numberOfLines={1}>
                      {selectedCountry ?? 'Все страны'}
                      {showLoadedCounts && !selectedCountry ? ` (${catalogTotal})` : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              }
            >
              <Menu.Item
                title={showLoadedCounts ? `Все страны (${catalogTotal})` : 'Все страны'}
                onPress={() => handleSelectCountry(null)}
                leadingIcon={({ size }) => (
                  <Feather
                    name={selectedCountry ? 'circle' : 'check-circle'}
                    size={size}
                    color={selectedCountry ? colors.textMuted : colors.primary}
                  />
                )}
                titleStyle={selectedCountry ? styles.countryMenuItemText : styles.countryMenuItemTextActive}
              />
              {countryFacets.map((group) => (
                <Menu.Item
                  key={group.name}
                  title={`${group.name} (${group.count})`}
                  onPress={() => handleSelectCountry(group.name)}
                  leadingIcon={({ size }) => (
                    <Feather
                      name={selectedCountry === group.name ? 'check-circle' : 'circle'}
                      size={size}
                      color={selectedCountry === group.name ? colors.primary : colors.textMuted}
                    />
                  )}
                  titleStyle={selectedCountry === group.name ? styles.countryMenuItemTextActive : styles.countryMenuItemText}
                />
              ))}
            </Menu>
          </View>
        </View>
        )}

        {/* ─── Main layout ─── */}
        <View style={styles.layout}>
          {/* Sidebar / collapsible filter. On mobile (compact) the search + category
              toggle live in the sticky compact bar above the scroll area, so the
              category list only expands here when the user opens the filter. */}
          {(!isCompact || filtersOpen) ? (
            <View
              style={[
                styles.sidebar,
                Platform.OS === 'web' && !isCompact && topBarHeight > 0
                  ? ({ top: topBarHeight, maxHeight: `calc(100vh - ${topBarHeight}px)` } as any)
                  : null,
              ]}
            >
              <View style={styles.sidebarHeader}>
                <Text style={styles.sectionTitle}>Категории</Text>
                {selectedCategory ? (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>1</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.categorySearchBox}>
                <Feather
                  name="search"
                  size={15}
                  color={colors.textMuted}
                  style={styles.categorySearchIcon}
                />
                <TextInput
                  value={categoryQuery}
                  onChangeText={setCategoryQuery}
                  placeholder="Найти категорию..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.categorySearchInput}
                  returnKeyType="search"
                  accessibilityLabel="Поиск категории"
                  testID="places-category-search-input"
                />
                {categoryQuery ? (
                  <Pressable
                    onPress={() => setCategoryQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Очистить поиск категории"
                    hitSlop={10}
                    style={({ pressed }) => [styles.categorySearchClear, pressed && PRESSED_OPACITY]}
                  >
                    <Feather name="x" size={14} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.hintText}>
                {hasCategorySearch ? 'Найденные категории' : 'Выберите категорию'}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Все категории"
                  count={showLoadedCounts ? catalogTotal : undefined}
                  selected={!selectedCategory}
                  onPress={handleClearCategory}
                  style={styles.filterChipCompact}
                  testID="places-category-chip-all"
                />
                {filteredCategoryFacets.map((group) => (
                  <Chip
                    key={group.name}
                    label={group.name}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCategory === group.name}
                    onPress={() => handleSelectCategory(group.name)}
                    style={styles.filterChipCompact}
                    testID={`places-category-chip-${group.name}`}
                  />
                ))}
                {filteredCategoryFacets.length === 0 && deferredCategoryQuery.trim() ? (
                  <View style={styles.categorySearchEmpty} testID="places-category-search-empty">
                    <Text style={styles.categorySearchEmptyText}>
                      Категории не найдены
                    </Text>
                  </View>
                ) : null}
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
                  {isInitialLoading
                    ? 'Загружаем подборку...'
                    : `${totalCount} ${getPlacesCountLabel(totalCount)}`}
                </Text>
              </View>
              {selectedCategory ? (
                <Button
                  label="Все места"
                  variant="outline"
                  onPress={handleClearCategory}
                />
              ) : null}
            </View>

            {resultsContent}
          </View>
        </View>
    </>
  )

  // Mobile compact sticky bar pinned above the scroll area so search + category
  // filter are always reachable. Kept ≤~20% of the viewport: single search row +
  // a filter/reset row, no large title (the big resultsTitle stays in the
  // scrollable pageChrome). Shared by web + native for parity.
  const compactFixedBar = mobileCompact ? (
    <View style={styles.compactBar}>
      <View style={styles.compactSearchBox}>
        <Feather name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Поиск места..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Найти место"
        />
        {query ? (
          <Pressable
            onPress={() => handleQueryChange('')}
            accessibilityRole="button"
            accessibilityLabel="Очистить поиск"
            hitSlop={10}
            style={({ pressed }) => [styles.searchClear, pressed && PRESSED_OPACITY]}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.compactBarRow}>
        <Pressable
          onPress={() => setFiltersOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          style={({ pressed }) => [
            styles.compactFilterToggle,
            !!selectedCategory && styles.compactFilterToggleActive,
            pressed && PRESSED_OPACITY,
          ]}
        >
          <Feather name="sliders" size={16} color={selectedCategory ? colors.primary : colors.text} />
          <Text
            numberOfLines={1}
            style={[styles.mobileFilterToggleText, !!selectedCategory && styles.mobileFilterToggleTextActive]}
          >
            Категории
          </Text>
          {selectedCategory ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>1</Text>
            </View>
          ) : null}
          <Feather
            name={filtersOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>

        <Menu
          visible={countryMenuVisible}
          onDismiss={() => setCountryMenuVisible(false)}
          contentStyle={styles.countryMenuContent}
          anchor={
            <Pressable
              onPress={() => setCountryMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Выбрать страну"
              accessibilityState={{ expanded: countryMenuVisible, disabled: facetsQuery.isLoading }}
              disabled={facetsQuery.isLoading}
              style={({ pressed }) => [
                styles.compactCountrySelect,
                !!selectedCountry && styles.compactCountrySelectActive,
                pressed && !facetsQuery.isLoading && PRESSED_OPACITY,
                facetsQuery.isLoading && styles.countrySelectDisabled,
              ]}
            >
              <Feather name="globe" size={16} color={selectedCountry ? colors.primary : colors.textMuted} />
              <Text
                style={[
                  styles.compactCountrySelectValue,
                  !!selectedCountry && styles.compactCountrySelectValueActive,
                ]}
                numberOfLines={1}
              >
                {selectedCountry ?? 'Все страны'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          }
        >
          <Menu.Item
            title={showLoadedCounts ? `Все страны (${catalogTotal})` : 'Все страны'}
            onPress={() => handleSelectCountry(null)}
            leadingIcon={({ size }) => (
              <Feather
                name={selectedCountry ? 'circle' : 'check-circle'}
                size={size}
                color={selectedCountry ? colors.textMuted : colors.primary}
              />
            )}
            titleStyle={selectedCountry ? styles.countryMenuItemText : styles.countryMenuItemTextActive}
          />
          {countryFacets.map((group) => (
            <Menu.Item
              key={group.name}
              title={`${group.name} (${group.count})`}
              onPress={() => handleSelectCountry(group.name)}
              leadingIcon={({ size }) => (
                <Feather
                  name={selectedCountry === group.name ? 'check-circle' : 'circle'}
                  size={size}
                  color={selectedCountry === group.name ? colors.primary : colors.textMuted}
                />
              )}
              titleStyle={selectedCountry === group.name ? styles.countryMenuItemTextActive : styles.countryMenuItemText}
            />
          ))}
        </Menu>

        {hasActiveFilters ? (
          <Pressable
            onPress={resetAll}
            accessibilityRole="button"
            accessibilityLabel="Сбросить фильтры"
            style={({ pressed }) => [styles.resetBtn, pressed && PRESSED_OPACITY]}
          >
            <Text style={styles.resetBtnText}>Сбросить</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null

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
      {compactFixedBar}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={180}
      >
        {pageChrome}
        <ContributionBanner variant="places" />
      </ScrollView>
    </View>
  )
}
