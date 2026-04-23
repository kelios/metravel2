import React, { useCallback, useMemo } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import MapSearchInput from '@/components/MapPage/MapSearchInput'
import Chip from '@/components/ui/Chip'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import type { ThemedColors } from '@/hooks/useTheme'

import { CATEGORY_ICONS } from './MapQuickFilters'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

const getCategoryName = (category: CategoryOption) => {
  if (typeof category === 'string') return category.trim()
  if (category && typeof category === 'object' && typeof category.name === 'string') {
    return category.name.trim()
  }
  if (category && typeof category === 'object' && typeof category.value === 'string') {
    return category.value.trim()
  }
  return ''
}

const getRadiusLabel = (rawValue: string | number | undefined) => {
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
      if (typeof onFilterChange !== 'function') return
      onFilterChange(field, value)
    },
    [onFilterChange]
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

  const resolvedCategoryOptions = useMemo(() => {
    if (Array.isArray(filters.categoryTravelAddress) && filters.categoryTravelAddress.length > 0) {
      return filters.categoryTravelAddress
    }

    return Object.keys(travelCategoriesCount)
      .sort((left, right) => left.localeCompare(right, 'ru'))
      .map((name) => ({ id: name, name }))
  }, [filters.categoryTravelAddress, travelCategoriesCount])

  const categoryOptions = useMemo(
    () =>
      resolvedCategoryOptions
        .map((category) => {
          const name = getCategoryName(category)
          if (!name) return null

          return {
            id:
              typeof category === 'object' && category !== null && 'id' in category
                ? (category as { id?: string | number }).id || name
                : name,
            value: name,
            count: travelCategoriesCount[name] || 0,
          }
        })
        .filter((category): category is { id: string | number; value: string; count: number } => {
          return category !== null
        }),
    [resolvedCategoryOptions, travelCategoriesCount]
  )

  const selectedCategoryValues = useMemo(
    () =>
      (Array.isArray(filterValue.categoryTravelAddress)
        ? filterValue.categoryTravelAddress
            .map((category) => getCategoryName(category))
            .filter((value): value is string => Boolean(value))
        : []) as string[],
    [filterValue.categoryTravelAddress]
  )

  const selectedCategoriesCount = selectedCategoryValues.length
  const radiusSummaryValue = filterValue.radius || DEFAULT_RADIUS_KM
  const radiusSummaryText = getRadiusLabel(radiusSummaryValue)
  const searchQueryValue = String(filterValue.searchQuery || '')
  const summaryChips = useMemo(
    () => [
      {
        key: 'radius',
        icon: 'radio' as const,
        label: `Радиус ${radiusSummaryText || `${DEFAULT_RADIUS_KM} км`}`,
        accent: true,
      },
      {
        key: 'categories',
        icon: 'grid' as const,
        label:
          selectedCategoriesCount > 0
            ? `Категорий: ${selectedCategoriesCount}`
            : 'Все категории',
        accent: false,
      },
      ...(searchQueryValue
        ? [
            {
              key: 'search',
              icon: 'search' as const,
              label: `Запрос: ${searchQueryValue}`,
              accent: false,
            },
          ]
        : []),
    ],
    [radiusSummaryText, searchQueryValue, selectedCategoriesCount]
  )
  const visibleSummaryChips = useMemo(
    () => (isMobile ? [] : summaryChips),
    [isMobile, summaryChips]
  )

  const handleSearchChange = useCallback(
    (value: string) => safeOnFilterChange('searchQuery', value),
    [safeOnFilterChange]
  )

  const handleCategoryToggle = useCallback(
    (categoryName: string) => {
      const nextValues = selectedCategoryValues.includes(categoryName)
        ? selectedCategoryValues.filter((currentCategory) => currentCategory !== categoryName)
        : [...selectedCategoryValues, categoryName]

      safeOnFilterChange('categoryTravelAddress', nextValues)
    },
    [safeOnFilterChange, selectedCategoryValues]
  )

  const radiusOptions = useMemo(() => {
    const base = (Array.isArray(filters.radius) ? filters.radius : []).filter(
      (option) => option?.id
    )
    const current = String(radiusSummaryValue || '').trim()
    if (!current) return base

    const exists = base.some((option) => String(option.id) === current)
    if (exists) return base

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
        {visibleSummaryChips.length > 0 ? (
        <View style={styles.desktopSummaryStrip} testID="radius-section-summary">
          {visibleSummaryChips.map((chip) => (
            <View
              key={chip.key}
              style={[
                styles.desktopSummaryChip,
                chip.accent && styles.desktopSummaryChipAccent,
              ]}
            >
              <Feather
                name={chip.icon}
                size={12}
                color={chip.accent ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.desktopSummaryChipText,
                  chip.accent && styles.desktopSummaryChipTextAccent,
                ]}
                numberOfLines={1}
              >
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
        ) : null}
      </View>

      {radiusOptions.length > 0 ? (
        <View style={styles.lightStepBlock}>
          <View style={styles.lightStepHeader}>
            <Feather name="radio" size={16} color={colors.textMuted} />
            <Text style={styles.lightStepTitle}>Радиус поиска</Text>
            {!isMobile && radiusSummaryText ? <Text style={styles.lightStepBadge}>{radiusSummaryText}</Text> : null}
          </View>
          {!isMobile ? (
            <Text style={styles.sectionHint}>Выберите, как далеко искать места вокруг вас</Text>
          ) : null}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.radiusOptionsScroll}
            contentContainerStyle={styles.radiusOptionsScrollContent}
            testID="radius-presets-scroll"
          >
            <View style={styles.radiusOptionsWrap} testID="radius-presets">
              {radiusOptions.map((option) => {
                const selected = String(option.id) === String(radiusSummaryValue)
                const label = getRadiusLabel(option.name || option.id)

                return (
                  <Chip
                    key={String(option.id)}
                    label={label}
                    selected={selected}
                    onPress={() => safeOnFilterChange('radius', option.id)}
                    testID={`radius-option-${option.id}`}
                    icon={
                      <Feather
                        name="radio"
                        size={12}
                        color={selected ? colors.primaryText : colors.primary}
                      />
                    }
                    style={styles.radiusOptionChip}
                  />
                )
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Feather name="map-pin" size={16} color={colors.textMuted} />
          <Text style={styles.lightStepTitle}>Что посмотреть</Text>
          {selectedCategoriesCount > 0 ? (
            <Text style={styles.lightStepBadge}>{selectedCategoriesCount}</Text>
          ) : null}
        </View>
        {!isMobile ? <Text style={styles.sectionHint}>Уточните поиск по типу мест</Text> : null}

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
