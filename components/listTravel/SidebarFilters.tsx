import React, { memo } from 'react'
import { Platform, View, ViewStyle } from 'react-native'
import ModernFilters from './ModernFilters'

interface SidebarFiltersProps {
  isMobile: boolean
  filterGroups: any[]
  filter: any
  onSelect: (groupKey: string, value: any) => void
  total: number
  isSuper: boolean
  setSearch: (value: string) => void
  resetFilters: () => void
  isVisible?: boolean
  onClose?: () => void
  containerStyle?: ViewStyle | ViewStyle[] | undefined
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
    onClose,
    containerStyle,
  }) => {
    // На native скрываем фильтры на мобильных, на web скрываем только если явно выключены
    if (Platform.OS !== 'web' && isMobile) {
      return null
    }

    if (Platform.OS === 'web' && isMobile && !isVisible) {
      return null
    }

    return (
      <View style={containerStyle}>
        <ModernFilters
          filterGroups={filterGroups}
          selectedFilters={filter as any}
          onFilterChange={(groupKey, optionId) => {
            const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v))
            const normalizedId = String(optionId)
            const newValues = currentValues.includes(normalizedId)
              ? currentValues.filter((id) => id !== normalizedId)
              : [...currentValues, normalizedId]
            onSelect(groupKey, newValues)
          }}
          onClearAll={() => {
            setSearch('')
            resetFilters()
          }}
          resultsCount={total}
          year={filter.year}
          onYearChange={(value) => onSelect('year', value)}
          showModeration={isSuper}
          moderationValue={filter.moderation}
          onToggleModeration={() => {
            const next = filter.moderation === 0 ? undefined : 0
            onSelect('moderation', next)
          }}
          onClose={onClose}
        />
      </View>
    )
  }
)

export default SidebarFilters
