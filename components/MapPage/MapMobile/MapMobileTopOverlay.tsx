/**
 * MapMobileTopOverlay — maps.me-style persistent overlay on top of the map.
 *
 * Renders:
 *  - a search bar placeholder ("Искать места") that opens the filters/search sheet
 *  - a filters icon button (sliders) opening the full FiltersPanel
 *  - a horizontally scrollable row of chips: radius chip first, then category
 *    chips (selected highlighted). Tapping a category chip toggles it instantly.
 *
 * No persistent panel — this overlay floats above a full-screen map.
 */
import React, { useCallback } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { getMapMobileTopOverlayStyles } from './MapMobileTopOverlay.styles'

export interface CategoryChip {
  id: string
  name: string
  selected: boolean
}

interface MapMobileTopOverlayProps {
  colors: ThemedColors
  topInset: number
  searchSummary: string
  radiusLabel: string
  categoryChips: ReadonlyArray<CategoryChip>
  hasMoreCategories: boolean
  onOpenSearch: () => void
  onOpenFilters: () => void
  onOpenRadius: () => void
  onToggleCategory: (id: string) => void
}

const MapMobileTopOverlayInner: React.FC<MapMobileTopOverlayProps> = ({
  colors,
  topInset,
  searchSummary,
  radiusLabel,
  categoryChips,
  hasMoreCategories,
  onOpenSearch,
  onOpenFilters,
  onOpenRadius,
  onToggleCategory,
}) => {
  const styles = getMapMobileTopOverlayStyles(colors)

  // R-1 — глобальной шапки на табе карты больше нет, поэтому overlay сам отвечает
  // за отступ под статус-бар/нотч. Берём safe-area top, но держим небольшой пол,
  // чтобы строка поиска не прилипала к самому краю там, где safe-area == 0
  // (web-mobile, Android без нотча).
  const resolvedTopPadding = Math.max(topInset, 8) + 8

  const renderCategory = useCallback(
    (chip: CategoryChip) => (
      <Pressable
        key={chip.id}
        testID={`map-chip-category-${chip.id}`}
        onPress={() => onToggleCategory(chip.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: chip.selected }}
        accessibilityLabel={`Категория ${chip.name}${chip.selected ? ', выбрана' : ''}`}
        style={({ pressed }) => [
          styles.chip,
          chip.selected && styles.chipSelected,
          pressed && { opacity: 0.8 },
        ]}
      >
        <RNText
          numberOfLines={1}
          style={[styles.chipText, chip.selected && styles.chipTextSelected]}
        >
          {chip.name}
        </RNText>
      </Pressable>
    ),
    [
      onToggleCategory,
      styles.chip,
      styles.chipSelected,
      styles.chipText,
      styles.chipTextSelected,
    ],
  )

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: resolvedTopPadding }]}
      testID="map-mobile-top-overlay"
    >
      <View style={styles.searchRow} pointerEvents="auto">
        <Pressable
          testID="map-mobile-search"
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel="Искать места"
          style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.9 }]}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <RNText style={styles.searchText} numberOfLines={1}>
            {searchSummary || 'Искать места'}
          </RNText>
        </Pressable>
        <Pressable
          testID="map-mobile-filters-button"
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel="Открыть фильтры"
          hitSlop={6}
          style={({ pressed }) => [
            styles.filtersButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="sliders" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsContent}
        style={styles.chipsScroll}
        pointerEvents="auto"
        testID="map-mobile-chips"
      >
        <Pressable
          testID="map-chip-radius"
          onPress={onOpenRadius}
          accessibilityRole="button"
          accessibilityLabel={`Радиус ${radiusLabel}`}
          style={({ pressed }) => [
            styles.chip,
            styles.chipRadius,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Feather name="target" size={13} color={colors.primary} />
          <RNText style={[styles.chipText, styles.chipRadiusText]} numberOfLines={1}>
            {radiusLabel}
          </RNText>
        </Pressable>

        {categoryChips.map(renderCategory)}

        {hasMoreCategories && (
          <Pressable
            testID="map-chip-more"
            onPress={onOpenFilters}
            accessibilityRole="button"
            accessibilityLabel="Все категории"
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
          >
            <RNText style={styles.chipText} numberOfLines={1}>
              Ещё…
            </RNText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

export const MapMobileTopOverlay = React.memo(MapMobileTopOverlayInner)

export const IS_TOP_OVERLAY_WEB = Platform.OS === 'web'
