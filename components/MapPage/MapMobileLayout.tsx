import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, Text as RNText, useWindowDimensions, View } from 'react-native'
import { usePathname } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { LAYOUT } from '@/constants/layout'
import { formatRadiusLabel } from '@/constants/mapConfig'
import { formatPlaces } from '@/utils/pluralize'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useMapMobileDerivations } from '@/hooks/map/useMapMobileDerivations'
import { FiltersSkeleton } from '@/components/ui/SkeletonLoader'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles'
import { MapMobileSheetBody } from './MapMobile/MapMobileSheetBody'
import { MapMobileTopOverlay } from './MapMobile/MapMobileTopOverlay'
import MapPlaceBottomCard from './MapPlaceBottomCard'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'
// Что показываем в шторке, когда она открыта (по запросу пользователя).
type SheetContentKind = 'list' | 'filters' | 'route'
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
  const filtersMode: FiltersMode | undefined = filtersContextProps?.mode
  const setFiltersMode: ((m: FiltersMode) => void) | undefined =
    filtersContextProps?.setMode
  const onFilterChange:
    | ((field: string, value: unknown) => void)
    | undefined = filtersContextProps?.onFilterChange

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
    bottomSheetRef.current?.snapToHalf()
  }, [clearSelectedPlace])

  // Все on-demand шторки (список/фильтры/маршрут) открываются на ОДНОЙ высоте
  // (half) — единый предсказуемый размер окна; пользователь тянет вверх до full.
  const openFiltersSheet = useCallback(() => {
    clearSelectedPlace?.()
    setFiltersMode?.('radius')
    setSheetContent('filters')
    bottomSheetRef.current?.snapToHalf()
    onOpenFilters()
  }, [onOpenFilters, setFiltersMode, clearSelectedPlace])

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

  const {
    filterToolbarSummary,
    activeRadius,
    topCategoryChips,
    hasMoreCategories,
    selectedCategories,
  } = derivations

  // Мгновенный toggle категории прямо с чипа верхнего overlay.
  const handleToggleCategory = useCallback(
    (id: string) => {
      if (!onFilterChange) return
      const current = Array.isArray(
        filtersContextProps?.filterValue?.categoryTravelAddress,
      )
        ? (filtersContextProps!.filterValue!
            .categoryTravelAddress as unknown[]).map((v) => String(v))
        : []
      const exists = current.includes(id)
      const next = exists
        ? current.filter((v) => v !== id)
        : [...current, id]
      onFilterChange('categoryTravelAddress', next)
    },
    [onFilterChange, filtersContextProps],
  )

  const radiusChipLabel = useMemo(
    () => formatRadiusLabel(activeRadius),
    [activeRadius],
  )

  const searchSummary = useMemo(() => {
    if (selectedCategories.length > 0) return filterToolbarSummary
    return 'Искать места'
  }, [filterToolbarSummary, selectedCategories.length])

  // #207 — when a marker is selected, collapse the on-demand sheet so the bottom
  // card is not covered. Opening any sheet (list/filters/route) clears the card.
  const hasSelectedPlace = !!selectedPlace
  useEffect(() => {
    if (hasSelectedPlace) bottomSheetRef.current?.snapToCollapsed()
  }, [hasSelectedPlace])

  const handleClearSelectedPlace = useCallback(() => {
    clearSelectedPlace?.()
  }, [clearSelectedPlace])

  const isCollapsed = sheetState === 'collapsed'

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

  const sheetContentNode = (
    <View style={styles.sheetRoot}>
      <View style={styles.sheetSheetHeader}>
        <RNText style={styles.sheetSheetTitle} numberOfLines={1}>
          {sheetContent === 'list'
            ? formatPlaces(travelsData.length)
            : sheetContent === 'route'
              ? 'Маршрут'
              : 'Фильтры и поиск'}
        </RNText>
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
    <GestureHandlerRootView
      style={styles.container}
      testID="map-mobile-layout"
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      <View style={styles.mapContainer}>
        {mapComponent}

        {/* maps.me-style верхний overlay: поиск + фильтры + чипы. Всегда виден,
            пока шторка не открыта на full (чтобы не накладываться на контент). */}
        {sheetState !== 'full' && (
          <MapMobileTopOverlay
            colors={colors}
            topInset={insets.top}
            searchSummary={searchSummary}
            radiusLabel={radiusChipLabel}
            categoryChips={topCategoryChips}
            hasMoreCategories={hasMoreCategories}
            onOpenSearch={openFiltersSheet}
            onOpenFilters={openFiltersSheet}
            onOpenRadius={openFiltersSheet}
            onToggleCategory={handleToggleCategory}
          />
        )}

        {/* Locate FAB справа снизу. */}
        <Pressable
          testID="map-center-user-quick"
          onPress={onCenterOnUser}
          accessibilityRole="button"
          accessibilityLabel="Показать мое местоположение"
          style={({ pressed }) => [styles.locateFab, pressed && { opacity: 0.8 }]}
        >
          <Feather name="crosshair" size={20} color={colors.primary} />
        </Pressable>

        {/* «Списком · N» — единственный вход в список. Виден, когда шторка
            свёрнута и не открыта карточка места. */}
        {isCollapsed && !hasSelectedPlace && (
          <Pressable
            testID="map-mobile-open-list"
            onPress={openList}
            accessibilityRole="button"
            accessibilityLabel={`Показать список — ${formatPlaces(travelsData.length)}`}
            style={({ pressed }) => [
              styles.listButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather name="list" size={16} color={colors.textOnPrimary} />
            <RNText style={styles.listButtonText} numberOfLines={1}>
              Списком · {travelsData.length > 999 ? '999+' : travelsData.length}
            </RNText>
          </Pressable>
        )}

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
    </GestureHandlerRootView>
  )
}
