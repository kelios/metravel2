import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import MapSearchInput from '@/components/MapPage/MapSearchInput'
import Chip from '@/components/ui/Chip'
import type { ThemedColors } from '@/hooks/useTheme'

import { CATEGORY_ICONS } from './mapCategoryIcons'
import { getCategoryName, type CategoryOption } from '@/components/MapPage/categoryName'
import { createCollator, translate as i18nT } from '@/i18n'


const COLLAPSED_UNSELECTED_LIMIT = 8

interface FiltersPanelRadiusSectionProps {
  colors: ThemedColors
  styles: any
  isMobile: boolean
  filters: {
    categories: CategoryOption[]
    categoryTravelAddress: CategoryOption[]
    radius: { id: string; name: string }[]
    address: string
  }
  filterValue: {
    categories: CategoryOption[]
    categoryTravelAddress: CategoryOption[]
    radius: string
    address: string
    searchQuery?: string
  }
  travelsData: { categoryName?: string; name?: string; address?: string }[]
  filteredTravelsData?: { categoryName?: string; name?: string; address?: string }[]
  resultsTotal?: number
  onFilterChange: (field: string, value: any) => void
}

const FiltersPanelRadiusSection: React.FC<FiltersPanelRadiusSectionProps> = ({
  colors,
  styles,
  isMobile,
  filters,
  filterValue,
  travelsData,
  filteredTravelsData = [],
  resultsTotal,
  onFilterChange,
}) => {
  const categoryCollator = useMemo(() => createCollator(), [])
  const safeOnFilterChange = useCallback(
    (field: string, value: any) => {
      if (typeof onFilterChange === 'function') onFilterChange(field, value)
    },
    [onFilterChange],
  )

  const travelCategoriesCount = useMemo(() => {
    const count: Record<string, number> = {}
    const dataset = Array.isArray(travelsData) ? travelsData : []
    for (const travel of dataset) {
      if (!travel.categoryName) continue
      travel.categoryName
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((categoryName) => {
          count[categoryName] = (count[categoryName] || 0) + 1
        })
    }
    return count
  }, [travelsData])

  const categoryOptions = useMemo(() => {
    const resolved =
      Array.isArray(filters.categoryTravelAddress) && filters.categoryTravelAddress.length > 0
        ? filters.categoryTravelAddress
        : Object.keys(travelCategoriesCount)
            .sort((left, right) => categoryCollator.compare(left, right))
            .map((name) => ({ id: name, name }))

    return resolved
      .map((category) => {
        const name = getCategoryName(category)
        if (!name) return null
        const id =
          typeof category === 'object' && category !== null && 'id' in category
            ? (category as { id?: string | number }).id || name
            : name
        return { id, value: name, count: travelCategoriesCount[name] || 0 }
      })
      .filter(
        (category): category is { id: string | number; value: string; count: number } =>
          category !== null,
      )
  }, [categoryCollator, filters.categoryTravelAddress, travelCategoriesCount])

  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')

  const selectedCategoryValues = useMemo(
    () =>
      Array.isArray(filterValue.categoryTravelAddress)
        ? filterValue.categoryTravelAddress
            .map(getCategoryName)
            .filter((value): value is string => Boolean(value))
        : [],
    [filterValue.categoryTravelAddress],
  )

  const selectedCategoriesCount = selectedCategoryValues.length

  const orderedCategories = useMemo(() => {
    const selectedSet = new Set(selectedCategoryValues)
    const selected = categoryOptions.filter((category) => selectedSet.has(category.value))
    const unselected = categoryOptions
      .filter((category) => !selectedSet.has(category.value))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count
        return categoryCollator.compare(left.value, right.value)
      })
    return { selected, unselected }
  }, [categoryCollator, categoryOptions, selectedCategoryValues])

  // The tag search only filters the *unselected* pool: selected chips stay pinned
  // on top so they can be unset without clearing the query first.
  const normalizedCategoryQuery = categoryQuery.trim().toLocaleLowerCase()
  const isCategorySearchActive = normalizedCategoryQuery.length > 0
  const matchedUnselected = useMemo(() => {
    if (!normalizedCategoryQuery) return orderedCategories.unselected
    return orderedCategories.unselected.filter((category) =>
      category.value.toLocaleLowerCase().includes(normalizedCategoryQuery),
    )
  }, [normalizedCategoryQuery, orderedCategories.unselected])

  const hiddenUnselectedCount = Math.max(
    0,
    matchedUnselected.length - COLLAPSED_UNSELECTED_LIMIT,
  )
  // While searching we show every match and hide the toggle — otherwise the
  // collapse would silently cut search results at 8.
  const canCollapse = !isCategorySearchActive && hiddenUnselectedCount > 0
  const visibleUnselected =
    canCollapse && !categoriesExpanded
      ? matchedUnselected.slice(0, COLLAPSED_UNSELECTED_LIMIT)
      : matchedUnselected
  const visibleCategories = [...orderedCategories.selected, ...visibleUnselected]
  const showCategorySearch = categoryOptions.length > COLLAPSED_UNSELECTED_LIMIT
  const showNoTagMatches = isCategorySearchActive && matchedUnselected.length === 0

  const searchQueryValue = String(filterValue.searchQuery || '')

  const handleSearchChange = useCallback(
    (value: string) => safeOnFilterChange('searchQuery', value),
    [safeOnFilterChange],
  )

  const handleCategoryToggle = useCallback(
    (categoryName: string) => {
      const nextValues = selectedCategoryValues.includes(categoryName)
        ? selectedCategoryValues.filter((c) => c !== categoryName)
        : [...selectedCategoryValues, categoryName]
      safeOnFilterChange('categoryTravelAddress', nextValues)
    },
    [safeOnFilterChange, selectedCategoryValues],
  )

  return (
    <>
      <View style={styles.lightStepBlock}>
        <MapSearchInput
          value={searchQueryValue}
          onChange={handleSearchChange}
          placeholder={i18nT('map:components.MapPage.FiltersPanelRadiusSection.nayti_mesto_po_nazvaniyu_0071d123')}
          resultsCount={
            searchQueryValue
              ? (typeof resultsTotal === 'number' ? resultsTotal : filteredTravelsData.length)
              : undefined
          }
          autoFocusOnSignal={isMobile}
        />
      </View>

      {/* Радиус вынесен в плавающую иконку на карте (десктоп) и в верхний тулбар
          (мобайл) — пресеты радиуса здесь больше не дублируем. */}

      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Feather name="map-pin" size={16} color={colors.primaryDark} />
          <Text style={styles.lightStepTitle}>{i18nT('map:components.MapPage.FiltersPanelRadiusSection.chto_posmotret_0ad809aa')}</Text>
          {selectedCategoriesCount > 0 && (
            <Text style={styles.lightStepBadge}>{selectedCategoriesCount}</Text>
          )}
        </View>
        {!isMobile && <Text style={styles.sectionHint}>{i18nT('map:components.MapPage.FiltersPanelRadiusSection.utochnite_tip_mest_f710a5c5')}</Text>}

        {showCategorySearch && (
          <MapSearchInput
            value={categoryQuery}
            onChange={setCategoryQuery}
            testID="category-search-input"
            placeholder={i18nT('map:components.MapPage.FiltersPanelRadiusSection.poisk_po_tegam_5b3c9f14')}
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelRadiusSection.poisk_po_tegam_i_kategoriyam_mest_7d41ac68')}
            accessibilityHint={i18nT('map:components.MapPage.FiltersPanelRadiusSection.vvedite_nazvanie_tega_naprimer_zamok_ili_peschera_2e9b60d7')}
          />
        )}

        {categoryOptions.length > 0 ? (
          <>
            <View style={styles.filterSelectionChips} testID="category-options">
              {visibleCategories.map((category, index) => {
                const selected = selectedCategoryValues.includes(category.value)
                const iconName = CATEGORY_ICONS[category.value]
                return (
                  <Chip
                    key={String(category.id)}
                    label={category.value}
                    count={category.count}
                    selected={selected}
                    onPress={() => handleCategoryToggle(category.value)}
                    testID={`category-option-${index}`}
                    style={[
                      styles.filterSelectionChip,
                      selected && styles.filterSelectionChipSelected,
                    ]}
                    icon={
                      iconName ? (
                        <Feather
                          name={iconName}
                          size={12}
                          color={selected ? colors.primaryText : colors.primary}
                        />
                      ) : undefined
                    }
                  />
                )
              })}
            </View>
            {showNoTagMatches && (
              <Text style={styles.sectionHint} testID="category-search-empty">
                {i18nT('map:components.MapPage.FiltersPanelRadiusSection.teg_ne_nayden_proverte_napisanie_9c6a05e2')}
              </Text>
            )}
            {canCollapse && (
              <Pressable
                onPress={() => setCategoriesExpanded((prev) => !prev)}
                testID="category-options-toggle"
                accessibilityRole="button"
                accessibilityLabel={
                  categoriesExpanded
                    ? i18nT('map:components.MapPage.FiltersPanelRadiusSection.svernut_spisok_kategoriy_30bcc426')
                    : i18nT('map:components.MapPage.FiltersPanelRadiusSection.pokazat_esche_value1_kategoriy_c9368920', { value1: hiddenUnselectedCount })
                }
                style={styles.categoriesToggle}
              >
                <Feather
                  name={categoriesExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primaryDark}
                />
                <Text style={styles.categoriesToggleText}>
                  {categoriesExpanded
                    ? i18nT('map:components.MapPage.FiltersPanelRadiusSection.svernut_31ab41bf')
                    : i18nT('map:components.MapPage.FiltersPanelRadiusSection.pokazat_esche_value1_7fc96c09', { value1: hiddenUnselectedCount })}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={styles.sectionHint}>{i18nT('map:components.MapPage.FiltersPanelRadiusSection.net_dostupnyh_kategoriy_v_tekuschem_radiuse_386122c6')}</Text>
        )}
      </View>
    </>
  )
}

export default React.memo(FiltersPanelRadiusSection)
