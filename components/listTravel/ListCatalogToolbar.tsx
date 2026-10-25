import { memo, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { getTravelLabel } from '@/utils/pluralize'
import type { ListDensity } from '@/stores/listViewStore'
import { translate as i18nT } from '@/i18n'
import { DialogMenu } from '@/ui/paper'
import { webAccessibilityProps, webTitleRef, webViewStyle } from '@/utils/webProps'


export type ListSortOption = { id: string; name: string }
export type ListStatusMode = 'all' | 'published' | 'drafts'

interface ListCatalogToolbarProps {
  sortOptions: ListSortOption[]
  sortValue: string
  onSortChange: (id: string) => void
  density: ListDensity
  onDensityChange: (density: ListDensity) => void
  /** Hide the density toggle on single-column layouts where it would force a 2-col grid. */
  showDensityToggle?: boolean
  /**
   * Explicit override for the sort menu. Even when true, sorting is dropped in the compact
   * (native / narrow-web) layout — on mobile it lives inside the filters sheet (SortDropdown),
   * keeping the pinned header within the 20% budget. Same `filter.sort` state, so nothing is lost.
   * Desktop (row layout) shows a single sort button with an anchored menu (#2755).
   */
  showSort?: boolean
  /**
   * Desktop: the toolbar is embedded in the search bar row (#2755), so it drops its own
   * paddings and lets the search field take the remaining width.
   */
  inline?: boolean
  contentPadding?: number
  /**
   * On mobile the results count is surfaced inline here (leading the sort row) instead of in a
   * standalone sticky row above, keeping the pinned header height within the 20% budget (#336).
   */
  resultsCount?: number
  showResultsCount?: boolean
  statusMode?: ListStatusMode
  onStatusModeChange?: (mode: ListStatusMode) => void
  showStatusModeToggle?: boolean
  /** Hydration-stable layout mode resolved by the list viewport owner. */
  compactLayout: boolean
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
  showSort = true,
  statusMode = 'all',
  onStatusModeChange,
  showStatusModeToggle = false,
  compactLayout,
  inline = false,
}: ListCatalogToolbarProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [sortMenuVisible, setSortMenuVisible] = useState(false)

  const activeSort = (sortValue || '').trim() || DEFAULT_SORT_ID
  const countVisible = showResultsCount && typeof resultsCount === 'number'
  const isNative = Platform.OS !== 'web'
  // ListTravelBase owns the responsive breakpoint and passes a value that is
  // already stable when this lazy route mounts. Reading useWindowDimensions()
  // again here briefly selected desktop geometry on mobile web and shifted the
  // density control after hydration (#1298).
  const isCompactWeb = Platform.OS === 'web' && compactLayout
  const useCompactLayout = isNative || isCompactWeb
  // Sorting is dropped in the compact layout (all phones + narrow web) to keep the 20% header
  // budget. It stays reachable in the filters sheet.
  const sortEnabled = showSort && !useCompactLayout
  const sortVisible = sortEnabled && sortOptions.length > 0

  const statusVisible = showStatusModeToggle && !!onStatusModeChange

  if (!sortVisible && !showDensityToggle && !countVisible && !statusVisible) return null

  const countNode = countVisible ? (
    <Text style={styles.countText} numberOfLines={1} testID="toolbar-results-count">
      {resultsCount} {getTravelLabel(resultsCount as number)}
    </Text>
  ) : null

  const activeSortOption = sortOptions.find((option) => option.id === activeSort) ?? sortOptions[0]
  const sortNode = sortVisible ? (
    <DialogMenu
      visible={sortMenuVisible}
      onDismiss={() => setSortMenuVisible(false)}
      accessibilityLabel={i18nT('travel:components.listTravel.ListCatalogToolbar.sortirovka_spiska_f3306938')}
      contentStyle={styles.sortMenu}
      anchor={
        <Pressable
          testID="catalog-sort-trigger"
          ref={webTitleRef(activeSortOption?.name ?? '')}
          onPress={() => setSortMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.listTravel.filters.SortDropdown.sortirovka_value1_3ed247b0', { value1: activeSortOption?.name ?? '' })}
          accessibilityState={{ expanded: sortMenuVisible }}
          style={({ pressed }) => [
            styles.sortTrigger,
            (pressed || sortMenuVisible) && styles.sortTriggerActive,
          ]}
          {...(Platform.OS === 'web'
            ? webAccessibilityProps({ 'aria-haspopup': 'dialog', 'aria-expanded': sortMenuVisible })
            : {})}
        >
          <Feather name="sliders" size={15} color={colors.textMuted} />
          <Text style={styles.sortTriggerText} numberOfLines={1}>
            {activeSortOption?.name}
          </Text>
          <Feather
            name={sortMenuVisible ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={colors.textMuted}
          />
        </Pressable>
      }
    >
      <View accessibilityRole="radiogroup">
        {sortOptions.map((option) => {
          const isActive = option.id === activeSort
          return (
            <Pressable
              key={option.id}
              testID={`sort-option-${option.id}`}
              onPress={() => {
                setSortMenuVisible(false)
                if (!isActive) onSortChange(option.id)
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={option.name}
              style={({ pressed }) => [
                styles.sortOption,
                isActive && styles.sortOptionActive,
                pressed && styles.sortOptionPressed,
              ]}
            >
              <Text
                style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}
                numberOfLines={1}
              >
                {option.name}
              </Text>
              {isActive ? <Feather name="check" size={16} color={colors.primary} /> : null}
            </Pressable>
          )
        })}
      </View>
    </DialogMenu>
  ) : null

  const densityNode = showDensityToggle ? (
    <View
      style={styles.densityGroup}
      accessibilityRole={Platform.OS === 'web' ? undefined : ('radiogroup' as any)}
      accessibilityLabel={i18nT('travel:components.listTravel.ListCatalogToolbar.plotnost_spiska_2c4c93c1')}
    >
      {DENSITY_BUTTONS.map((button) => {
        const isActive = density === button.value
        return (
          <Pressable
            key={button.value}
            ref={webTitleRef(button.label)}
            testID={`density-${button.value}`}
            onPress={() => onDensityChange(button.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={button.label}
            style={[styles.densityButton, isActive && styles.densityButtonActive]}
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

  const statusNode = statusVisible ? (
    <View
      style={styles.densityGroup}
      accessibilityRole={Platform.OS === 'web' ? undefined : ('radiogroup' as any)}
      accessibilityLabel={i18nT('travel:components.listTravel.ListCatalogToolbar.status_moih_puteshestviy_855a3491')}
    >
      {STATUS_BUTTONS.map((button) => {
        const isActive = statusMode === button.value
        return (
          <Pressable
            key={button.value}
            ref={webTitleRef(button.label)}
            testID={`travel-status-${button.value}`}
            onPress={() => onStatusModeChange?.(button.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={button.label}
            style={[styles.densityButton, isActive && styles.densityButtonActive]}
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

  const controlsNode = statusNode || densityNode ? (
    <View style={styles.iconControlsRow}>
      {statusNode}
      {densityNode}
    </View>
  ) : null

  if (useCompactLayout) {
    if (!countNode && !controlsNode) return null
    return (
      <View
        style={[styles.container, styles.compactContainer, { paddingHorizontal: contentPadding }]}
        accessibilityRole="toolbar"
      >
        <View style={styles.compactTopRow}>
          {countNode}
          {controlsNode}
        </View>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.container,
        inline ? styles.inlineContainer : { paddingHorizontal: contentPadding },
      ]}
      accessibilityRole={Platform.OS === 'web' ? undefined : 'toolbar'}
    >
      {countNode}
      {sortNode}
      {controlsNode}
    </View>
  )
}

const STATUS_BUTTONS: Array<{
  value: ListStatusMode
  icon: keyof typeof Feather.glyphMap
  label: string
}> = [
  { value: 'all', icon: 'layers', get label() { return i18nT('travel:components.listTravel.ListCatalogToolbar.status.all') } },
  { value: 'published', icon: 'check-circle', get label() { return i18nT('travel:components.listTravel.ListCatalogToolbar.status.published') } },
  { value: 'drafts', icon: 'edit-3', get label() { return i18nT('travel:components.listTravel.ListCatalogToolbar.status.drafts') } },
]

const DENSITY_BUTTONS: Array<{
  value: ListDensity
  icon: keyof typeof Feather.glyphMap
  label: string
}> = [
  { value: 'comfortable', icon: 'square', get label() { return i18nT('travel:components.listTravel.ListCatalogToolbar.density.comfortable') } },
  { value: 'compact', icon: 'grid', get label() { return i18nT('travel:components.listTravel.ListCatalogToolbar.density.compact') } },
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
      // On web, keep controls pinned to the trailing edge even before the async
      // result count appears. With space-between, a lone controls group sat at
      // the leading edge and jumped across the row when the count mounted (#1298).
      justifyContent: Platform.select({ web: 'flex-end', default: 'space-between' }),
      gap: spacing.sm,
    },
    iconControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    inlineContainer: {
      paddingTop: 0,
      flexShrink: 0,
    },
    countText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      flexShrink: 1,
      minWidth: 0,
      marginRight: Platform.select<number | 'auto'>({ web: 'auto', default: spacing.xs }),
    },
    sortTrigger: {
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      maxWidth: 240,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexShrink: 1,
      minWidth: 0,
      ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
    },
    sortTriggerActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha40,
    },
    sortTriggerText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
      minWidth: 0,
    },
    sortMenu: {
      width: 260,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      ...Platform.select({ web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.card }) }),
    },
    sortOption: {
      minHeight: 44,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
    },
    sortOptionActive: {
      backgroundColor: colors.primarySoft,
    },
    sortOptionPressed: {
      opacity: 0.8,
    },
    sortOptionText: {
      fontSize: 14,
      color: colors.text,
      flexShrink: 1,
    },
    sortOptionTextActive: {
      fontWeight: '700',
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
