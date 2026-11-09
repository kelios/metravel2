import React, { useMemo } from 'react'
import { Platform, View, ScrollView, Text as RNText } from 'react-native'
import { FlashList } from '@shopify/flash-list'

import { isPhoneListWidth } from '@/components/UserPoints/pointListLayout'
import { PointsListSkeleton, WIDE_LIST_SKELETON_IMAGE_HEIGHT } from '@/components/UserPoints/PointsListSkeleton'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsiveWidth } from '@/hooks/useResponsive'
import { METRICS } from '@/constants/layout'
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import type { MapUiApi } from '@/types/mapUi'

import type { PointsListStyles } from './types'
import { translate as i18nT } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'
import { createLocalStyles, useMapSettingsStyles } from './PointsListGrid.styles'
import { PointsListPanelHeader } from './PointsListPanelHeader'
import { UserPointsMapCanvas } from './UserPointsMapCanvas'
import { useUserPointsGeocode } from './useUserPointsGeocode'


type ViewMode = 'list' | 'map'

export const PointsListGrid: React.FC<{
  styles: PointsListStyles
  colors: { text: string }

  viewMode: ViewMode
  isLoading: boolean
  filteredPoints: any[]
  listExtraData?: any
  listKey?: string
  /** Серверный поиск ещё отвечает — счётчик вкладки показывает «…» (#3161). */
  isSearching?: boolean
  /** Число активных фильтров — бейдж вкладки «Фильтры» (#3134). */
  activeFilterCount?: number
  panelTab?: 'filters' | 'list'
  onPanelTabChange?: (tab: 'filters' | 'list') => void

  /** Шапка экрана (сводка, переключатель раскладки, фильтры) — элемент, не рендерер (#3135). */
  header: React.ReactElement
  /** Куда смотреть, если геокодер поиска ничего не нашёл: геолокация или центр коллекции. */
  geocodeFallbackCenter?: { lat: number; lng: number } | null
  renderItem: ({ item }: { item: any }) => React.ReactElement
  renderEmpty: () => React.ReactElement
  onOpenActions?: () => void


	  onRefresh: () => void

	  currentLocation: { lat: number; lng: number } | null
	  onMapPress: (coords: { lat: number; lng: number }) => void
	  onMapPointPress?: (point: any) => void
	  onPointEdit?: (point: any) => void
	  onPointDelete?: (point: any) => void

  showManualAdd: boolean
  manualCoords: { lat: number; lng: number } | null
  manualColor: any

  isLocating: boolean
  onLocateMe: () => void

  showingRecommendations: boolean
  onCloseRecommendations: () => void
  onRefreshRecommendations: () => void
  activePointId?: number | null
  recommendedRoutes?: Record<number, { distance: number; duration: number; line?: Array<[number, number]> }>

  searchQuery: string
  /** Запрос после debounce — по нему считаются `filteredPoints` и геокодинг пустого результата (#3132). */
  appliedSearchQuery?: string
  onSearch: (text: string) => void

  hasFilters: boolean
  onResetFilters: () => void

  showMapSettings?: boolean
}> = ({
  styles,
  colors,
  viewMode,
  isLoading,
  filteredPoints,
  listExtraData,
  listKey,
  isSearching = false,
  activeFilterCount = 0,
  panelTab: controlledPanelTab,
  onPanelTabChange,
  header,
  geocodeFallbackCenter = null,
  renderItem,
  renderEmpty,
  onOpenActions,
	  onRefresh,
	  currentLocation,
	  onMapPress,
	  onMapPointPress,
	  onPointEdit,
	  onPointDelete,
	  showManualAdd,
  manualCoords,
  manualColor,
  isLocating,
  onLocateMe,
  showingRecommendations,
  onCloseRecommendations,
  onRefreshRecommendations,
  activePointId,
  recommendedRoutes,
  searchQuery,
  appliedSearchQuery = searchQuery,
  onSearch,
  hasFilters,
  onResetFilters,
  showMapSettings = false,
}) => {
  // #1814 — ширина берётся из того же источника, что и у родителя
  // (`PointsList` → `useBreakpoints({ clientOnly: true })`). Прежний
  // `useWindowDimensions` отдавал живую ширину без гидратационной защёлки, и на
  // первом web-кадре родитель с этим узлом могли разойтись по режиму. Поддерево
  // монтируется уже после гидратации (`UserPointsScreen` держит спиннер до
  // `authReady`), значит `clientOnly` здесь корректен и не даёт «нулевого»
  // кадра (#1282).
  const windowWidth = useResponsiveWidth({ clientOnly: true })
  const isWeb = Platform.OS === 'web'
  const isWideScreen = isWeb && windowWidth >= 1024
  const themedColors = useThemedColors()
  const localStyles = useMemo(() => createLocalStyles(themedColors), [themedColors])
  const mapSettingsStyles = useMapSettingsStyles(themedColors, !isWideScreen, windowWidth)
	  const recommendedRouteLines = useMemo(() => {
	    if (!showingRecommendations) return [] as Array<{ id: number; line: Array<[number, number]> }>;
	    const entries = Object.entries(recommendedRoutes ?? {});
	    return entries
	      .map(([id, r]) => ({ id: Number(id), line: r?.line ?? [] }))
	      .filter((r) => Number.isFinite(r.id) && Array.isArray(r.line) && r.line.length > 1);
	  }, [recommendedRoutes, showingRecommendations]);
	  const [internalPanelTab, setInternalPanelTab] = React.useState<'filters' | 'list'>('list')
  const panelTab = controlledPanelTab ?? internalPanelTab
  const setPanelTab = onPanelTabChange ?? setInternalPanelTab
  // Узкий экран (мобильный web + native): единый верхний таб-бар с тремя
  // вкладками — Карта / Список / Фильтры. Раньше карта была недостижима:
  // showMobilePanel переключался только глобальным mapPanelStore-тоглом,
  // которого в потоке «Мои точки» нет (#545).
  const [mobileTab, setMobileTab] = React.useState<'map' | 'list' | 'filters'>('map')
  const [mapUiApi, setMapUiApi] = React.useState<MapUiApi | null>(null)
  const didInitialFitRef = React.useRef(false)
  const searchMarker = useUserPointsGeocode({
    appliedSearchQuery,
    filteredPoints,
    isSearching,
    mapUiApi,
    fallbackCenter: geocodeFallbackCenter,
  })
  // #3133: число во вкладке — через форматтер локали («2 656»), а пока первая
  // страница не пришла — многоточие вместо «(0)», которое читалось как «точек нет».
  const listCountLabel = isLoading || isSearching ? '…' : formatInteger(filteredPoints.length)
  // Сегмент мобильного таб-бара — треть ширины 320–390 px: число в подписи
  // («Список (2655)») там не помещается ни с разрядами, ни без. Счётчик идёт
  // отдельным бейджем сегмента (как у общей карты), подпись — короткое «Список».
  const mobileListBadge = isLoading || isSearching ? undefined : filteredPoints.length
  // На 320 px сегмент ≈ 97 px: иконка + «Список» + бейдж «2656» не помещаются
  // (прод-проба 08.11: scrollWidth > clientWidth), без иконок — помещаются.
  const showMobileTabIcons = windowWidth >= METRICS.breakpoints.phone
  // #3134: вкладка так и называется — «Фильтры», а не «Фильтры карты», и несёт
  // бейдж с числом активных фильтров; при нуле бейджа нет.
  const filtersBadge = activeFilterCount > 0 ? activeFilterCount : undefined
  const panelOptions = React.useMemo(
    () => [
      { key: 'filters', label: i18nT('map:components.UserPoints.PointsListGrid.filtry_a9025123'), badge: filtersBadge },
      { key: 'list', label: i18nT('map:components.UserPoints.PointsListGrid.spisok_value1_cc1e53c4', { value1: listCountLabel }) },
    ],
    [filtersBadge, listCountLabel]
  )
  const mobileTabOptions = React.useMemo(
    () => [
      { key: 'map', label: i18nT('map:components.UserPoints.PointsListGrid.karta_b48708d8'), icon: showMobileTabIcons ? 'map' : undefined },
      { key: 'list', label: i18nT('map:components.UserPoints.PointsListHeader.spisok_b0731a7f'), icon: showMobileTabIcons ? 'list' : undefined, badge: mobileListBadge },
      { key: 'filters', label: i18nT('map:components.UserPoints.PointsListGrid.filtry_a9025123'), icon: showMobileTabIcons ? 'filter-list' : undefined, badge: filtersBadge },
    ],
    [filtersBadge, mobileListBadge, showMobileTabIcons]
  )
  const handleMobileTabChange = React.useCallback(
    (key: string) => {
      const nextTab = key as 'map' | 'list' | 'filters'
      setMobileTab(nextTab)
      if (nextTab === 'list' || nextTab === 'filters') {
        setPanelTab(nextTab)
      }
    },
    [setPanelTab],
  )

  const mapCanvas = (
    <UserPointsMapCanvas
      styles={styles}
      colors={colors}
      points={filteredPoints}
      currentLocation={currentLocation}
      searchMarker={searchMarker}
      routeLines={recommendedRouteLines}
      activePointId={activePointId}
      pendingMarker={showManualAdd ? manualCoords : null}
      pendingMarkerColor={manualColor}
      isLocating={isLocating}
      onLocateMe={onLocateMe}
      onMapPress={onMapPress}
      onMapPointPress={onMapPointPress}
      onPointEdit={onPointEdit}
      onPointDelete={onPointDelete}
      onMapUiApiReady={setMapUiApi}
    />
  )

  const renderFiltersPanel = React.useCallback(
    (isMobilePanel: boolean) => (
      <ScrollView
        style={localStyles.rightPanelScroll}
        contentContainerStyle={localStyles.rightPanelContent}
        showsVerticalScrollIndicator={true}
      >
        {header}
        {Platform.OS === 'web' && showMapSettings ? (
          <FiltersPanelMapSettings
            colors={themedColors as any}
            styles={mapSettingsStyles}
            isMobile={isMobilePanel}
            mode="radius"
            mapUiApi={mapUiApi}
            totalPoints={filteredPoints.length}
            hasFilters={hasFilters}
            canBuildRoute={false}
            onReset={onResetFilters}
            hideReset={!hasFilters}
            showBaseLayer={false}
            showOverlays={true}
            withContainer={false}
          />
        ) : null}
      </ScrollView>
    ),
    [
      filteredPoints.length,
      hasFilters,
      localStyles.rightPanelContent,
      localStyles.rightPanelScroll,
      mapSettingsStyles,
      mapUiApi,
      onResetFilters,
      header,
      showMapSettings,
      themedColors,
    ]
  )

  const listHeader = React.useMemo(
    () => (
      <PointsListPanelHeader
        localStyles={localStyles}
        themedColors={themedColors}
        searchQuery={searchQuery}
        onSearch={onSearch}
        onOpenActions={onOpenActions}
        hasFilters={hasFilters}
        onResetFilters={onResetFilters}
        showingRecommendations={showingRecommendations}
        onRefreshRecommendations={onRefreshRecommendations}
        onCloseRecommendations={onCloseRecommendations}
        currentLocation={currentLocation}
        isLocating={isLocating}
        onLocateMe={onLocateMe}
      />
    ),
    [
      currentLocation,
      hasFilters,
      isLocating,
      localStyles,
      onCloseRecommendations,
      onLocateMe,
      onOpenActions,
      onRefreshRecommendations,
      onResetFilters,
      onSearch,
      searchQuery,
      showingRecommendations,
      themedColors,
    ],
  )

  const listFlashExtraData = React.useMemo(
    () => ({ listExtraData, showingRecommendations, recommendedRoutes }),
    [listExtraData, showingRecommendations, recommendedRoutes]
  )

  const renderPointListItem = React.useCallback(
    ({ item }: { item: any }) => {
      const routeInfo = recommendedRoutes?.[Number(item?.id)]
      return (
        <View style={localStyles.pointsListItem}>
          {renderItem({ item })}
          {showingRecommendations && routeInfo ? (
            <View style={localStyles.routeInfo}>
              <RNText style={localStyles.routeInfoText}>
                {i18nT('map:components.UserPoints.PointsListGrid.km_5098801f', { value1: formatNumber(routeInfo.distance), value2: formatNumber(routeInfo.duration) })}</RNText>
            </View>
          ) : null}
        </View>
      )
    },
    [
      localStyles.pointsListItem,
      localStyles.routeInfo,
      localStyles.routeInfoText,
      recommendedRoutes,
      renderItem,
      showingRecommendations,
    ]
  )

  // Пока первая страница не пришла — каркас, не пустота и не «нет точек». Каркас
  // повторяет то, что придёт (#2253): строки на телефоне (#3142), карточки шире.
  const skeletonVariant = isPhoneListWidth(windowWidth) ? 'row' : 'card'
  const renderListEmpty = React.useCallback(
    () =>
      isLoading ? (
        <PointsListSkeleton variant={skeletonVariant} imageHeight={WIDE_LIST_SKELETON_IMAGE_HEIGHT} />
      ) : (
        renderEmpty()
      ),
    [isLoading, renderEmpty, skeletonVariant]
  )

  // #3133: один виртуализированный список на web и native. Раньше web рисовал
  // ScrollView со срезом по 80 карточек и сбрасывал его на каждую новую ссылку
  // filteredPoints (в том числе на каждую докачанную страницу).
  const renderListPanel = React.useCallback(
    () => (
      <FlashList
        key={listKey ?? 'userpoints-list'}
        style={localStyles.rightPanelScroll}
        contentContainerStyle={[localStyles.rightPanelContent, localStyles.pointsList] as any}
        data={filteredPoints}
        extraData={listFlashExtraData}
        keyExtractor={(item, index) => String((item as any)?.id ?? `idx-${index}`)}
        {...({ estimatedItemSize: 120 } as any)}
        testID="userpoints-panel-content-list"
        renderItem={renderPointListItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderListEmpty}
        showsVerticalScrollIndicator={true}
        drawDistance={600}
      />
    ),
    [
      filteredPoints,
      listFlashExtraData,
      listKey,
      localStyles,
      renderListEmpty,
      renderPointListItem,
      listHeader,
    ]
  )
  
  // Auto-switch to list tab only on the false->true transition of recommendations,
  // to avoid loops when setPanelTab identity is unstable.
  const prevShowingRecommendationsRef = React.useRef(showingRecommendations)
  React.useEffect(() => {
    if (showingRecommendations && !prevShowingRecommendationsRef.current) {
      setPanelTab('list');
      if (!isWideScreen) setMobileTab('list');
    }
    prevShowingRecommendationsRef.current = showingRecommendations;
  }, [isWideScreen, setPanelTab, showingRecommendations]);
  
  // Тап по точке (в списке или на карте) делает её активной — на узком экране
  // показываем её на карте, переключив верхнюю вкладку на «Карта».
  const prevActivePointIdRef = React.useRef(activePointId)
  React.useEffect(() => {
    if (isWideScreen) return
    if (activePointId != null && activePointId !== prevActivePointIdRef.current) {
      setMobileTab('map')
    }
    prevActivePointIdRef.current = activePointId
  }, [activePointId, isWideScreen])

  // На широком экране карта всегда видна (map-режим); на узком — только когда
  // активна вкладка «Карта».
  const isMapVisible = isWideScreen ? viewMode === 'map' : mobileTab === 'map'

  // Reset the initial-fit latch when leaving map mode or when there are no points,
  // so the auto-fit runs again next time the map shows a non-empty set.
  React.useEffect(() => {
    if (!isMapVisible || !Array.isArray(filteredPoints) || filteredPoints.length === 0) {
      didInitialFitRef.current = false;
    }
  }, [isMapVisible, filteredPoints]);

  // Initial viewport fit: after first load, auto-fit to currently visible points once.
  React.useEffect(() => {
    if (didInitialFitRef.current) return;
    if (!isMapVisible) return;
    if (isLoading) return;
    if (showingRecommendations) return;
    if (activePointId != null) return;
    if (!mapUiApi?.fitToResults) return;
    if (!Array.isArray(filteredPoints) || filteredPoints.length === 0) return;

    didInitialFitRef.current = true;
    const t = setTimeout(() => {
      try {
        mapUiApi.fitToResults();
      } catch {
        // noop
      }
    }, 0);

    return () => clearTimeout(t);
  }, [activePointId, filteredPoints, isLoading, isMapVisible, mapUiApi, showingRecommendations]);

  // На узком экране режим показа полностью определяется верхним 3-таб-баром
  // (Карта / Список / Фильтры) ниже, поэтому standalone list-режим (с тяжёлой
  // summary-шапкой) применяем только на десктопе/широком web.
  if (viewMode === 'list' && isWideScreen) {
    // #3133: desktop list-режим тоже виртуализирован — раньше web рисовал все
    // filteredPoints.map без окна. Сетки в несколько колонок нет (#3135: мёртвые
    // grid-ветки убраны вместе с `numColumns`).
    return (
      <FlashList
        data={filteredPoints}
        extraData={listFlashExtraData}
        renderItem={renderItem}
        keyExtractor={(item: { id?: string | number }, index: number) => String(item?.id ?? `idx-${index}`)}
        {...({ estimatedItemSize: 120 } as any)}
        ListHeaderComponent={header}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={onRefresh}
        drawDistance={600}
      />
    )
  }

  // Map mode with right panel for wide screens
  if (isWideScreen) {
    return (
      <View style={localStyles.mapLayoutContainer}>
        <View style={localStyles.mapMainContent}>
          {mapCanvas}
        </View>

        <View style={localStyles.mapRightPanel}>
          <View style={localStyles.panelTabs}>
            <SegmentedControl
              options={panelOptions}
              value={panelTab}
              onChange={(key) => setPanelTab(key as 'filters' | 'list')}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListGrid.panel_7e476941')}
              compact
            />
          </View>

          {panelTab === 'filters' ? renderFiltersPanel(false) : renderListPanel()}
        </View>
      </View>
    )
  }

  // Mobile/narrow screens: single 3-tab bar — Map / List / Filters.
  return (
    <View style={styles.mapContainer}>
      <View style={localStyles.mobileTabsBar}>
        <SegmentedControl
          options={mobileTabOptions}
          value={mobileTab}
          onChange={handleMobileTabChange}
          accessibilityLabel={i18nT('map:components.UserPoints.PointsListGrid.karta_spisok_ili_filtry_tochek_7f0bb71f')}
          compact
          dense
          activateOnPressInNative
        />
      </View>

      {mobileTab === 'map' ? (
        mapCanvas
      ) : mobileTab === 'filters' ? (
        <View style={localStyles.mobilePanelContainer}>{renderFiltersPanel(true)}</View>
      ) : (
        <View style={localStyles.mobilePanelContainer}>{renderListPanel()}</View>
      )}
    </View>
  )
}
