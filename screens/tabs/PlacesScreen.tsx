import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import {
  filterCatalogPlaces,
  groupCatalogPlaces,
  groupCatalogCountries,
  type CatalogPlace,
} from '@/utils/placesCatalog'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
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

export default function PlacesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; country?: string }>()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isCompact = width < 760
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact])
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

  const activeCategoryTitle =
    selectedCategories.length === 0
      ? 'Все места'
      : selectedCategories.length === 1
        ? selectedCategories[0]
        : FEATURED_CATEGORY_LABEL
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

  const handleScroll = useCallback((event: any) => {
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
    router.setParams(country ? { country } : { country: undefined })
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
    router.push(place.urlTravel as any)
  }, [router])

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
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <Feather name="map-pin" size={18} color={colors.primary} />
            <Text style={styles.eyebrow}>Каталог точек</Text>
          </View>
          <Text style={styles.title}>Места</Text>
          <Text style={styles.subtitle}>
            Все точки сайта отдельно от радиуса карты. Выберите категорию, откройте место на карте
            или перейдите к путешествию, где оно используется.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Найти место"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Найти место"
            />
          </View>
          {query ? (
            <Button
              label="Сбросить"
              variant="ghost"
              size="sm"
              onPress={() => setQuery('')}
              icon={<Feather name="x" size={16} color={colors.text} />}
            />
          ) : null}
        </View>

        <View style={styles.topFilters}>
          <View style={styles.topFiltersHeader}>
            <Text style={styles.sectionTitle}>Страны</Text>
            {selectedCountry ? (
              <Button
                label="Все страны"
                variant="ghost"
                size="sm"
                onPress={() => handleSelectCountry(null)}
              />
            ) : null}
          </View>
          <View style={styles.countryList}>
            {placesQuery.isLoading ? (
              <Text style={styles.loadingHint}>Страны загрузятся вместе с местами</Text>
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

        <View style={styles.layout}>
          <View style={styles.sidebar}>
            <Text style={styles.sectionTitle}>Категории</Text>
            <Text style={styles.sectionHint}>
              По умолчанию выбрана готовая подборка. Нажмите на категорию, чтобы добавить или убрать ее.
            </Text>
            <View style={styles.categoryList}>
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

          <View style={styles.main}>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>{activeCategoryTitle}</Text>
                <Text style={styles.resultsMeta}>
                  {placesQuery.isLoading
                    ? 'Загружаем подборку'
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
                <View style={styles.activeSelectionChips}>
                  {selectedCategories.map((category) => (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityLabel={`Убрать категорию ${category}`}
                      onPress={() => handleToggleCategory(category)}
                      style={({ pressed }) => [styles.activeSelectionChip, pressed && PRESSED_OPACITY]}
                    >
                      <Text style={styles.activeSelectionText}>{category}</Text>
                      <Feather name="x" size={13} color={colors.primaryText} />
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
                description="Измените категорию или поисковый запрос."
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
                      label="Показать еще"
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
    <View style={styles.card}>
      <View style={styles.media}>
        {place.imageUrl || place.travelImageThumbUrl ? (
          <ImageCardMedia
            src={place.imageUrl || place.travelImageThumbUrl}
            alt={place.title}
            height={190}
            borderRadius={0}
            fit="contain"
            blurBackground
            loading="lazy"
          />
        ) : (
          <View style={styles.mediaPlaceholder} />
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{place.category}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{place.title}</Text>
        {place.address ? (
          <Text style={styles.cardAddress} numberOfLines={2}>{place.address}</Text>
        ) : null}
        <View style={styles.countryMetaRow}>
          <Feather name="globe" size={14} color={colors.textMuted} />
          <Text style={styles.countryMetaText} numberOfLines={1}>{place.country}</Text>
        </View>
        <View style={styles.cardActions}>
          <Button
            label="На карте"
            variant="secondary"
            size="sm"
            onPress={() => onOpenMap(place)}
            icon={<Feather name="map-pin" size={16} color={colors.text} />}
          />
          {place.urlTravel ? (
            <Button
              label="Прочитать"
              variant="primary"
              size="sm"
              onPress={() => onOpenTravel(place)}
              icon={<Feather name="book-open" size={16} color={colors.textOnPrimary} />}
            />
          ) : null}
        </View>
      </View>
    </View>
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
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.stateTitle}>Загружаем места</Text>
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
      <Feather name={icon} size={36} style={styles.stateIcon} />
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

const createStyles = (colors: ThemedColors, isCompact: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: isCompact ? DESIGN_TOKENS.spacing.lg : DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.xl,
    gap: DESIGN_TOKENS.spacing.xl,
  },
  header: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: isCompact ? 36 : 42,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    lineHeight: 26,
    maxWidth: 780,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    outlineStyle: 'none' as any,
  },
  topFilters: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  topFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.md,
  },
  countryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  loadingHint: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },
  layout: {
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.xl,
  },
  sidebar: {
    width: isCompact ? '100%' : 280,
    gap: DESIGN_TOKENS.spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  main: {
    flex: 1,
    minWidth: 0,
    width: isCompact ? '100%' : undefined,
    gap: DESIGN_TOKENS.spacing.lg,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '800',
  },
  resultsMeta: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    marginTop: 4,
  },
  activeSelection: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  activeSelectionLabel: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  activeSelectionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  activeSelectionChip: {
    minHeight: 34,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  activeSelectionText: {
    color: colors.primaryText,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.lg,
  },
  card: {
    width: isCompact ? '100%' : 'calc(50% - 12px)' as any,
    minWidth: isCompact ? undefined : 300,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.light } as any) : null),
  },
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
  media: {
    height: 190,
    backgroundColor: colors.surfaceMuted,
  },
  mediaPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  cardBody: {
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
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
  },
  cardTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800',
    lineHeight: 24,
  },
  cardAddress: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },
  countryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  countryMetaText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingTop: DESIGN_TOKENS.spacing.xs,
  },
  stateBlock: {
    minHeight: 280,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.xl,
  },
  stateIcon: {
    color: colors.textMuted,
  },
  stateTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    textAlign: 'center',
  },
  stateAction: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    minHeight: 40,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  stateActionText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
})
