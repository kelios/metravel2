import React, { useMemo, useCallback } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import MultiSelectField from '@/components/forms/MultiSelectField'
import MapIcon from './MapIcon'
import CollapsibleSection from '@/components/MapPage/CollapsibleSection'
import type { ThemedColors } from '@/hooks/useTheme'
import IconButton from '@/components/ui/IconButton'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { CATEGORY_ICONS } from './MapQuickFilters'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count)
  const mod10 = absCount % 10
  const mod100 = absCount % 100

  if (mod10 === 1 && mod100 !== 11) return `${count} место`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`
  return `${count} мест`
}

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
    for (const t of dataset) {
      if (!t.categoryName) continue
      t.categoryName
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((cat) => {
          count[cat] = (count[cat] || 0) + 1
        })
    }
    return count
  }, [travelsData])

  const resolvedCategoryOptions = useMemo(() => {
    if (Array.isArray(filters.categoryTravelAddress) && filters.categoryTravelAddress.length > 0) {
      return filters.categoryTravelAddress
    }

    return Object.keys(travelCategoriesCount)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((name) => ({ id: name, name }))
  }, [filters.categoryTravelAddress, travelCategoriesCount])

  const categoriesWithCount = useMemo(
    () =>
      resolvedCategoryOptions
        .map((category) => {
          const name = getCategoryName(category)
          if (!name) return null

          const qty = travelCategoriesCount[name] || 0
          return {
            id:
              typeof category === 'object' && category !== null && 'id' in category
                ? (category as any).id || name
                : name,
            label: qty > 0 ? `${name} (${qty})` : name,
            value: name,
          }
        })
        .filter(Boolean) as { id: string | number; label: string; value: string }[],
    [resolvedCategoryOptions, travelCategoriesCount]
  )

  const handleCategoryRemove = useCallback(
    (cat: CategoryOption) => {
      const catValue = getCategoryName(cat)

      safeOnFilterChange(
        'categoryTravelAddress',
        filterValue.categoryTravelAddress.filter((currentCategory) => {
          return getCategoryName(currentCategory) !== catValue
        })
      )
    },
    [filterValue.categoryTravelAddress, safeOnFilterChange]
  )

  const selectedCategoriesCount = Array.isArray(filterValue.categoryTravelAddress)
    ? filterValue.categoryTravelAddress.length
    : 0

  const selectedCategoryNames = useMemo(
    () =>
      (Array.isArray(filterValue.categoryTravelAddress) ? filterValue.categoryTravelAddress : [])
        .map(getCategoryName)
        .filter(Boolean),
    [filterValue.categoryTravelAddress]
  )

  const radiusResultCount = useMemo(() => {
    if (selectedCategoryNames.length === 0) return travelsData.length
    const normalizedSelected = new Set(
      selectedCategoryNames.map((name) => name.toLowerCase().trim())
    )

    return travelsData.filter((travel) => {
      const categoryNames = String(travel.categoryName || '')
        .split(',')
        .map((entry) => entry.toLowerCase().trim())
        .filter(Boolean)
      return categoryNames.some((categoryName) => normalizedSelected.has(categoryName))
    }).length
  }, [selectedCategoryNames, travelsData])

  const radiusSummaryValue = filterValue.radius || DEFAULT_RADIUS_KM
  const radiusSummaryText = `${radiusSummaryValue} км`
  const hasSelectionSummary = selectedCategoryNames.length > 0 || Boolean(radiusSummaryValue)
  const categoryPreview = selectedCategoryNames.slice(0, 2).join(', ')
  const categorySummary =
    selectedCategoryNames.length > 2
      ? `${categoryPreview} +${selectedCategoryNames.length - 2}`
      : categoryPreview

  return (
    <View style={styles.lightStepBlock}>
      <CollapsibleSection
        title="Что посмотреть"
        badge={selectedCategoriesCount || undefined}
        defaultOpen={false}
        icon="map-pin"
        tone="flat"
      >
        {!isMobile ? (
          <Text style={styles.sectionHint}>Уточните поиск по типу мест</Text>
        ) : null}
        <MultiSelectField
          items={categoriesWithCount}
          value={(Array.isArray(filterValue.categoryTravelAddress)
            ? filterValue.categoryTravelAddress
                .map((cat) => getCategoryName(cat))
                .filter((value): value is string => Boolean(value))
            : []) as string[]}
          onChange={(value) => safeOnFilterChange('categoryTravelAddress', value)}
          labelField="label"
          valueField="value"
          placeholder="Выберите..."
          searchPlaceholder="Поиск типа места..."
          search={true}
          compact
        />
        {selectedCategoriesCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsContainer}
            contentContainerStyle={styles.chipsContent}
          >
            {filterValue.categoryTravelAddress.slice(0, 5).map((cat) => {
              const catValue = getCategoryName(cat)
              const catKey =
                typeof cat === 'string'
                  ? cat
                  : cat && typeof cat === 'object' && 'id' in cat
                    ? String(cat.id)
                    : catValue
              const displayText = catValue.split(' ')[0] || catValue
              const iconName = CATEGORY_ICONS[catValue]

              return (
                <View key={catKey} style={styles.categoryChip}>
                  {iconName && <Feather name={iconName} size={12} color={colors.primary} />}
                  <Text style={styles.categoryChipText} numberOfLines={1}>
                    {displayText}
                  </Text>
                  <IconButton
                    icon={<MapIcon name="close" size={16} color={colors.primary} />}
                    label="Удалить категорию"
                    size="sm"
                    onPress={() => handleCategoryRemove(cat)}
                    style={styles.categoryChipIconButton}
                  />
                </View>
              )
            })}
            {selectedCategoriesCount > 5 && (
              <View style={styles.moreChip}>
                <Text style={styles.moreChipText}>+{selectedCategoriesCount - 5}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </CollapsibleSection>

      {hasSelectionSummary && (
        <View style={styles.filterSelectionSummary} testID="radius-selection-summary">
          <View style={styles.filterSelectionChips}>
            {selectedCategoryNames.length > 0 ? (
              <View style={styles.filterSelectionChip}>
                <Feather name="grid" size={12} color={colors.primary} />
                <Text style={styles.filterSelectionChipText} numberOfLines={1}>
                  {categorySummary}
                </Text>
              </View>
            ) : null}
            {radiusSummaryValue ? (
              <View style={styles.filterSelectionChip}>
                <Feather name="radio" size={12} color={colors.primary} />
                <Text style={styles.filterSelectionChipText} numberOfLines={1}>
                  {radiusSummaryText}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.radiusSelectionHint}>
            {radiusResultCount > 0
              ? `${getPlacesLabel(radiusResultCount)} попадает в выбранные условия.`
              : 'Под выбранные условия пока ничего не попадает.'}
          </Text>
        </View>
      )}
    </View>
  )
}

export default React.memo(FiltersPanelRadiusSection)
