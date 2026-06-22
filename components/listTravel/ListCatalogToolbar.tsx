import React, { memo, useMemo } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
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
}: ListCatalogToolbarProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const { isMobile } = useResponsive()

  const activeSort = (sortValue || '').trim() || DEFAULT_SORT_ID
  const countVisible = showResultsCount && typeof resultsCount === 'number'

  if (!sortOptions.length && !showDensityToggle && !countVisible) return null

  return (
    <View
      style={[styles.container, { paddingHorizontal: contentPadding }]}
      accessibilityRole={Platform.OS === 'web' ? undefined : 'toolbar'}
    >
      {countVisible ? (
        <Text style={styles.countText} numberOfLines={1} testID="toolbar-results-count">
          {resultsCount} {getTravelLabel(resultsCount as number)}
        </Text>
      ) : null}

      {sortOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
          style={styles.sortScroll}
          accessibilityRole={Platform.OS === 'web' ? undefined : ('toolbar' as any)}
          accessibilityLabel="Сортировка списка"
        >
          {!isMobile ? (
            <View style={styles.sortLabelWrap}>
              <Feather name="bar-chart-2" size={13} color={colors.textMuted} />
              <Text style={styles.sortLabel}>Сортировка</Text>
            </View>
          ) : null}
          {sortOptions.map((option) => {
            const isActive = option.id === activeSort
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
                  {option.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : (
        <View style={styles.sortScroll} />
      )}

      {showDensityToggle ? (
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
      ) : null}
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
      paddingTop: spacing.xs,
    },
    sortScroll: {
      flex: 1,
      minWidth: 0,
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      // Trailing room so the last chip ("Популярные") never clips at the
      // ScrollView edge when chips overflow into horizontal scroll.
      paddingRight: spacing.sm,
    },
    sortLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: 2,
    },
    sortLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    countText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      flexShrink: 0,
      marginRight: spacing.xs,
    },
    chip: {
      flexShrink: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
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
      width: 36,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    densityButtonActive: {
      backgroundColor: colors.primarySoft,
    },
  })

export default memo(ListCatalogToolbar)
