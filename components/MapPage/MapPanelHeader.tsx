import React, { memo, useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import { showFiltersResetToast } from '@/utils/mapToasts'
import { formatPlaces } from '@/utils/pluralize'
import { translate as i18nT } from '@/i18n'


type PanelTab = 'search' | 'route' | 'travels'

const BADGE_COUNT_CAP = 999
const PRESSED_OPACITY_07 = { opacity: 0.7 }

/**
 * Header of the map panel in the desktop branch of the map screen (width ≥ 768):
 * desktop web and native tablets render the same header, segment and actions
 * (#2172). The phone layout has its own sheet header (MapMobileLayout), so this
 * component carries no phone-only branch.
 */
interface MapPanelHeaderProps {
  activeTab: PanelTab
  travelsCount: number
  themedColors: ThemedColors
  styles: any
  selectSearchTab: () => void
  selectRouteTab: () => void
  selectTravelsTab: () => void
  resetFilters?: () => void
  /**
   * The page-level `<h1>` when this header is the active anchor for it (#1640).
   * The caller owns the choice; `undefined` here means the heading is mounted
   * in the map-corner anchor instead, so this component must not decide it.
   */
  heading?: React.ReactNode
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
  return (
    <Pressable
      testID={`map-panel-tab-${tab}`}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
      onPress={onPress}
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
  activeTab,
  travelsCount,
  themedColors,
  styles,
  selectSearchTab,
  selectRouteTab,
  selectTravelsTab,
  resetFilters,
  heading,
}) => {
  const handleReset = useCallback(() => {
    selectSearchTab()
    resetFilters?.()
    showFiltersResetToast()
  }, [selectSearchTab, resetFilters])

  // Фильтры — кнопка-иконка в ряду действий, а не вкладка. Сегмент сводится к
  // двум вкладкам: «Места» и «Маршрут». Фильтры открыты, когда не выбрана ни
  // одна из вкладок (activeTab === 'search').
  const filtersActive = activeTab === 'search'

  return (
    <View style={styles.tabsContainer}>
      {heading}

      <View style={styles.tabsRow}>
          <View style={styles.tabsSegment} accessibilityRole="tablist" aria-label={i18nT('map:components.MapPage.MapPanelHeader.panel_karty_951bb838')}>
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

        {/* Без hitSlop у вкладок и действий (#2172): тач-таргет — собственный
            бокс 44 pt (guard-touch-targets). На native hitSlop шире зазора до
            соседа (2 pt в сегменте, 6 pt здесь) залезал в его собственную
            рамку: правые 4 pt «Подсказок» срабатывали как «Сбросить фильтры».
            Web hitSlop не читает, его вид не меняется. */}
        <View style={styles.panelHeaderActions}>
          <Pressable
            testID="map-filters-button"
            style={({ pressed }) => [
              styles.resetButton,
              styles.resetButtonCompact,
              filtersActive && styles.tabActive,
              pressed && PRESSED_OPACITY_07,
            ]}
            onPress={selectSearchTab}
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
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.sbrosit_filtry_06292479')}
            {...({ title: i18nT('map:components.MapPage.MapPanelHeader.sbrosit_filtry_06292479') } as any)}
          >
            <Feather name="rotate-cw" size={13} color={themedColors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default memo(MapPanelHeader)
