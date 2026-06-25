import { Suspense, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'

import { MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
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

type MapScreenDesktopProps = {
  styles: any
  themedColors: any
  isWeb: boolean
  isMobile: boolean
  isDesktopCollapsed: boolean
  desktopPanelWidth: number
  rightPanelTab: string
  rightPanelVisible: boolean
  activePanelTab: 'search' | 'route' | 'travels'
  panelRef: any
  panelStyle: any
  overlayStyle: any
  toggleDesktopCollapse: () => void
  handleSelectSearchTab: () => void
  handleSelectRouteTab: () => void
  selectTravelsTab: () => void
  closeRightPanel: () => void
  openRightPanel: () => void
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
}

/**
 * Desktop chrome: the left panel (or its collapsed strip) plus the in-map
 * overlay used while the mobile-style sheet animates. Rendered as a flex
 * sibling BEFORE the stable map host (see MapScreenShell) so the map node is
 * never re-parented on a breakpoint flip. #217.
 */
export function MapScreenDesktopChrome({
  styles,
  themedColors,
  isWeb,
  isMobile,
  isDesktopCollapsed,
  desktopPanelWidth,
  rightPanelTab,
  rightPanelVisible,
  activePanelTab,
  panelRef,
  panelStyle,
  overlayStyle,
  toggleDesktopCollapse,
  handleSelectSearchTab,
  handleSelectRouteTab,
  selectTravelsTab,
  closeRightPanel,
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
}: MapScreenDesktopProps) {
  const showDesktopCollapsedStrip = !isMobile && isDesktopCollapsed && isWeb
  const showDesktopExpandedPanel = !showDesktopCollapsedStrip

  return (
    <>
      {showDesktopCollapsedStrip && (
        <View testID="map-panel-collapsed" style={styles.collapsedPanel}>
          <Pressable
            testID="map-panel-expand-button"
            hitSlop={8}
            style={({ pressed }) => [styles.collapseToggle, pressed && PRESSED_OPACITY_07]}
            onPress={toggleDesktopCollapse}
            accessibilityRole="button"
            accessibilityLabel="Развернуть панель"
            {...({ title: 'Развернуть панель' } as any)}
          >
            <Feather name="chevron-right" size={18} color={themedColors.text} />
          </Pressable>
          <CollapsedIconButton
            icon="list"
            label={`Список точек (${travelsCount})`}
            title={`Список мест (${travelsCount})`}
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
            label="Построение маршрута"
            title="Построить маршрут"
            onPress={() => {
              toggleDesktopCollapse()
              handleSelectRouteTab()
            }}
            styles={styles}
            iconColor={themedColors.textMuted}
          />
          <CollapsedIconButton
            icon="sliders"
            label="Фильтры"
            title="Фильтры"
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
          {!isMobile && isWeb && (
            <Pressable
              testID="map-panel-collapse-button"
              hitSlop={8}
              style={({ pressed }) => [styles.collapseToggleInPanel, pressed && PRESSED_OPACITY_07]}
              onPress={toggleDesktopCollapse}
              accessibilityRole="button"
              accessibilityLabel="Свернуть панель"
            >
              <Feather name="chevron-left" size={16} color={themedColors.textMuted} />
            </Pressable>
          )}
          <MapPanelHeader
            isMobile={isMobile}
            activeTab={activePanelTab}
            travelsCount={travelsCount}
            themedColors={themedColors}
            styles={styles}
            selectSearchTab={handleSelectSearchTab}
            selectRouteTab={handleSelectRouteTab}
            selectTravelsTab={selectTravelsTab}
            closeRightPanel={closeRightPanel}
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
                      <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                    </View>
                  }
                >
                  <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                    <filtersPanelProps.Panel hideTopControls hideFooterReset={!isMobile} />
                  </filtersPanelProps.Component>
                </Suspense>
              ) : (
                <View style={styles.panelPlaceholder}>
                  <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                </View>
              )
            ) : (
              <View
                testID="map-travels-tab"
                {...(isWeb ? ({ 'data-testid': 'map-travels-tab' } as any) : null)}
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

      {rightPanelVisible && isMobile && (
        <Animated.View style={[styles.overlay, overlayStyle]} />
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
  isWeb: boolean
  /** Desktop-web only: the left panel is hidden on mobile, so this is always false there. */
  isMobile: boolean
  openRightPanel: () => void
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
 * Desktop overlays that live OUTSIDE the map container (FAB, offline indicator,
 * loading overlay, onboarding). Rendered by the shell as breakpoint shared
 * chrome so they do not affect the map host position.
 */
export function MapScreenDesktopOverlays({
  styles,
  themedColors,
  isWeb,
  isMobile,
  openRightPanel,
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
  // Desktop-web «Слои» floating control: layers live on the map (Google-Maps
  // style), no longer inside the left filters panel. Mobile keeps its own icon
  // toolbar + popover, so this branch is desktop-web only.
  const showDesktopLayersControl = isWeb && !isMobile
  const [layersOpen, setLayersOpen] = useState(false)
  const toggleLayers = useCallback(() => {
    setLayersOpen((v) => !v)
    setRadiusOpen(false)
  }, [])
  const closeLayers = useCallback(() => setLayersOpen(false), [])

  // Desktop-web «Радиус» floating control: same on-map cluster as «Слои» (sits
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

  return (
    <>
      {!isWeb && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && PRESSED_OPACITY_085]}
          onPress={openRightPanel}
          accessibilityRole="button"
          accessibilityLabel="Фильтры и список мест"
        >
          <Feather name="sliders" size={22} color={themedColors.textOnPrimary} />
        </Pressable>
      )}

      {showDesktopLayersControl && (
        <>
          <Pressable
            testID="map-desktop-radius-button"
            onPress={toggleRadius}
            accessibilityRole="button"
            accessibilityState={{ expanded: radiusOpen }}
            accessibilityLabel={`Радиус${radiusBadge ? ` ${radiusBadge}` : ''}`}
            hitSlop={6}
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
              top={16 + 44 + 8}
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
            accessibilityLabel="Слои и настройки карты"
            hitSlop={6}
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
              top={16 + 44 + 8}
              right={16}
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

      <MapOfflineIndicator visible={!isConnected} />

      {!mapReady && (
        <View style={[styles.loadingOverlay, POINTER_EVENTS_NONE]} testID="map-loading-overlay">
          <ActivityIndicator color={themedColors.primary} accessibilityLabel="Загрузка карты" />
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
