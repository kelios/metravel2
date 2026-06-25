import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, Text as RNText, useWindowDimensions, View } from 'react-native'
import { usePathname } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { LAYOUT } from '@/constants/layout'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'
import { useMapMobileDerivations } from '@/hooks/map/useMapMobileDerivations'
import { FiltersSkeleton } from '@/components/ui/SkeletonLoader'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles'
import { MapMobileSheetBody } from './MapMobile/MapMobileSheetBody'
import { MapMobileTopOverlay } from './MapMobile/MapMobileTopOverlay'
import MapPlaceBottomCard from './MapPlaceBottomCard'
import { getPlacesLabel, PLACE_COUNT_BADGE_CAP } from './TravelListPanel/helpers'
import type { TransportMode } from './transportModes'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'seventy' | 'full'
// Что показываем в шторке, когда она открыта (по запросу пользователя).
type SheetContentKind = 'list' | 'filters' | 'route'
type FiltersMode = 'radius' | 'route'

interface MapMobileLayoutProps {
  travelsData: any[]
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  isLoading?: boolean
  isRefreshing?: boolean
  coordinates: { latitude: number; longitude: number } | null
  transportMode: 'car' | 'bike' | 'foot'
  buildRouteTo: (item: any) => void
  focusPlace?: (item: any) => void
  totalCount?: number
  onCenterOnUser: () => void
  // F-49 — Google-Maps-style "Search this area" affordance.
  canSearchThisArea?: boolean
  onSearchThisArea?: () => void
  onOpenFilters: () => void
  filtersPanelProps: any
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
  onResetFilters?: () => void
  onExpandRadius?: () => void
  // #207 — selected single marker → maps.me-style bottom card.
  selectedPlace?: any | null
  clearSelectedPlace?: () => void
  selectedPlaceUserLocation?: { latitude: number; longitude: number } | null
}

const IS_WEB = Platform.OS === 'web'
const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 430
const PHONE_COMPACT_ACTIONS_MAX_WIDTH = 520
const PHONE_STACKED_TOOLBAR_MAX_WIDTH = 360
const WEB_MOBILE_BOTTOM_DOCK_INSET = 104
const WEB_MOBILE_CONSENT_BANNER_INSET = 112
const NATIVE_MOBILE_BOTTOM_DOCK_INSET = (LAYOUT?.tabBarHeight ?? 56) + 16

