import React, { memo, useCallback } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import { showFiltersResetToast } from '@/utils/mapToasts'

type PanelTab = 'search' | 'route' | 'travels'

const BADGE_COUNT_CAP = 999
const PRESSED_OPACITY_07 = { opacity: 0.7 }

interface MapPanelHeaderProps {
  isMobile: boolean
  activeTab: PanelTab
  travelsCount: number
  themedColors: ThemedColors
  styles: any
  selectSearchTab: () => void
  selectRouteTab: () => void
  selectTravelsTab: () => void
  closeRightPanel: () => void
  resetFilters?: () => void
}

function TabButton({
  tab,
  activeTab,
  icon,
  label,
  accessibilityLabel,
  onPress,
  themedColors,
  styles,
  badge,
}: {
  tab: PanelTab
  activeTab: PanelTab
  icon: React.ComponentProps<typeof Feather>['name']
  label: string
  accessibilityLabel: string
  onPress: () => void
  themedColors: ThemedColors
  styles: any
  badge?: number
}) {
  const active = activeTab === tab
  const isWeb = Platform.OS === 'web'
  return (
    <Pressable
      testID={`map-panel-tab-${tab}`}
      {...(isWeb && tab === 'travels'
        ? ({ 'data-testid': 'map-panel-tab-travels' } as any)
        : null)}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
      onPress={onPress}
      hitSlop={8}
      android_ripple={{ color: themedColors.overlayLight }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
    >
      <Feather
        name={icon}
        size={15}
        color={active ? themedColors.textInverse : themedColors.textMuted}
      />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge != null && badge > 0 && (
        <View style={[styles.badge, active && styles.badgeActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
            {badge > BADGE_COUNT_CAP ? `${BADGE_COUNT_CAP}+` : badge}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const MapPanelHeader: React.FC<MapPanelHeaderProps> = ({
  isMobile,
  activeTab,
  travelsCount,
  themedColors,
  styles,
  selectSearchTab,
  selectRouteTab,
  selectTravelsTab,
  closeRightPanel,
  resetFilters,
}) => {
  const handleReset = useCallback(() => {
    selectSearchTab()
    resetFilters?.()
    showFiltersResetToast()
  }, [selectSearchTab, resetFilters])

  const showDesktopActions = Platform.OS === 'web' && !isMobile

  return (
    <View style={styles.tabsContainer}>
      {isMobile && <View style={styles.dragHandle} />}

      <View style={styles.tabsSegment} accessibilityRole="tablist" aria-label="Панель карты">
        <TabButton
          tab="search"
          activeTab={activeTab}
          icon="search"
          label="Поиск"
          accessibilityLabel="Поиск"
          onPress={selectSearchTab}
          themedColors={themedColors}
          styles={styles}
        />
        <TabButton
          tab="route"
          activeTab={activeTab}
          icon="navigation"
          label="Маршрут"
          accessibilityLabel="Построение маршрута"
          onPress={selectRouteTab}
          themedColors={themedColors}
          styles={styles}
        />
        <TabButton
          tab="travels"
          activeTab={activeTab}
          icon="list"
          label="Места"
          accessibilityLabel={`Список мест (${travelsCount})`}
          onPress={selectTravelsTab}
          themedColors={themedColors}
          styles={styles}
          badge={travelsCount}
        />
      </View>

      {showDesktopActions ? (
        <View style={styles.panelHeaderActions}>
          <Pressable
            testID="map-help-button"
            style={({ pressed }) => [
              styles.resetButton,
              { paddingHorizontal: 8, minWidth: 32 },
              pressed && PRESSED_OPACITY_07,
            ]}
            onPress={restartMapOnboarding}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Показать подсказки по карте"
            {...({ title: 'Показать подсказки по карте' } as any)}
          >
            <Feather name="help-circle" size={13} color={themedColors.textMuted} />
          </Pressable>
          <Pressable
            testID="map-reset-filters-button"
            style={({ pressed }) => [
              styles.resetButton,
              styles.resetButtonCompact,
              pressed && PRESSED_OPACITY_07,
            ]}
            onPress={handleReset}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Сбросить фильтры"
            {...({ title: 'Сбросить фильтры' } as any)}
          >
            <Feather name="rotate-cw" size={13} color={themedColors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID="map-close-panel-button"
          style={({ pressed }) => [styles.closePanelButton, pressed && PRESSED_OPACITY_07]}
          onPress={closeRightPanel}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Скрыть панель"
        >
          <Feather name="chevron-down" size={16} color={themedColors.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

export default memo(MapPanelHeader)
