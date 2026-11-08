import { searchInputAccessibilityProps } from '@/utils/webProps'
import React, { useMemo } from 'react'
import { Platform, View, ScrollView, TextInput, Text as RNText } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { FlashList } from '@shopify/flash-list'

import { UserPointsMap } from '@/components/UserPoints/UserPointsMap'
import { PHONE_LIST_IMAGE_HEIGHT } from '@/components/UserPoints/PointCard'
import { PointsListSkeleton, WIDE_LIST_SKELETON_IMAGE_HEIGHT } from '@/components/UserPoints/PointsListSkeleton'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsiveWidth } from '@/hooks/useResponsive'
import { METRICS } from '@/constants/layout'
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import IconButton from '@/components/ui/IconButton'
import type { MapUiApi } from '@/types/mapUi'
import { resolveExportedFunction } from '@/utils/moduleInterop'
import { nominatimSearch } from '@/api/external/nominatim'
import { getMapGeocoderLanguage } from '@/utils/mapLocale'

import type { PointsListStyles } from './types'
import { translate as i18nT } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { createLocalStyles } from './PointsListGrid.styles'


let getFiltersPanelStylesSafe: ((...args: any[]) => any) | null = null
try {
  const mod = require('@/components/MapPage/filtersPanelStyles')
  getFiltersPanelStylesSafe = resolveExportedFunction(mod, 'getFiltersPanelStyles')
} catch {
  getFiltersPanelStylesSafe = null
}

type ViewMode = 'list' | 'map'

