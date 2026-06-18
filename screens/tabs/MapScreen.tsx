import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { useMapScreenController } from '@/hooks/useMapScreenController'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'
import { MapCanvas } from '@/components/MapPage/MapCanvas'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { MAP_SEO_TITLE, MAP_SEO_DESCRIPTION } from '@/constants/mapSeo'
import { buildOgImageUrl, MAP_OG_IMAGE_PATH } from '@/utils/seo'
import { createMapStructuredData } from '@/utils/discoverySeo'
import { devWarn } from '@/utils/logger'
import {
  buildQuickFiltersData,
  buildActiveFilterItems,
} from '@/screens/tabs/mapScreenHelpers'
import { MapScreenMobile } from '@/components/MapPage/MapScreenParts/MapScreenMobile'
import { MapScreenError } from '@/components/MapPage/MapScreenParts/MapScreenError'
import {
  MapScreenDesktopChrome,
  MapScreenDesktopOverlays,
} from '@/components/MapPage/MapScreenParts/MapScreenDesktop'
import { MapScreenShell } from '@/components/MapPage/MapScreenParts/MapScreenShell'

const IS_WEB = Platform.OS === 'web'
const CAN_PRELOAD_LEAFLET = IS_WEB && typeof window !== 'undefined'
const MAP_STRUCTURED_DATA_ENTRY_LIMIT = 12
const RADIUS_EXPAND_MAX_KM = 500
const RADIUS_EXPAND_DEFAULT = 30
const ONBOARDING_DEFER_MS = 600
const ONBOARDING_IDLE_TIMEOUT = 1000

function preloadLeafletRuntime() {
  Promise.resolve(import('@/utils/loadLeafletRuntime'))
    .then((m) => m.loadLeafletRuntime())
    .catch((error) => {
      devWarn('[MapScreen] Failed to preload Leaflet runtime', error)
    })
}

// Defer the Leaflet runtime prefetch off the critical hydration/LCP path.
// The map container loads Leaflet on its own once mapReady resolves; this is
// purely a warm-up prefetch, so yield the main thread to first paint first.
if (CAN_PRELOAD_LEAFLET) {
  const requestIdle = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined
  if (typeof requestIdle === 'function') {
    requestIdle(preloadLeafletRuntime, { timeout: 1500 })
  } else {
    setTimeout(preloadLeafletRuntime, 300)
  }
}

