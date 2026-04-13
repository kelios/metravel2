import React, { memo, useCallback } from 'react'
import { Platform, StyleProp, View, ViewStyle } from 'react-native'
import ModernFilters from './ModernFilters'
import type { FilterState as ModernFilterState } from './ModernFilters'
import type { FilterState } from './utils/listTravelTypes'
import type { TravelFilterGroup } from './utils/filterGroups'

interface SidebarFiltersProps {
  isMobile: boolean
  filterGroups: TravelFilterGroup[]
  filter: FilterState
  onSelect: (groupKey: string, value: any) => void
  total: number
  isSuper: boolean
  setSearch: (value: string) => void
  resetFilters: () => void
  isVisible?: boolean
  isLoading?: boolean
  onClose?: () => void
  containerStyle?: StyleProp<ViewStyle>
}

const SidebarFilters: React.FC<SidebarFiltersProps> = memo(
  ({
    isMobile,
    filterGroups,
    filter,
    onSelect,
    total,
    isSuper,
    setSearch,
    resetFilters,
    isVisible = true,
    isLoading = false,
    onClose,
    containerStyle,
  }) => {
    const handleFilterChange = useCallback((groupKey: string, optionId: string) => {
      const group = filterGroups.find((item) => item?.key === groupKey);
      const isMultiSelect = group?.multiSelect !== false;
      if (!isMultiSelect) {
        const currentValue = filter[groupKey as keyof FilterState];
        const normalizedId = String(optionId);
        const nextValue = currentValue !== undefined && String(currentValue) === normalizedId
          ? undefined
          : normalizedId;
        onSelect(groupKey, nextValue);
        return;
      }

      const currentValues: string[] = ((filter[groupKey as keyof FilterState] as any) || []).map((v: any) => String(v))
      const normalizedId = String(optionId)
      const newValues = currentValues.includes(normalizedId)
        ? currentValues.filter((id) => id !== normalizedId)
        : [...currentValues, normalizedId]
      onSelect(groupKey, newValues)
    }, [filterGroups, filter, onSelect])

    const handleClearAll = useCallback(() => {
      setSearch('')
      resetFilters()
    }, [setSearch, resetFilters])

    const handleYearChange = useCallback((value?: string) => {
      onSelect('year', value)
    }, [onSelect])

    const handleToggleModeration = useCallback(() => {
      const next = filter.moderation === 0 ? undefined : 0
      onSelect('moderation', next)
    }, [filter.moderation, onSelect])

    // На native скрываем фильтры на мобильных, на web скрываем только если явно выключены
    if (Platform.OS !== 'web' && isMobile) {
      return null
    }

    // На web-mobile при скрытой панели ничего не рендерим, чтобы избежать лишнего DOM и CLS.
    if (Platform.OS === 'web' && isMobile && !isVisible) {
      return null
    }

    return (
      <View style={containerStyle}>
        <ModernFilters
          filterGroups={filterGroups}
          selectedFilters={filter as unknown as ModernFilterState}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
          resultsCount={total}
          isLoading={isLoading}
          year={filter.year}
          onYearChange={handleYearChange}
          showModeration={isSuper}
          moderationValue={filter.moderation}
          onToggleModeration={handleToggleModeration}
          onClose={onClose}
        />
      </View>
    )
  }
)

export default SidebarFilters