export const PointsListGrid: React.FC<{
  styles: PointsListStyles
  colors: { text: string }

  viewMode: ViewMode
  isLoading: boolean
  filteredPoints: any[]
  listExtraData?: any
  listKey?: string
  /** Прогресс фоновой докачки коллекции — строка «Загружено N из M» под списком (#3133). */
  loadProgress?: { loaded: number; total: number; complete: boolean }
  panelTab?: 'filters' | 'list'
  onPanelTabChange?: (tab: 'filters' | 'list') => void

  numColumns?: number

  renderHeader: () => React.ReactElement
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
  loadProgress,
  panelTab: controlledPanelTab,
  onPanelTabChange,
  numColumns,
  renderHeader,
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
  const compactControls = isWeb && windowWidth < 1200
  const themedColors = useThemedColors()
  const localStyles = useMemo(() => createLocalStyles(themedColors), [themedColors])
  const mapSettingsStyles = useMemo(
    () =>
      typeof getFiltersPanelStylesSafe === 'function'
        ? getFiltersPanelStylesSafe(themedColors as any, !isWideScreen, windowWidth)
        : ({} as any),
    [themedColors, isWideScreen, windowWidth]
  )
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
  const [searchMarker, setSearchMarker] = React.useState<null | { lat: number; lng: number; label?: string }>(null)
  const geocodeAbortRef = React.useRef<AbortController | null>(null)
  const geocodeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedQueryRef = React.useRef<string>('')
  // #3133: число во вкладке — через форматтер локали («2 656»), а пока первая
  // страница не пришла — многоточие вместо «(0)», которое читалось как «точек нет».
  const listCountLabel = isLoading ? '…' : formatInteger(filteredPoints.length)
  // Сегмент мобильного таб-бара — треть ширины 320–390 px: число в подписи
  // («Список (2655)») там не помещается ни с разрядами, ни без. Счётчик идёт
  // отдельным бейджем сегмента (как у общей карты), подпись — короткое «Список».
  const mobileListBadge = isLoading ? undefined : filteredPoints.length
  // На 320 px сегмент ≈ 97 px: иконка + «Список» + бейдж «2656» не помещаются
  // (прод-проба 08.11: scrollWidth > clientWidth), без иконок — помещаются.
  const showMobileTabIcons = windowWidth >= METRICS.breakpoints.phone
  const panelOptions = React.useMemo(
    () => [
      { key: 'filters', label: i18nT('map:components.UserPoints.PointsListGrid.filtry_karty_bf82f2ec') },
      { key: 'list', label: i18nT('map:components.UserPoints.PointsListGrid.spisok_value1_cc1e53c4', { value1: listCountLabel }) },
    ],
    [listCountLabel]
  )
  const mobileTabOptions = React.useMemo(
    () => [
      { key: 'map', label: i18nT('map:components.UserPoints.PointsListGrid.karta_b48708d8'), icon: showMobileTabIcons ? 'map' : undefined },
      { key: 'list', label: i18nT('map:components.UserPoints.PointsListHeader.spisok_b0731a7f'), icon: showMobileTabIcons ? 'list' : undefined, badge: mobileListBadge },
      { key: 'filters', label: i18nT('map:components.UserPoints.PointsListGrid.filtry_a9025123'), icon: showMobileTabIcons ? 'filter-list' : undefined },
    ],
    [mobileListBadge, showMobileTabIcons]
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

  const renderMapCanvas = React.useCallback(
    () => (
      <View style={styles.mapInner} {...SCREEN_CONTENT_FIRST_PROPS}>
	        <UserPointsMap
	          points={filteredPoints}
	          center={currentLocation ?? undefined}
	          searchMarker={searchMarker}
	          routeLines={recommendedRouteLines}
	          onMapPress={onMapPress}
	          onEditPoint={onPointEdit}
	          onDeletePoint={onPointDelete}
	          pendingMarker={showManualAdd ? manualCoords : null}
	          pendingMarkerColor={manualColor}
	          activePointId={activePointId ?? undefined}
	          onPointPress={onMapPointPress}
	          onMapUiApiReady={setMapUiApi}
	        />

        <IconButton
          icon={<Feather name="crosshair" size={20} color={colors.text} />}
          label={i18nT('map:components.UserPoints.PointsListGrid.moe_mestopolozhenie_852e92f2')}
          onPress={onLocateMe}
          disabled={isLocating}
          style={[styles.locateFab, isLocating && styles.locateFabDisabled]}
        />
      </View>
    ),
	    [
	      activePointId,
	      colors.text,
	      currentLocation,
	      filteredPoints,
	      onMapPointPress,
	      isLocating,
	      manualColor,
	      manualCoords,
      onLocateMe,
      onMapPress,
      onPointDelete,
      onPointEdit,
      recommendedRouteLines,
      searchMarker,
      showManualAdd,
      styles.locateFab,
      styles.locateFabDisabled,
      styles.mapInner,
    ]
  )

  const renderFiltersPanel = React.useCallback(
    (isMobilePanel: boolean) => (
      <ScrollView
        style={localStyles.rightPanelScroll}
        contentContainerStyle={localStyles.rightPanelContent}
        showsVerticalScrollIndicator={true}
      >
        {renderHeader()}
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
      renderHeader,
      showMapSettings,
      themedColors,
    ]
  )

  const renderListHeader = React.useCallback(
    () => (
      <>
        <View style={localStyles.listControlsRow}>
          <TextInput
            {...searchInputAccessibilityProps()}
            style={localStyles.listSearchInput as any}
            value={searchQuery}
            onChangeText={onSearch}
            placeholder={i18nT('map:components.UserPoints.PointsListGrid.poisk_po_nazvaniyu_adresu_opisaniyu_i_kategorii_bd6ebf74')}
            placeholderTextColor={themedColors.textMuted}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListGrid.poisk_po_nazvaniyu_adresu_opisaniyu_i_kategorii_bd6ebf74')}
            testID="userpoints-list-search"
          />

          <View style={localStyles.listControlsActions}>
            {onOpenActions ? (
              <IconButton
                icon={<Feather name="settings" size={16} color={themedColors.text} />}
                label={i18nT('map:components.UserPoints.PointsListGrid.upravlenie_tochkami_fcf804c2')}
                onPress={onOpenActions}
                size="sm"
                testID="userpoints-actions-open"
                showLabel={!compactControls}
              />
            ) : null}

            <IconButton
              icon={<Feather name="sliders" size={16} color={themedColors.text} />}
              label={i18nT('map:components.UserPoints.PointsListGrid.filtry_a9025123')}
              onPress={() => setPanelTab('filters')}
              size="sm"
              testID="userpoints-list-open-filters"
              showLabel={!compactControls}
            />

            <IconButton
              icon={<Feather name="rotate-ccw" size={16} color={themedColors.text} />}
              label={i18nT('map:components.UserPoints.PointsListGrid.sbrosit_filtry_811750be')}
              onPress={onResetFilters}
              disabled={!hasFilters}
              size="sm"
              testID="userpoints-list-reset-filters"
              showLabel={!compactControls}
            />
          </View>
        </View>

        {showingRecommendations ? (
          <View style={localStyles.recommendationsHeader}>
            <RNText style={localStyles.recommendationsTitle}>{i18nT('map:components.UserPoints.PointsListGrid.3_sluchaynye_tochki_iz_vashih_24a90489')}</RNText>
            <View style={localStyles.recommendationsActions}>
              <IconButton
                icon={<Feather name="refresh-cw" size={16} color={themedColors.text} />}
                label={i18nT('map:components.UserPoints.PointsListGrid.obnovit_335ad256')}
                onPress={onRefreshRecommendations}
                size="sm"
                showLabel
              />
              <IconButton
                icon={<Feather name="x" size={16} color={themedColors.textOnPrimary} />}
                label={i18nT('map:components.UserPoints.PointsListGrid.vse_tochki_2d6d6b49')}
                onPress={onCloseRecommendations}
                size="sm"
                active
                showLabel
              />
            </View>
          </View>
        ) : null}
        {/* PERM-3: геолокации нет — маршрутов к точкам тоже; просим её по кнопке, а не при загрузке. */}
        {showingRecommendations && !currentLocation ? (
          <View style={localStyles.recommendationsLocationRow} testID="userpoints-recommendations-need-location">
            <RNText style={localStyles.recommendationsLocationHint}>
              {i18nT('map:components.UserPoints.PointsListGrid.recommendationsNeedLocation')}
            </RNText>
            <IconButton
              icon={<Feather name="crosshair" size={16} color={themedColors.text} />}
              label={i18nT('map:components.UserPoints.PointsListGrid.recommendationsLocateCta')}
              onPress={onLocateMe}
              disabled={isLocating}
              size="sm"
              showLabel
              testID="userpoints-recommendations-locate"
            />
          </View>
        ) : null}
      </>
    ),
    [
      currentLocation,
      isLocating,
      onLocateMe,
      localStyles.recommendationsLocationHint,
      localStyles.recommendationsLocationRow,
      hasFilters,
      localStyles.listControlsRow,
      localStyles.listControlsActions,
      localStyles.listSearchInput,
      localStyles.recommendationsActions,
      localStyles.recommendationsHeader,
      localStyles.recommendationsTitle,
      compactControls,
      onCloseRecommendations,
      onOpenActions,
      onRefreshRecommendations,
      onResetFilters,
      onSearch,
      searchQuery,
      showingRecommendations,
      setPanelTab,
      themedColors.text,
      themedColors.textMuted,
      themedColors.textOnPrimary,
    ]
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

  // #3133: подвал списка — прогресс фоновой докачки. Пока страницы стримятся,
  // счётчик вкладки растёт скачками по 200; строка объясняет, что это загрузка.
  const renderListFooter = React.useCallback(() => {
    if (isLoading || !loadProgress || loadProgress.complete || loadProgress.total <= loadProgress.loaded) return null
    return (
      <RNText style={localStyles.listProgressText} testID="userpoints-list-progress">
        {i18nT('map:components.UserPoints.PointsListGrid.zagruzheno_value1_iz_value2_6c50f47e', {
          value1: formatInteger(loadProgress.loaded),
          value2: formatInteger(loadProgress.total),
        })}
      </RNText>
    )
  }, [isLoading, loadProgress, localStyles.listProgressText])

  // Пока первая страница не пришла — каркас карточек, не пустота и не «нет точек».
  // Высота фото каркаса повторяет карточку (#2253: каркас ≠ карточка → прыжок при замене).
  const renderListEmpty = React.useCallback(
    () =>
      isLoading ? (
        <PointsListSkeleton imageHeight={isWideScreen ? WIDE_LIST_SKELETON_IMAGE_HEIGHT : PHONE_LIST_IMAGE_HEIGHT} />
      ) : (
        renderEmpty()
      ),
    [isLoading, isWideScreen, renderEmpty]
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
        // Элемент, а не ссылка на функцию: FlashList делает createElement(функция),
        // и новая identity колбэка (каждое нажатие в поиске) ремаунтила бы шапку —
        // поле поиска теряло бы фокус после каждого символа.
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
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
      renderListFooter,
      renderPointListItem,
      renderListHeader,
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

  React.useEffect(() => {
    // Геокодинг пустого результата — по применённому запросу: иначе Nominatim
    // дёргался бы на промежуточных буквах, пока список ещё не пересчитан (#3132).
    const q = String(appliedSearchQuery || '').trim();
    if (!q) {
      setSearchMarker(null)
      lastGeocodedQueryRef.current = ''
      geocodeAbortRef.current?.abort()
      geocodeAbortRef.current = null
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current)
        geocodeTimerRef.current = null
      }
      return
    }

    if (Array.isArray(filteredPoints) && filteredPoints.length > 0) {
      setSearchMarker(null)
      lastGeocodedQueryRef.current = ''
      geocodeAbortRef.current?.abort()
      geocodeAbortRef.current = null
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current)
        geocodeTimerRef.current = null
      }
      return
    }

    if (!mapUiApi?.focusOnCoord) return
    if (lastGeocodedQueryRef.current === q) return

    const focusWith = (coords: { lat: number; lng: number; label?: string; zoom?: number }) => {
      setSearchMarker({ lat: coords.lat, lng: coords.lng, label: coords.label })
      lastGeocodedQueryRef.current = q
      try {
        mapUiApi.focusOnCoord?.(`${coords.lat},${coords.lng}`, { zoom: coords.zoom ?? 11 })
      } catch {
        // noop
      }
    }

    const focusFallback = () => {
      focusWith({ lat: 53.902496, lng: 27.561481, label: i18nT('map:components.UserPoints.PointsListGrid.minsk_f73327f9'), zoom: 10 })
    }

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => {
      geocodeTimerRef.current = null
      geocodeAbortRef.current?.abort()

      const controller = new AbortController()
      geocodeAbortRef.current = controller

      nominatimSearch(
        { q, limit: 1, addressdetails: 1, acceptLanguage: getMapGeocoderLanguage() },
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (controller.signal.aborted) return
          const item = Array.isArray(data) ? data[0] : null
          const lat = Number(item?.lat)
          const lng = Number(item?.lon)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            focusFallback()
            return
          }

          focusWith({ lat, lng, label: String(item?.display_name ?? ''), zoom: 13 })
        })
        .catch(() => {
          if (controller.signal.aborted) return
          focusFallback()
        })
    }, 450)

    return () => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current)
        geocodeTimerRef.current = null
      }
      geocodeAbortRef.current?.abort()
    }
  }, [appliedSearchQuery, filteredPoints, mapUiApi])

  // На узком экране режим показа полностью определяется верхним 3-таб-баром
  // (Карта / Список / Фильтры) ниже, поэтому standalone list-режим (с тяжёлой
  // summary-шапкой) применяем только на десктопе/широком web.
  if (viewMode === 'list' && isWideScreen) {
    const columns = typeof numColumns === 'number' && Number.isFinite(numColumns) ? numColumns : 1
    // #3133: desktop list-режим тоже виртуализирован — раньше web рисовал все
    // filteredPoints.map без окна.
    return (
      <FlashList
        data={filteredPoints}
        extraData={listFlashExtraData}
        renderItem={({ item, index }: { item: any; index: number }) => {
          if (columns <= 1) {
            return renderItem({ item })
          }
          const gap = 12
          const col = columns > 0 ? index % columns : 0
          const isFirst = col === 0
          const isLast = col === columns - 1
          const paddingLeft = isFirst ? 0 : gap / 2
          const paddingRight = isLast ? 0 : gap / 2
          return (
            <View style={{ paddingLeft, paddingRight }}>
              {renderItem({ item })}
            </View>
          )
        }}
        keyExtractor={(item: { id?: string | number }, index: number) => String(item?.id ?? `idx-${index}`)}
        {...({ estimatedItemSize: 120 } as any)}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
        numColumns={columns}
        key={String(columns)}
        contentContainerStyle={columns > 1 ? styles.gridListContent : styles.listContent}
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
          {renderMapCanvas()}
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
        renderMapCanvas()
      ) : mobileTab === 'filters' ? (
        <View style={localStyles.mobilePanelContainer}>{renderFiltersPanel(true)}</View>
      ) : (
        <View style={localStyles.mobilePanelContainer}>{renderListPanel()}</View>
      )}
    </View>
  )
}
