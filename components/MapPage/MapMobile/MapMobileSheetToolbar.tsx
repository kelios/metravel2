/**
 * MapMobileSheetToolbar - segmented tabs + action buttons row for the mobile bottom sheet.
 */
import React from 'react'
import { Pressable, Text as RNText, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import SegmentedControl from '@/components/MapPage/SegmentedControl'
import type { getMapMobileLayoutStyles } from '@/components/MapPage/MapMobileLayout.styles'
import type { ThemedColors } from '@/hooks/useTheme'

type UiTab = 'search' | 'route' | 'list'
type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'
type SheetStyles = ReturnType<typeof getMapMobileLayoutStyles>

interface PanelTabOption {
  key: string
  label: string
  icon?: string
}

export interface MapMobileSheetToolbarProps {
  uiTab: UiTab
  sheetState: SheetState
  travelsData: ReadonlyArray<unknown>
  panelTabsOptions: PanelTabOption[]
  filterToolbarSummary: string
  resetFilters?: () => void
  onTabChange: (next: UiTab) => void
  onOpenList: () => void
  onClose: () => void
  isNarrow: boolean
  stackSheetToolbar: boolean
  compactSheetActions: boolean
  colors: ThemedColors
  styles: SheetStyles
}

const MapMobileSheetToolbarInner: React.FC<MapMobileSheetToolbarProps> = ({
  uiTab,
  sheetState,
  travelsData,
  panelTabsOptions,
  filterToolbarSummary,
  resetFilters,
  onTabChange,
  onOpenList,
  onClose,
  isNarrow,
  stackSheetToolbar,
  compactSheetActions,
  colors,
  styles,
}) => {
  const isQuarterListPreview = uiTab === 'list' && sheetState === 'quarter'
  const showTopFilterActions = false
  const showSheetCloseButton = !isQuarterListPreview
  const showOnlyCloseAction = showSheetCloseButton && !showTopFilterActions
  const toolbarSummaryText = isQuarterListPreview
    ? 'Быстрый просмотр результатов'
    : uiTab === 'search' || uiTab === 'route'
      ? filterToolbarSummary
      : null

  return (
    <View
      style={[
        styles.sheetToolbar,
        showOnlyCloseAction &&
          stackSheetToolbar &&
          styles.sheetToolbarCloseOnly,
        isQuarterListPreview && styles.sheetToolbarPreview,
        stackSheetToolbar
          ? styles.sheetToolbarStacked
          : styles.sheetToolbarInline,
      ]}
    >
      <View
        style={[
          styles.sheetToolbarLeft,
          stackSheetToolbar && styles.sheetToolbarFullWidth,
          showOnlyCloseAction &&
            stackSheetToolbar &&
            styles.sheetToolbarLeftWithFloatingClose,
        ]}
      >
        <SegmentedControl
          options={panelTabsOptions}
          value={uiTab}
          onChange={(key) => {
            const next: UiTab =
              key === 'route' ? 'route' : key === 'list' ? 'list' : 'search'
            onTabChange(next)
          }}
          compact={true}
          dense={isNarrow}
          noOuterMargins={true}
          tone="subtle"
          accessibilityLabel="Переключение между поиском, маршрутом и списком точек"
        />
        {toolbarSummaryText && (
          <RNText
            style={[
              styles.sheetToolbarSummary,
              isQuarterListPreview && styles.sheetToolbarSummaryPreview,
            ]}
            numberOfLines={2}
            testID="map-mobile-toolbar-summary"
          >
            {toolbarSummaryText}
          </RNText>
        )}
      </View>

      <View
        style={[
          styles.sheetToolbarActions,
          stackSheetToolbar && styles.sheetToolbarActionsStacked,
          showOnlyCloseAction &&
            stackSheetToolbar &&
            styles.sheetToolbarActionsFloatingClose,
          isQuarterListPreview && styles.sheetToolbarActionsPreview,
        ]}
      >
        {isQuarterListPreview && (
          <Pressable
            testID="map-panel-expand-list"
            onPress={onOpenList}
            accessibilityRole="button"
            accessibilityLabel={`Показать все ${travelsData.length} мест`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.sheetShowResultsButton,
              stackSheetToolbar && styles.sheetToolbarButtonStacked,
              compactSheetActions && styles.sheetShowResultsButtonCompact,
              {
                backgroundColor: pressed ? colors.primaryDark : colors.primary,
              },
            ]}
          >
            <Feather
              name="maximize-2"
              size={15}
              color={colors.textOnPrimary}
            />
            {!compactSheetActions && (
              <RNText style={styles.sheetPrimaryActionText}>Все места</RNText>
            )}
          </Pressable>
        )}

        {showTopFilterActions && (
          <>
            {typeof resetFilters === 'function' && (
              <Pressable
                testID="map-panel-reset"
                onPress={() => resetFilters()}
                accessibilityRole="button"
                accessibilityLabel="Сбросить фильтры"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.sheetCloseButton,
                  stackSheetToolbar && styles.sheetIconButtonStacked,
                  compactSheetActions && styles.sheetIconButtonCompact,
                  { borderColor: colors.borderLight },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Feather
                  name="rotate-cw"
                  size={15}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
            <Pressable
              testID="map-panel-show-results"
              onPress={onOpenList}
              accessibilityRole="button"
              accessibilityLabel={`Показать ${travelsData.length} мест`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.sheetShowResultsButton,
                stackSheetToolbar && styles.sheetToolbarButtonStacked,
                compactSheetActions && styles.sheetShowResultsButtonCompact,
                {
                  backgroundColor: pressed
                    ? colors.primaryDark
                    : colors.primary,
                },
              ]}
            >
              <Feather name="list" size={15} color={colors.textOnPrimary} />
              {travelsData.length > 0 && (
                <RNText
                  style={[
                    styles.sheetResultsBadge,
                    { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {travelsData.length > 999
                    ? '999+'
                    : String(travelsData.length)}
                </RNText>
              )}
            </Pressable>
          </>
        )}

        {showSheetCloseButton && (
          <Pressable
            testID="map-panel-close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть панель"
            hitSlop={8}
            style={({ pressed }) => [
              styles.sheetCloseButton,
              styles.sheetToolbarCloseButton,
              stackSheetToolbar && styles.sheetIconButtonStacked,
              compactSheetActions && styles.sheetIconButtonCompact,
              showOnlyCloseAction &&
                stackSheetToolbar &&
                styles.sheetToolbarCloseButtonFloating,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

export const MapMobileSheetToolbar = React.memo(MapMobileSheetToolbarInner)
export default MapMobileSheetToolbar
