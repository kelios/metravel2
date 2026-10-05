import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'

import { MAP_OFFLINE_INDICATOR_TOP, MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover'
import { MapMobileRadiusPopover } from '@/components/MapPage/MapMobile/MapMobileRadiusPopover'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'
import {
  ActiveFiltersBar,
  MapOnboarding,
  TravelListPanel,
} from '@/screens/tabs/mapDeferred'

import {
  CollapsedIconButton,
  POINTER_EVENTS_NONE,
  PRESSED_OPACITY_07,
  PRESSED_OPACITY_085,
} from './shared'
import { translate as i18nT } from '@/i18n'


type MapScreenDesktopProps = {
  styles: any
  themedColors: any
  isWeb: boolean
  isMobile: boolean
  isDesktopCollapsed: boolean
  desktopPanelWidth: number
  rightPanelTab: string
  activePanelTab: 'search' | 'route' | 'travels'
  panelRef: any
  panelStyle: any
  toggleDesktopCollapse: () => void
  handleSelectSearchTab: () => void
  handleSelectRouteTab: () => void
  selectTravelsTab: () => void
  handleResizeMouseDown: (e: any) => void
  resetFiltersForPanel?: () => void
  filtersPanelProps: any
  activeFilterItems: any[]
  handleRemoveActiveFilter: (key: string) => void
  handleClearAllFilters: () => void
  handleExpandRadius: () => void
  travelsData: any[]
  loading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  hasMore: boolean
  onLoadMore?: () => void
  refetchMapData: () => void
  buildRouteTo: (item: any) => void
  focusPlace?: (item: any) => void
  travelsCount: number
  currentRadius: string | number
  coordinates: any
  transportMode: any
  isConnected: boolean
  mapReady: boolean
  shouldLoadOnboarding: boolean
  /**
   * The page `<h1>` when the expanded panel header is its active anchor
   * (#1640). Undefined means it is mounted in the map-corner anchor instead.
   */
  panelHeading?: React.ReactNode
}

/**
 * Desktop chrome: the left panel or its collapsed strip. Rendered as a flex
 * sibling BEFORE the stable map host (see MapScreenShell) so the map node is
 * never re-parented on a breakpoint flip. #217.
 *
 * #2172 — one panel model for every platform at width ≥ 768 (desktop web,
 * iPad, Android tablets): the panel is either expanded or collapsed into the
 * 56-wide strip, and there is no "hidden" state — an invisible panel left
 * in the row was an empty, dead (iOS) or still tappable (Android) column. Only
 * the mouse-driven resize handle and the persisted width stay web-only.
 */
export function MapScreenDesktopChrome({
  styles,
  themedColors,
  isWeb,
  isMobile,
  isDesktopCollapsed,
  desktopPanelWidth,
  rightPanelTab,
  activePanelTab,
  panelRef,
  panelStyle,
  toggleDesktopCollapse,
  handleSelectSearchTab,
  handleSelectRouteTab,
  selectTravelsTab,
  handleResizeMouseDown,
  resetFiltersForPanel,
  filtersPanelProps,
  activeFilterItems,
  handleRemoveActiveFilter,
  handleClearAllFilters,
  handleExpandRadius,
  travelsData,
  loading,
  isFetching,
  isPlaceholderData,
  hasMore,
  onLoadMore,
  refetchMapData,
  buildRouteTo,
  focusPlace,
  travelsCount,
  currentRadius,
  coordinates,
  transportMode,
  panelHeading,
}: MapScreenDesktopProps) {
  const showDesktopCollapsedStrip = !isMobile && isDesktopCollapsed
  const showDesktopExpandedPanel = !showDesktopCollapsedStrip

  // #2172 — one collapse control (same node, label and look) on every
  // platform; only its parent differs. Web: a child of the panel past its right
  // edge — DOM hit-testing reaches it. Native: a sibling of the panel in the
  // row at the same spot (`collapseToggleInPanel` positions it), inside the
  // row's bounds and above the map: Android dispatches the native touch by
  // parent bounds, so a child past the panel edge also leaked the tap into the
  // map WebView under it (#2113 device QA: in «Маршрут» it set a route point).
  // Desktop-branch controls carry no hitSlop: on Android the JS target grows by
  // it while the native touch outside the view still lands on the map.
  const collapseButton = (
    <Pressable
      testID="map-panel-collapse-button"
      style={({ pressed }) => [styles.collapseToggleInPanel, pressed && PRESSED_OPACITY_07]}
      onPress={toggleDesktopCollapse}
      accessibilityRole="button"
      accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.svernut_panel_2b99d933')}
    >
      <Feather name="chevron-left" size={16} color={themedColors.textMuted} />
    </Pressable>
  )

  return (
    <>
      {showDesktopCollapsedStrip && (
        <View testID="map-panel-collapsed" style={styles.collapsedPanel}>
          <Pressable
            testID="map-panel-expand-button"
            style={({ pressed }) => [styles.collapseToggle, pressed && PRESSED_OPACITY_07]}
            onPress={toggleDesktopCollapse}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.razvernut_panel_4e58160a')}
            {...({ title: i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.razvernut_panel_4e58160a') } as any)}
          >
            <Feather name="chevron-right" size={18} color={themedColors.text} />
          </Pressable>
          <CollapsedIconButton
            icon="list"
            label={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.spisok_tochek_value1_3daae6f8', { value1: travelsCount })}
            title={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.spisok_mest_value1_fc47c6bb', { value1: travelsCount })}
            onPress={() => {
              toggleDesktopCollapse()
              selectTravelsTab()
            }}
            styles={styles}
            iconColor={themedColors.textMuted}
            badge={travelsCount}
            badgeStyles={{ container: styles.collapsedBadge, text: styles.collapsedBadgeText }}
          />
          <CollapsedIconButton
            icon="navigation"
            label={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.postroenie_marshruta_c3fdf7cc')}
            title={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.postroit_marshrut_20dc07d3')}
            onPress={() => {
              toggleDesktopCollapse()
              handleSelectRouteTab()
            }}
            styles={styles}
            iconColor={themedColors.textMuted}
          />
          <CollapsedIconButton
            icon="sliders"
            label={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.filtry_e60de25e')}
            title={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.filtry_e60de25e')}
            onPress={() => {
              toggleDesktopCollapse()
              handleSelectSearchTab()
            }}
            styles={styles}
            iconColor={themedColors.textMuted}
          />
        </View>
      )}

      {showDesktopExpandedPanel && (
        <Animated.View
          ref={panelRef}
          style={[
            styles.rightPanel,
            panelStyle,
            !isMobile && isWeb ? { width: desktopPanelWidth } : null,
          ]}
        >
          {!isMobile && isWeb && (
            <View
              testID="map-panel-resize-handle"
              style={styles.resizeHandle}
              onStartShouldSetResponder={() => true}
              {...({ onMouseDown: handleResizeMouseDown } as any)}
            />
          )}
          {isWeb && collapseButton}
          <MapPanelHeader
            heading={panelHeading}
            activeTab={activePanelTab}
            travelsCount={travelsCount}
            themedColors={themedColors}
            styles={styles}
            selectSearchTab={handleSelectSearchTab}
            selectRouteTab={handleSelectRouteTab}
            selectTravelsTab={selectTravelsTab}
            resetFilters={resetFiltersForPanel}
          />
          {!isMobile && activePanelTab === 'search' && activeFilterItems.length > 0 && (
            <Suspense fallback={null}>
              <ActiveFiltersBar
                filters={activeFilterItems}
                onRemoveFilter={handleRemoveActiveFilter}
                onClearAll={handleClearAllFilters}
              />
            </Suspense>
          )}
          <View style={styles.panelContent}>
            {rightPanelTab === 'filters' ? (
              filtersPanelProps?.Component ? (
                <Suspense
                  fallback={
                    <View style={styles.panelPlaceholder}>
                      <Text style={styles.panelPlaceholderText}>{i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.zagruzka_filtrov_611549f2')}</Text>
                    </View>
                  }
                >
                  <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                    <filtersPanelProps.Panel hideTopControls hideFooterReset={!isMobile} />
                  </filtersPanelProps.Component>
                </Suspense>
              ) : (
                <View style={styles.panelPlaceholder}>
                  <Text style={styles.panelPlaceholderText}>{i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.zagruzka_filtrov_611549f2')}</Text>
                </View>
              )
            ) : (
              <View
                testID="map-travels-tab"
                style={{ flex: 1 }}
              >
                <Suspense fallback={<ActivityIndicator style={{ paddingVertical: 32 }} color={themedColors.primary} />}>
                  <TravelListPanel
                    travelsData={travelsData}
                    buildRouteTo={buildRouteTo}
                    onSelectPlace={focusPlace}
                    isMobile={isMobile}
                    isLoading={loading || isFetching}
                    hasMore={hasMore}
                    onLoadMore={onLoadMore}
                    isRefreshing={isFetching && isPlaceholderData}
                    onRefresh={refetchMapData}
                     currentRadiusKm={currentRadius}
                    userLocation={coordinates}
                    transportMode={transportMode}
                    onResetFilters={handleClearAllFilters}
                    onExpandRadius={handleExpandRadius}
                  />
                </Suspense>
              </View>
            )}
          </View>
        </Animated.View>
      )}
      {showDesktopExpandedPanel && !isWeb && collapseButton}
    </>
  )
}

interface DesktopOverlayOption {
  id: string
  title: string
  category?: string
}

type MapScreenDesktopOverlaysProps = {
  styles: any
  themedColors: any
  /** Desktop branch only (width ≥ 768, any platform): always false in practice. */
  isMobile: boolean
  /**
   * #2172 — the branch's own top inset (`getDesktopBranchTopInset`): 0 on web,
   * the status bar on native, which has no app header on /map.
   */
  topInset?: number
  isConnected: boolean
  mapReady: boolean
  shouldLoadOnboarding: boolean
  // Layers floating-control state — same controlled overlay source the filters
  // panel/mobile toolbar use (filtersPanelProps.contextValue). No duplicated logic.
  mapUiApi?: MapUiApi | null
  overlayOptions?: ReadonlyArray<DesktopOverlayOption>
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  // Radius floating-control state — same controlled source as the filters panel
  // (filterValue.radius + onFilterChange('radius', id)). No duplicated logic.
  radiusOptions?: ReadonlyArray<{ id: string; name: string }>
  radiusValue?: string | number
  onRadiusSelect?: (id: string) => void
}

/**
 * Desktop overlays that live OUTSIDE the map container (layers/radius controls,
 * offline indicator, loading overlay, onboarding). Rendered by the shell as
 * breakpoint shared chrome so they do not affect the map host position.
 */
export function MapScreenDesktopOverlays({
  styles,
  themedColors,
  isMobile,
  topInset = 0,
  isConnected,
  mapReady,
  shouldLoadOnboarding,
  mapUiApi,
  overlayOptions,
  enabledOverlays,
  onOverlayToggle,
  onResetOverlays,
  radiusOptions,
  radiusValue,
  onRadiusSelect,
}: MapScreenDesktopOverlaysProps) {
  // Desktop «Слои» floating control: layers live on the map (Google-Maps
  // style), no longer inside the left filters panel. Mobile keeps its own icon
  // toolbar + popover. #2172 — the desktop branch is the same on every
  // platform: the popovers and `mapUiApi.setOverlayEnabled` already work on
  // native phones, so iPad and Android tablets get the same controls.
  const showDesktopLayersControl = !isMobile
  const [layersOpen, setLayersOpen] = useState(false)
  const toggleLayers = useCallback(() => {
    setLayersOpen((v) => !v)
    setRadiusOpen(false)
  }, [])
  const closeLayers = useCallback(() => setLayersOpen(false), [])

  // Desktop «Радиус» floating control: same on-map cluster as «Слои» (sits
  // immediately to its left). Reuses the controlled radius source from the
  // filters panel; no duplicated radius logic.
  const [radiusOpen, setRadiusOpen] = useState(false)
  const toggleRadius = useCallback(() => {
    setRadiusOpen((v) => !v)
    setLayersOpen(false)
  }, [])
  const closeRadius = useCallback(() => setRadiusOpen(false), [])
  const resolvedRadiusValue = String(radiusValue ?? '')
  const radiusBadge = useMemo(() => {
    const n = Number(resolvedRadiusValue)
    return Number.isFinite(n) && n > 0 ? String(n) : ''
  }, [resolvedRadiusValue])

  // #2172 — Android Back closes an open popover before navigating away
  // (BUG-CLASS-5), like the phone layout does in MapMobileLayout. Registered
  // only while a popover is open, so Back keeps its default otherwise.
  const popoverOpen = layersOpen || radiusOpen
  useEffect(() => {
    if (Platform.OS !== 'android' || !popoverOpen) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setLayersOpen(false)
      setRadiusOpen(false)
      return true
    })
    return () => subscription.remove()
  }, [popoverOpen])

  return (
    <>
      {showDesktopLayersControl && (
        <>
          <Pressable
            testID="map-desktop-radius-button"
            onPress={toggleRadius}
            accessibilityRole="button"
            accessibilityState={{ expanded: radiusOpen }}
            accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.radius_value1_934e2db6', { value1: radiusBadge ? ` ${radiusBadge}` : '' })}
            style={({ pressed }) => [
              styles.desktopRadiusFab,
              radiusOpen && styles.desktopRadiusFabActive,
              pressed && PRESSED_OPACITY_085,
            ]}
          >
            <Feather name="target" size={20} color={themedColors.text} />
            {!!radiusBadge && (
              <View style={styles.desktopRadiusFabBadge} pointerEvents="none">
                <Text style={styles.desktopRadiusFabBadgeText} numberOfLines={1}>
                  {radiusBadge}
                </Text>
              </View>
            )}
          </Pressable>

          {radiusOpen && (
            <MapMobileRadiusPopover
              colors={themedColors as ThemedColors}
              top={topInset + 16 + 44 + 8}
              right={16 + 44 + 8}
              minWidth={150}
              maxWidth={200}
              options={radiusOptions ?? []}
              currentValue={resolvedRadiusValue}
              onSelect={(id) => onRadiusSelect?.(id)}
              onRequestClose={closeRadius}
            />
          )}

          <Pressable
            testID="map-desktop-layers-button"
            onPress={toggleLayers}
            accessibilityRole="button"
            accessibilityState={{ expanded: layersOpen }}
            accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.sloi_i_nastroyki_karty_ed15c793')}
            style={({ pressed }) => [
              styles.desktopLayersFab,
              layersOpen && styles.desktopLayersFabActive,
              pressed && PRESSED_OPACITY_085,
            ]}
          >
            <Feather name="layers" size={20} color={themedColors.text} />
          </Pressable>

          {layersOpen && (
            <MapMobileLayersPopover
              colors={themedColors as ThemedColors}
              top={topInset + 16 + 44 + 8}
              right={16}
              // MapMobilePopover фиксирует ширину карточки по `minWidth` (width:
              // minWidth), поэтому без него карточка садилась на дефолтные 200px и
              // «Топографическая»/«Показать всё на карте» рвались посреди слова.
              // 280px хватает строке-тумблеру (лейбл + Switch) на одну строку.
              minWidth={280}
              maxWidth={320}
              mapUiApi={mapUiApi}
              overlayOptions={overlayOptions}
              enabledOverlays={enabledOverlays}
              onOverlayToggle={onOverlayToggle}
              onResetOverlays={onResetOverlays}
              onRequestClose={closeLayers}
            />
          )}
        </>
      )}

      <MapOfflineIndicator visible={!isConnected} top={MAP_OFFLINE_INDICATOR_TOP + topInset} />

      {!mapReady && (
        <View style={[styles.loadingOverlay, POINTER_EVENTS_NONE]} testID="map-loading-overlay">
          <ActivityIndicator color={themedColors.primary} accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.zagruzka_karty_8db9bcd2')} />
        </View>
      )}

      {shouldLoadOnboarding && (
        <Suspense fallback={null}>
          {/* Desktop branch: coachmark is mobile-web only, so always false here. */}
          <MapOnboarding mobileWebCoachmark={false} />
        </Suspense>
      )}
    </>
  )
}
