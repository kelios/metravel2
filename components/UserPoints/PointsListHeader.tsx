import React from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointFilters } from '@/components/UserPoints/PointFilters'
import type { PointFilters as PointFiltersType } from '@/types/userPoints'

import type { PointsListStyles } from './PointsList'

type ViewMode = 'list' | 'map'

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

  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void

  showFilters: boolean
  onToggleFilters: () => void

  onOpenActions: () => void
  onOpenRecommendations: () => void

  searchQuery: string
  onSearch: (text: string) => void

  filters: PointFiltersType
  onFilterChange: (newFilters: PointFiltersType) => void

  siteCategoryOptions: Array<{ id: string; name: string }>
}

export const PointsListHeader: React.FC<PointsListHeaderProps> = ({
  styles,
  colors,
  isNarrow,
  isMobile,
  total,
  viewMode,
  onViewModeChange,
  showFilters,
  onToggleFilters,
  onOpenActions,
  onOpenRecommendations,
  searchQuery,
  onSearch,
  filters,
  onFilterChange,
  siteCategoryOptions,
}) => {
  return (
    <View style={styles.header}>
      <View style={[styles.titleRow, isNarrow && styles.titleRowNarrow]}>
        <View>
          <Text style={styles.title}>Мои точки</Text>
          <Text style={styles.subtitle}>Всего: {total || 0} точек</Text>
        </View>

        <View style={isNarrow ? styles.headerActionsNarrow : styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, isMobile && styles.headerIconButton]}
            onPress={onOpenActions}
            accessibilityRole="button"
            accessibilityLabel="Добавить"
          >
            {isMobile ? (
              <Feather name="plus" size={18} color={colors.text} />
            ) : (
              <Text style={styles.headerButtonText}>Добавить</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, isMobile && styles.headerIconButton]}
            onPress={onToggleFilters}
            accessibilityRole="button"
            accessibilityLabel={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
          >
            {isMobile ? (
              <Feather name="filter" size={18} color={colors.text} />
            ) : (
              <Text style={styles.headerButtonText}>
                {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.recoOpenButton, isMobile && styles.headerIconButtonPrimary]}
            onPress={onOpenRecommendations}
            accessibilityRole="button"
            accessibilityLabel="Куда поехать сегодня"
          >
            {isMobile ? (
              <Feather name="compass" size={18} color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.recoOpenButtonText}>Куда поехать сегодня</Text>
            )}
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.viewButton,
                isMobile && styles.viewIconButton,
                viewMode === 'list' && styles.viewButtonActive,
              ]}
              onPress={() => onViewModeChange('list')}
              accessibilityRole="button"
              accessibilityLabel="Список"
            >
              {isMobile ? (
                <Feather
                  name="list"
                  size={18}
                  color={viewMode === 'list' ? colors.textOnPrimary : colors.textMuted}
                />
              ) : (
                <Text
                  style={[styles.viewButtonText, viewMode === 'list' && styles.viewButtonTextActive]}
                >
                  Список
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewButton,
                isMobile && styles.viewIconButton,
                viewMode === 'map' && styles.viewButtonActive,
              ]}
              onPress={() => onViewModeChange('map')}
              accessibilityRole="button"
              accessibilityLabel="Карта"
            >
              {isMobile ? (
                <Feather
                  name="map"
                  size={18}
                  color={viewMode === 'map' ? colors.textOnPrimary : colors.textMuted}
                />
              ) : (
                <Text
                  style={[styles.viewButtonText, viewMode === 'map' && styles.viewButtonTextActive]}
                >
                  Карта
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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

      {showFilters && (
        <PointFilters
          filters={filters}
          onChange={onFilterChange}
          siteCategoryOptions={siteCategoryOptions}
        />
      )}
    </View>
  )
}
