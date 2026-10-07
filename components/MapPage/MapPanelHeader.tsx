import type { MapOnboardingTargetRegistry } from './MapOnboarding'
import React, { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import { formatPlaceCountBadge } from '@/components/MapPage/TravelListPanel/helpers'
import { MAP_PANEL_TAB_MAX_FONT_SCALE } from '@/screens/tabs/map.styles'
import { globalFocusStyles } from '@/styles/globalFocus'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { getTabA11yProps, getTabListA11yProps } from '@/utils/a11yTabRoles'


type PanelTab = 'search' | 'route' | 'travels'

/**
 * Header of the map panel in the desktop branch of the map screen (width ≥ 768):
 * desktop web and native tablets render the same header and segment (#2172).
 * The phone layout has its own sheet header (MapMobileLayout), so this
 * component carries no phone-only branch.
 *
 * #2217 — the row belongs to the tabs only: «Места», «Маршрут», «Фильтры» in
 * the order of the collapsed 56 strip, each an icon row over its label. The
 * former header actions live where their meaning is: «Подсказки» on the map
 * (`map-desktop-help-button`), «Сбросить» in the filters footer
 * (`filters-reset-button`). Norms — docs/design/map-panel-header-tablet.md.
 */
interface MapPanelHeaderProps {
  targetRegistry?: MapOnboardingTargetRegistry
  activeTab: PanelTab
  travelsCount: number
  themedColors: ThemedColors
  styles: any
  selectSearchTab: () => void
  selectRouteTab: () => void
  selectTravelsTab: () => void
  /**
   * The page-level `<h1>` when this header is the active anchor for it (#1640).
   * The caller owns the choice; `undefined` here means the heading is mounted
   * in the map-corner anchor instead, so this component must not decide it.
   */
  heading?: React.ReactNode
}

function TabButton({
  targetRef,
  testID,
  active,
  icon,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  themedColors,
  styles,
  badge,
}: {
  targetRef?: MapOnboardingTargetRegistry[string]
  testID: string
  active: boolean
  icon: React.ComponentProps<typeof Feather>['name']
  label: string
  accessibilityLabel: string
  accessibilityHint?: string
  onPress: () => void
  themedColors: ThemedColors
  styles: any
  badge?: number
}) {
  return (
    // No hitSlop (#2172): the touch target is the tab's own 44 box
    // (guard-touch-targets). On native a slop wider than the 2 pt gap reached
    // into the neighbour's box.
    <Pressable
      testID={testID}
      ref={targetRef}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
        globalFocusStyles.focusable,
      ]}
      onPress={onPress}
      android_ripple={{ color: themedColors.overlayLight }}
      // iOS: `button` + selected, the row is `tabbar`; web gets `aria-selected`
      // (RN-web 0.21 drops `accessibilityState.selected`, #2217). #2262.
      {...getTabA11yProps(active)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // iOS: the label is capped at MAP_PANEL_TAB_MAX_FONT_SCALE; at the
      // accessibility sizes a long press shows it in the Large Content Viewer,
      // the UITabBar idiom. Other platforms ignore both props.
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={label}
    >
      <View style={styles.tabIconRow}>
        <Feather
          name={icon}
          size={15}
          color={active ? themedColors.textOnPrimary : themedColors.textMuted}
        />
        {badge != null && badge > 0 && (
          <View style={[styles.badge, active && styles.badgeActive]}>
            <Text
              style={[styles.badgeText, active && styles.badgeTextActive]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAP_PANEL_TAB_MAX_FONT_SCALE}
            >
              {formatPlaceCountBadge(badge)}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.tabText, active && styles.tabTextActive]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAP_PANEL_TAB_MAX_FONT_SCALE}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const MapPanelHeader: React.FC<MapPanelHeaderProps> = ({
  targetRegistry,
  activeTab,
  travelsCount,
  themedColors,
  styles,
  selectSearchTab,
  selectRouteTab,
  selectTravelsTab,
  heading,
}) => {
  const placesLabel = i18nT('map:components.MapPage.MapPanelHeader.mesta_3ad2b948')
  const routeLabel = i18nT('map:components.MapPage.MapPanelHeader.marshrut_486762dc')
  const filtersLabel = i18nT('map:components.MapPage.MapPanelHeader.filtry_95c57b1d')

  return (
    <View style={styles.tabsContainer}>
      {heading}

      <View style={styles.tabsRow}>
        <View
          style={styles.tabsSegment}
          {...getTabListA11yProps()}
          aria-label={i18nT('map:components.MapPage.MapPanelHeader.panel_karty_951bb838')}
        >
          {/* Accessible names start with the visible label (WCAG 2.5.3); the
              count is the full one, not the capped «999+» of the badge. */}
          <TabButton
            testID="map-panel-tab-travels"
            targetRef={targetRegistry?.['map-panel-tab-travels']}
            active={activeTab === 'travels'}
            icon="list"
            label={placesLabel}
            accessibilityLabel={
              travelsCount > 0 ? `${placesLabel} (${formatInteger(travelsCount)})` : placesLabel
            }
            onPress={selectTravelsTab}
            themedColors={themedColors}
            styles={styles}
            badge={travelsCount}
          />
          <TabButton
            testID="map-panel-tab-route"
            targetRef={targetRegistry?.['map-panel-tab-route']}
            active={activeTab === 'route'}
            icon="navigation"
            label={routeLabel}
            accessibilityLabel={routeLabel}
            accessibilityHint={i18nT('map:components.MapPage.MapPanelHeader.postroenie_marshruta_7aa011b1')}
            onPress={selectRouteTab}
            themedColors={themedColors}
            styles={styles}
          />
          {/* «Фильтры» is the third view of the panel (activeTab === 'search'),
              not an action: selected on start, so exactly one tab is selected. */}
          <TabButton
            testID="map-panel-tab-filters"
            targetRef={targetRegistry?.['map-panel-tab-filters']}
            active={activeTab === 'search'}
            icon="sliders"
            label={filtersLabel}
            accessibilityLabel={filtersLabel}
            onPress={selectSearchTab}
            themedColors={themedColors}
            styles={styles}
          />
        </View>
      </View>
    </View>
  )
}

export default memo(MapPanelHeader)
