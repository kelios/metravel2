import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Text as RNText, useWindowDimensions, View } from 'react-native'
import { usePathname } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { useThemedColors } from '@/hooks/useTheme'
import { LAYOUT } from '@/constants/layout'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useMapMobileDerivations } from '@/hooks/map/useMapMobileDerivations'
import { FiltersSkeleton } from '@/components/ui/SkeletonLoader'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles'
import { MapMobileSheetToolbar } from './MapMobile/MapMobileSheetToolbar'
import { MapMobileSheetBody } from './MapMobile/MapMobileSheetBody'
import { MapMobileCollapsedOverlay } from './MapMobile/MapMobileCollapsedOverlay'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'
type UiTab = 'search' | 'route' | 'list'
type FiltersMode = 'radius' | 'route'

interface MapMobileLayoutProps {
  mapComponent: React.ReactNode
  travelsData: any[]
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  isLoading?: boolean
  isRefreshing?: boolean
  coordinates: { latitude: number; longitude: number } | null
  transportMode: 'car' | 'bike' | 'foot'
  buildRouteTo: (item: any) => void
  onCenterOnUser: () => void
  onOpenFilters: () => void
  filtersPanelProps: any
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
  onResetFilters?: () => void
  onExpandRadius?: () => void
  quickActionButtons?: ReadonlyArray<{
    key: string
    label: string
    icon: any
    onPress: () => void
    testID?: string
  }>
}

