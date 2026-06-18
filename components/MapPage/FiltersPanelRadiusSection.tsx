import React, { useCallback, useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import MapSearchInput from '@/components/MapPage/MapSearchInput'
import Chip from '@/components/ui/Chip'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import type { ThemedColors } from '@/hooks/useTheme'

import { CATEGORY_ICONS } from './mapCategoryIcons'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

function getCategoryName(category: CategoryOption): string {
  if (typeof category === 'string') return category.trim()
  if (category && typeof category === 'object') {
    if (typeof category.name === 'string') return category.name.trim()
    if (typeof category.value === 'string') return category.value.trim()
  }
  return ''
}

function getRadiusLabel(rawValue: string | number | undefined): string {
  const value = String(rawValue ?? '').trim()
  if (!value) return ''
  return /км$/i.test(value) ? value : `${value} км`
}

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
  onFilterChange: (field: string, value: any) => void
}

const FiltersPanelRadiusSection: React.FC<FiltersPanelRadiusSectionProps> = ({
  colors,
  styles,
  isMobile,
  filters,
  filterValue,
  travelsData,
  onFilterChange,
}) => {
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
            .sort((left, right) => left.localeCompare(right, 'ru'))
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
  }, [filters.categoryTravelAddress, travelCategoriesCount])

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
  const radiusSummaryValue = filterValue.radius || DEFAULT_RADIUS_KM
  const radiusSummaryText = getRadiusLabel(radiusSummaryValue)
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

  const radiusOptions = useMemo(() => {
    const base = (Array.isArray(filters.radius) ? filters.radius : []).filter(
      (option) => option?.id,
    )
    const current = String(radiusSummaryValue || '').trim()
    if (!current) return base
    if (base.some((option) => String(option.id) === current)) return base

    const next = [...base, { id: current, name: getRadiusLabel(current) }]
    next.sort((a, b) => {
      const aValue = Number(String(a.id).replace(/\D/g, '')) || 0
      const bValue = Number(String(b.id).replace(/\D/g, '')) || 0
      return aValue - bValue
    })
    return next
  }, [filters.radius, radiusSummaryValue])

  return (
    <>
      <View style={styles.lightStepBlock}>
        <MapSearchInput
          value={searchQueryValue}
          onChange={handleSearchChange}
          placeholder="Найти место по названию..."
          resultsCount={searchQueryValue ? travelsData.length : undefined}
        />
      </View>

      {radiusOptions.length > 0 && (
        <View style={styles.lightStepBlock}>
          <View style={styles.lightStepHeader}>
            <Feather name="radio" size={16} color={colors.primary} />
            <Text style={styles.lightStepTitle}>Радиус поиска</Text>
            {!!radiusSummaryText && (
              <Text style={styles.lightStepBadge}>{radiusSummaryText}</Text>
            )}
          </View>
          {!isMobile && (
            <Text style={styles.sectionHint}>Как далеко искать места вокруг</Text>
          )}
          <View
            style={styles.radiusSegmentTrack}
            testID="radius-presets"
            accessibilityRole="radiogroup"
          >
            {radiusOptions.map((option) => {
              const selected = String(option.id) === String(radiusSummaryValue)
              const label = getRadiusLabel(option.name || option.id)
              return (
                <Pressable
                  key={String(option.id)}
                  onPress={() => safeOnFilterChange('radius', option.id)}
                  testID={`radius-option-${option.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.radiusSegment,
                    selected && styles.radiusSegmentSelected,
                    pressed && !selected && styles.radiusSegmentPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.radiusSegmentText,
                      selected && styles.radiusSegmentTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Feather name="map-pin" size={16} color={colors.primary} />
          <Text style={styles.lightStepTitle}>Что посмотреть</Text>
          {selectedCategoriesCount > 0 && (
            <Text style={styles.lightStepBadge}>{selectedCategoriesCount}</Text>
          )}
        </View>
        {!isMobile && <Text style={styles.sectionHint}>Уточните тип мест</Text>}

        {categoryOptions.length > 0 ? (
          <View style={styles.filterSelectionChips} testID="category-options">
            {categoryOptions.map((category, index) => {
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
        ) : (
          <Text style={styles.sectionHint}>Нет доступных категорий в текущем радиусе</Text>
        )}
      </View>
    </>
  )
}

export default React.memo(FiltersPanelRadiusSection)
