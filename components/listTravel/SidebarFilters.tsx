import React, { memo } from 'react'
import { View, ViewStyle } from 'react-native'
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
    containerStyle,
  }) => {
    if (isMobile) {
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
        />
      </View>
    )
  }
)

export default SidebarFilters
