import { memo, useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { getTravelLabel } from '@/utils/pluralize'
import type { ListDensity } from '@/stores/listViewStore'

export type ListSortOption = { id: string; name: string }

interface ListCatalogToolbarProps {
  sortOptions: ListSortOption[]
  sortValue: string
  onSortChange: (id: string) => void
  density: ListDensity
  onDensityChange: (density: ListDensity) => void
  /** Hide the density toggle on single-column layouts where it would force a 2-col grid. */
  showDensityToggle?: boolean
  /**
   * Explicit override for the sort chips. Even when true, the chips are dropped in the compact
   * (native / narrow-web) layout where they'd take a full extra row — on mobile sorting lives inside
   * the filters sheet (SortDropdown) instead, keeping the pinned header within the 20% budget. Same
   * `filter.sort` state, so nothing is lost. Desktop (row layout) keeps the inline chips.
   */
  showSort?: boolean
  contentPadding?: number
  /**
   * On mobile the results count is surfaced inline here (leading the sort row) instead of in a
   * standalone sticky row above, keeping the pinned header height within the 20% budget (#336).
   */
  resultsCount?: number
  showResultsCount?: boolean
}

const spacing = DESIGN_TOKENS.spacing
const radii = DESIGN_TOKENS.radii
const DEFAULT_SORT_ID = 'newest'
const NATIVE_SORT_LABELS: Record<string, string> = {
  newest: 'Новые',
  oldest: 'Старые',
  popular_desc: 'Популярные',
}

function ListCatalogToolbar({
  sortOptions,
  sortValue,
  onSortChange,
  density,
  onDensityChange,
  showDensityToggle = true,
  contentPadding = 0,
  resultsCount,
  showResultsCount = false,
  showSort = true,
}: ListCatalogToolbarProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const { width: viewportWidth } = useWindowDimensions()

  const activeSort = (sortValue || '').trim() || DEFAULT_SORT_ID
  const countVisible = showResultsCount && typeof resultsCount === 'number'
  const isNative = Platform.OS !== 'web'
  const isCompactWeb = Platform.OS === 'web' && viewportWidth > 0 && viewportWidth < 600
  const compactLayout = isNative || isCompactWeb
  // Sort chips are dropped in the compact layout (all phones + narrow web) — they'd wrap onto their
  // own full-width row and blow the 20% header budget. Sorting stays reachable in the filters sheet.
  const sortEnabled = showSort && !compactLayout
  const sortVisible = sortEnabled && sortOptions.length > 0

  if (!sortVisible && !showDensityToggle && !countVisible) return null

  const countNode = countVisible ? (
    <Text style={styles.countText} numberOfLines={1} testID="toolbar-results-count">
      {resultsCount} {getTravelLabel(resultsCount as number)}
    </Text>
  ) : null

  const sortNode = !sortEnabled ? null : sortOptions.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sortRow}
      style={[
        styles.sortScroll,
        isNative && styles.sortScrollNative,
        isCompactWeb && styles.sortScrollCompactWeb,
      ]}
      accessibilityRole={Platform.OS === 'web' ? undefined : ('toolbar' as any)}
      accessibilityLabel="Сортировка списка"
    >
      {sortOptions.map((option) => {
        const isActive = option.id === activeSort
        const chipLabel = isNative ? NATIVE_SORT_LABELS[option.id] ?? option.name : option.name
        return (
          <Pressable
            key={option.id}
            testID={`sort-chip-${option.id}`}
            onPress={() => onSortChange(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Сортировать: ${option.name}`}
            style={[styles.chip, isActive && styles.chipActive]}
            {...Platform.select({ web: { title: option.name } as any })}
          >
            <Text
              style={[styles.chipText, isActive && styles.chipTextActive]}
              numberOfLines={1}
            >
              {chipLabel}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.sortScroll,
        isNative && styles.sortScrollNative,
        isCompactWeb && styles.sortScrollCompactWeb,
      ]}
    />
  )

  const densityNode = showDensityToggle ? (
    <View
      style={styles.densityGroup}
      accessibilityRole={Platform.OS === 'web' ? undefined : ('radiogroup' as any)}
      accessibilityLabel="Плотность списка"
    >
      {DENSITY_BUTTONS.map((button) => {
        const isActive = density === button.value
        return (
          <Pressable
            key={button.value}
            testID={`density-${button.value}`}
            onPress={() => onDensityChange(button.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={button.label}
            style={[styles.densityButton, isActive && styles.densityButtonActive]}
            {...Platform.select({ web: { title: button.label } as any })}
          >
            <Feather
              name={button.icon}
              size={15}
              color={isActive ? colors.primary : colors.textMuted}
            />
          </Pressable>
        )
      })}
    </View>
  ) : null

  if (isNative || isCompactWeb) {
    return (
      <View
        style={[styles.container, styles.compactContainer, { paddingHorizontal: contentPadding }]}
        accessibilityRole="toolbar"
      >
        {(countNode || densityNode) ? (
          <View style={styles.compactTopRow}>
            {countNode}
            {densityNode}
          </View>
        ) : null}
        {sortNode}
      </View>
    )
  }

  return (
    <View
      style={[styles.container, { paddingHorizontal: contentPadding }]}
      accessibilityRole={Platform.OS === 'web' ? undefined : 'toolbar'}
    >
      {countNode}
      {sortNode}
      {densityNode}
    </View>
  )
}

const DENSITY_BUTTONS: Array<{
  value: ListDensity
  icon: keyof typeof Feather.glyphMap
  label: string
}> = [
  { value: 'comfortable', icon: 'square', label: 'Крупные карточки' },
  { value: 'compact', icon: 'grid', label: 'Компактный вид' },
]

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingTop: spacing.xxs,
      flexWrap: 'nowrap',
    },
    compactContainer: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.xs,
    },
    compactTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sortScroll: {
      flex: 1,
      minWidth: Platform.select({ web: 0, default: 120 }),
      maxWidth: '100%',
    },
    sortScrollNative: {
      flex: 0,
      width: '100%',
      minWidth: '100%',
    },
    sortScrollCompactWeb: {
      flex: 0,
      width: '100%',
      minWidth: '100%',
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      // Trailing room so the last chip ("Популярные") never clips at the
      // ScrollView edge when chips overflow into horizontal scroll.
      paddingRight: spacing.sm,
    },
    countText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      flexShrink: 1,
      minWidth: 0,
      marginRight: spacing.xs,
    },
    chip: {
      flexShrink: 0,
      minHeight: 32,
      minWidth: Platform.select({ web: undefined, default: 72 }),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    chipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha40,
    },
    chipText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.primaryText,
    },
    densityGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      flexShrink: 0,
    },
    densityButton: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    densityButtonActive: {
      backgroundColor: colors.primarySoft,
    },
  })

export default memo(ListCatalogToolbar)