export default function MapScreen() {
  const isWeb = Platform.OS === 'web'
  const {
    canonical,
    isFocused,
    isMobile,
    themedColors,
    styles,
    mapReady,
    mapPanelProps,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersPanelProps,
    filtersValuesSlice,
    overlaySlice,
    routingSlice,
    travelsData,
    loading,
    isFetching,
    isDebouncingFilters,
    isPlaceholderData,
    hasMore,
    onLoadMore,
    mapError,
    mapErrorDetails,
    refetchMapData,
    invalidateTravelsQuery,
    buildRouteTo,
    centerOnUser,
    canSearchThisArea,
    handleSearchThisArea,
    panelRef,
    geoError,
    coordinates,
    transportMode,
    selectedPlace,
    clearSelectedPlace,
    selectedPlaceUserLocation,
  } = useMapScreenController()

  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false)
  const [shouldLoadOnboarding, setShouldLoadOnboarding] = useState(false)
  const dismissGeoBanner = useCallback(() => setGeoBannerDismissed(true), [])
  const showGeoBanner = Boolean(geoError && !geoBannerDismissed)

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return
    if (!isMobile) return
    const previousOverflowY = document.body.style.overflowY
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.style.overflowY = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overflowY = previousOverflowY
    }
  }, [isMobile, isWeb])

  useEffect(() => {
    if (!geoError && geoBannerDismissed) setGeoBannerDismissed(false)
  }, [geoError, geoBannerDismissed])

  useEffect(() => {
    if (shouldLoadOnboarding) return
    if (!isWeb) {
      setShouldLoadOnboarding(true)
      return
    }
    const win = typeof window !== 'undefined' ? window : undefined
    const requestIdle = win?.requestIdleCallback
    if (typeof requestIdle === 'function') {
      const idleId = requestIdle(() => setShouldLoadOnboarding(true), { timeout: ONBOARDING_IDLE_TIMEOUT })
      return () => win?.cancelIdleCallback?.(idleId)
    }
    const timer = setTimeout(() => setShouldLoadOnboarding(true), ONBOARDING_DEFER_MS)
    return () => clearTimeout(timer)
  }, [isWeb, shouldLoadOnboarding])

  const { isConnected } = useNetworkStatus()
  const wasDisconnectedRef = useRef(!isConnected)
  useEffect(() => {
    if (!mapError) {
      wasDisconnectedRef.current = !isConnected
      return
    }
    if (isConnected && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false
      invalidateTravelsQuery()
      refetchMapData()
      return
    }
    wasDisconnectedRef.current = !isConnected
  }, [isConnected, mapError, invalidateTravelsQuery, refetchMapData])

  const mapStructuredData = useMemo(() => {
    if (!isWeb || !isFocused) return null
    return createMapStructuredData({
      canonical,
      title: MAP_SEO_TITLE,
      description: MAP_SEO_DESCRIPTION,
      entries: travelsData.slice(0, MAP_STRUCTURED_DATA_ENTRY_LIMIT).map((item: any) => ({
        name: item?.address || 'Маршрут на карте',
        url: item?.urlTravel,
        lat: item?.lat ?? String(item?.coord || '').split(',')[0],
        lng: item?.lng ?? String(item?.coord || '').split(',')[1],
        categoryName: item?.categoryName,
      })),
    })
  }, [canonical, isFocused, isWeb, travelsData])

  const mapSeoTags = useMemo(() => {
    if (!isWeb || !mapStructuredData) return undefined
    return (
      <script
        key="map-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(mapStructuredData) }}
      />
    )
  }, [isWeb, mapStructuredData])

  const seoBlock = useMemo(() => {
    if (!isWeb || !isFocused) return null
    return (
      <InstantSEO
        headKey={mapError ? 'map-error' : 'map'}
        title={MAP_SEO_TITLE}
        description={MAP_SEO_DESCRIPTION}
        canonical={canonical}
        image={buildOgImageUrl(MAP_OG_IMAGE_PATH)}
        imageWidth={1200}
        imageHeight={630}
        additionalTags={mapSeoTags}
      />
    )
  }, [canonical, isFocused, isWeb, mapError, mapSeoTags])

  const activeResizeHandlersRef = useRef<{
    onMove: (ev: MouseEvent) => void
    onUp: () => void
  } | null>(null)

  const handleResizeMouseDown = useCallback(
    (e: any) => {
      if (!isWeb || isMobile) return
      e.preventDefault()
      const startX = e.clientX
      const startW = desktopPanelWidth
      const onMove = (ev: MouseEvent) => onResizePanelWidth(startW + ev.clientX - startX)
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        activeResizeHandlersRef.current = null
      }
      activeResizeHandlersRef.current = { onMove, onUp }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [desktopPanelWidth, isMobile, isWeb, onResizePanelWidth],
  )

  useEffect(
    () => () => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return
      if (activeResizeHandlersRef.current) {
        document.removeEventListener('mousemove', activeResizeHandlersRef.current.onMove)
        document.removeEventListener('mouseup', activeResizeHandlersRef.current.onUp)
        activeResizeHandlersRef.current = null
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
    [],
  )

  const commandNonce = useMapPanelStore((s) => s.commandNonce)
  const command = useMapPanelStore((s) => s.command)

  const openRightPanelRef = useRef(openRightPanel)
  useEffect(() => {
    openRightPanelRef.current = openRightPanel
  }, [openRightPanel])

  // Desktop panel only reacts to `open` commands (toggle/collapse are mobile-sheet only).
  useEffect(() => {
    if (!commandNonce) return
    if (command.kind !== 'open') return
    if (command.tab === 'list') selectTravelsTab()
    else selectFiltersTab()
    openRightPanelRef.current()
  }, [commandNonce, command, selectFiltersTab, selectTravelsTab])

  const currentRadius = filtersValuesSlice?.filterValue?.radius ?? ''
  // Depend on the stable slices buildQuickFiltersData reads (each keeps its own
  // identity), not the whole filtersPanelProps object which is rebuilt on every
  // routing-state change.
  const quickFilters = useMemo(
    () => buildQuickFiltersData(filtersPanelProps, currentRadius),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersValuesSlice, overlaySlice, currentRadius],
  )

  const currentTransport = transportMode ?? 'car'
  const currentMode = routingSlice?.mode
  const activeFilterItems = useMemo(
    () => buildActiveFilterItems(quickFilters.selected, currentRadius, currentMode, currentTransport),
    [quickFilters.selected, currentRadius, currentMode, currentTransport],
  )

  const handleRemoveActiveFilter = useCallback(
    (key: string) => {
      const onChange = filtersValuesSlice?.onFilterChange
      if (!onChange) return
      if (key.startsWith('cat:')) {
        const catName = key.slice(4)
        const current: string[] = filtersValuesSlice?.filterValue?.categoryTravelAddress ?? []
        onChange('categoryTravelAddress', current.filter((c: string) => c !== catName))
      } else if (key === 'radius') {
        onChange('radius', String(DEFAULT_RADIUS_KM))
      } else if (key === 'transport') {
        routingSlice?.setTransportMode?.('car')
      }
    },
    [filtersValuesSlice, routingSlice],
  )

  const handleClearAllFilters = useCallback(() => {
    filtersValuesSlice?.resetFilters?.()
  }, [filtersValuesSlice])

  const requestOpenBottomSheet = useMapPanelStore((s) => s.requestOpen)

  const handleExpandRadius = useCallback(() => {
    const onChange = filtersValuesSlice?.onFilterChange
    if (!onChange) return
    const current = Number(filtersValuesSlice?.filterValue?.radius) || RADIUS_EXPAND_DEFAULT
    onChange('radius', String(Math.min(current * 2, RADIUS_EXPAND_MAX_KM)))
  }, [filtersValuesSlice])

  const resetFiltersForPanel = filtersValuesSlice?.resetFilters
  const setPanelMode = routingSlice?.setMode

  const handleSelectSearchTab = useCallback(() => {
    useRouteStore.getState().clearRouteAndSetMode('radius')
    selectFiltersTab()
  }, [selectFiltersTab])

  const handleSelectRouteTab = useCallback(() => {
    setPanelMode?.('route')
    selectFiltersTab()
  }, [setPanelMode, selectFiltersTab])

  // #211 — «Список точек» показывает места ВОКРУГ (radius-концепция). Если в эту
  // вкладку попали из route-режима (например, кликнув список после «Маршрут»),
  // запрос точек остаётся route-режимным и без построенного маршрута возвращает 0
  // → пользователь видит пустой «Ничего не нашлось». Переводим в radius, чтобы
  // список отражал ближайшие места. Маршрут сохраняется (setMode не очищает точки).
  useEffect(() => {
    if (rightPanelTab === 'travels' && currentMode === 'route') {
      setPanelMode?.('radius')
    }
  }, [rightPanelTab, currentMode, setPanelMode])

  const activePanelTab: 'search' | 'route' | 'travels' =
    rightPanelTab === 'travels' ? 'travels' : currentMode === 'route' ? 'route' : 'search'

  // На мобиле радиус уже показан чипом «Радиус N км» в верхнем overlay — плавающая
  // пилюля дублировала его и занимала отдельную строку (F-50). Прячем её на мобиле.
  const shouldShowFloatingRadiusPill = Boolean(currentRadius && !isWeb && !isMobile)
  const showMapProgress =
    isDebouncingFilters ||
    (loading && !travelsData.length) ||
    (isFetching && !isPlaceholderData && !travelsData.length)

  const enabledOverlays = quickFilters.enabledOverlays

  const mapComponent = useMemo(
    () => (
      <MapCanvas
        styles={styles}
        themedColors={themedColors}
        isWeb={isWeb}
        isMobile={isMobile}
        showProgress={showMapProgress}
        mapReady={mapReady}
        mapPanelProps={mapPanelProps}
        enabledOverlays={enabledOverlays}
        currentRadius={currentRadius}
        shouldShowFloatingRadiusPill={shouldShowFloatingRadiusPill}
        showGeoBanner={showGeoBanner}
        dismissGeoBanner={dismissGeoBanner}
        handleSelectSearchTab={handleSelectSearchTab}
        openRightPanel={openRightPanel}
      />
    ),
    [
      isMobile,
      isWeb,
      mapPanelProps,
      mapReady,
      showMapProgress,
      enabledOverlays,
      currentRadius,
      shouldShowFloatingRadiusPill,
      styles,
      showGeoBanner,
      dismissGeoBanner,
      themedColors,
      handleSelectSearchTab,
      openRightPanel,
    ],
  )

  // Desktop data-fetch error replaces the whole screen (separate from the
  // breakpoint-flip path — it is not part of the remount oscillation). Mobile
  // keeps the map + chrome and surfaces errors inline.
  if (mapError && !isMobile) {
    return (
      <MapScreenError
        styles={styles}
        seoBlock={seoBlock}
        mapError={mapError}
        mapErrorDetails={mapErrorDetails}
        isConnected={isConnected}
        invalidateTravelsQuery={invalidateTravelsQuery}
        refetchMapData={refetchMapData}
      />
    )
  }

  const chrome = isMobile ? (
    <MapScreenMobile
      travelsData={travelsData}
      hasMore={hasMore}
      onLoadMore={onLoadMore}
      refetchMapData={refetchMapData}
      loading={loading}
      isFetching={isFetching}
      isPlaceholderData={isPlaceholderData}
      coordinates={coordinates}
      transportMode={transportMode}
      buildRouteTo={buildRouteTo}
      centerOnUser={centerOnUser}
      canSearchThisArea={canSearchThisArea}
      onSearchThisArea={handleSearchThisArea}
      handleSelectSearchTab={handleSelectSearchTab}
      requestOpenBottomSheet={requestOpenBottomSheet}
      filtersPanelProps={filtersPanelProps}
      handleClearAllFilters={handleClearAllFilters}
      handleExpandRadius={handleExpandRadius}
      isConnected={isConnected}
      shouldLoadOnboarding={shouldLoadOnboarding}
      isWeb={isWeb}
      isMobile={isMobile}
      selectedPlace={selectedPlace}
      clearSelectedPlace={clearSelectedPlace}
      selectedPlaceUserLocation={selectedPlaceUserLocation}
    />
  ) : (
    <MapScreenDesktopChrome
      styles={styles}
      themedColors={themedColors}
      isWeb={isWeb}
      isMobile={isMobile}
      isDesktopCollapsed={isDesktopCollapsed}
      desktopPanelWidth={desktopPanelWidth}
      rightPanelTab={rightPanelTab}
      rightPanelVisible={rightPanelVisible}
      activePanelTab={activePanelTab}
      panelRef={panelRef}
      panelStyle={panelStyle}
      overlayStyle={overlayStyle}
      toggleDesktopCollapse={toggleDesktopCollapse}
      handleSelectSearchTab={handleSelectSearchTab}
      handleSelectRouteTab={handleSelectRouteTab}
      selectTravelsTab={selectTravelsTab}
      closeRightPanel={closeRightPanel}
      openRightPanel={openRightPanel}
      handleResizeMouseDown={handleResizeMouseDown}
      resetFiltersForPanel={resetFiltersForPanel}
      filtersPanelProps={filtersPanelProps}
      activeFilterItems={activeFilterItems}
      handleRemoveActiveFilter={handleRemoveActiveFilter}
      handleClearAllFilters={handleClearAllFilters}
      handleExpandRadius={handleExpandRadius}
      travelsData={travelsData}
      loading={loading}
      isFetching={isFetching}
      isPlaceholderData={isPlaceholderData}
      hasMore={hasMore}
      onLoadMore={onLoadMore}
      refetchMapData={refetchMapData}
      buildRouteTo={buildRouteTo}
      currentRadius={currentRadius}
      coordinates={coordinates}
      transportMode={transportMode}
      isConnected={isConnected}
      mapReady={mapReady}
      shouldLoadOnboarding={shouldLoadOnboarding}
    />
  )

  const overlays = isMobile ? null : (
    <MapScreenDesktopOverlays
      styles={styles}
      themedColors={themedColors}
      isWeb={isWeb}
      openRightPanel={openRightPanel}
      isConnected={isConnected}
      mapReady={mapReady}
      shouldLoadOnboarding={shouldLoadOnboarding}
    />
  )

  return (
    <MapScreenShell
      styles={styles}
      seoBlock={seoBlock}
      mapComponent={mapComponent}
      chrome={chrome}
      overlays={overlays}
      isMobile={isMobile}
    />
  )
}
