import React from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointFilters } from '@/components/UserPoints/PointFilters'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import IconButton from '@/components/ui/IconButton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
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
  const themed = useThemedColors();
  const local = React.useMemo(() => createLocalStyles(themed), [themed]);

  return (
    <View style={styles.header}>
      <View style={local.summaryCard}>
        <View style={local.summaryTopRow}>
          <View style={local.summaryTextBlock}>
            <Text style={local.summaryEyebrow}>Ваши точки</Text>
            <Text style={local.summaryTitle}>Управляйте сохранёнными местами</Text>
            <Text style={local.summarySubtitle}>
              Быстро переключайте фильтры, настройки карты и подборки прямо из панели.
            </Text>
          </View>

          <View style={local.statsGrid}>
            <View style={[styles.statPill, local.statCard]}>
              <Text style={styles.statPillLabel}>Всего</Text>
              <Text style={[styles.statPillValue, local.statValue]}>{total || 0}</Text>
            </View>
            <View style={[styles.statPill, local.statCard]}>
              <Text style={styles.statPillLabel}>Найдено</Text>
              <Text style={[styles.statPillValue, local.statValue]}>{found || 0}</Text>
            </View>
          </View>
        </View>

        <View style={local.actionsGrid}>
          <IconButton
            icon={<Feather name="settings" size={18} color={colors.text} />}
            label="Управление точками"
            onPress={onOpenActions}
            size="sm"
            testID="userpoints-actions-open"
            showLabel={!isMobile}
            style={local.actionButton}
          />

          <IconButton
            icon={<Feather name={showFilters ? 'eye-off' : 'filter'} size={18} color={colors.text} />}
            label={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
            onPress={onToggleFilters}
            active={showFilters}
            size="sm"
            showLabel={!isMobile}
            style={local.actionButton}
          />

          <IconButton
            icon={<Feather name="sliders" size={18} color={colors.text} />}
            label={showMapSettings ? 'Скрыть настройки карты' : 'Показать настройки карты'}
            onPress={onToggleMapSettings}
            active={showMapSettings}
            size="sm"
            showLabel={!isMobile}
            style={local.actionButton}
          />
          <IconButton
            icon={<Feather name="compass" size={18} color={colors.text} />}
            label="3 случайные точки"
            onPress={onOpenRecommendations}
            size="sm"
            showLabel={!isMobile}
            style={local.actionButton}
          />
        </View>
      </View>

      <View style={local.searchBlock}>
        <Text style={local.searchLabel}>Поиск по точкам</Text>
        <View style={local.searchField}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, local.searchInput]}
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChangeText={onSearch}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Поиск по точкам"
          />
        </View>
      </View>

      <View style={styles.headerDivider} />

      {hasActiveFilters ? (
        <View style={local.activeFiltersBlock}>
          <View style={local.activeFiltersHeaderRow}>
            <Text style={[styles.subtitle, local.activeFiltersLabel]}>Активные фильтры</Text>
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

          <View style={local.activeFiltersChipsRow}>
            {activeFilterChips.map((chip) => (
              <View key={chip.key} style={local.activeFiltersChipItem}>
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

const createLocalStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  summaryCard: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.md,
  },
  summaryTopRow: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  summaryTextBlock: {
    gap: 6,
  },
  summaryEyebrow: {
    fontSize: 12,
    fontWeight: '700' as any,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800' as any,
    color: colors.text,
  },
  summarySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  statCard: {
    minWidth: 104,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  statValue: {
    fontSize: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  actionButton: {
    marginHorizontal: 0,
    ...(Platform.OS === 'web'
      ? ({
          width: 'calc(50% - 6px)',
          justifyContent: 'flex-start',
        } as any)
      : null),
  },
  searchBlock: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600' as any,
    color: colors.textMuted,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        } as any)
      : null),
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 0,
  },
  activeFiltersBlock: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  activeFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  activeFiltersLabel: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: colors.textMuted,
    marginBottom: 0,
  },
  activeFiltersChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  activeFiltersChipItem: {
    // gap handles spacing now
  },
})
