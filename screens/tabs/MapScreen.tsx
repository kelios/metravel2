import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { getUserFriendlyNetworkError } from '@/utils/networkErrorHandler'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { useMapScreenController } from '@/hooks/useMapScreenController'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'
import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { MAP_SEO_TITLE, MAP_SEO_DESCRIPTION } from '@/constants/mapSeo'
import { buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { createMapStructuredData } from '@/utils/discoverySeo'

const IS_WEB = Platform.OS === 'web'
const MAP_STRUCTURED_DATA_ENTRY_LIMIT = 12
const BADGE_COUNT_CAP = 999
const RADIUS_EXPAND_MAX_KM = 500
const RADIUS_EXPAND_DEFAULT = 30
const ONBOARDING_DEFER_MS = 600
const ONBOARDING_IDLE_TIMEOUT = 1000

const PRESSED_OPACITY_07 = { opacity: 0.7 } as const
const PRESSED_OPACITY_085 = { opacity: 0.85 } as const
const PRESSED_OPACITY_06 = { opacity: 0.6 } as const
const POINTER_EVENTS_NONE = { pointerEvents: 'none' } as const

if (IS_WEB) {
  import('@/utils/loadLeafletRuntime').then((m) => m.loadLeafletRuntime()).catch(() => {})
}

const LazyMapOnboarding = lazy(() => import('@/components/MapPage/MapOnboarding'))
const LazyTravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'))
const LazyMapMobileLayout = lazy(() =>
  import('@/components/MapPage/MapMobileLayout').then((mod) => ({ default: mod.MapMobileLayout })),
)
const LazyMapQuickFilters = lazy(() =>
  import('@/components/MapPage/MapQuickFilters').then((mod) => ({ default: mod.MapQuickFilters })),
)
const LazyActiveFiltersBar = lazy(() =>
  import('@/components/MapPage/ActiveFiltersBar').then((mod) => ({ default: mod.ActiveFiltersBar })),
)

const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

const ROOT_MAP_PROPS = IS_WEB
  ? ({ testID: 'map-screen-root', 'data-testid': 'map-screen-root', 'data-active': 'true' } as any)
  : ({ testID: 'map-screen-root' } as any)

const TRANSPORT_LABELS: Record<string, string> = { bike: 'Велосипед', foot: 'Пешком' }

function CollapsedIconButton({
  icon,
  label,
  title,
  onPress,
  styles,
  iconColor,
  badge,
  badgeStyles,
}: {
  icon: 'search' | 'navigation' | 'list'
  label: string
  title: string
  onPress: () => void
  styles: any
  iconColor: string
  badge?: number
  badgeStyles?: { container: any; text: any }
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.collapsedIconBtn, pressed && PRESSED_OPACITY_07]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...({ title } as any)}
    >
      <Feather name={icon} size={18} color={iconColor} />
      {badge != null && badge > 0 && badgeStyles && (
        <View style={badgeStyles.container}>
          <Text style={badgeStyles.text}>
            {badge > BADGE_COUNT_CAP ? `${BADGE_COUNT_CAP}+` : badge}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

function buildQuickFiltersData(filtersPanelProps: any, currentRadius: string | number | undefined) {
  const ctx = filtersPanelProps?.contextValue
  const filterValue = ctx?.filterValue ?? {}
  const filters = ctx?.filters ?? {}

  const selected: string[] = filterValue?.categoryTravelAddress ?? []
  const radiusOptions = filters?.radius ?? []
  const categoryOptions = filters?.categoryTravelAddress ?? []
  const overlayOptions = ctx?.overlayOptions ?? []
  const enabledOverlays = ctx?.enabledOverlays ?? {}

  const categoriesValue =
    selected.length === 0
      ? 'Все'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} выбрано`

  const radiusValue = currentRadius ? `${currentRadius} км` : `${DEFAULT_RADIUS_KM} км`

  const enabledCount = overlayOptions.filter((option: { id: string }) =>
    Boolean(enabledOverlays?.[option.id]),
  ).length
  const overlaysValue =
    enabledCount === 0 ? 'Выкл' : enabledCount === 1 ? '1 вкл' : `${enabledCount} вкл`

  return {
    selected,
    radiusOptions,
    categoryOptions,
    overlayOptions,
    enabledOverlays,
    categoriesValue,
    radiusValue,
    overlaysValue,
  }
}

export default function MapScreen() {
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
    zoomIn,
    zoomOut,
    panelRef,
    geoError,
    coordinates,
    transportMode,
  } = useMapScreenController()

  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false)
  const [shouldLoadOnboarding, setShouldLoadOnboarding] = useState(false)
  const dismissGeoBanner = useCallback(() => setGeoBannerDismissed(true), [])
  const showGeoBanner = Boolean(geoError && !geoBannerDismissed)

  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const previousOverflowY = document.body.style.overflowY
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.style.overflowY = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overflowY = previousOverflowY
    }
  }, [])

  useEffect(() => {
    if (!geoError && geoBannerDismissed) setGeoBannerDismissed(false)
  }, [geoError, geoBannerDismissed])

  useEffect(() => {
    if (shouldLoadOnboarding) return
    if (!IS_WEB) {
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
  }, [shouldLoadOnboarding])

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
    if (!IS_WEB || !isFocused) return null
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
  }, [canonical, isFocused, travelsData])

  const mapSeoTags = useMemo(() => {
    if (!IS_WEB || !mapStructuredData) return undefined
    return (
      <script
        key="map-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mapStructuredData) }}
      />
    )
  }, [mapStructuredData])

  const seoBlock = useMemo(() => {
    if (!IS_WEB || !isFocused) return null
    return (
      <InstantSEO
        headKey={mapError ? 'map-error' : 'map'}
        title={MAP_SEO_TITLE}
        description={MAP_SEO_DESCRIPTION}
        canonical={canonical}
        image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
        additionalTags={mapSeoTags}
      />
    )
  }, [isFocused, mapError, canonical, mapSeoTags])

  const handleResizeMouseDown = useCallback(
    (e: any) => {
      if (!IS_WEB || isMobile) return
      e.preventDefault()
      const startX = e.clientX
      const startW = desktopPanelWidth
      const onMove = (ev: MouseEvent) => onResizePanelWidth(startW + ev.clientX - startX)
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [isMobile, desktopPanelWidth, onResizePanelWidth],
  )

  const openNonce = useMapPanelStore((s) => s.openNonce)
  const requestedOpenTab = useMapPanelStore((s) => s.requestedTab)

  const openRightPanelRef = useRef(openRightPanel)
  useEffect(() => {
    openRightPanelRef.current = openRightPanel
  }, [openRightPanel])

  useEffect(() => {
    if (!openNonce) return
    if (requestedOpenTab === 'list') selectTravelsTab()
    else selectFiltersTab()
    openRightPanelRef.current()
  }, [openNonce, requestedOpenTab, selectFiltersTab, selectTravelsTab])

  const currentRadius = filtersPanelProps?.contextValue?.filterValue?.radius ?? ''
  const quickFilters = useMemo(
    () => buildQuickFiltersData(filtersPanelProps, currentRadius),
    [filtersPanelProps, currentRadius],
  )

  const mapQuickActionButtons = useMemo(
    () => [
      { key: 'locate', label: 'Мое местоположение', icon: 'crosshair' as const, onPress: centerOnUser, testID: 'map-center-user-inline' },
      { key: 'zoom-in', label: 'Приблизить', icon: 'plus' as const, onPress: zoomIn, testID: 'map-zoom-in-inline' },
      { key: 'zoom-out', label: 'Отдалить', icon: 'minus' as const, onPress: zoomOut, testID: 'map-zoom-out-inline' },
    ],
    [centerOnUser, zoomIn, zoomOut],
  )

  const currentTransport = transportMode ?? 'car'
  const currentMode = filtersPanelProps?.contextValue?.mode
  const activeFilterItems = useMemo(() => {
    const items: { key: string; label: string }[] = []
    quickFilters.selected.forEach((cat: string) => items.push({ key: `cat:${cat}`, label: cat }))
    const radiusVal = currentRadius || String(DEFAULT_RADIUS_KM)
    items.push({ key: 'radius', label: `${radiusVal} км` })
    if (currentMode === 'route' && currentTransport !== 'car') {
      items.push({ key: 'transport', label: TRANSPORT_LABELS[currentTransport] ?? currentTransport })
    }
    return items
  }, [quickFilters.selected, currentRadius, currentMode, currentTransport])

  const handleRemoveActiveFilter = useCallback(
    (key: string) => {
      const ctx = filtersPanelProps?.contextValue
      const onChange = ctx?.onFilterChange
      if (!onChange) return
      if (key.startsWith('cat:')) {
        const catName = key.slice(4)
        const current: string[] = ctx?.filterValue?.categoryTravelAddress ?? []
        onChange('categoryTravelAddress', current.filter((c: string) => c !== catName))
      } else if (key === 'radius') {
        onChange('radius', String(DEFAULT_RADIUS_KM))
      } else if (key === 'transport') {
        ctx?.setTransportMode?.('car')
      }
    },
    [filtersPanelProps?.contextValue],
  )

  const handleClearAllFilters = useCallback(() => {
    filtersPanelProps?.contextValue?.resetFilters?.()
  }, [filtersPanelProps?.contextValue])

  const requestOpenBottomSheet = useMapPanelStore((s) => s.requestOpen)

  const handleExpandRadius = useCallback(() => {
    const onChange = filtersPanelProps?.contextValue?.onFilterChange
    if (!onChange) return
    const current = Number(filtersPanelProps?.contextValue?.filterValue?.radius) || RADIUS_EXPAND_DEFAULT
    onChange('radius', String(Math.min(current * 2, RADIUS_EXPAND_MAX_KM)))
  }, [filtersPanelProps?.contextValue])

  const resetFiltersForPanel = filtersPanelProps?.contextValue?.resetFilters
  const setPanelMode = filtersPanelProps?.contextValue?.setMode

  const handleSelectSearchTab = useCallback(() => {
    useRouteStore.getState().clearRouteAndSetMode('radius')
    selectFiltersTab()
  }, [selectFiltersTab])

  const handleSelectRouteTab = useCallback(() => {
    setPanelMode?.('route')
    selectFiltersTab()
  }, [setPanelMode, selectFiltersTab])

  const activePanelTab: 'search' | 'route' | 'travels' =
    rightPanelTab === 'travels' ? 'travels' : currentMode === 'route' ? 'route' : 'search'

  const shouldShowFloatingRadiusPill = Boolean(currentRadius && !IS_WEB)

  const onFilterChange = filtersPanelProps?.contextValue?.onFilterChange
  const onOverlayToggle = filtersPanelProps?.contextValue?.onOverlayToggle
  const onResetOverlays = filtersPanelProps?.contextValue?.onResetOverlays

  const mapComponent = useMemo(
    () => (
      <View style={styles.mapArea}>
        <MapLoadingBar visible={isFetching || isDebouncingFilters} />
        {IS_WEB && !isMobile && (
          <Suspense fallback={null}>
            <LazyMapQuickFilters
              extraActions={mapQuickActionButtons}
              extraActionsPosition="inside-radius"
              radiusValue={quickFilters.radiusValue}
              categoriesValue={quickFilters.categoriesValue}
              overlaysValue={quickFilters.overlaysValue}
              radiusOptions={quickFilters.radiusOptions}
              radiusSelected={currentRadius}
              onChangeRadius={(next) => onFilterChange?.('radius', next)}
              categoriesOptions={quickFilters.categoryOptions}
              categoriesSelected={quickFilters.selected}
              onChangeCategories={(next) => onFilterChange?.('categoryTravelAddress', next)}
              overlayOptions={quickFilters.overlayOptions}
              enabledOverlays={quickFilters.enabledOverlays}
              onChangeOverlay={(id, enabled) => onOverlayToggle?.(id, enabled)}
              onResetOverlays={onResetOverlays}
              travelsData={travelsData}
            />
          </Suspense>
        )}
        {mapReady ? (
          <MapPanel {...mapPanelProps} hideFloatingControls={isMobile} />
        ) : (
          MAP_PANEL_PLACEHOLDER
        )}
        {shouldShowFloatingRadiusPill && (
          <Pressable
            style={styles.radiusPill}
            accessibilityRole="button"
            accessibilityLabel={`Радиус поиска: ${currentRadius} км. Нажмите, чтобы изменить`}
            testID="map-radius-pill"
            onPress={() => {
              handleSelectSearchTab()
              openRightPanel()
            }}
            hitSlop={8}
          >
            <Feather name="radio" size={12} color={themedColors.primary} />
            <Text style={styles.radiusPillText}>{currentRadius} км</Text>
            <Feather name="chevron-down" size={11} color={themedColors.textMuted} />
          </Pressable>
        )}
        {showGeoBanner && (
          <View style={styles.geoBanner} testID="map-geo-banner">
            <Feather name="map-pin" size={13} color={themedColors.warning} />
            <Text style={styles.geoBannerText}>
              Геолокация недоступна — разрешите доступ в настройках браузера
            </Text>
            <Pressable
              onPress={dismissGeoBanner}
              accessibilityRole="button"
              accessibilityLabel="Закрыть уведомление"
              hitSlop={10}
              style={({ pressed }) => [styles.geoBannerClose, pressed && PRESSED_OPACITY_06]}
            >
              <Feather name="x" size={12} color={themedColors.textMuted} />
            </Pressable>
          </View>
        )}
      </View>
    ),
    [
      isFetching,
      isDebouncingFilters,
      isMobile,
      mapPanelProps,
      mapReady,
      travelsData,
      quickFilters,
      mapQuickActionButtons,
      currentRadius,
      shouldShowFloatingRadiusPill,
      onFilterChange,
      onOverlayToggle,
      onResetOverlays,
      styles,
      showGeoBanner,
      dismissGeoBanner,
      themedColors,
      handleSelectSearchTab,
      openRightPanel,
    ],
  )

  if (isMobile) {
    return (
      <View style={styles.container} {...ROOT_MAP_PROPS}>
        {seoBlock}
        <Suspense fallback={MAP_PANEL_PLACEHOLDER}>
          <LazyMapMobileLayout
            mapComponent={mapComponent}
            travelsData={travelsData}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onRefresh={refetchMapData}
            isRefreshing={isFetching && isPlaceholderData}
            coordinates={coordinates}
            transportMode={transportMode}
            buildRouteTo={buildRouteTo}
            onCenterOnUser={centerOnUser}
            onOpenFilters={() => {
              handleSelectSearchTab()
              requestOpenBottomSheet('filters')
            }}
            filtersPanelProps={filtersPanelProps}
            onResetFilters={handleClearAllFilters}
            onExpandRadius={handleExpandRadius}
            quickActionButtons={mapQuickActionButtons}
          />
        </Suspense>
      </View>
    )
  }

  if (mapError) {
    const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError)
    const friendlyMessage = (friendly as any)?.message ?? String(friendly || '')
    const offlineMessage =
      'Нет подключения к интернету. Карта загрузится автоматически, как только соединение восстановится.'
    const effectiveMessage = !isConnected
      ? offlineMessage
      : friendlyMessage || 'Проверьте соединение и попробуйте ещё раз'
    return (
      <View style={styles.container} {...ROOT_MAP_PROPS}>
        {seoBlock}
        <ErrorDisplay
          title={!isConnected ? 'Нет подключения' : 'Не удалось загрузить карту'}
          message={effectiveMessage}
          isNetworkError={!isConnected}
          onRetry={() => {
            invalidateTravelsQuery()
            refetchMapData()
          }}
        />
      </View>
    )
  }

  const showDesktopCollapsedStrip = !isMobile && isDesktopCollapsed && IS_WEB
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
              icon="search"
              label="Поиск"
              title="Поиск мест"
              onPress={() => {
                toggleDesktopCollapse()
                handleSelectSearchTab()
              }}
              styles={styles}
              iconColor={themedColors.textMuted}
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
          </View>
        )}

        {showDesktopExpandedPanel && (
          <Animated.View
            ref={panelRef}
            style={[
              styles.rightPanel,
              panelStyle,
              !isMobile && IS_WEB ? { width: desktopPanelWidth } : null,
            ]}
          >
            {!isMobile && IS_WEB && (
              <View
                testID="map-panel-resize-handle"
                style={styles.resizeHandle}
                onStartShouldSetResponder={() => true}
                {...({ onMouseDown: handleResizeMouseDown } as any)}
              />
            )}
            {!isMobile && IS_WEB && (
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
                <LazyActiveFiltersBar
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
                  {...(IS_WEB ? ({ 'data-testid': 'map-travels-tab' } as any) : null)}
                  style={{ flex: 1 }}
                >
                  <Suspense fallback={<ActivityIndicator style={{ paddingVertical: 32 }} color={themedColors.primary} />}>
                    <LazyTravelListPanel
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

      {!IS_WEB && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && PRESSED_OPACITY_085]}
          onPress={openRightPanel}
          accessibilityRole="button"
          accessibilityLabel="Фильтры и список мест"
        >
          <Feather name="sliders" size={22} color={themedColors.textOnPrimary} />
        </Pressable>
      )}

      {!mapReady && (
        <View style={[styles.loadingOverlay, POINTER_EVENTS_NONE]} testID="map-loading-overlay">
          <ActivityIndicator color={themedColors.primary} accessibilityLabel="Загрузка карты" />
        </View>
      )}

      {shouldLoadOnboarding && (
        <Suspense fallback={null}>
          <LazyMapOnboarding mobileWebCoachmark={IS_WEB && isMobile} />
        </Suspense>
      )}
    </View>
  )
}
