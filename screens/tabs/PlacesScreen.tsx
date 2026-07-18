import React, { useMemo } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useIsFocused } from 'expo-router'

import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { Menu } from '@/ui/paper'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsiveWidth } from '@/hooks/useResponsive'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH, getSiteBaseUrl } from '@/utils/seo'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'
import ContributionBanner from '@/components/common/ContributionBanner'

import {
  PRESSED_OPACITY,
  getPlacesCountLabel,
  isSameCategorySet,
} from './PlacesScreen.helpers'
import { PlaceCard, SkeletonGrid, StateBlock } from './PlacesScreen.parts'
import { createStyles } from './PlacesScreen.styles'
import { usePlacesCatalogController } from './usePlacesCatalogController'
import { translate as i18nT } from '@/i18n'


export default function PlacesScreen() {
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const width = useResponsiveWidth()
  // `useResponsiveWidth` deliberately returns 0 for SSR and the first hydration
  // render. Treat that unknown snapshot as the stable desktop export layout, just
  // like the app shell/header does. Otherwise static HTML is rendered as mobile
  // and the entire catalog jumps into the desktop layout after hydration.
  const hasMeasuredWidth = width > 0
  const isCompact = hasMeasuredWidth && width < 760
  const isWide = !hasMeasuredWidth || width >= 1100
  const styles = useMemo(() => createStyles(colors, isCompact, isWide), [colors, isCompact, isWide])
  const {
    activeCategoryTitle,
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
    firstScreenCount,
    handleClearCategories,
    handleQueryChange,
    handleScroll,
    handleSelectCountry,
    handleSelectSort,
    handleToggleCategory,
    handleTopBarLayout,
    hasActiveFilters,
    hasCategorySearch,
    hasMorePlaces,
    isInitialLoading,
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
    showLoadedCounts,
    sortMenuVisible,
    sortMode,
    topBarHeight,
    totalCount,
    visiblePlaces,
  } = usePlacesCatalogController({ isCompact, isWide })

  // Sort control shared by the desktop results header and the compact sticky bar.
  const sortOptions = useMemo(
    () => [
      { value: 'default' as const, label: i18nT('map:screens.tabs.PlacesScreen.po_umolchaniyu_bc186f34') },
      { value: 'rating' as const, label: i18nT('map:screens.tabs.PlacesScreen.po_reytingu_d0b00645') },
    ],
    [],
  )
  const activeSortLabel =
    sortOptions.find((option) => option.value === sortMode)?.label ?? sortOptions[0].label
  const renderSortMenu = (anchorStyleActive: boolean) => (
    <Menu
      visible={sortMenuVisible}
      onDismiss={() => setSortMenuVisible(false)}
      contentStyle={styles.countryMenuContent}
      anchor={
        <Pressable
          onPress={() => setSortMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.vybrat_sortirovku_c333ebd7')}
          accessibilityState={{ expanded: sortMenuVisible }}
          style={({ pressed }) => [
            styles.sortSelect,
            anchorStyleActive && styles.sortSelectActive,
            pressed && PRESSED_OPACITY,
          ]}
        >
          <Feather
            name="bar-chart-2"
            size={16}
            color={anchorStyleActive ? colors.primary : colors.textMuted}
          />
          <Text
            style={[styles.sortSelectValue, anchorStyleActive && styles.sortSelectValueActive]}
            numberOfLines={1}
          >
            {activeSortLabel}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      }
    >
      {sortOptions.map((option) => (
        <Menu.Item
          key={option.value}
          title={option.label}
          onPress={() => handleSelectSort(option.value)}
          leadingIcon={({ size }) => (
            <Feather
              name={sortMode === option.value ? 'check-circle' : 'circle'}
              size={size}
              color={sortMode === option.value ? colors.primary : colors.textMuted}
            />
          )}
          titleStyle={sortMode === option.value ? styles.countryMenuItemTextActive : styles.countryMenuItemText}
        />
      ))}
    </Menu>
  )

  const pageDescription = selectedCategories.length > 0
    ? i18nT('map:screens.tabs.PlacesScreen.mesta_vybrannyh_kategoriy_value1_kartochki_t_005ce7dc', { value1: selectedCategories.join(', ') })
    : i18nT('map:screens.tabs.PlacesScreen.katalog_mest_metravel_zamki_muzei_parki_prir_0c294a51')

  // ─── SEO ───
  const seoHeading = useMemo(() => {
    const parts = [i18nT('map:screens.tabs.PlacesScreen.mesta_eff0ba98')]
    if (selectedCategories.length > 0) parts.push(activeCategoryTitle)
    if (selectedCountry) parts.push(selectedCountry)
    return parts.join(' — ')
  }, [activeCategoryTitle, selectedCategories.length, selectedCountry])
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

  // Compact "app" chrome — a sticky compact filter bar (search + Категории + страна
  // + Сбросить) pinned above a single scrolling column of cards. Used on every mobile
  // width, web and native alike, so /places renders identically across platforms; the
  // full stacked topBar/sidebar is desktop-only. Both platforms share one ScrollView
  // path (no native FlatList) to guarantee the same layout and scroll behaviour.
  const mobileCompact = isCompact

  const loadMoreBlock = hasMorePlaces ? (
    <View style={styles.loadMoreFooter}>
      <Text style={styles.loadMoreText}>
        {i18nT('map:screens.tabs.PlacesScreen.pokazano_673c959e')}{visiblePlaces.length} {i18nT('map:screens.tabs.PlacesScreen.iz_897ff3eb')}{totalCount}
      </Text>
      <Button
        label={i18nT('map:screens.tabs.PlacesScreen.pokazat_esche_f7728927')}
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
        title={i18nT('map:screens.tabs.PlacesScreen.ne_udalos_zagruzit_mesta_b8af7ba1')}
        description={i18nT('map:screens.tabs.PlacesScreen.proverte_soedinenie_i_poprobuyte_snova_198a2bc9')}
        actionLabel={i18nT('map:screens.tabs.PlacesScreen.povtorit_e910f968')}
        onAction={() => placesQuery.refetch()}
        pending={placesQuery.isFetching}
        pendingLabel={i18nT('map:screens.tabs.PlacesScreen.zagruzhaem_a0cca9ea')}
      />
    )
  } else if (resultsStatus === 'empty') {
    resultsContent = catalogTotal === 0 && !hasActiveFilters ? (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="inbox"
        title={i18nT('map:screens.tabs.PlacesScreen.katalog_poka_pust_ead50e14')}
        description={i18nT('map:screens.tabs.PlacesScreen.skoro_zdes_poyavyatsya_mesta_iz_puteshestviy_95576d13')}
        actionLabel={i18nT('map:screens.tabs.PlacesScreen.obnovit_aaf704dc')}
        onAction={() => placesQuery.refetch()}
        pending={placesQuery.isFetching}
        pendingLabel={i18nT('map:screens.tabs.PlacesScreen.obnovlyaem_22cc01a2')}
      />
    ) : (
      <StateBlock
        styles={styles}
        colors={colors}
        icon="map-pin"
        title={
          deferredQuery
            ? i18nT('map:screens.tabs.PlacesScreen.po_zaprosu_value1_nichego_ne_naydeno_2c354d86', { value1: deferredQuery })
            : i18nT('map:screens.tabs.PlacesScreen.mesta_ne_naydeny_bad57b88')
        }
        description={
          deferredQuery
            ? i18nT('map:screens.tabs.PlacesScreen.poprobuyte_drugoe_nazvanie_ili_sbroste_filtr_7cf6a42b')
            : i18nT('map:screens.tabs.PlacesScreen.izmenite_kategoriyu_ili_stranu_5611fa44')
        }
        actionLabel={i18nT('map:screens.tabs.PlacesScreen.sbrosit_filtry_f13dc45b')}
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
              <Text style={styles.heroTitle}>{i18nT('map:screens.tabs.PlacesScreen.mesta_eff0ba98')}</Text>
              {showLoadedCounts ? (
                <Text style={styles.heroCount}>· {catalogTotal} {i18nT('map:screens.tabs.PlacesScreen.v_kataloge_af576304')}</Text>
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
                placeholder={i18nT('map:screens.tabs.PlacesScreen.poisk_po_nazvaniyu_ili_adresu_ef70caf8')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.nayti_mesto_c5e8b835')}
              />
              {query ? (
                <Pressable
                  onPress={() => handleQueryChange('')}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.ochistit_poisk_4f31e8e9')}
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
                  accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.vybrat_stranu_a7b66c0c')}
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
                    <Text style={styles.countrySelectLabel}>{i18nT('map:screens.tabs.PlacesScreen.strana_f749c62d')}</Text>
                    <Text style={styles.countrySelectValue} numberOfLines={1}>
                      {selectedCountry ?? i18nT('map:screens.tabs.PlacesScreen.vse_strany_08494525')}
                      {showLoadedCounts && !selectedCountry ? ` (${catalogTotal})` : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              }
            >
              <Menu.Item
                title={showLoadedCounts ? i18nT('map:screens.tabs.PlacesScreen.vse_strany_value1_7f58288c', { value1: catalogTotal }) : i18nT('map:screens.tabs.PlacesScreen.vse_strany_08494525')}
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
                <Text style={styles.sectionTitle}>{i18nT('map:screens.tabs.PlacesScreen.kategorii_7e54cc5b')}</Text>
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
                  placeholder={i18nT('map:screens.tabs.PlacesScreen.nayti_kategoriyu_9e5e9459')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.categorySearchInput}
                  returnKeyType="search"
                  accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.poisk_kategorii_654d76f0')}
                  testID="places-category-search-input"
                />
                {categoryQuery ? (
                  <Pressable
                    onPress={() => setCategoryQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.ochistit_poisk_kategorii_31f7af51')}
                    hitSlop={10}
                    style={({ pressed }) => [styles.categorySearchClear, pressed && PRESSED_OPACITY]}
                  >
                    <Feather name="x" size={14} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {showCollections && !hasCategorySearch ? (
                <View style={styles.collectionSection}>
                  <Text style={styles.hintText}>{i18nT('map:screens.tabs.PlacesScreen.interesnye_podborki_05fc53e0')}</Text>
                  <View style={styles.collectionList}>
                    {collectionCards.map((collection) => {
                      const selected = isSameCategorySet(selectedCategories, collection.categories)
                      return (
                        <View
                          key={collection.id}
                          style={[styles.featuredCard, selected && styles.featuredCardActive]}
                        >
                          <Pressable
                            onPress={() => selectCategoryCollection(collection)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.podborka_value1_9a67f5b2', { value1: collection.title })}
                            style={({ pressed }) => [
                              styles.featuredSelectArea,
                              pressed && PRESSED_OPACITY,
                            ]}
                            testID={`places-collection-${collection.id}`}
                          >
                            <View style={styles.featuredIconWrap}>
                              <Feather name={collection.icon} size={14} color={colors.primaryText} />
                            </View>
                            <View style={styles.featuredTextBlock}>
                              <Text style={styles.featuredLabel}>{collection.hint}</Text>
                              <Text style={styles.featuredName} numberOfLines={2}>
                                {collection.title}
                              </Text>
                            </View>
                            {/* Reserve the count slot from first paint so the count
                                appearing after load does not narrow the text block and
                                re-wrap featuredName, which caused cascading CLS on /places. */}
                            <View style={styles.featuredCountSlot}>
                              {collection.countReady ? (
                                <Text style={styles.featuredCount}>{collection.count}</Text>
                              ) : null}
                            </View>
                          </Pressable>
                          {selected ? (
                            <Pressable
                              onPress={handleClearCategories}
                              accessibilityRole="button"
                              accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.ochistit_podborku_value1_29340fbb', { value1: collection.title })}
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
                {hasCategorySearch
                  ? i18nT('map:screens.tabs.PlacesScreen.naydennye_kategorii_75a4bdc5')
                  : showCollections
                    ? i18nT('map:screens.tabs.PlacesScreen.ili_vyberite_kategorii_vruchnuyu_11fb6a00')
                    : i18nT('map:screens.tabs.PlacesScreen.vyberite_kategorii_8717e26b')}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label={i18nT('map:screens.tabs.PlacesScreen.vse_kategorii_f1b4a07f')}
                  count={showLoadedCounts ? catalogTotal : undefined}
                  selected={selectedCategories.length === 0}
                  onPress={handleClearCategories}
                  style={styles.filterChipCompact}
                  testID="places-category-chip-all"
                />
                {filteredCategoryFacets.map((group) => (
                  <Chip
                    key={group.name}
                    label={group.name}
                    count={showLoadedCounts ? group.count : undefined}
                    selected={selectedCategories.includes(group.name)}
                    onPress={() => handleToggleCategory(group.name)}
                    style={styles.filterChipCompact}
                    testID={`places-category-chip-${group.name}`}
                  />
                ))}
                {filteredCategoryFacets.length === 0 && deferredCategoryQuery.trim() ? (
                  <View style={styles.categorySearchEmpty} testID="places-category-search-empty">
                    <Text style={styles.categorySearchEmptyText}>
                      {i18nT('map:screens.tabs.PlacesScreen.kategorii_ne_naydeny_0e4e6021')}</Text>
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
                  <Text style={styles.sidebarResetBtnText}>{i18nT('map:screens.tabs.PlacesScreen.sbrosit_filtry_f13dc45b')}</Text>
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
                    ? i18nT('map:screens.tabs.PlacesScreen.zagruzhaem_podborku_b98517c7')
                    : `${totalCount} ${getPlacesCountLabel(totalCount)}`}
                </Text>
              </View>
              <View style={styles.resultsHeaderControls}>
                {mobileCompact ? null : renderSortMenu(sortMode !== 'default')}
                {selectedCategories.length > 0 ? (
                  <Button
                    label={i18nT('map:screens.tabs.PlacesScreen.vse_mesta_e8f3c355')}
                    variant="outline"
                    onPress={handleClearCategories}
                  />
                ) : null}
              </View>
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
          placeholder={i18nT('map:screens.tabs.PlacesScreen.poisk_mesta_642f16e6')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.nayti_mesto_c5e8b835')}
        />
        {query ? (
          <Pressable
            onPress={() => handleQueryChange('')}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.ochistit_poisk_4f31e8e9')}
            hitSlop={10}
            style={({ pressed }) => [styles.searchClear, pressed && PRESSED_OPACITY]}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.compactBarRow}>
        <Menu
          visible={countryMenuVisible}
          onDismiss={() => setCountryMenuVisible(false)}
          contentStyle={styles.countryMenuContent}
          anchor={
            <Pressable
              onPress={() => setCountryMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.vybrat_stranu_a7b66c0c')}
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
                {selectedCountry ?? i18nT('map:screens.tabs.PlacesScreen.vse_strany_08494525')}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          }
        >
          <Menu.Item
            title={showLoadedCounts ? i18nT('map:screens.tabs.PlacesScreen.vse_strany_value1_7f58288c', { value1: catalogTotal }) : i18nT('map:screens.tabs.PlacesScreen.vse_strany_08494525')}
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

        <Pressable
          onPress={() => setFiltersOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          style={({ pressed }) => [
            styles.compactFilterToggle,
            selectedCategories.length > 0 && styles.compactFilterToggleActive,
            pressed && PRESSED_OPACITY,
          ]}
        >
          <Feather name="sliders" size={16} color={selectedCategories.length > 0 ? colors.primary : colors.text} />
          <Text
            numberOfLines={1}
            style={[styles.mobileFilterToggleText, selectedCategories.length > 0 && styles.mobileFilterToggleTextActive]}
          >
            {i18nT('map:screens.tabs.PlacesScreen.kategorii_7e54cc5b')}</Text>
          {selectedCategories.length > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{selectedCategories.length}</Text>
            </View>
          ) : null}
          <Feather
            name={filtersOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>

        {renderSortMenu(sortMode !== 'default')}

        {hasActiveFilters ? (
          <Pressable
            onPress={resetAll}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:screens.tabs.PlacesScreen.sbrosit_filtry_f13dc45b')}
            style={({ pressed }) => [styles.resetBtn, pressed && PRESSED_OPACITY]}
          >
            <Text style={styles.resetBtnText}>{i18nT('map:screens.tabs.PlacesScreen.sbrosit_10b66035')}</Text>
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
