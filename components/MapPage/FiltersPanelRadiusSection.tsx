import React, { useMemo, useCallback } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import MultiSelectField from '@/components/forms/MultiSelectField'
import MapIcon from './MapIcon'
import CollapsibleSection from '@/components/MapPage/CollapsibleSection'
import MapSearchInput from '@/components/MapPage/MapSearchInput'
import type { ThemedColors } from '@/hooks/useTheme'
import IconButton from '@/components/ui/IconButton'
import Chip from '@/components/ui/Chip'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
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

  const radiusSummaryValue = filterValue.radius || DEFAULT_RADIUS_KM
  const radiusSummaryText = getRadiusLabel(radiusSummaryValue)

  const searchQueryValue = String(filterValue.searchQuery || '')
  const handleSearchChange = useCallback(
    (value: string) => safeOnFilterChange('searchQuery', value),
    [safeOnFilterChange]
  )
  const radiusOptions = useMemo(
    () => (Array.isArray(filters.radius) ? filters.radius : []).filter((option) => option?.id),
    [filters.radius]
  )

  return (
    <View style={styles.lightStepBlock}>
      <MapSearchInput
        value={searchQueryValue}
        onChange={handleSearchChange}
        placeholder="Найти место по названию..."
        resultsCount={searchQueryValue ? travelsData.length : undefined}
      />
      {radiusOptions.length > 0 ? (
        <CollapsibleSection
          title="Радиус поиска"
          badge={radiusSummaryText}
          defaultOpen={true}
          icon="radio"
          tone="flat"
        >
          {!isMobile ? (
            <Text style={styles.sectionHint}>Выберите, как далеко искать места вокруг вас</Text>
          ) : null}
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
                  icon={<Feather name="radio" size={12} color={colors.primary} />}
                  style={styles.radiusOptionChip}
                />
              )
            })}
          </View>
        </CollapsibleSection>
      ) : null}
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
    </View>
  )
}

export default React.memo(FiltersPanelRadiusSection)
