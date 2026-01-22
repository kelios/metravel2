import React from 'react'
import { Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointFilters } from '@/components/UserPoints/PointFilters'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import IconButton from '@/components/ui/IconButton'
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

  showMapSettings: boolean
  onToggleMapSettings: () => void

  onOpenActions: () => void
  onOpenRecommendations: () => void

  searchQuery: string
  onSearch: (text: string) => void

  filters: PointFiltersType
  onFilterChange: (newFilters: PointFiltersType) => void

  presets?: Array<{ id: string; label: string }>
  activePresetId?: string | null
  onPresetChange?: (presetId: string | null) => void

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
  showMapSettings,
  onToggleMapSettings,
  onOpenActions,
  onOpenRecommendations,
  searchQuery,
  onSearch,
  filters,
  onFilterChange,
  presets,
  activePresetId,
  onPresetChange,
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
          <IconButton
            icon={<Feather name="settings" size={18} color={colors.text} />}
            label="Управление точками"
            onPress={onOpenActions}
            size="sm"
            testID="userpoints-actions-open"
          />

          <IconButton
            icon={<Feather name={showFilters ? 'eye-off' : 'filter'} size={18} color={colors.text} />}
            label={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
            onPress={onToggleFilters}
            active={showFilters}
            size="sm"
          />

          <IconButton
            icon={<Feather name="sliders" size={18} color={colors.text} />}
            label={showMapSettings ? 'Скрыть настройки карты' : 'Показать настройки карты'}
            onPress={onToggleMapSettings}
            active={showMapSettings}
            size="sm"
          />
        </View>
      </View>

      <View style={styles.headerActionsRow}>
        <Button
          label="3 случайные точки"
          onPress={onOpenRecommendations}
          accessibilityLabel="3 случайные точки"
          icon={<Feather name="compass" size={18} color={colors.textOnPrimary} />}
          fullWidth
        />
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
            {isMobile ? (
              <IconButton
                icon={<Feather name="x" size={18} color={colors.text} />}
                label="Сбросить фильтры"
                onPress={onResetFilters}
                size="sm"
              />
            ) : (
              <Button
                label="Сбросить"
                onPress={onResetFilters}
                accessibilityLabel="Сбросить фильтры"
                size="sm"
                variant="secondary"
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {activeFilterChips.map((chip) => (
              <View key={chip.key} style={{ marginRight: 8, marginBottom: 8 }}>
                <Chip
                  label={chip.label}
                  onPress={() => onRemoveFilterChip(chip.key)}
                  testID={`userpoints-filter-chip-${chip.key}`}
                  selected
                />
              </View>
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
          presets={presets}
          activePresetId={activePresetId}
          onPresetChange={onPresetChange}
        />
      ) : null}
    </View>
  )
}
