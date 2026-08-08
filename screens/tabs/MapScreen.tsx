import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { translate as i18nT } from '@/i18n'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { useMapScreenController } from '@/hooks/useMapScreenController'
import { useMapViewportHeightVar } from '@/hooks/useMapViewportHeightVar'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'
import { MapCanvas } from '@/components/MapPage/MapCanvas'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { getMapSeoDescription, getMapSeoTitle } from '@/constants/mapSeo'
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
import {
  isMapFilterChipsRowVisible,
  MAP_FILTER_CHIPS_STACK_OFFSET,
} from '@/components/MapPage/mapFilterChips'

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
  // Web-only: keep --metravel-map-vh in sync with the real visible viewport so
  // the map container has a reliable height in in-app WebViews where `dvh` is
  // broken (Instagram/Threads grey-map bug). No-op on native.
  useMapViewportHeightVar()
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
    focusPlace,
    travelsCount,
    centerOnUser,
    refreshLocation,
    openLocationSettings,
    startManualRouteFromLocationState,
    showAllPlaces,
    canSearchThisArea,
    handleSearchThisArea,
    panelRef,
    locationState,
    coordinates,
    coordinatesSource,
    transportMode,
    selectedPlace,
    clearSelectedPlace,
    selectedPlaceUserLocation,
  } = useMapScreenController()

  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false)
  const [shouldLoadOnboarding, setShouldLoadOnboarding] = useState(false)
  // Первый вход показывает оверлеи ПО ОДНОМУ, а не стопкой поверх карты. Онбординг
  // и cookie-баннер публикуют своё состояние в DOM (`data-map-onboarding-open` /
  // `data-consent-banner-open`); пока открыт любой из них, гео-баннер не
  // показываем. Приоритет: cookie (юридически важнее) → онбординг → гео-баннер.
  const [blockingOverlayOpen, setBlockingOverlayOpen] = useState(false)
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    const read = () =>
      setBlockingOverlayOpen(
        body.getAttribute('data-map-onboarding-open') === 'true' ||
          body.getAttribute('data-consent-banner-open') === 'true',
      )
    read()
    const observer = new MutationObserver(read)
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-map-onboarding-open', 'data-consent-banner-open'],
    })
    return () => observer.disconnect()
  }, [isWeb])
  const dismissGeoBanner = useCallback(() => setGeoBannerDismissed(true), [])
  const isMobileRouteMode = isMobile && routingSlice.mode === 'route'
  const showGeoBanner = Boolean(
    !geoBannerDismissed &&
      !isMobileRouteMode &&
      !blockingOverlayOpen &&
      ['cached', 'denied', 'unavailable', 'error'].includes(locationState.status),
  )

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

  // Возрождать закрытый баннер разрешено ТОЛЬКО когда геолокация реально
  // получена (`current`): тогда, если она позже деградирует до denied/error,
  // пользователь снова увидит свежий статус. Раньше сюда входил и транзиентный
  // `loading`, который случается при каждом ретрае гео (в т.ч. при переоткрытии
  // данных карты) → однажды закрытый баннер воскресал сам собой. `loading`
  // убран: закрытие держится, пока состояние не станет по-настоящему валидным.
  useEffect(() => {
    if (locationState.status === 'current' && geoBannerDismissed) {
      setGeoBannerDismissed(false)
    }
  }, [geoBannerDismissed, locationState.status])

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
      title: getMapSeoTitle(),
      description: getMapSeoDescription(),
      entries: travelsData.slice(0, MAP_STRUCTURED_DATA_ENTRY_LIMIT).map((item: any) => ({
        name: item?.address || i18nT('map:screens.tabs.MapScreen.marshrut_na_karte_62253936'),
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
        title={getMapSeoTitle()}
        description={getMapSeoDescription()}
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

  // Ряд чипов активных фильтров (overlay-слой, zIndex 1500) и плашка
  // «Геолокация недоступна» (слой карты, zIndex 1010) живут в РАЗНЫХ поддеревьях
  // и не складываются в один вертикальный поток — оба целятся под тулбар и
  // накладывались друг на друга. Считаем видимость ряда тем же общим предикатом,
  // что и сам ряд, и опускаем баннер ровно на его высоту.
  const mobileFilterChipsVisible = useMemo(
    () =>
      isMobile &&
      isMapFilterChipsRowVisible({
        mode: currentMode,
        items: activeFilterItems,
        canRemove: true,
      }),
    [isMobile, currentMode, activeFilterItems],
  )
  const geoBannerStackOffset = mobileFilterChipsVisible ? MAP_FILTER_CHIPS_STACK_OFFSET : 0

  // Radius всегда имеет непустое дефолтное значение, поэтому активность считаем
  // ТОЛЬКО по категориям + текстовому поиску (как ActiveFiltersBar исключает
  // radius-чип). Иначе быстрая кнопка сброса висела бы постоянно.
  const hasActiveMapFilters = useMemo(
    () =>
      quickFilters.selected.length > 0 ||
      Boolean(String(filtersValuesSlice?.filterValue?.searchQuery ?? '').trim()),
    [quickFilters.selected, filtersValuesSlice],
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

  // Desktop-web radius FAB reuses the same controlled source as the filters
  // panel — onFilterChange('radius', id). No duplicated radius logic.
  const handleDesktopRadiusSelect = useCallback(
    (id: string) => {
      filtersValuesSlice?.onFilterChange?.('radius', id)
    },
    [filtersValuesSlice],
  )

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
        geoBannerStackOffset={geoBannerStackOffset}
        locationState={locationState}
        coordinatesSource={coordinatesSource}
        dismissGeoBanner={dismissGeoBanner}
        retryLocation={() => {
          void refreshLocation()
        }}
        openLocationSettings={() => {
          void openLocationSettings()
        }}
        startManualRoute={startManualRouteFromLocationState}
        handleSelectSearchTab={handleSelectSearchTab}
        openRightPanel={openRightPanel}
        canSearchThisArea={canSearchThisArea}
        onSearchThisArea={handleSearchThisArea}
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
      geoBannerStackOffset,
      locationState,
      coordinatesSource,
      dismissGeoBanner,
      refreshLocation,
      openLocationSettings,
      startManualRouteFromLocationState,
      themedColors,
      handleSelectSearchTab,
      openRightPanel,
      canSearchThisArea,
      handleSearchThisArea,
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
      focusPlace={focusPlace}
      travelsCount={travelsCount}
      centerOnUser={centerOnUser}
      onShowAllPlaces={showAllPlaces}
      canSearchThisArea={canSearchThisArea}
      onSearchThisArea={handleSearchThisArea}
      handleSelectSearchTab={handleSelectSearchTab}
      requestOpenBottomSheet={requestOpenBottomSheet}
      filtersPanelProps={filtersPanelProps}
      handleClearAllFilters={handleClearAllFilters}
      hasActiveFilters={hasActiveMapFilters}
      activeFilterItems={activeFilterItems}
      handleRemoveActiveFilter={handleRemoveActiveFilter}
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
      focusPlace={focusPlace}
      travelsCount={travelsCount}
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
      isMobile={isMobile}
      openRightPanel={openRightPanel}
      isConnected={isConnected}
      mapReady={mapReady}
      shouldLoadOnboarding={shouldLoadOnboarding}
      mapUiApi={filtersPanelProps?.contextValue?.mapUiApi ?? null}
      overlayOptions={quickFilters.overlayOptions}
      enabledOverlays={enabledOverlays}
      onOverlayToggle={filtersPanelProps?.contextValue?.onOverlayToggle}
      onResetOverlays={filtersPanelProps?.contextValue?.onResetOverlays}
      radiusOptions={quickFilters.radiusOptions}
      radiusValue={currentRadius}
      onRadiusSelect={handleDesktopRadiusSelect}
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
