import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, BackHandler, Platform, Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'

import { MAP_OFFLINE_INDICATOR_TOP, MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover'
import { MapMobileRadiusPopover } from '@/components/MapPage/MapMobile/MapMobileRadiusPopover'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'
import { webTitleRef } from '@/utils/webProps'
import { DESKTOP_LAYERS_FAB_RIGHT, DESKTOP_RADIUS_FAB_RIGHT } from '@/screens/tabs/map.styles'
import { NO_DESKTOP_INSETS, type DesktopBranchInsets } from '@/screens/tabs/mapDesktopInsets'
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

  // #2243 — screen-reader focus follows the chevron on native (ios-designer,
  // #2172 «Дизайн-решение п. 5»): after «Свернуть панель» it lands on
  // «Развернуть панель», after «Развернуть панель» back on «Свернуть панель».
  // The pressed button unmounts with the toggle, so without this VoiceOver and
  // TalkBack fall back to the top of the screen. The target exists only after
  // the state flip, so the event goes out from the commit effect, not from the
  // press handler. Web keeps its DOM focus model (unchanged).
  const collapseButtonRef = useRef<View>(null)
  const expandButtonRef = useRef<View>(null)
  const pendingFocusRef = useRef<'collapse' | 'expand' | null>(null)
  const handleChevronPress = useCallback(
    (next: 'collapse' | 'expand') => {
      if (!isWeb) pendingFocusRef.current = next
      toggleDesktopCollapse()
    },
    [isWeb, toggleDesktopCollapse],
  )
  useEffect(() => {
    const target = pendingFocusRef.current
    if (!target) return
    const node = (target === 'expand' ? expandButtonRef : collapseButtonRef).current
    if (!node) return
    pendingFocusRef.current = null
    AccessibilityInfo.sendAccessibilityEvent(node, 'focus')
  }, [isDesktopCollapsed])

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
      ref={collapseButtonRef}
      testID="map-panel-collapse-button"
      style={({ pressed }) => [styles.collapseToggleInPanel, pressed && PRESSED_OPACITY_07]}
      onPress={() => handleChevronPress('expand')}
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
            // Web: the hover title; native: the #2243 focus target.
            ref={webTitleRef(i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.razvernut_panel_4e58160a')) ?? expandButtonRef}
            testID="map-panel-expand-button"
            style={({ pressed }) => [styles.collapseToggle, pressed && PRESSED_OPACITY_07]}
            onPress={() => handleChevronPress('collapse')}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.razvernut_panel_4e58160a')}
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

      {/* #2243 — on native the chevron is the panel's row sibling (#2172) and
          precedes it in the tree: the screen readers walk siblings in tree
          order (#2113 device QA read panel → content → chevron), so it now
          reads before the tabs and the panel content. Its position comes from
          `collapseToggleInPanel` (absolute, zIndex), not from this order. */}
      {showDesktopExpandedPanel && !isWeb && collapseButton}
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
                    {/* #2217 — «Сбросить» lives in the filters footer on every
                        branch (the same FiltersPanelFooter as the phone sheet);
                        the panel header has no reset action any more. */}
                    <filtersPanelProps.Panel hideTopControls />
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
   * #2172/#2233 — the branch's own safe-area insets (`getDesktopBranchInsets`):
   * zeros on web; on native the status bar on top (no app header on /map) and
   * the camera cutout on the sides (Android phone in landscape).
   */
  insets?: DesktopBranchInsets
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
  /**
   * #2263 — «Подсказки» live on the map, outside the panel, so they are
   * reachable with the panel collapsed into the 56 strip. Steps 2–4 of the tour
   * point at the panel tabs, which the strip does not render: the button expands
   * the panel first, then starts the tour (same state as the chrome's chevron).
   */
  isDesktopCollapsed?: boolean
  toggleDesktopCollapse?: () => void
}

/**
 * Desktop overlays that live OUTSIDE the map container (help/radius/layers controls,
 * offline indicator, loading overlay, onboarding). Rendered by the shell as
 * breakpoint shared chrome so they do not affect the map host position.
 */
export function MapScreenDesktopOverlays({
  styles,
  themedColors,
  isMobile,
  insets = NO_DESKTOP_INSETS,
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
  isDesktopCollapsed = false,
  toggleDesktopCollapse,
}: MapScreenDesktopOverlaysProps) {
  const openMapHelp = useCallback(() => {
    if (isDesktopCollapsed) toggleDesktopCollapse?.()
    restartMapOnboarding()
  }, [isDesktopCollapsed, toggleDesktopCollapse])
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
              top={insets.top + 16 + 44 + 8}
              right={DESKTOP_RADIUS_FAB_RIGHT + insets.right}
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

          {/* #2217 — «Подсказки» moved out of the panel header into this cluster,
              under «Слои» at the map edge: the top row stays «Радиус», «Слои»,
              because a third slot there reaches into the centred «Искать в этой
              области» pill on a 768–925 px window. Reading order follows the
              picture: «Радиус», «Слои», «Подсказки». While «Слои» is open the
              button is not rendered: the layers card opens on its spot, and the
              button (zIndex 1001, the popover root has none) would sit on the
              card's «×» and start the tour instead of closing the card. Like its
              neighbours: own 44 box inside the root, no hitSlop (#2172 — on
              Android a slop ring over the map WebView leaks the tap into the
              map). */}
          {!layersOpen && (
            <Pressable
              ref={webTitleRef(i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd'))}
              testID="map-desktop-help-button"
              onPress={openMapHelp}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd')}
              style={({ pressed }) => [styles.desktopHelpFab, pressed && PRESSED_OPACITY_085]}
            >
              <Feather name="help-circle" size={20} color={themedColors.text} />
            </Pressable>
          )}

          {layersOpen && (
            <MapMobileLayersPopover
              colors={themedColors as ThemedColors}
              top={insets.top + 16 + 44 + 8}
              right={DESKTOP_LAYERS_FAB_RIGHT + insets.right}
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

      <MapOfflineIndicator visible={!isConnected} top={MAP_OFFLINE_INDICATOR_TOP + insets.top} />

      {!mapReady && (
        <View style={[styles.loadingOverlay, POINTER_EVENTS_NONE]} testID="map-loading-overlay">
          <ActivityIndicator color={themedColors.primary} accessibilityLabel={i18nT('map:components.MapPage.MapScreenParts.MapScreenDesktop.zagruzka_karty_8db9bcd2')} />
        </View>
      )}

      {shouldLoadOnboarding && (
        <Suspense fallback={null}>
          {/* Desktop branch: coachmark is mobile-web only, so always false here. */}
          <MapOnboarding layout="desktop" mobileWebCoachmark={false} />
        </Suspense>
      )}
    </>
  )
}
