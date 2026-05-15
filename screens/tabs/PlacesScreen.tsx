import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
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

const parseCategoryParam = (value: unknown): string[] => {
  if (typeof value !== 'string') return [...DEFAULT_CATEGORY_SELECTION]
  const parsed = value
    .split(',')
    .map((item) => decodeURIComponent(item).trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : []
}

const arraysEqualSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

const getActiveCategoryTitle = (categories: string[]): string => {
  if (categories.length === 0) return 'Все места'
  if (arraysEqualSet(categories, [...DEFAULT_CATEGORY_SELECTION])) return FEATURED_CATEGORY_LABEL
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    parseCategoryParam(params.category),
  )
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    typeof params.country === 'string' && params.country.trim() ? params.country.trim() : null,
  )
  const [visibleCount, setVisibleCount] = useState(PLACES_PAGE_SIZE)

  const placesQuery = useQuery({
    queryKey: ['places-catalog'],
    queryFn: ({ signal }) => fetchPlacesCatalog(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: false,
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
  const defaultSelectionCount = useMemo(
    () => filterCatalogPlaces(allPlaces, '', [...DEFAULT_CATEGORY_SELECTION], selectedCountry).length,
    [allPlaces, selectedCountry],
  )
  const countryGroups = useMemo(
    () => groupCatalogCountries(placesForCountryCounts),
    [placesForCountryCounts],
  )
  const filteredPlaces = useMemo(
    () => filterCatalogPlaces(allPlaces, query, selectedCategories, selectedCountry),
    [allPlaces, query, selectedCategories, selectedCountry],
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

  const syncCategoryParams = useCallback((categories: string[]) => {
    router.setParams(categories.length > 0 ? { category: categories.join(',') } : { category: '' })
  }, [router])

  useEffect(() => {
    setVisibleCount(PLACES_PAGE_SIZE)
  }, [query, selectedCategories, selectedCountry])

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

  const handleDefaultCategories = useCallback(() => {
    const next = [...DEFAULT_CATEGORY_SELECTION]
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

  return (
    <View style={styles.screen}>
      {Platform.OS === 'web' && isFocused ? (
        <InstantSEO
          headKey="places"
          title="Места | MeTravel"
          description={pageDescription}
          canonical={buildCanonicalUrl('/places')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={180}
      >
        {/* ─── Hero ─── */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>Каталог точек</Text>
            </View>
            <Text style={styles.heroTitle}>Места</Text>
            <Text style={styles.heroSubtitle}>
              Все точки из путешествий — отдельно от радиуса карты. Выберите категорию,
              откройте место на карте или перейдите к связанному маршруту.
            </Text>
            {showLoadedCounts ? (
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{allPlaces.length}</Text>
                  <Text style={styles.heroStatLabel}>мест в каталоге</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{countryGroups.length}</Text>
                  <Text style={styles.heroStatLabel}>{countryGroups.length === 1 ? 'страна' : countryGroups.length < 5 ? 'страны' : 'стран'}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{categoryGroups.length}</Text>
                  <Text style={styles.heroStatLabel}>{categoryGroups.length === 1 ? 'категория' : categoryGroups.length < 5 ? 'категории' : 'категорий'}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Search ─── */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color={colors.primary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск по названию или адресу"
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
            {hasActiveFilters ? (
              <Button
                label="Сбросить всё"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setQuery('')
                  handleClearCategories()
                  handleSelectCountry(null)
                }}
              />
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
          <View style={styles.chipRow}>
            {placesQuery.isLoading ? (
              <Text style={styles.hintText}>Загрузка стран...</Text>
            ) : (
              <>
                <Chip
                  label="Все"
                  count={showLoadedCounts ? placesForCountryCounts.length : undefined}
                  selected={!selectedCountry}
                  onPress={() => handleSelectCountry(null)}
                />
                {countryGroups.map((group) => (
                  <Chip
                    key={group.country}
                    label={group.country}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCountry === group.country}
                    onPress={() => handleSelectCountry(group.country)}
                  />
                ))}
              </>
            )}
          </View>
        </View>

        {/* ─── Main layout ─── */}
        <View style={styles.layout}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sectionTitle}>Категории</Text>
              {selectedCategories.length > 0 ? (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>{selectedCategories.length}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.hintText}>
              По умолчанию выбрана подборка. Нажмите на категорию, чтобы изменить фильтр.
            </Text>
            <View style={styles.chipRow}>
              <Chip
                label="Подборка"
                count={showLoadedCounts ? defaultSelectionCount : undefined}
                selected={arraysEqualSet(selectedCategories, [...DEFAULT_CATEGORY_SELECTION])}
                onPress={handleDefaultCategories}
              />
              <Chip
                label="Все"
                count={showLoadedCounts ? placesForCategoryCounts.length : undefined}
                selected={selectedCategories.length === 0}
                onPress={handleClearCategories}
              />
              {categoryGroups.map((group) => (
                <Chip
                  key={group.category}
                  label={group.category}
                  count={showLoadedCounts ? group.count : undefined}
                  selected={selectedCategories.includes(group.category)}
                  onPress={() => handleToggleCategory(group.category)}
                />
              ))}
            </View>
          </View>

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
              {selectedCategories.length > 0 ? (
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
                <Text style={styles.activeSelectionLabel}>Выбрано</Text>
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
                      <Feather name="x" size={12} color={colors.primaryText} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {placesQuery.isLoading ? (
              <LoadingBlock styles={styles} colors={colors} />
            ) : placesQuery.isError ? (
              <StateBlock
                styles={styles}
                icon="alert-circle"
                title="Не удалось загрузить места"
                description="Попробуйте обновить каталог."
                actionLabel="Повторить"
                onAction={() => placesQuery.refetch()}
              />
            ) : filteredPlaces.length === 0 ? (
              <StateBlock
                styles={styles}
                icon="map-pin"
                title="Места не найдены"
                description="Измените категорию, страну или поисковый запрос."
                actionLabel="Сбросить фильтры"
                onAction={() => {
                  setQuery('')
                  handleClearCategories()
                  handleSelectCountry(null)
                }}
              />
            ) : (
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
            )}
          </View>
        </View>
        <ContributionBanner variant="places" />
      </ScrollView>
    </View>
  )
}

function PlaceCard({
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
  return (
    <UnifiedTravelCard
      title={place.title}
      imageUrl={place.imageUrl || place.travelImageThumbUrl || null}
      onPress={() => onOpenMap(place)}
      mediaFit="contain"
      heroTitleOverlay
      imageHeight={220}
      style={styles.card}
      mediaProps={{
        blurBackground: true,
        allowCriticalWebBlur: Platform.OS === 'web',
        loading: 'lazy',
        priority: 'low',
      }}
      contentSlot={
        <View style={styles.cardContent}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{place.category}</Text>
          </View>
          {place.address ? (
            <View style={styles.cardMeta}>
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <Text style={styles.cardAddress} numberOfLines={1}>{place.address}</Text>
            </View>
          ) : null}
          <View style={styles.cardMeta}>
            <Feather name="globe" size={12} color={colors.textMuted} />
            <Text style={styles.cardCountry} numberOfLines={1}>{place.country}</Text>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => onOpenMap(place)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть ${place.title} на карте`}
              style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnSecondary, pressed && PRESSED_OPACITY]}
            >
              <Feather name="map" size={14} color={colors.text} />
              <Text style={styles.cardActionBtnText}>На карте</Text>
            </Pressable>
            {place.urlTravel ? (
              <Pressable
                onPress={() => onOpenTravel(place)}
                accessibilityRole="button"
                accessibilityLabel={`Читать маршрут для ${place.title}`}
                style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnPrimary, pressed && PRESSED_OPACITY]}
              >
                <Feather name="book-open" size={14} color={colors.textOnPrimary} />
                <Text style={[styles.cardActionBtnText, styles.cardActionBtnTextPrimary]}>Маршрут</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      }
    />
  )
}

function LoadingBlock({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createStyles>
  colors: ThemedColors
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIconWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={styles.stateTitle}>Загружаем места</Text>
      <Text style={styles.stateText}>Подготавливаем каталог точек...</Text>
    </View>
  )
}

function StateBlock({
  styles,
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  styles: ReturnType<typeof createStyles>
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIconWrap}>
        <Feather name={icon} size={28} color={styles.stateIconColor.color} />
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
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingBottom: DESIGN_TOKENS.spacing.xxl,
  },

  // ─── Hero ───
  hero: {
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingTop: isCompact ? DESIGN_TOKENS.spacing.xl : DESIGN_TOKENS.spacing.xxl,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  heroInner: {
    gap: DESIGN_TOKENS.spacing.md,
    maxWidth: 680,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: colors.text,
    fontSize: isCompact ? 40 : 56,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: isCompact ? 46 : 62,
  },
  heroSubtitle: {
    display: 'none' as any,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingTop: DESIGN_TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  heroStatItem: {
    gap: 2,
  },
  heroStatValue: {
    color: colors.text,
    fontSize: isCompact ? 22 : 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
    marginHorizontal: DESIGN_TOKENS.spacing.xs,
  },

  // ─── Search ───
  searchSection: {
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
  },
  searchBox: {
    flex: 1,
    minHeight: 52,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
    } as any) : null),
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    outlineStyle: 'none' as any,
  },
  searchClear: {
    padding: 4,
    borderRadius: DESIGN_TOKENS.radii.full,
  },

  // ─── Countries ───
  countrySection: {
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '800',
    letterSpacing: -0.2,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },

  // ─── Layout ───
  layout: {
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: 'flex-start',
    gap: 0,
  },

  // ─── Sidebar ───
  sidebar: {
    width: isCompact ? '100%' : 260,
    gap: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.xl,
    borderRightWidth: isCompact ? 0 : 1,
    borderRightColor: colors.borderLight,
    borderBottomWidth: isCompact ? 1 : 0,
    borderBottomColor: colors.borderLight,
    ...(Platform.OS === 'web' && !isCompact ? ({
      position: 'sticky' as any,
      top: 0,
      maxHeight: '100vh',
      overflowY: 'auto',
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
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  resultsMeta: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '500',
  },

  // ─── Active selection chips ───
  activeSelection: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primarySoft,
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  activeSelectionLabel: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
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
  },

  // ─── Card ───
  card: {
    width: isCompact
      ? '100%'
      : isWide
        ? ('calc(33.333% - 11px)' as any)
        : ('calc(50% - 8px)' as any),
    minWidth: isCompact ? undefined : 260,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({
      boxShadow: DESIGN_TOKENS.shadows.light,
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    } as any) : null),
  },
  cardContent: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardAddress: {
    flex: 1,
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    flexShrink: 1,
  },
  cardCountry: {
    flex: 1,
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
    flexWrap: 'wrap',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  cardActionBtnSecondary: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },

  // ─── State blocks ───
  stateBlock: {
    minHeight: 300,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.xxl,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  stateIconColor: {
    color: colors.textMuted,
  },
  stateTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
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
