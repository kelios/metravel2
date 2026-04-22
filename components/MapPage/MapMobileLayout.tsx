/**
 * MapMobileLayout - mobile map layout with bottom sheet flows.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Platform,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native'
import { usePathname } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useThemedColors } from '@/hooks/useTheme'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useMapMobileDerivations } from '@/hooks/map/useMapMobileDerivations'
import { FiltersSkeleton } from '@/components/ui/SkeletonLoader'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles'
import { MapMobileSheetToolbar } from './MapMobile/MapMobileSheetToolbar'
import { MapMobileSheetBody } from './MapMobile/MapMobileSheetBody'
import { MapMobileCollapsedOverlay } from './MapMobile/MapMobileCollapsedOverlay'

interface MapMobileLayoutProps {
  mapComponent: React.ReactNode
  travelsData: any[]
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
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
}

const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 430
const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 350
const PHONE_COMPACT_ACTIONS_MAX_WIDTH = 520
const PHONE_STACKED_TOOLBAR_MAX_WIDTH = 560
const WEB_MOBILE_BOTTOM_DOCK_INSET = 104
const WEB_MOBILE_CONSENT_BANNER_INSET = 112

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  mapComponent,
  travelsData,
  hasMore,
  onLoadMore,
  onRefresh,
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
}) => {
  const colors = useThemedColors()
  const { width: viewportWidth } = useWindowDimensions()
  const isNarrow = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
  const isVeryNarrow = viewportWidth <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
  const compactSheetActions = viewportWidth <= PHONE_COMPACT_ACTIONS_MAX_WIDTH
  // Keep tabs accessible on mid-width mobile web layouts where the action row
  // would otherwise squeeze the segmented control out of view.
  const stackSheetToolbar = viewportWidth <= PHONE_STACKED_TOOLBAR_MAX_WIDTH
  const bottomSheetRef = useRef<MapBottomSheetRef>(null)
  const pathname = usePathname()
  const isActiveWebRoute =
    Platform.OS === 'web' &&
    (pathname === '/map' || String(pathname).startsWith('/map/'))
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  const [uiTab, setUiTab] = useState<'search' | 'route' | 'list'>('list')
  const sheetStateRef = useRef<'collapsed' | 'quarter' | 'half' | 'full'>(
    'collapsed',
  )
  const [sheetState, setSheetState] = useState<
    'collapsed' | 'quarter' | 'half' | 'full'
  >('collapsed')
  const isSheetPreview = false
  const styles = useMemo(
    () =>
      getMapMobileLayoutStyles(colors, {
        isNarrow,
        compactSheetActions,
        stackSheetToolbar,
        isSheetPreview,
      }),
    [colors, isNarrow, compactSheetActions, stackSheetToolbar, isSheetPreview],
  )

  const openNonce = useMapPanelStore((s) => s.openNonce)
  const requestedOpenTab = useMapPanelStore((s) => s.requestedTab)
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce)

  const setBottomSheetState = useBottomSheetStore((s) => s.setState)
  const bottomSheetState = useBottomSheetStore((s) => s.state)
  const collapseNonce = useBottomSheetStore((s) => s.collapseNonce)
  const filtersContextProps =
    filtersPanelProps?.props ?? filtersPanelProps?.contextValue
  const filtersMode: 'radius' | 'route' | undefined = filtersContextProps?.mode
  const setFiltersMode: ((m: 'radius' | 'route') => void) | undefined =
    filtersContextProps?.setMode

  const handleSheetStateChange = useCallback(
    (state: 'collapsed' | 'quarter' | 'half' | 'full') => {
      sheetStateRef.current = state
      setSheetState(state)
      setBottomSheetState(state)
    },
    [setBottomSheetState],
  )

  useEffect(() => {
    if (!openNonce) return
    const nextTab =
      requestedOpenTab === 'list'
        ? 'list'
        : filtersMode === 'route'
          ? 'route'
          : 'search'
    setUiTab(nextTab)
    if (nextTab === 'list') {
      bottomSheetRef.current?.snapToFull()
      return
    }
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
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
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

    return () => {
      observer.disconnect()
    }
  }, [])

  const handleOpenList = useCallback(() => {
    setUiTab('list')
    bottomSheetRef.current?.snapToFull()
  }, [])

  const handleOpenSearch = useCallback(() => {
    setFiltersMode?.('radius')
    setUiTab('search')
    bottomSheetRef.current?.snapToFull()
    onOpenFilters()
  }, [onOpenFilters, setFiltersMode])

  const handleBackToMap = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  const handleTabChange = useCallback(
    (next: 'search' | 'route' | 'list') => {
      if (next === 'route') {
        setFiltersMode?.('route')
      } else if (next === 'search') {
        setFiltersMode?.('radius')
      }
      setUiTab(next)
      bottomSheetRef.current?.snapToFull()
    },
    [setFiltersMode],
  )

  const handleProviderOpenList = useCallback(() => {
    setUiTab('list')
    bottomSheetRef.current?.snapToFull()
  }, [])

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
  const bottomSheetInset =
    Platform.OS === 'web'
      ? WEB_MOBILE_BOTTOM_DOCK_INSET +
        (consentBannerVisible ? WEB_MOBILE_CONSENT_BANNER_INSET : 0)
      : 0

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
    <View
      style={[
        styles.sheetRoot,
        isQuarterListPreview && styles.sheetRootPreview,
      ]}
    >
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

      <View
        style={[
          styles.sheetBody,
          isQuarterListPreview && styles.sheetBodyPreview,
        ]}
      >
        <MapMobileSheetBody
          uiTab={uiTab}
          sheetState={sheetState}
          travelsData={travelsData}
          buildRouteTo={buildRouteTo}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          coordinates={coordinates}
          transportMode={transportMode}
          onToggleFavorite={onToggleFavorite}
          favorites={favorites}
          onResetFilters={onResetFilters}
          onExpandRadius={onExpandRadius}
          onOpenList={handleOpenList}
          onBackToMap={handleBackToMap}
          onOpenSearch={handleOpenSearch}
          filtersPanelProps={filtersPanelProps}
          filtersContextProps={filtersContextProps}
          filtersLoadingFallback={filtersLoadingFallback}
          onProviderOpenList={handleProviderOpenList}
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
          />
        )}
      </View>

      <MapBottomSheet
        ref={bottomSheetRef}
        peekContent={null}
        onStateChange={handleSheetStateChange}
        bottomInset={bottomSheetInset}
      >
        {sheetContent}
      </MapBottomSheet>
    </GestureHandlerRootView>
  )
}
