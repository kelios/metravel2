/**
 * MapMobileLayout - mobile map layout with bottom sheet flows.
 */

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  InteractionManager,
  Platform,
  Pressable,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { usePathname } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import Button from '@/components/ui/Button'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors } from '@/hooks/useTheme'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
import { MapPeekPreview } from './MapPeekPreview'
import { MapQuickFilters } from './MapQuickFilters'
import TravelListPanel from './TravelListPanel'
import { getMapMobileLayoutStyles } from './MapMobileLayout.styles'

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
const PHONE_COMPACT_ACTIONS_MAX_WIDTH = 420

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
  const stackSheetToolbar = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
  const bottomSheetRef = useRef<MapBottomSheetRef>(null)
  const pathname = usePathname()
  const isActiveWebRoute =
    Platform.OS === 'web' && (pathname === '/map' || String(pathname).startsWith('/map/'))
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  const [uiTab, setUiTab] = useState<'list' | 'filters'>('list')
  const [contentTab, setContentTab] = useState<'list' | 'filters'>('list')
  const [, startTransition] = useTransition()
  const sheetStateRef = useRef<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed')
  const [sheetState, setSheetState] = useState<'collapsed' | 'quarter' | 'half' | 'full'>('collapsed')
  const isSheetPreview = sheetState === 'quarter' && uiTab === 'list'
  const styles = useMemo(
    () => getMapMobileLayoutStyles(colors, { isNarrow, compactSheetActions, stackSheetToolbar, isSheetPreview }),
    [colors, isNarrow, compactSheetActions, stackSheetToolbar, isSheetPreview],
  )

  const openNonce = useMapPanelStore((s) => s.openNonce)
  const requestedOpenTab = useMapPanelStore((s) => s.requestedTab)
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce)

  const setBottomSheetState = useBottomSheetStore((s) => s.setState)
  const bottomSheetState = useBottomSheetStore((s) => s.state)
  const collapseNonce = useBottomSheetStore((s) => s.collapseNonce)

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
    const nextTab = requestedOpenTab === 'list' ? 'list' : 'filters'
    setUiTab(nextTab)
    setContentTab(nextTab)
    if (nextTab === 'list') {
      bottomSheetRef.current?.snapToHalf()
      return
    }
    bottomSheetRef.current?.snapToFull()
  }, [openNonce, requestedOpenTab])

  useEffect(() => {
    if (!toggleNonce) return
    if (sheetStateRef.current === 'collapsed') {
      setUiTab('list')
      setContentTab('list')
      bottomSheetRef.current?.snapToQuarter?.()
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
      setConsentBannerVisible(body.getAttribute('data-consent-banner-open') === 'true')
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

  const setTabDeferred = useCallback(
    (next: 'list' | 'filters') => {
      setUiTab(next)

      if (Platform.OS === 'web') {
        startTransition(() => {
          setContentTab(next)
        })
        return
      }

      InteractionManager.runAfterInteractions(() => {
        setContentTab(next)
      })
    },
    [startTransition],
  )

  const handlePlacePress = useCallback(
    (place: any) => {
      buildRouteTo(place)
      bottomSheetRef.current?.snapToCollapsed()
    },
    [buildRouteTo],
  )

  const handleOpenListPreview = useCallback(() => {
    setTabDeferred('list')
    bottomSheetRef.current?.snapToQuarter?.()
  }, [setTabDeferred])

  const handleOpenList = useCallback(() => {
    setTabDeferred('list')
    bottomSheetRef.current?.snapToHalf()
  }, [setTabDeferred])

  const handleToggleListPanel = useCallback(() => {
    if (sheetStateRef.current === 'collapsed') {
      handleOpenListPreview()
      return
    }
    bottomSheetRef.current?.snapToCollapsed()
  }, [handleOpenListPreview])

  const handleOpenFilters = useCallback(() => {
    setTabDeferred('filters')
    bottomSheetRef.current?.snapToFull()
    onOpenFilters()
  }, [onOpenFilters, setTabDeferred])

  const handleBackToMap = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  const handleCenterOnUserPress = useCallback(() => {
    onCenterOnUser()
  }, [onCenterOnUser])

  const filtersContextProps = filtersPanelProps?.props ?? filtersPanelProps?.contextValue
  const filtersMode: 'radius' | 'route' | undefined = filtersContextProps?.mode
  const setFiltersMode: ((m: 'radius' | 'route') => void) | undefined = filtersContextProps?.setMode

  const canBuildRoute = useMemo(() => {
    if (filtersMode !== 'route') return false
    const points = filtersContextProps?.routePoints
    return Array.isArray(points) && points.length >= 2
  }, [filtersMode, filtersContextProps?.routePoints])

  const routingLoading = Boolean(filtersContextProps?.routingLoading)
  const routeDistance = filtersContextProps?.routeDistance as number | null | undefined
  const routePointsCount = Array.isArray(filtersContextProps?.routePoints)
    ? filtersContextProps.routePoints.length
    : 0
  const activeRadius = filtersContextProps?.filterValue?.radius || '60'
  const selectedCategories = useMemo(
    () =>
      Array.isArray(filtersContextProps?.filterValue?.categories)
        ? filtersContextProps.filterValue.categories
            .map((value: unknown) => String(value ?? '').trim())
            .filter(Boolean)
        : [],
    [filtersContextProps?.filterValue?.categories],
  )

  const routeCtaLabel = useMemo(() => {
    if (routingLoading) return 'Строим...'
    if (routeDistance != null) return 'Пересчитать маршрут'
    return canBuildRoute ? 'Построить маршрут' : 'Добавьте старт и финиш'
  }, [routingLoading, routeDistance, canBuildRoute])

  const filterToolbarSummary = useMemo(() => {
    if (filtersMode === 'route') {
      if (routingLoading) return 'Маршрут обновляется'
      if (canBuildRoute && routeDistance != null) return 'Маршрут готов, можно открыть список точек'
      return routePointsCount > 0
        ? `Выбрано ${routePointsCount} из 2 точек`
        : 'Выберите старт и финиш кликом по карте'
    }

    const categoriesLabel =
      selectedCategories.length > 0 ? `категорий: ${selectedCategories.length}` : 'все категории'
    return `${travelsData.length > 999 ? '999+' : travelsData.length} мест · ${activeRadius} км · ${categoriesLabel}`
  }, [
    activeRadius,
    canBuildRoute,
    filtersMode,
    routeDistance,
    routePointsCount,
    routingLoading,
    selectedCategories.length,
    travelsData.length,
  ])

  const listTabsOptions = useMemo(
    () => [
      { key: 'list', label: 'Список', icon: isVeryNarrow ? undefined : 'list' },
      { key: 'filters', label: 'Фильтры', icon: isVeryNarrow ? undefined : 'filter-list' },
    ],
    [isVeryNarrow],
  )

  const modeTabsOptions = useMemo(
    () => [
      { key: 'radius', label: 'Радиус', icon: isVeryNarrow ? undefined : 'my-location' },
      { key: 'route', label: 'Маршрут', icon: isVeryNarrow ? undefined : 'alt-route' },
    ],
    [isVeryNarrow],
  )

  const quickFiltersValue = useMemo(() => {
    if (filtersMode === 'route') return 'Маршрут'
    return activeRadius ? `${activeRadius} км` : 'Выбор'
  }, [activeRadius, filtersMode])
  const quickCategoriesValue = useMemo(() => {
    if (selectedCategories.length === 0) return 'Все'
    if (selectedCategories.length === 1) return selectedCategories[0]
    return `${selectedCategories.length} выбрано`
  }, [selectedCategories])

  const showCollapsedMapOverlay = sheetState === 'collapsed' && bottomSheetState === 'collapsed'
  const showQuickFiltersOverlay = showCollapsedMapOverlay

  const peekContent = useMemo(() => {
    if (contentTab === 'list') {
      return (
        <MapPeekPreview
          places={travelsData}
          userLocation={coordinates}
          transportMode={transportMode}
          onPlacePress={handlePlacePress}
          onExpandPress={() => bottomSheetRef.current?.snapToHalf()}
        />
      )
    }

    if (contentTab !== 'filters') return null
    if (!filtersMode || typeof setFiltersMode !== 'function') return null

    const showRouteCta = filtersMode === 'route' && typeof filtersContextProps?.onBuildRoute === 'function'

    return (
      <View style={styles.filtersPeek}>
        <SegmentedControl
          options={modeTabsOptions}
          value={filtersMode}
          onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
          compact={true}
          dense={isNarrow}
          tone="subtle"
          accessibilityLabel="Выбор режима поиска"
        />

        {showRouteCta && (
          <View style={styles.filtersPeekCtaRow}>
            <Button
              label={routeCtaLabel}
              onPress={() => {
                if (!canBuildRoute || routingLoading) return
                filtersContextProps?.onBuildRoute?.()
              }}
              disabled={!canBuildRoute || routingLoading}
              accessibilityLabel="Построить маршрут"
              variant="primary"
              fullWidth
            />
          </View>
        )}
      </View>
    )
  }, [
    contentTab,
    travelsData,
    coordinates,
    transportMode,
    handlePlacePress,
    filtersMode,
    setFiltersMode,
    filtersContextProps,
    styles.filtersPeek,
    styles.filtersPeekCtaRow,
    canBuildRoute,
    routingLoading,
    routeCtaLabel,
    modeTabsOptions,
    isNarrow,
  ])

  const sheetPeekContent = Platform.OS === 'web' ? null : peekContent
  const quickActionsBottomOffset = consentBannerVisible ? 208 : 128

  const sheetContent = useMemo(() => {
    const isQuarterListPreview = uiTab === 'list' && sheetState === 'quarter'
    const isTabTransitioning = uiTab !== contentTab
    const showModeToggle =
      (filtersMode === 'radius' || filtersMode === 'route') && typeof setFiltersMode === 'function'
    const showTopFilterActions = uiTab === 'filters' && filtersMode === 'radius' && !stackSheetToolbar
    const showSheetCloseButton = !isQuarterListPreview
    const toolbarSummaryText = isQuarterListPreview
      ? 'Быстрый просмотр результатов'
      : uiTab === 'filters'
        ? filterToolbarSummary
        : null
    const transitionTitle = uiTab === 'filters' ? 'Открываем фильтры' : 'Открываем список мест'
    const transitionText =
      uiTab === 'filters'
        ? 'Сейчас можно будет сузить поиск по категориям, расстоянию и режиму маршрута.'
        : 'Сейчас покажем актуальные места рядом, чтобы вы могли быстро выбрать точку.'

    const body = isTabTransitioning ? (
      <View style={styles.sheetTransitionState} testID="map-mobile-tab-transition">
        <View style={styles.sheetTransitionCard}>
          <View style={styles.sheetTransitionIconWrap}>
            <Feather
              name={uiTab === 'filters' ? 'sliders' : 'list'}
              size={18}
              color={uiTab === 'filters' ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.sheetTransitionCopy}>
            <RNText style={styles.sheetTransitionTitle}>{transitionTitle}</RNText>
            <RNText style={styles.sheetTransitionText}>{transitionText}</RNText>
          </View>
        </View>
      </View>
    ) : contentTab === 'filters' ? (
      (() => {
        const ProviderComponent = filtersPanelProps?.Component
        const PanelComponent = filtersPanelProps?.Panel
        const providerProps = filtersContextProps

        if (!ProviderComponent || !PanelComponent || !providerProps) {
          return <View style={styles.sheetRoot} />
        }

        const mergedProviderProps = {
          ...providerProps,
          onOpenList: () => {
            setTabDeferred('list')
            bottomSheetRef.current?.snapToHalf()
          },
        }

        return (
          <Suspense fallback={<View style={styles.sheetRoot} />}>
            <ProviderComponent {...mergedProviderProps}>
              {showModeToggle && (
                <View style={styles.filtersModeBar} testID="map-mobile-mode-toggle">
                  <SegmentedControl
                    options={modeTabsOptions}
                    value={filtersMode}
                    onChange={(key) => setFiltersMode(key as 'radius' | 'route')}
                    compact={true}
                    dense={isNarrow}
                    noOuterMargins={true}
                    tone="subtle"
                    accessibilityLabel="Выбор режима поиска"
                  />
                </View>
              )}
              <PanelComponent
                hideTopControls={true}
                hideFooterCta={filtersMode === 'route'}
                hideFooterReset={filtersMode !== 'radius'}
              />
            </ProviderComponent>
          </Suspense>
        )
      })()
    ) : (
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={buildRouteTo}
        isMobile={true}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        userLocation={coordinates}
        transportMode={transportMode}
        onToggleFavorite={onToggleFavorite}
        favorites={favorites}
        compactPreview={sheetState === 'quarter'}
        onExpandList={handleOpenList}
        onClosePanel={handleBackToMap}
        onOpenFilters={handleOpenFilters}
        onResetFilters={onResetFilters}
        onExpandRadius={onExpandRadius}
      />
    )

    return (
      <View style={[styles.sheetRoot, isQuarterListPreview && styles.sheetRootPreview]}>
        <View
          style={[
            styles.sheetToolbar,
            isQuarterListPreview && styles.sheetToolbarPreview,
            stackSheetToolbar ? styles.sheetToolbarStacked : styles.sheetToolbarInline,
          ]}
        >
          <View style={[styles.sheetToolbarLeft, stackSheetToolbar && styles.sheetToolbarFullWidth]}>
            <SegmentedControl
              options={listTabsOptions}
              value={uiTab}
              onChange={(key) => {
                const next = key === 'filters' ? 'filters' : 'list'
                setTabDeferred(next)
                if (next === 'filters') {
                  bottomSheetRef.current?.snapToFull()
                  return
                }
                bottomSheetRef.current?.snapToHalf()
              }}
              compact={true}
              dense={isNarrow}
              noOuterMargins={true}
              tone="subtle"
              accessibilityLabel="Переключение между фильтрами и списком"
            />
            {toolbarSummaryText && (
              <RNText
                style={[styles.sheetToolbarSummary, isQuarterListPreview && styles.sheetToolbarSummaryPreview]}
                numberOfLines={2}
                testID="map-mobile-toolbar-summary"
              >
                {toolbarSummaryText}
              </RNText>
            )}
          </View>

          <View
            style={[
              styles.sheetToolbarActions,
              stackSheetToolbar && styles.sheetToolbarActionsStacked,
              isQuarterListPreview && styles.sheetToolbarActionsPreview,
            ]}
          >
            {isQuarterListPreview && (
              <Pressable
                testID="map-panel-expand-list"
                onPress={handleOpenList}
                accessibilityRole="button"
                accessibilityLabel={`Показать все ${travelsData.length} мест`}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.sheetShowResultsButton,
                  stackSheetToolbar && styles.sheetToolbarButtonStacked,
                  compactSheetActions && styles.sheetShowResultsButtonCompact,
                  { backgroundColor: pressed ? colors.primaryDark : colors.primary },
                ]}
              >
                <Feather name="maximize-2" size={15} color={colors.textOnPrimary} />
                {!compactSheetActions && <RNText style={styles.sheetPrimaryActionText}>Все места</RNText>}
              </Pressable>
            )}
            {showTopFilterActions && (
              <>
                {typeof filtersContextProps?.resetFilters === 'function' && (
                  <Pressable
                    testID="map-panel-reset"
                    onPress={() => filtersContextProps?.resetFilters?.()}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.sheetCloseButton,
                      stackSheetToolbar && styles.sheetIconButtonStacked,
                      compactSheetActions && styles.sheetIconButtonCompact,
                      { borderColor: colors.borderLight },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Feather name="rotate-cw" size={15} color={colors.textMuted} />
                  </Pressable>
                )}
                <Pressable
                  testID="map-panel-show-results"
                  onPress={handleOpenList}
                  accessibilityRole="button"
                  accessibilityLabel={`Показать ${travelsData.length} мест`}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.sheetShowResultsButton,
                    stackSheetToolbar && styles.sheetToolbarButtonStacked,
                    compactSheetActions && styles.sheetShowResultsButtonCompact,
                    { backgroundColor: pressed ? colors.primaryDark : colors.primary },
                  ]}
                >
                  <Feather name="list" size={15} color={colors.textOnPrimary} />
                  {travelsData.length > 0 && (
                    <RNText style={[styles.sheetResultsBadge, { color: colors.primary }]} numberOfLines={1}>
                      {travelsData.length > 999 ? '999+' : String(travelsData.length)}
                    </RNText>
                  )}
                </Pressable>
              </>
            )}
            <Pressable
              testID="map-panel-open"
              onPress={handleToggleListPanel}
              accessibilityRole="button"
              accessibilityLabel="Вернуться к карте"
              hitSlop={6}
              style={({ pressed }) => [
                styles.sheetBackToMapButton,
                stackSheetToolbar && styles.sheetToolbarButtonStacked,
                compactSheetActions && styles.sheetBackToMapButtonCompact,
                pressed && { opacity: 0.72 },
              ]}
            >
              <Feather name="map" size={15} color={colors.textMuted} />
              {!compactSheetActions && <RNText style={styles.sheetBackToMapText}>Карта</RNText>}
            </Pressable>
            {showSheetCloseButton && (
              <Pressable
                testID="map-panel-close"
                onPress={() => bottomSheetRef.current?.snapToCollapsed()}
                accessibilityRole="button"
                accessibilityLabel="Закрыть панель"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.sheetCloseButton,
                  stackSheetToolbar && styles.sheetIconButtonStacked,
                  compactSheetActions && styles.sheetIconButtonCompact,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.sheetBody, isQuarterListPreview && styles.sheetBodyPreview]}>{body}</View>
      </View>
    )
  }, [
    uiTab,
    contentTab,
    colors.borderLight,
    colors.primary,
    colors.primaryDark,
    colors.textMuted,
    colors.textOnPrimary,
    buildRouteTo,
    coordinates,
    favorites,
    hasMore,
    filtersContextProps,
    filtersMode,
    filtersPanelProps?.Component,
    filtersPanelProps?.Panel,
    isRefreshing,
    onExpandRadius,
    onLoadMore,
    onRefresh,
    onResetFilters,
    onToggleFavorite,
    handleBackToMap,
    handleOpenFilters,
    handleOpenList,
    handleToggleListPanel,
    listTabsOptions,
    modeTabsOptions,
    canBuildRoute,
    compactSheetActions,
    filterToolbarSummary,
    isNarrow,
    routeCtaLabel,
    routingLoading,
    setFiltersMode,
    setTabDeferred,
    sheetState,
    stackSheetToolbar,
    styles.filtersModeBar,
    styles.sheetBackToMapButton,
    styles.sheetBackToMapButtonCompact,
    styles.sheetBackToMapText,
    styles.sheetBody,
    styles.sheetBodyPreview,
    styles.sheetCloseButton,
    styles.sheetIconButtonCompact,
    styles.sheetIconButtonStacked,
    styles.sheetResultsBadge,
    styles.sheetRoot,
    styles.sheetRootPreview,
    styles.sheetShowResultsButton,
    styles.sheetShowResultsButtonCompact,
    styles.sheetToolbar,
    styles.sheetToolbarActions,
    styles.sheetToolbarActionsPreview,
    styles.sheetToolbarActionsStacked,
    styles.sheetToolbarButtonStacked,
    styles.sheetToolbarFullWidth,
    styles.sheetToolbarInline,
    styles.sheetToolbarLeft,
    styles.sheetToolbarPreview,
    styles.sheetToolbarStacked,
    styles.sheetToolbarSummary,
    styles.sheetToolbarSummaryPreview,
    styles.sheetTransitionCard,
    styles.sheetTransitionCopy,
    styles.sheetTransitionIconWrap,
    styles.sheetTransitionState,
    styles.sheetTransitionText,
    styles.sheetTransitionTitle,
    transportMode,
    travelsData,
  ])

  return (
    <GestureHandlerRootView
      style={styles.container}
      testID="map-mobile-layout"
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      <View style={styles.mapContainer}>
        {mapComponent}

        {showQuickFiltersOverlay && (
          <MapQuickFilters
            filtersValue={quickFiltersValue}
            categoriesValue={quickCategoriesValue}
            onPressFilters={handleOpenFilters}
            onPressCategories={handleOpenFilters}
          />
        )}
      </View>

      {showCollapsedMapOverlay && (
        <View
          style={[
            styles.quickActionsRail,
            {
              bottom:
                Platform.OS === 'web'
                  ? (`calc(${quickActionsBottomOffset}px + env(safe-area-inset-bottom, 0px))` as any)
                  : quickActionsBottomOffset,
            },
          ]}
        >
          <View style={styles.quickSecondaryActions}>
            <CardActionPressable
              accessibilityRole="button"
              accessibilityLabel="Открыть фильтры"
              onPress={handleOpenFilters}
              style={styles.quickCircleButton}
            >
              <Feather name="sliders" size={18} color={colors.text} />
            </CardActionPressable>
            <CardActionPressable
              testID="map-center-user"
              accessibilityRole="button"
              accessibilityLabel="Показать мое местоположение"
              onPress={handleCenterOnUserPress}
              style={styles.quickCircleButton}
            >
              <Feather name="crosshair" size={18} color={colors.text} />
            </CardActionPressable>
          </View>
        </View>
      )}

      <MapBottomSheet
        ref={bottomSheetRef}
        peekContent={sheetPeekContent}
        onStateChange={handleSheetStateChange}
        bottomInset={0}
      >
        {sheetContent}
      </MapBottomSheet>
    </GestureHandlerRootView>
  )
}
