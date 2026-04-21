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
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors } from '@/hooks/useTheme'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import MapBottomSheet, { type MapBottomSheetRef } from './MapBottomSheet'
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
  const stackSheetToolbar = viewportWidth <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
  const bottomSheetRef = useRef<MapBottomSheetRef>(null)
  const pathname = usePathname()
  const isActiveWebRoute =
    Platform.OS === 'web' &&
    (pathname === '/map' || String(pathname).startsWith('/map/'))
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  const [uiTab, setUiTab] = useState<'search' | 'route' | 'list'>('list')
  const [contentTab, setContentTab] = useState<'search' | 'route' | 'list'>(
    'list',
  )
  const [, startTransition] = useTransition()
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
    setContentTab(nextTab)
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
      setContentTab('list')
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

  const setTabDeferred = useCallback(
    (next: 'search' | 'route' | 'list') => {
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

  const handleOpenList = useCallback(() => {
    setTabDeferred('list')
    bottomSheetRef.current?.snapToFull()
  }, [setTabDeferred])

  const handleToggleListPanel = useCallback(() => {
    if (sheetStateRef.current === 'collapsed') {
      handleOpenList()
      return
    }
    bottomSheetRef.current?.snapToCollapsed()
  }, [handleOpenList])

  const handleOpenSearch = useCallback(() => {
    setFiltersMode?.('radius')
    setTabDeferred('search')
    bottomSheetRef.current?.snapToFull()
    onOpenFilters()
  }, [onOpenFilters, setFiltersMode, setTabDeferred])

  const handleBackToMap = useCallback(() => {
    bottomSheetRef.current?.snapToCollapsed()
  }, [])

  const handleCenterOnUserPress = useCallback(() => {
    onCenterOnUser()
  }, [onCenterOnUser])

  const canBuildRoute = useMemo(() => {
    if (filtersMode !== 'route') return false
    const points = filtersContextProps?.routePoints
    return Array.isArray(points) && points.length >= 2
  }, [filtersMode, filtersContextProps?.routePoints])

  const routingLoading = Boolean(filtersContextProps?.routingLoading)
  const routeDistance = filtersContextProps?.routeDistance as
    | number
    | null
    | undefined
  const routePointsCount = Array.isArray(filtersContextProps?.routePoints)
    ? filtersContextProps.routePoints.length
    : 0
  const activeRadius = filtersContextProps?.filterValue?.radius || '60'
  const selectedCategories = useMemo(
    () =>
      Array.isArray(filtersContextProps?.filterValue?.categoryTravelAddress)
        ? filtersContextProps.filterValue.categoryTravelAddress
            .map((value: unknown) => String(value ?? '').trim())
            .filter(Boolean)
        : [],
    [filtersContextProps?.filterValue?.categoryTravelAddress],
  )

  const filterToolbarSummary = useMemo(() => {
    if (filtersMode === 'route') {
      if (routingLoading) return 'Маршрут обновляется'
      if (canBuildRoute && routeDistance != null)
        return 'Маршрут готов, можно открыть список точек'
      return routePointsCount > 0
        ? `Выбрано ${routePointsCount} из 2 точек`
        : 'Выберите старт и финиш кликом по карте'
    }

    const categoriesLabel =
      selectedCategories.length > 0
        ? `категорий: ${selectedCategories.length}`
        : 'все категории'
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

  const panelTabsOptions = useMemo(
    () => [
      {
        key: 'search',
        label: 'Поиск',
        icon: isVeryNarrow ? undefined : 'search',
      },
      {
        key: 'route',
        label: 'Маршрут',
        icon: isVeryNarrow ? undefined : 'alt-route',
      },
      { key: 'list', label: 'Точки', icon: isVeryNarrow ? undefined : 'list' },
    ],
    [isVeryNarrow],
  )

  const showCollapsedMapOverlay =
    sheetState === 'collapsed' && bottomSheetState === 'collapsed'
  const quickActionsBottomOffset = consentBannerVisible ? 208 : 128
  const bottomSheetInset =
    Platform.OS === 'web'
      ? WEB_MOBILE_BOTTOM_DOCK_INSET +
        (consentBannerVisible ? WEB_MOBILE_CONSENT_BANNER_INSET : 0)
      : 0

  const sheetContent = useMemo(() => {
    const isQuarterListPreview = uiTab === 'list' && sheetState === 'quarter'
    const isTabTransitioning = uiTab !== contentTab
    const showTopFilterActions = uiTab === 'search' && !stackSheetToolbar
    const showSheetCloseButton = !isQuarterListPreview
    const toolbarSummaryText = isQuarterListPreview
      ? 'Быстрый просмотр результатов'
      : uiTab === 'search' || uiTab === 'route'
        ? filterToolbarSummary
        : null
    const transitionMeta =
      uiTab === 'search'
        ? {
            icon: 'search' as const,
            color: colors.primary,
            title: 'Открываем поиск',
            text: 'Сейчас можно будет быстро сузить выдачу по категориям и радиусу.',
          }
        : uiTab === 'route'
          ? {
              icon: 'navigation' as const,
              color: colors.primary,
              title: 'Открываем маршрут',
              text: 'Сейчас можно будет выбрать старт и финиш без вложенных переключателей.',
            }
          : {
              icon: 'list' as const,
              color: colors.textMuted,
              title: 'Открываем список мест',
              text: 'Сейчас покажем актуальные точки рядом, чтобы вы могли быстро выбрать место.',
            }

    const body = isTabTransitioning ? (
      <View
        style={styles.sheetTransitionState}
        testID="map-mobile-tab-transition"
      >
        <View style={styles.sheetTransitionCard}>
          <View style={styles.sheetTransitionIconWrap}>
            <Feather
              name={transitionMeta.icon}
              size={18}
              color={transitionMeta.color}
            />
          </View>
          <View style={styles.sheetTransitionCopy}>
            <RNText style={styles.sheetTransitionTitle}>
              {transitionMeta.title}
            </RNText>
            <RNText style={styles.sheetTransitionText}>
              {transitionMeta.text}
            </RNText>
          </View>
        </View>
      </View>
    ) : contentTab === 'list' ? (
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
        onOpenFilters={handleOpenSearch}
        onResetFilters={onResetFilters}
        onExpandRadius={onExpandRadius}
      />
    ) : (
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
            bottomSheetRef.current?.snapToFull()
          },
        }

        return (
          <Suspense fallback={<View style={styles.sheetRoot} />}>
            <ProviderComponent {...mergedProviderProps}>
              <PanelComponent hideTopControls={true} />
            </ProviderComponent>
          </Suspense>
        )
      })()
    )

    return (
      <View
        style={[
          styles.sheetRoot,
          isQuarterListPreview && styles.sheetRootPreview,
        ]}
      >
        <View
          style={[
            styles.sheetToolbar,
            isQuarterListPreview && styles.sheetToolbarPreview,
            stackSheetToolbar
              ? styles.sheetToolbarStacked
              : styles.sheetToolbarInline,
          ]}
        >
          <View
            style={[
              styles.sheetToolbarLeft,
              stackSheetToolbar && styles.sheetToolbarFullWidth,
            ]}
          >
            <SegmentedControl
              options={panelTabsOptions}
              value={uiTab}
              onChange={(key) => {
                const next =
                  key === 'route' ? 'route' : key === 'list' ? 'list' : 'search'
                if (next === 'route') {
                  setFiltersMode?.('route')
                } else if (next === 'search') {
                  setFiltersMode?.('radius')
                }
                setTabDeferred(next)
                if (next === 'search' || next === 'route') {
                  bottomSheetRef.current?.snapToFull()
                  return
                }
                bottomSheetRef.current?.snapToFull()
              }}
              compact={true}
              dense={isNarrow}
              noOuterMargins={true}
              tone="subtle"
              accessibilityLabel="Переключение между поиском, маршрутом и списком точек"
            />
            {toolbarSummaryText && (
              <RNText
                style={[
                  styles.sheetToolbarSummary,
                  isQuarterListPreview && styles.sheetToolbarSummaryPreview,
                ]}
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
                  {
                    backgroundColor: pressed
                      ? colors.primaryDark
                      : colors.primary,
                  },
                ]}
              >
                <Feather
                  name="maximize-2"
                  size={15}
                  color={colors.textOnPrimary}
                />
                {!compactSheetActions && (
                  <RNText style={styles.sheetPrimaryActionText}>
                    Все места
                  </RNText>
                )}
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
                    <Feather
                      name="rotate-cw"
                      size={15}
                      color={colors.textMuted}
                    />
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
                    {
                      backgroundColor: pressed
                        ? colors.primaryDark
                        : colors.primary,
                    },
                  ]}
                >
                  <Feather name="list" size={15} color={colors.textOnPrimary} />
                  {travelsData.length > 0 && (
                    <RNText
                      style={[
                        styles.sheetResultsBadge,
                        { color: colors.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {travelsData.length > 999
                        ? '999+'
                        : String(travelsData.length)}
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
              {!compactSheetActions && (
                <RNText style={styles.sheetBackToMapText}>Карта</RNText>
              )}
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

        <View
          style={[
            styles.sheetBody,
            isQuarterListPreview && styles.sheetBodyPreview,
          ]}
        >
          {body}
        </View>
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
    filtersPanelProps?.Component,
    filtersPanelProps?.Panel,
    isRefreshing,
    onExpandRadius,
    onLoadMore,
    onRefresh,
    onResetFilters,
    onToggleFavorite,
    handleBackToMap,
    handleOpenSearch,
    handleOpenList,
    handleToggleListPanel,
    panelTabsOptions,
    compactSheetActions,
    filterToolbarSummary,
    isNarrow,
    setFiltersMode,
    setTabDeferred,
    sheetState,
    stackSheetToolbar,
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
    styles.sheetPrimaryActionText,
    transportMode,
    travelsData,
  ])

  return (
    <GestureHandlerRootView
      style={styles.container}
      testID="map-mobile-layout"
      {...(isActiveWebRoute ? ({ 'data-active': 'true' } as any) : null)}
    >
      <View style={styles.mapContainer}>{mapComponent}</View>

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
          <CardActionPressable
            testID="map-open-list"
            accessibilityRole="button"
            accessibilityLabel="Открыть панель со списком"
            onPress={handleOpenList}
            style={styles.quickCircleButton}
          >
            <Feather name="list" size={18} color={colors.text} />
          </CardActionPressable>

          <View style={styles.quickSecondaryActions}>
            <CardActionPressable
              accessibilityRole="button"
              accessibilityLabel="Открыть поиск"
              onPress={handleOpenSearch}
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
        peekContent={null}
        onStateChange={handleSheetStateChange}
        bottomInset={bottomSheetInset}
      >
        {sheetContent}
      </MapBottomSheet>
    </GestureHandlerRootView>
  )
}
