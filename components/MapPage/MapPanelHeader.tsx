import React, { memo, useCallback } from 'react'
import { View, Text, Pressable, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { ThemedColors } from '@/hooks/useTheme'

interface MapPanelHeaderProps {
  isMobile: boolean
  activeTab: 'search' | 'route' | 'travels'
  travelsCount: number
  themedColors: ThemedColors
  styles: any
  selectSearchTab: () => void
  selectRouteTab: () => void
  selectTravelsTab: () => void
  closeRightPanel: () => void
  resetFilters?: () => void
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
    if (typeof resetFilters === 'function') resetFilters()
  }, [selectSearchTab, resetFilters])

  return (
    <View style={styles.tabsContainer}>
      {isMobile && <View style={styles.dragHandle} />}
      <View
        style={styles.tabsSegment}
        accessibilityRole="tablist"
        aria-label="Панель карты"
      >
        <Pressable
          testID="map-panel-tab-search"
          style={({ pressed }) => [
            styles.tab,
            activeTab === 'search' && styles.tabActive,
            pressed && styles.tabPressed,
          ]}
          onPress={selectSearchTab}
          hitSlop={8}
          android_ripple={{ color: themedColors.overlayLight }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'search' }}
          accessibilityLabel="Поиск"
        >
          <Feather
            name="search"
            size={15}
            color={
              activeTab === 'search'
                ? themedColors.textInverse
                : themedColors.textMuted
            }
          />
          {!isMobile && (
            <Text
              style={[
                styles.tabText,
                activeTab === 'search' && styles.tabTextActive,
              ]}
            >
              Поиск
            </Text>
          )}
        </Pressable>

        <Pressable
          testID="map-panel-tab-route"
          style={({ pressed }) => [
            styles.tab,
            activeTab === 'route' && styles.tabActive,
            pressed && styles.tabPressed,
          ]}
          onPress={selectRouteTab}
          hitSlop={8}
          android_ripple={{ color: themedColors.overlayLight }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'route' }}
          accessibilityLabel="Построение маршрута"
        >
          <Feather
            name="navigation"
            size={15}
            color={
              activeTab === 'route'
                ? themedColors.textInverse
                : themedColors.textMuted
            }
          />
          {!isMobile && (
            <Text
              style={[
                styles.tabText,
                activeTab === 'route' && styles.tabTextActive,
              ]}
            >
              Маршрут
            </Text>
          )}
        </Pressable>

        <Pressable
          testID="map-panel-tab-travels"
          {...(Platform.OS === 'web'
            ? ({ 'data-testid': 'map-panel-tab-travels' } as any)
            : null)}
          style={({ pressed }) => [
            styles.tab,
            activeTab === 'travels' && styles.tabActive,
            pressed && styles.tabPressed,
          ]}
          onPress={selectTravelsTab}
          hitSlop={8}
          android_ripple={{ color: themedColors.overlayLight }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'travels' }}
          accessibilityLabel={`Список точек (${travelsCount} мест)`}
        >
          <Feather
            name="list"
            size={15}
            color={
              activeTab === 'travels'
                ? themedColors.textInverse
                : themedColors.textMuted
            }
          />
          {!isMobile && (
            <Text
              style={[
                styles.tabText,
                activeTab === 'travels' && styles.tabTextActive,
              ]}
            >
              Точки
            </Text>
          )}
          {travelsCount > 0 && (
            <View
              style={[
                styles.badge,
                activeTab === 'travels' && styles.badgeActive,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  activeTab === 'travels' && styles.badgeTextActive,
                ]}
              >
                {travelsCount > 999 ? '999+' : travelsCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {Platform.OS === 'web' && !isMobile ? (
        <Pressable
          testID="map-reset-filters-button"
          style={({ pressed }) => [
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleReset}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Сбросить фильтры"
        >
          <Feather
            name="rotate-cw"
            size={13}
            color={themedColors.textMuted}
          />
        </Pressable>
      ) : (
        <Pressable
          testID="map-close-panel-button"
          style={({ pressed }) => [
            styles.closePanelButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={closeRightPanel}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Закрыть панель"
        >
          <Feather name="x" size={16} color={themedColors.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

export default memo(MapPanelHeader)
