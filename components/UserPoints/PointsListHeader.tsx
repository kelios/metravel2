import React from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointFilters } from '@/components/UserPoints/PointFilters'
import type { PointFilters as PointFiltersType } from '@/types/userPoints'

import type { PointsListStyles } from './PointsList'

type ViewMode = 'list' | 'map'

type ActiveFilterChip = {
  key: string
  label: string
}

type PointsListHeaderProps = {
  styles: PointsListStyles
  colors: {
    text: string
    textMuted: string
    textOnPrimary: string
  }
  isNarrow: boolean
  isMobile: boolean
  total: number
  found: number

  hasActiveFilters: boolean
  onResetFilters: () => void

  activeFilterChips: ActiveFilterChip[]
  onRemoveFilterChip: (key: string) => void

  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void

  /** Web desktop layout: right panel tabs (filters/list) */
  panelTab?: 'filters' | 'list'
  onPanelTabChange?: (tab: 'filters' | 'list') => void
  hideViewToggle?: boolean

  showFilters: boolean
  onToggleFilters: () => void

  onOpenActions: () => void
  onOpenRecommendations: () => void

  searchQuery: string
  onSearch: (text: string) => void

  filters: PointFiltersType
  onFilterChange: (newFilters: PointFiltersType) => void

  siteCategoryOptions: Array<{ id: string; name: string }>
  availableColors?: string[]
}

export const PointsListHeader: React.FC<PointsListHeaderProps> = ({
  styles,
  colors,
  isNarrow: _isNarrow,
  isMobile,
  total,
  found,
  hasActiveFilters,
  onResetFilters,
  activeFilterChips,
  onRemoveFilterChip,
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  panelTab: _panelTab,
  onPanelTabChange: _onPanelTabChange,
  hideViewToggle: _hideViewToggle,
  showFilters,
  onToggleFilters,
  onOpenActions,
  onOpenRecommendations,
  searchQuery,
  onSearch,
  filters,
  onFilterChange,
  siteCategoryOptions,
  availableColors,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Всего</Text>
            <Text style={styles.statPillValue}>{total || 0}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Найдено</Text>
            <Text style={styles.statPillValue}>{found || 0}</Text>
          </View>
        </View>

        <View style={styles.actionsTopRow}>
          <TouchableOpacity
            style={[styles.headerButton, styles.headerIconButton]}
            onPress={onOpenActions}
            testID="userpoints-actions-open"
            accessibilityRole="button"
            accessibilityLabel="Управление точками"
          >
            <Feather name="settings" size={18} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, styles.headerIconButton]}
            onPress={onToggleFilters}
            accessibilityRole="button"
            accessibilityLabel={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
          >
            <Feather name={showFilters ? 'eye-off' : 'filter'} size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerActionsRow}>
        <TouchableOpacity
          style={[
            styles.recoOpenButton,
            styles.recoOpenButtonFull,
            !isMobile && ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } as any),
          ]}
          onPress={onOpenRecommendations}
          accessibilityRole="button"
          accessibilityLabel="3 случайные точки"
        >
          <Feather name="compass" size={18} color={colors.textOnPrimary} />
          <Text numberOfLines={1} style={[styles.recoOpenButtonText, styles.recoOpenButtonTextFull]}>
            3 случайные точки
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChangeText={onSearch}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.headerDivider} />

      {hasActiveFilters ? (
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.subtitle, { marginBottom: 6 } as any]}>Активные фильтры</Text>
            <TouchableOpacity
              style={[styles.headerButton, isMobile && styles.headerIconButton]}
              onPress={onResetFilters}
              accessibilityRole="button"
              accessibilityLabel="Сбросить фильтры"
            >
              {isMobile ? (
                <Feather name="x" size={18} color={colors.text} />
              ) : (
                <Text style={styles.headerButtonText}>Сбросить</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {activeFilterChips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={[styles.webChip, { marginRight: 8, marginBottom: 8 } as any]}
                onPress={() => onRemoveFilterChip(chip.key)}
                accessibilityRole="button"
                accessibilityLabel={`Убрать фильтр: ${chip.label}`}
              >
                <Text style={styles.webChipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {showFilters ? (
        <PointFilters
          filters={filters}
          onChange={onFilterChange}
          siteCategoryOptions={siteCategoryOptions}
          availableColors={availableColors}
        />
      ) : null}
    </View>
  )
}
