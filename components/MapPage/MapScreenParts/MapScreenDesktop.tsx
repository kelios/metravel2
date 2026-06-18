import React, { Suspense } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'

import { MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
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
  ROOT_MAP_PROPS,
} from './shared'

type MapScreenDesktopProps = {
  styles: any
  themedColors: any
  seoBlock: React.ReactNode
  mapComponent: React.ReactNode
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
  currentRadius: string | number
  coordinates: any
  transportMode: any
  isConnected: boolean
  mapReady: boolean
  shouldLoadOnboarding: boolean
}

export function MapScreenDesktop({
  styles,
  themedColors,
  seoBlock,
  mapComponent,
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
  openRightPanel,
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
  currentRadius,
  coordinates,
  transportMode,
  isConnected,
  mapReady,
  shouldLoadOnboarding,
}: MapScreenDesktopProps) {
  const showDesktopCollapsedStrip = !isMobile && isDesktopCollapsed && isWeb
  const showDesktopExpandedPanel = !showDesktopCollapsedStrip

  return (
    <View style={styles.container} {...ROOT_MAP_PROPS}>
      {seoBlock}

      <View style={styles.mapContainer}>
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
              label={`Список точек (${travelsData.length})`}
              title={`Список мест (${travelsData.length})`}
              onPress={() => {
                toggleDesktopCollapse()
                selectTravelsTab()
              }}
              styles={styles}
              iconColor={themedColors.textMuted}
              badge={travelsData.length}
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
              travelsCount={travelsData.length}
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

        {mapComponent}
        {rightPanelVisible && isMobile && (
          <Animated.View style={[styles.overlay, overlayStyle]} />
        )}
      </View>

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

      <MapOfflineIndicator visible={!isConnected} />

      {!mapReady && (
        <View style={[styles.loadingOverlay, POINTER_EVENTS_NONE]} testID="map-loading-overlay">
          <ActivityIndicator color={themedColors.primary} accessibilityLabel="Загрузка карты" />
        </View>
      )}

      {shouldLoadOnboarding && (
        <Suspense fallback={null}>
          <MapOnboarding mobileWebCoachmark={isWeb && isMobile} />
        </Suspense>
      )}
    </View>
  )
}
