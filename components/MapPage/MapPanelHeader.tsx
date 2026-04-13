import React, { memo, useCallback } from 'react'
import { View, Text, Pressable, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { ThemedColors } from '@/hooks/useTheme'

interface MapPanelHeaderProps {
  isMobile: boolean
  rightPanelTab: 'filters' | 'travels'
  travelsCount: number
  themedColors: ThemedColors
  styles: any
  selectFiltersTab: () => void
  selectTravelsTab: () => void
  closeRightPanel: () => void
  resetFilters?: () => void
}

const MapPanelHeader: React.FC<MapPanelHeaderProps> = ({
  isMobile,
  rightPanelTab,
  travelsCount,
  themedColors,
  styles,
  selectFiltersTab,
  selectTravelsTab,
  closeRightPanel,
  resetFilters,
}) => {
  const handleReset = useCallback(() => {
    selectFiltersTab()
    if (typeof resetFilters === 'function') resetFilters()
  }, [selectFiltersTab, resetFilters])

  return (
    <View style={styles.tabsContainer}>
      {isMobile && <View style={styles.dragHandle} />}
      <View
        style={styles.tabsSegment}
        accessibilityRole="tablist"
        aria-label="Панель карты"
      >
        <Pressable
          testID="map-panel-tab-filters"
          style={({ pressed }) => [
            styles.tab,
            rightPanelTab === 'filters' && styles.tabActive,
            pressed && styles.tabPressed,
          ]}
          onPress={selectFiltersTab}
          hitSlop={8}
          android_ripple={{ color: themedColors.overlayLight }}
          accessibilityRole="tab"
          accessibilityState={{ selected: rightPanelTab === 'filters' }}
          accessibilityLabel="Фильтры"
        >
          <Feather
            name="sliders"
            size={15}
            color={
              rightPanelTab === 'filters'
                ? themedColors.textInverse
                : themedColors.textMuted
            }
          />
          {!isMobile && (
            <Text
              style={[
                styles.tabText,
                rightPanelTab === 'filters' && styles.tabTextActive,
              ]}
            >
              Фильтры
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
            rightPanelTab === 'travels' && styles.tabActive,
            pressed && styles.tabPressed,
          ]}
          onPress={selectTravelsTab}
          hitSlop={8}
          android_ripple={{ color: themedColors.overlayLight }}
          accessibilityRole="tab"
          accessibilityState={{ selected: rightPanelTab === 'travels' }}
          accessibilityLabel={`Список (${travelsCount} мест)`}
        >
          <Feather
            name="list"
            size={15}
            color={
              rightPanelTab === 'travels'
                ? themedColors.textInverse
                : themedColors.textMuted
            }
          />
          {!isMobile && (
            <Text
              style={[
                styles.tabText,
                rightPanelTab === 'travels' && styles.tabTextActive,
              ]}
            >
              Список
            </Text>
          )}
          {travelsCount > 0 && (
            <View
              style={[
                styles.badge,
                rightPanelTab === 'travels' && styles.badgeActive,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  rightPanelTab === 'travels' && styles.badgeTextActive,
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