const IS_WEB = Platform.OS === 'web'
const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 430
const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 350
const PHONE_COMPACT_ACTIONS_MAX_WIDTH = 520
const PHONE_STACKED_TOOLBAR_MAX_WIDTH = 360
const WEB_MOBILE_BOTTOM_DOCK_INSET = 104
const WEB_MOBILE_CONSENT_BANNER_INSET = 112
const NATIVE_MOBILE_BOTTOM_DOCK_INSET = (LAYOUT?.tabBarHeight ?? 56) + 16

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  mapComponent,
  travelsData,
  hasMore,
  onLoadMore,
  onRefresh,
  isLoading,
  isRefreshing,
  coordinates,
  transportMode,
  buildRouteTo,
  onCenterOnUser,
  onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
  onResetFilters,
  onExpandRadius,
  quickActionButtons,
}) => {
  const colors = useThemedColors()
  const { width: viewportWidth } = useWindowDimensions()
  const isNarrow = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
  const isVeryNarrow = viewportWidth <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
  const compactSheetActions = viewportWidth <= PHONE_COMPACT_ACTIONS_MAX_WIDTH
  const stackSheetToolbar = viewportWidth <= PHONE_STACKED_TOOLBAR_MAX_WIDTH

  const bottomSheetRef = useRef<MapBottomSheetRef>(null)
  const pathname = usePathname()
  const isActiveWebRoute =
    IS_WEB && (pathname === '/map' || String(pathname).startsWith('/map/'))
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  const [uiTab, setUiTab] = useState<UiTab>('list')
  const sheetStateRef = useRef<SheetState>('collapsed')
  const [sheetState, setSheetState] = useState<SheetState>('collapsed')

  const styles = useMemo(
    () =>
      getMapMobileLayoutStyles(colors, {
        isNarrow,
        compactSheetActions,
        stackSheetToolbar,
        isSheetPreview: false,
      }),
    [colors, isNarrow, compactSheetActions, stackSheetToolbar],
  )

  const openNonce = useMapPanelStore((s) => s.openNonce)
  const requestedOpenTab = useMapPanelStore((s) => s.requestedTab)
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce)

  const setBottomSheetState = useBottomSheetStore((s) => s.setState)
  const bottomSheetState = useBottomSheetStore((s) => s.state)
  const collapseNonce = useBottomSheetStore((s) => s.collapseNonce)

  const filtersContextProps =
    filtersPanelProps?.props ?? filtersPanelProps?.contextValue
  const filtersMode: FiltersMode | undefined = filtersContextProps?.mode
  const setFiltersMode: ((m: FiltersMode) => void) | undefined =
    filtersContextProps?.setMode

  const handleSheetStateChange = useCallback(
    (state: SheetState) => {
      sheetStateRef.current = state
      setSheetState(state)
      setBottomSheetState(state)
    },
    [setBottomSheetState],
  )

  // Initial collapse on mount + reset shared store on unmount, чтобы залипшее
  // 'full' не заставляло глобальный back-handler (BottomDock) глотать Back на
  // других экранах.
  useEffect(() => {
    sheetStateRef.current = 'collapsed'
    setSheetState('collapsed')
    setBottomSheetState('collapsed')
    bottomSheetRef.current?.snapToCollapsed()
    return () => {
      setBottomSheetState('collapsed')
    }
  }, [setBottomSheetState])

  useEffect(() => {
    if (!openNonce) return
    const nextTab: UiTab =
      requestedOpenTab === 'list' ? 'list' : filtersMode === 'route' ? 'route' : 'search'
    setUiTab(nextTab)
    bottomSheetRef.current?.snapToFull()
  }, [filtersMode, openNonce, requestedOpenTab])

  useEffect(() => {
    if (!toggleNonce) return
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('list')
      bottomSheetRef.current?.snapToFull()
      return
    }
    bottomSheetRef.current?.snapToCollapsed()
  }, [toggleNonce])

  useEffect(() => {
    if (!collapseNonce) return
    if (sheetStateRef.current === 'collapsed') return
    bottomSheetRef.current?.snapToCollapsed()
  }, [collapseNonce])

  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const body = document.body
    if (!body) return

    const update = () => {
      setConsentBannerVisible(
        body.getAttribute('data-consent-banner-open') === 'true',
      )
    }
    update()

    const observer = new MutationObserver(update)
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-consent-banner-open'],
    })

    return () => observer.disconnect()
  }, [])

  const handleOpenList = useCallback(() => {
    setUiTab('list')
    bottomSheetRef.current?.snapToFull()
  }, [])

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  const handleOpenSearch = useCallback(() => {
    setFiltersMode?.('radius')
    setUiTab('search')
    bottomSheetRef.current?.snapToFull()
    onOpenFilters()
  }, [onOpenFilters, setFiltersMode])

  const handleTabChange = useCallback(
    (next: UiTab) => {
      if (next === 'route') setFiltersMode?.('route')
      else if (next === 'search') setFiltersMode?.('radius')
      setUiTab(next)
      bottomSheetRef.current?.snapToFull()
    },
    [setFiltersMode],
  )

  const derivations = useMapMobileDerivations(
    filtersContextProps,
    filtersMode,
    travelsData,
    isVeryNarrow,
  )

  const {
    quickRadiusValue,
    quickCategoriesValue,
    quickOverlaysValue,
    activeRadius,
    quickFilterSelected,
    quickRadiusOptions,
    quickCategoryOptions,
    quickOverlayOptions,
    quickEnabledOverlays,
    filterToolbarSummary,
    panelTabsOptions,
  } = derivations

  const showCollapsedMapOverlay =
    sheetState === 'collapsed' && bottomSheetState === 'collapsed'

  const bottomSheetInset = IS_WEB
    ? WEB_MOBILE_BOTTOM_DOCK_INSET +
      (consentBannerVisible ? WEB_MOBILE_CONSENT_BANNER_INSET : 0)
    : NATIVE_MOBILE_BOTTOM_DOCK_INSET

  const filtersLoadingFallback = useMemo(
    () => (
      <View
        style={styles.sheetFallback}
        testID="map-mobile-filters-loading"
        accessibilityRole="progressbar"
        accessibilityLabel="Загружаем фильтры"
      >
        <RNText style={styles.sheetFallbackTitle}>Загружаем фильтры</RNText>
        <FiltersSkeleton />
      </View>
    ),
    [styles.sheetFallback, styles.sheetFallbackTitle],
  )

  const isQuarterListPreview = uiTab === 'list' && sheetState === 'quarter'

  const sheetContent = (
    <View style={[styles.sheetRoot, isQuarterListPreview && styles.sheetRootPreview]}>
      <MapMobileSheetToolbar
        uiTab={uiTab}
        sheetState={sheetState}
        travelsData={travelsData}
        panelTabsOptions={panelTabsOptions}
        filterToolbarSummary={filterToolbarSummary}
        resetFilters={filtersContextProps?.resetFilters}
        onTabChange={handleTabChange}
        onOpenList={handleOpenList}
        onClose={handleCloseSheet}
        isNarrow={isNarrow}
        stackSheetToolbar={stackSheetToolbar}
        compactSheetActions={compactSheetActions}
        colors={colors}
        styles={styles}
      />

      <View style={[styles.sheetBody, isQuarterListPreview && styles.sheetBodyPreview]}>
        <MapMobileSheetBody
          uiTab={uiTab}
          sheetState={sheetState}
          travelsData={travelsData}
          buildRouteTo={buildRouteTo}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onRefresh={onRefresh}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          coordinates={coordinates}
          transportMode={transportMode}
          onToggleFavorite={onToggleFavorite}
          favorites={favorites}
          onResetFilters={onResetFilters}
          onExpandRadius={onExpandRadius}
          onOpenList={handleOpenList}
          onBackToMap={handleCloseSheet}
          onOpenSearch={handleOpenSearch}
          filtersPanelProps={filtersPanelProps}
          filtersContextProps={filtersContextProps}
          filtersLoadingFallback={filtersLoadingFallback}
          onProviderOpenList={handleOpenList}
        />
      </View>
    </View>
  )

  return (
    <GestureHandlerRootView
      style={styles.container}
      testID="map-mobile-layout"
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      <View style={styles.mapContainer}>
        {mapComponent}
        {showCollapsedMapOverlay && (
          <MapMobileCollapsedOverlay
            quickRadiusValue={quickRadiusValue}
            quickCategoriesValue={quickCategoriesValue}
            quickOverlaysValue={quickOverlaysValue}
            quickRadiusOptions={quickRadiusOptions}
            quickCategoryOptions={quickCategoryOptions as any}
            quickOverlayOptions={quickOverlayOptions}
            quickEnabledOverlays={quickEnabledOverlays}
            activeRadius={activeRadius}
            quickFilterSelected={quickFilterSelected}
            travelsData={travelsData}
            onCenterUser={onCenterOnUser}
            onOpenList={handleOpenList}
            onOpenSearch={handleOpenSearch}
            onFilterChange={filtersContextProps?.onFilterChange}
            onOverlayToggle={filtersContextProps?.onOverlayToggle}
            onResetOverlays={filtersContextProps?.onResetOverlays}
            quickActionButtons={quickActionButtons}
          />
        )}
      </View>

      <MapBottomSheet
        ref={bottomSheetRef}
        peekContent={null}
        onStateChange={handleSheetStateChange}
        bottomInset={bottomSheetInset}
        scrollableContent={uiTab !== 'list'}
      >
        {sheetContent}
      </MapBottomSheet>
    </GestureHandlerRootView>
  )
}
