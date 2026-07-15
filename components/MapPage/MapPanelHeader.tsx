import React, { memo, useCallback } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import { showFiltersResetToast } from '@/utils/mapToasts'
import { formatPlaces } from '@/utils/pluralize'
import { translate as i18nT } from '@/i18n'


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
  // На desktop фильтры — это кнопка-иконка в ряду действий, а не вкладка.
  // Сегмент сводится к двум вкладкам: «Места» и «Маршрут». Фильтры открыты,
  // когда не выбрана ни одна из вкладок (activeTab === 'search').
  const filtersActive = activeTab === 'search'

  return (
    <View style={styles.tabsContainer}>
      {isMobile && <View style={styles.dragHandle} />}

      <View style={styles.tabsSegment} accessibilityRole="tablist" aria-label={i18nT('map:components.MapPage.MapPanelHeader.panel_karty_951bb838')}>
        {isMobile && (
          <TabButton
            tab="search"
            activeTab={activeTab}
            icon="search"
            label={i18nT('map:components.MapPage.MapPanelHeader.poisk_787c6fe7')}
            accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.poisk_787c6fe7')}
            onPress={selectSearchTab}
            themedColors={themedColors}
            styles={styles}
          />
        )}
        <TabButton
          tab="travels"
          activeTab={activeTab}
          icon="list"
          label={i18nT('map:components.MapPage.MapPanelHeader.mesta_3ad2b948')}
          accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.spisok_value1_272d2a31', { value1: formatPlaces(travelsCount) })}
          onPress={selectTravelsTab}
          themedColors={themedColors}
          styles={styles}
          badge={travelsCount}
        />
        <TabButton
          tab="route"
          activeTab={activeTab}
          icon="navigation"
          label={i18nT('map:components.MapPage.MapPanelHeader.marshrut_486762dc')}
          accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.postroenie_marshruta_7aa011b1')}
          onPress={selectRouteTab}
          themedColors={themedColors}
          styles={styles}
        />
      </View>

      {showDesktopActions ? (
        <View style={styles.panelHeaderActions}>
          <Pressable
            testID="map-filters-button"
            {...({ 'data-testid': 'map-filters-button' } as any)}
            style={({ pressed }) => [
              styles.resetButton,
              styles.resetButtonCompact,
              filtersActive && styles.tabActive,
              pressed && PRESSED_OPACITY_07,
            ]}
            onPress={selectSearchTab}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ selected: filtersActive }}
            accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.filtry_95c57b1d')}
            {...({ title: i18nT('map:components.MapPage.MapPanelHeader.filtry_95c57b1d') } as any)}
          >
            <Feather
              name="sliders"
              size={14}
              color={filtersActive ? themedColors.textInverse : themedColors.textMuted}
            />
          </Pressable>
          <Pressable
            testID="map-help-button"
            style={({ pressed }) => [
              styles.resetButton,
              styles.resetButtonCompact,
              pressed && PRESSED_OPACITY_07,
            ]}
            onPress={restartMapOnboarding}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd')}
            {...({ title: i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd') } as any)}
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
            accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.sbrosit_filtry_06292479')}
            {...({ title: i18nT('map:components.MapPage.MapPanelHeader.sbrosit_filtry_06292479') } as any)}
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
          accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.skryt_panel_e9e1ec83')}
        >
          <Feather name="chevron-down" size={16} color={themedColors.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

export default memo(MapPanelHeader)
