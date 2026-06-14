import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
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
import { useQuery } from '@tanstack/react-query'

import { fetchPlacesCatalog } from '@/api/places'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { Menu } from '@/ui/paper'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { stringifyJsonLd } from '@/utils/jsonLd'
import {
  filterCatalogPlaces,
  groupCatalogPlaces,
  groupCatalogCountries,
  type CatalogPlace,
} from '@/utils/placesCatalog'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH, getSiteBaseUrl } from '@/utils/seo'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'
import ContributionBanner from '@/components/common/ContributionBanner'

import {
  type CategoryCollection,
  INTERESTING_CATEGORY_COLLECTIONS,
  LOAD_MORE_SCROLL_THRESHOLD,
  MAP_FOCUS_RADIUS_KM,
  PLACES_PAGE_SIZE,
  PRESSED_OPACITY,
  getActiveCategoryTitle,
  getPlacesCountLabel,
  isSameCategorySet,
  parseCategoryParam,
} from './PlacesScreen.helpers'
import { PlaceCard, SkeletonGrid, StateBlock } from './PlacesScreen.parts'
import { createStyles } from './PlacesScreen.styles'

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    parseCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [visibleCount, setVisibleCount] = useState(PLACES_PAGE_SIZE)
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
      const normalizedCategoryQuery = deferredCategoryQuery.trim().toLowerCase()
      return groupCatalogPlaces(placesForCategoryCounts)
        .filter((group) => {
          if (!normalizedCategoryQuery) return true
          return group.category.toLowerCase().includes(normalizedCategoryQuery)
        })
        .sort((a, b) => {
          const aSelected = selectedSet.has(a.category)
          const bSelected = selectedSet.has(b.category)
          if (aSelected !== bSelected) return aSelected ? -1 : 1
          return 0
        })
    },
    [deferredCategoryQuery, placesForCategoryCounts, selectedCategories],
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
  const seoPlaces = useMemo(() => filteredPlaces.slice(0, 12), [filteredPlaces])
  const placesJsonLd = useMemo(() => {
    if (Platform.OS !== 'web' || !isFocused || seoPlaces.length === 0) return undefined
    const base = getSiteBaseUrl().replace(/\/$/, '')
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: seoHeading,
      numberOfItems: filteredPlaces.length,
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
  }, [filteredPlaces.length, isFocused, seoHeading, seoPlaces])

  const syncCategoryParams = useCallback((categories: string[]) => {
    router.setParams(categories.length > 0 ? { category: categories.join(',') } : { category: '' })
  }, [router])

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next)
    router.setParams(next ? { q: next } : { q: '' })
  }, [router])

  // Sync URL params → state when ?category/?country change without a remount
  // (e.g. in-app navigation to /places?category=...). Guarded on value equality
  // so it never loops with the syncCategoryParams/handleSelectCountry setParams calls.
  useEffect(() => {
    const nextCategories = parseCategoryParam(params.category)
    setSelectedCategories((current) =>
      isSameCategorySet(current, nextCategories) ? current : nextCategories,
    )
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

  const hasActiveFilters = selectedCategories.length > 0 || !!selectedCountry || !!query
  const selectedCategoryCount = selectedCategories.length
  const hasCategorySearch = deferredCategoryQuery.trim().length > 0

  const resetAll = useCallback(() => {
    handleQueryChange('')
    setCategoryQuery('')
    handleClearCategories()
    handleSelectCountry(null)
  }, [handleQueryChange, handleClearCategories, handleSelectCountry])

  const resultsStatus: 'loading' | 'error' | 'empty' | 'list' = placesQuery.isLoading
    ? 'loading'
    : placesQuery.isError
      ? 'error'
      : filteredPlaces.length === 0
        ? 'empty'
        : 'list'

  const useVirtualList = Platform.OS !== 'web' && isCompact && resultsStatus === 'list'

  const renderVirtualCard = useCallback(
    ({ item }: { item: CatalogPlace }) => (
      <View style={styles.virtualCardItem}>
        <PlaceCard
          place={item}
          styles={styles}
          colors={colors}
          onOpenMap={openOnMap}
          onOpenTravel={openTravel}
        />
      </View>
    ),
    [styles, colors, openOnMap, openTravel],
  )

  const keyExtractor = useCallback((item: CatalogPlace) => item.id, [])

  const loadMoreBlock = hasMorePlaces ? (
    <View style={styles.loadMoreFooter}>
      <Text style={styles.loadMoreText}>
        Показано {visiblePlaces.length} из {filteredPlaces.length}
      </Text>
      <Button label="Показать ещё" variant="secondary" size="sm" onPress={loadMorePlaces} />
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
    resultsContent = allPlaces.length === 0 ? (
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
        {loadMoreBlock}
      </View>
    )
  }

  const pageChrome = (
    <>
        <View style={styles.topBar} onLayout={handleTopBarLayout}>
          <View style={styles.topBarMeta}>
            <View style={styles.heroTitleRow}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.heroTitle}>Места</Text>
              {showLoadedCounts ? (
                <Text style={styles.heroCount}>· {allPlaces.length} в каталоге</Text>
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
                  accessibilityState={{ expanded: countryMenuVisible, disabled: placesQuery.isLoading }}
                  disabled={placesQuery.isLoading}
                  style={({ pressed }) => [
                    styles.countrySelect,
                    !!selectedCountry && styles.countrySelectActive,
                    pressed && !placesQuery.isLoading && PRESSED_OPACITY,
                    placesQuery.isLoading && styles.countrySelectDisabled,
                  ]}
                >
                  <Feather name="globe" size={16} color={selectedCountry ? colors.primary : colors.textMuted} />
                  <View style={styles.countrySelectTextBlock}>
                    <Text style={styles.countrySelectLabel}>Страна</Text>
                    <Text style={styles.countrySelectValue} numberOfLines={1}>
                      {selectedCountry ?? 'Все страны'}
                      {showLoadedCounts && !selectedCountry ? ` (${placesForCountryCounts.length})` : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              }
            >
              <Menu.Item
                title={showLoadedCounts ? `Все страны (${placesForCountryCounts.length})` : 'Все страны'}
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
              {countryGroups.map((group) => (
                <Menu.Item
                  key={group.country}
                  title={`${group.country} (${group.count})`}
                  onPress={() => handleSelectCountry(group.country)}
                  leadingIcon={({ size }) => (
                    <Feather
                      name={selectedCountry === group.country ? 'check-circle' : 'circle'}
                      size={size}
                      color={selectedCountry === group.country ? colors.primary : colors.textMuted}
                    />
                  )}
                  titleStyle={selectedCountry === group.country ? styles.countryMenuItemTextActive : styles.countryMenuItemText}
                />
              ))}
            </Menu>
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
                <Feather name="sliders" size={16} color={selectedCategoryCount > 0 ? colors.primary : colors.text} />
                <Text style={[styles.mobileFilterToggleText, selectedCategoryCount > 0 && styles.mobileFilterToggleTextActive]}>
                  Категории
                </Text>
                {selectedCategoryCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedCategoryCount}</Text>
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
                {selectedCategories.length > 0 ? (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>{selectedCategories.length}</Text>
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
              {!hasCategorySearch ? (
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
                            {/* Reserve the count slot from first paint so the count
                                appearing after load does not narrow the text block and
                                re-wrap featuredName, which caused cascading CLS on /places. */}
                            <View style={styles.featuredCountSlot}>
                              {showLoadedCounts ? (
                                <Text style={styles.featuredCount}>{collection.count}</Text>
                              ) : null}
                            </View>
                          </Pressable>
                          {selected ? (
                            <Pressable
                              onPress={handleClearCategories}
                              accessibilityRole="button"
                              accessibilityLabel={`Очистить подборку ${collection.title}`}
                              hitSlop={10}
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
              ) : null}

              <Text style={styles.hintText}>
                {hasCategorySearch ? 'Найденные категории' : 'Или выберите категории вручную'}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Все категории"
                  count={showLoadedCounts ? placesForCategoryCounts.length : undefined}
                  selected={selectedCategories.length === 0}
                  onPress={handleClearCategories}
                  style={styles.filterChipCompact}
                  testID="places-category-chip-all"
                />
                {categoryGroups.map((group) => (
                  <Chip
                    key={group.category}
                    label={group.category}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCategories.includes(group.category)}
                    onPress={() => handleToggleCategory(group.category)}
                    style={styles.filterChipCompact}
                    testID={`places-category-chip-${group.category}`}
                  />
                ))}
                {categoryGroups.length === 0 && deferredCategoryQuery.trim() ? (
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
                  {placesQuery.isLoading
                    ? 'Загружаем подборку...'
                    : hasActiveFilters && filteredPlaces.length < allPlaces.length
                      ? `${filteredPlaces.length} из ${allPlaces.length} ${getPlacesCountLabel(allPlaces.length)}`
                      : `${filteredPlaces.length} ${getPlacesCountLabel(filteredPlaces.length)}`}
                </Text>
              </View>
              {selectedCategories.length > 0 ? (
                <Button
                  label="Все места"
                  variant="outline"
                  size="sm"
                  onPress={handleClearCategories}
                />
              ) : null}
            </View>

            {useVirtualList ? null : resultsContent}
          </View>
        </View>
    </>
  )

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
      {useVirtualList ? (
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          data={visiblePlaces}
          keyExtractor={keyExtractor}
          renderItem={renderVirtualCard}
          ListHeaderComponent={pageChrome}
          ListFooterComponent={
            <>
              {loadMoreBlock}
              <ContributionBanner variant="places" />
            </>
          }
          onEndReached={loadMorePlaces}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={9}
        />
      ) : (
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
      )}
    </View>
  )
}
