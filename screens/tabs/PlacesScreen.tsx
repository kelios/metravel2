import React, { useCallback, useMemo, useState } from 'react'
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
import { useAuth } from '@/context/AuthContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import {
  filterCatalogPlaces,
  groupCatalogPlaces,
  type CatalogPlace,
} from '@/utils/placesCatalog'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'

const MAP_FOCUS_RADIUS_KM = '5'
const PRESSED_OPACITY = { opacity: 0.72 } as const

export default function PlacesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string }>()
  const isFocused = useIsFocused()
  const { isAuthenticated } = useAuth()
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isCompact = width < 760
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
    typeof params.category === 'string' && params.category.trim() ? params.category.trim() : null,
  )

  const placesQuery = useQuery({
    queryKey: ['places-catalog'],
    queryFn: ({ signal }) => fetchPlacesCatalog(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const allPlaces = useMemo(() => placesQuery.data ?? [], [placesQuery.data])
  const categoryGroups = useMemo(() => groupCatalogPlaces(allPlaces), [allPlaces])
  const filteredPlaces = useMemo(
    () => filterCatalogPlaces(allPlaces, query, selectedCategory),
    [allPlaces, query, selectedCategory],
  )

  const activeCategoryTitle = selectedCategory ?? 'Все места'
  const pageDescription = selectedCategory
    ? `Все места категории ${selectedCategory}: карточки точек, переход на карту и ссылка на путешествие.`
    : 'Каталог мест MeTravel: замки, музеи, парки, природные точки и другие места из путешествий.'

  const handleSelectCategory = useCallback((category: string | null) => {
    setSelectedCategory(category)
    router.setParams(category ? { category } : { category: undefined })
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

  const openAddPlace = useCallback(() => {
    router.push('/travel/new' as any)
  }, [router])

  const openRegistration = useCallback(() => {
    router.push('/registration?redirect=%2Ftravel%2Fnew&intent=create-travel' as any)
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

        <View style={styles.contributionBanner}>
          <View style={styles.contributionIcon}>
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </View>
          <View style={styles.contributionTextBlock}>
            <Text style={styles.contributionTitle}>Помогите расширить карту</Text>
            <Text style={styles.contributionText}>
              Если здесь нашлось что-то полезное для вашего планирования, внесите вклад:
              зарегистрируйтесь и добавьте свое место, маршрут или точку, о которой стоит рассказать другим.
            </Text>
          </View>
          <View style={styles.contributionActions}>
            {!isAuthenticated ? (
              <Button
                label="Зарегистрироваться"
                variant="outline"
                size="sm"
                onPress={openRegistration}
                icon={<Feather name="user-plus" size={16} color={colors.text} />}
              />
            ) : null}
            <Button
              label="Добавить место"
              variant="primary"
              size="sm"
              onPress={openAddPlace}
              icon={<Feather name="map-pin" size={16} color={colors.textOnPrimary} />}
            />
          </View>
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

        <View style={styles.layout}>
          <View style={styles.sidebar}>
            <Text style={styles.sectionTitle}>Категории</Text>
            <View style={styles.categoryList}>
              <Chip
                label="Все"
                count={allPlaces.length}
                selected={!selectedCategory}
                onPress={() => handleSelectCategory(null)}
              />
              {categoryGroups.map((group) => (
                <Chip
                  key={group.category}
                  label={group.category}
                  count={group.count}
                  selected={selectedCategory === group.category}
                  onPress={() => handleSelectCategory(group.category)}
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
                    ? 'Загружаем места'
                    : `${filteredPlaces.length} ${getPlacesCountLabel(filteredPlaces.length)}`}
                </Text>
              </View>
              {selectedCategory ? (
                <Button
                  label="Все места"
                  variant="outline"
                  size="sm"
                  onPress={() => handleSelectCategory(null)}
                />
              ) : null}
            </View>

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
                  handleSelectCategory(null)
                }}
              />
            ) : (
              <View style={styles.cardsGrid}>
                {filteredPlaces.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    styles={styles}
                    colors={colors}
                    onOpenMap={openOnMap}
                    onOpenTravel={openTravel}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
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
  contributionBanner: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.lg,
    flexDirection: isCompact ? 'column' : 'row',
    alignItems: isCompact ? 'flex-start' : 'center',
    gap: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.light } as any) : null),
  },
  contributionIcon: {
    width: 44,
    height: 44,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contributionTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  contributionTitle: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800',
  },
  contributionText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 22,
  },
  contributionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    justifyContent: isCompact ? 'flex-start' : 'flex-end',
    flexShrink: 0,
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