export const MapMobileLayout: React.FC<MapMobileLayoutProps> = ({
  travelsData,
  hasMore,
  onLoadMore,
  onRefresh,
  isLoading,
  isRefreshing,
  coordinates,
  transportMode,
  buildRouteTo,
  focusPlace,
  totalCount,
  onCenterOnUser,
  canSearchThisArea,
  onSearchThisArea,
  onOpenFilters,
  filtersPanelProps,
  onToggleFavorite,
  favorites,
  onResetFilters,
  onExpandRadius,
  selectedPlace,
  clearSelectedPlace,
  selectedPlaceUserLocation,
}) => {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { width: viewportWidth } = useWindowDimensions()
  const isNarrow = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
  const compactSheetActions = viewportWidth <= PHONE_COMPACT_ACTIONS_MAX_WIDTH
  const stackSheetToolbar = viewportWidth <= PHONE_STACKED_TOOLBAR_MAX_WIDTH

  const bottomSheetRef = useRef<MapBottomSheetRef>(null)
  const pathname = usePathname()
  const isActiveWebRoute =
    IS_WEB && (pathname === '/map' || String(pathname).startsWith('/map/'))
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  // Контент шторки = list (по умолчанию) | filters (поиск/радиус/категории) | route.
  const [sheetContent, setSheetContent] = useState<SheetContentKind>('list')
  // Какой компактный поповер верхнего тулбара открыт (радиус/слои/транспорт) — или ни один.
  const [activePopover, setActivePopover] = useState<
    'radius' | 'layers' | 'transport' | null
  >(null)
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

  const commandNonce = useMapPanelStore((s) => s.commandNonce)
  const command = useMapPanelStore((s) => s.command)

  const setBottomSheetState = useBottomSheetStore((s) => s.setState)

  const filtersContextProps =
    filtersPanelProps?.props ?? filtersPanelProps?.contextValue
  // #597 — toolbar mode/transport read straight from the store so the floating
  // controls react to clearRouteAndSetMode/setMode without waiting on the
  // memoized filters slice to re-flow down through props.
  const storeMode = useRouteStore((s) => s.mode)
  const storeTransportMode = useRouteStore((s) => s.transportMode)
  const filtersMode: FiltersMode | undefined =
    (filtersContextProps?.mode as FiltersMode | undefined) ?? storeMode
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

  const openList = useCallback(() => {
    clearSelectedPlace?.()
    setSheetContent('list')
    bottomSheetRef.current?.snapToSeventy()
  }, [clearSelectedPlace])

  // Иконки верхнего overlay (радиус/слои/фильтры) открывают шит фильтров на ~70%
  // высоты экрана — единый предсказуемый размер окна; пользователь тянет вверх до
  // full. Автофокус поля поиска по тапу НЕ запрашиваем: поиск теперь внутри
  // «Фильтров», клавиатура поднимается только при ручном тапе по полю
  // (keyboard-avoidance сохранён в самом шите).
  const openFiltersSheet = useCallback(() => {
    setActivePopover(null)
    clearSelectedPlace?.()
    setFiltersMode?.('radius')
    setSheetContent('filters')
    bottomSheetRef.current?.snapToSeventy()
    onOpenFilters()
  }, [onOpenFilters, setFiltersMode, clearSelectedPlace])

  const closePopover = useCallback(() => setActivePopover(null), [])

  // Радиус/Слои теперь компактные поповеры под иконкой (не шит на 70%): тогглим
  // локальный state; повторный тап по той же иконке закрывает поповер.
  const toggleRadiusPopover = useCallback(() => {
    clearSelectedPlace?.()
    setActivePopover((prev) => (prev === 'radius' ? null : 'radius'))
  }, [clearSelectedPlace])

  const toggleLayersPopover = useCallback(() => {
    clearSelectedPlace?.()
    setActivePopover((prev) => (prev === 'layers' ? null : 'layers'))
  }, [clearSelectedPlace])

  const openRouteSheet = useCallback(() => {
    clearSelectedPlace?.()
    setFiltersMode?.('route')
    setSheetContent('route')
    bottomSheetRef.current?.snapToHalf()
  }, [setFiltersMode, clearSelectedPlace])

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  // Single command handler for the unified panel stream (open / toggle / collapse).
  // Гард по nonce: эффект зависит от нестабильных колбэков (open*Sheet → setMode из
  // filtersContextProps, новая ссылка каждый рендер), поэтому обрабатываем каждую
  // команду РОВНО один раз на новый commandNonce — иначе бесконечный setState-цикл.
  const lastHandledCommandNonceRef = useRef(0)
  useEffect(() => {
    if (!commandNonce) return
    if (commandNonce === lastHandledCommandNonceRef.current) return
    lastHandledCommandNonceRef.current = commandNonce
    const sheet = bottomSheetRef.current

    if (command.kind === 'collapse') {
      if (sheetStateRef.current === 'collapsed') return
      sheet?.snapToCollapsed()
      return
    }

    if (command.kind === 'toggle') {
      if (sheetStateRef.current === 'collapsed') {
        openList()
      } else {
        sheet?.snapToCollapsed()
      }
      return
    }

    // command.kind === 'open'
    if (command.tab === 'list') {
      openList()
      return
    }
    if (filtersMode === 'route') {
      openRouteSheet()
    } else {
      openFiltersSheet()
    }
  }, [
    commandNonce,
    command,
    filtersMode,
    openList,
    openFiltersSheet,
    openRouteSheet,
  ])

  // Вход в режим маршрута: когда из карточки места добавлена точка (filtersMode
  // переключился на 'route'), показываем построитель маршрута в шторке.
  const prevFiltersModeRef = useRef<FiltersMode | undefined>(filtersMode)
  useEffect(() => {
    const prev = prevFiltersModeRef.current
    prevFiltersModeRef.current = filtersMode
    if (filtersMode === 'route' && prev !== 'route') {
      setSheetContent('route')
      bottomSheetRef.current?.snapToHalf()
    }
  }, [filtersMode])

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

  const derivations = useMapMobileDerivations(
    filtersContextProps,
    filtersMode,
    travelsData,
    isNarrow,
  )

  const { activeRadius, quickRadiusOptions, quickOverlayOptions, quickEnabledOverlays } =
    derivations

  // Бейдж на кнопке радиуса — короткое число (напр. «50»), без единиц.
  const radiusBadge = useMemo(() => {
    const n = Number(activeRadius)
    return Number.isFinite(n) && n > 0 ? String(n) : ''
  }, [activeRadius])

  // Бейдж на кнопке «Список» — количество мест рядом (cap 999+). Показываем
  // общее число (totalCount) от бэкенда, а не длину загруженной страницы.
  const displayCount = totalCount ?? travelsData.length
  const listBadge = useMemo(() => {
    const n = displayCount
    if (!n) return ''
    return n > 999 ? '999+' : String(n)
  }, [displayCount])
  const currentRadiusKm = filtersContextProps?.filterValue?.radius ?? null
  const listHeaderSummaryText = useMemo(() => {
    const placesCountLabel =
      displayCount > PLACE_COUNT_BADGE_CAP
        ? `${PLACE_COUNT_BADGE_CAP}+`
        : String(displayCount)
    const hasRadiusContext =
      currentRadiusKm != null && String(currentRadiusKm).trim() !== ''

    return `${placesCountLabel} ${getPlacesLabel(displayCount)}${hasRadiusContext ? ` · ${currentRadiusKm} км` : ''}`
  }, [currentRadiusKm, displayCount])

  // Радиус-поповер и слои-поповер переиспользуют ту же модель, что и шит:
  // onFilterChange('radius', id) и контролируемое состояние оверлеев из контекста.
  const onFilterChange = filtersContextProps?.onFilterChange as
    | ((field: string, value: unknown) => void)
    | undefined
  const handleRadiusSelect = useCallback(
    (id: string) => {
      onFilterChange?.('radius', id)
    },
    [onFilterChange],
  )
  const onOverlayToggle = filtersContextProps?.onOverlayToggle as
    | ((id: string, enabled: boolean) => void)
    | undefined
  const onResetOverlays = filtersContextProps?.onResetOverlays as (() => void) | undefined
  const mapUiApi = filtersContextProps?.mapUiApi ?? null

  // Route building (#597) — actions read straight from routeStore (same store the
  // desktop filters sheet drives): setMode/setTransportMode flip mode/profile,
  // clearRouteAndSetMode atomically clears points + returns to radius.
  const routeMode = storeMode
  const routeTransportMode = storeTransportMode as TransportMode
  const storeSetMode = useRouteStore((s) => s.setMode)
  const storeSetTransportMode = useRouteStore((s) => s.setTransportMode)
  const clearRouteAndSetMode = useRouteStore((s) => s.clearRouteAndSetMode)
  const routePointCount = useRouteStore((s) => s.points.length)

  const enterRouteMode = useCallback(() => {
    clearSelectedPlace?.()
    setActivePopover(null)
    storeSetMode('route')
    setFiltersMode?.('route')
  }, [clearSelectedPlace, storeSetMode, setFiltersMode])

  const toggleTransportPopover = useCallback(() => {
    setActivePopover((prev) => (prev === 'transport' ? null : 'transport'))
  }, [])

  const handleTransportSelect = useCallback(
    (m: TransportMode) => {
      storeSetTransportMode(m)
    },
    [storeSetTransportMode],
  )

  const handleClearRoute = useCallback(() => {
    setActivePopover(null)
    clearRouteAndSetMode('radius')
    setFiltersMode?.('radius')
    // Close the route sheet too: while its body (RouteBuilder/route provider)
    // stays mounted it re-asserts mode='route', so leaving it open would flip the
    // toolbar straight back into route mode after the clear.
    setSheetContent('list')
    bottomSheetRef.current?.snapToCollapsed()
  }, [clearRouteAndSetMode, setFiltersMode])

  // #207 — when a marker is selected, collapse the on-demand sheet so the bottom
  // card is not covered. Opening any sheet (list/filters/route) clears the card.
  const hasSelectedPlace = !!selectedPlace
  useEffect(() => {
    if (hasSelectedPlace) {
      bottomSheetRef.current?.snapToCollapsed()
      setActivePopover(null)
    }
  }, [hasSelectedPlace])

  const handleClearSelectedPlace = useCallback(() => {
    clearSelectedPlace?.()
  }, [clearSelectedPlace])

  // F-49 — "Искать в этой области" видна только когда есть значимый сдвиг карты,
  // шторка закрыта и не открыта карточка места. В открытой шторке кнопка
  // оказывается поверх карточек списка на Android.
  const showSearchAreaButton =
    !!canSearchThisArea &&
    !!onSearchThisArea &&
    sheetState === 'collapsed' &&
    !hasSelectedPlace

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

  // uiTab для тела шторки: list → список; filters/route → провайдер фильтров.
  const bodyUiTab = sheetContent === 'list' ? 'list' : 'search'
  const showSheetHeader = sheetContent !== 'list'
  const showListHeaderSummary = sheetContent === 'list' && travelsData.length > 0

  const sheetContentNode = (
    <View style={styles.sheetRoot}>
      <View style={styles.sheetSheetHeader}>
        {showListHeaderSummary ? (
          <View
            style={styles.sheetListHeaderContent}
            testID="travel-list-mobile-summary"
          >
            <RNText style={styles.sheetListTitle} numberOfLines={1}>
              Места рядом
            </RNText>
            <View style={styles.sheetListCountChip}>
              <RNText style={styles.sheetListCountChipText} numberOfLines={1}>
                {listHeaderSummaryText}
              </RNText>
            </View>
            <Pressable
              testID="travel-list-open-filters"
              onPress={openFiltersSheet}
              accessibilityRole="button"
              accessibilityLabel="Открыть фильтры"
              hitSlop={8}
              style={({ pressed }) => [
                styles.sheetListFiltersButton,
                pressed && styles.sheetListFiltersButtonPressed,
              ]}
            >
              <Feather name="sliders" size={18} color={colors.primary} />
            </Pressable>
          </View>
        ) : showSheetHeader ? (
          <RNText style={styles.sheetSheetTitle} numberOfLines={1}>
            {sheetContent === 'route' ? 'Маршрут' : 'Фильтры и поиск'}
          </RNText>
        ) : (
          <View style={styles.sheetHeaderSpacer} />
        )}
        <Pressable
          testID="map-mobile-sheet-close"
          onPress={handleCloseSheet}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          hitSlop={8}
          style={({ pressed }) => [
            styles.sheetCloseButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.sheetBody}>
        <MapMobileSheetBody
          uiTab={bodyUiTab}
          sheetState={sheetState}
          travelsData={travelsData}
          buildRouteTo={buildRouteTo}
          onSelectPlace={focusPlace}
          totalCount={totalCount}
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
          onOpenList={openList}
          onBackToMap={handleCloseSheet}
          onOpenSearch={openFiltersSheet}
          filtersPanelProps={filtersPanelProps}
          filtersContextProps={filtersContextProps}
          filtersLoadingFallback={filtersLoadingFallback}
          onProviderOpenList={openList}
        />
      </View>
    </View>
  )

  return (
    // #217 — the map node itself lives in the shared MapScreenShell (stable tree
    // position). This layout is an absolute overlay ON TOP of that map host: it
    // owns the maps.me-style chrome + bottom sheet, but never the map, so a
    // mobile↔desktop flip cannot unmount/remount Leaflet. `box-none` lets pan/
    // zoom reach the map underneath wherever there is no chrome.
    //
    // #217 (gesture layer) — this root is a PLAIN box-none View, NOT a
    // GestureHandlerRootView. The single RNGH root now lives in MapScreenShell as
    // an ancestor of BOTH this overlay and the map host, so empty-area touches
    // fall through this box-none overlay to the map sibling underneath (which is
    // inside the same gesture orchestrator). A GestureHandlerRootView here would
    // be an absoluteFill ReactViewGroup over the map and would swallow the
    // ACTION_DOWN before it reached the WebView sibling below.
    <View
      style={[styles.container, styles.overlayRoot]}
      testID="map-mobile-layout"
      {...({ pointerEvents: 'box-none' } as any)}
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      <View style={styles.mapContainer} {...({ pointerEvents: 'box-none' } as any)}>
        {/* maps.me-style верхний overlay: поиск + фильтры + чипы. Виден, пока
            шторка не открыта на full И не открыта карточка места (#497 — иначе
            иконки фильтров/слоёв/списка наезжают на hero-фото карточки места). */}
        {sheetState !== 'full' && !hasSelectedPlace && (
          <MapMobileTopOverlay
            colors={colors}
            topInset={insets.top}
            radiusBadge={radiusBadge}
            activePopover={activePopover}
            onToggleRadius={toggleRadiusPopover}
            onToggleLayers={toggleLayersPopover}
            onClosePopover={closePopover}
            onOpenFilters={openFiltersSheet}
            onCenterOnUser={onCenterOnUser}
            onOpenList={openList}
            listBadge={listBadge}
            radiusOptions={quickRadiusOptions}
            radiusValue={activeRadius}
            onRadiusSelect={handleRadiusSelect}
            mapUiApi={mapUiApi}
            overlayOptions={quickOverlayOptions}
            enabledOverlays={quickEnabledOverlays}
            onOverlayToggle={onOverlayToggle}
            onResetOverlays={onResetOverlays}
            mode={routeMode}
            transportMode={routeTransportMode}
            onEnterRouteMode={enterRouteMode}
            onToggleTransport={toggleTransportPopover}
            onTransportSelect={handleTransportSelect}
            onClearRoute={handleClearRoute}
            routePointCount={routePointCount}
          />
        )}

        {/* F-49 — «Искать в этой области» по центру СНИЗУ, над кнопкой «Списком»
            и нижним доком (как в Google/Organic Maps). Появляется при значимом
            сдвиге карты от текущего якоря. */}
        {showSearchAreaButton && (
          <Pressable
            testID="map-search-this-area"
            onPress={onSearchThisArea}
            accessibilityRole="button"
            accessibilityLabel="Искать в этой области"
            style={({ pressed }) => [
              styles.searchAreaButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather name="refresh-cw" size={15} color={colors.textOnPrimary} />
            <RNText style={styles.searchAreaButtonText} numberOfLines={1}>
              Искать в этой области
            </RNText>
          </Pressable>
        )}

        {/* Локация и «Список · N» перенесены в верхний icon-toolbar
            (MapMobileTopOverlay): нижний FAB локации и нижняя кнопка списка
            больше не рендерятся. «Искать в этой области» остаётся снизу. */}

        {/* #207 — maps.me-style bottom card for a tapped single marker. */}
        {hasSelectedPlace && (
          <MapPlaceBottomCard
            point={selectedPlace}
            userLocation={selectedPlaceUserLocation ?? coordinates}
            onClose={handleClearSelectedPlace}
            bottomInset={bottomSheetInset}
          />
        )}
      </View>

      <MapBottomSheet
        ref={bottomSheetRef}
        onStateChange={handleSheetStateChange}
        bottomInset={bottomSheetInset}
        scrollableContent={sheetContent !== 'list'}
      >
        {sheetContentNode}
      </MapBottomSheet>
    </View>
  )
}
