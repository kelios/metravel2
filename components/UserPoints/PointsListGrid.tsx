import React, { useMemo } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions, ScrollView, TextInput, Text as RNText, RefreshControl } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { FlashList } from '@shopify/flash-list'

import { UserPointsMap } from '@/components/UserPoints/UserPointsMap'
import { useThemedColors } from '@/hooks/useTheme'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import { getFiltersPanelStyles } from '@/components/MapPage/filtersPanelStyles'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import IconButton from '@/components/ui/IconButton'
import type { MapUiApi } from '@/types/mapUi'

import type { PointsListStyles } from './PointsList'

type ViewMode = 'list' | 'map'

export const PointsListGrid: React.FC<{
  styles: PointsListStyles
  colors: { text: string }

  viewMode: ViewMode
  isLoading: boolean
  filteredPoints: any[]
  listExtraData?: any
  listKey?: string
  panelTab?: 'filters' | 'list'
  onPanelTabChange?: (tab: 'filters' | 'list') => void

  numColumns?: number

  renderHeader: () => React.ReactElement
  renderItem: ({ item }: { item: any }) => React.ReactElement
  renderEmpty: () => React.ReactElement

  renderFooter?: () => React.ReactElement | null

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
  panelTab: controlledPanelTab,
  onPanelTabChange,
  numColumns,
  renderHeader,
  renderItem,
  renderEmpty,
	  renderFooter,
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
  onSearch,
  hasFilters,
  onResetFilters,
  showMapSettings = false,
}) => {
  const { width: windowWidth } = useWindowDimensions()
  const isWeb = Platform.OS === 'web'
  const isWideScreen = isWeb && windowWidth >= 1024
  const themedColors = useThemedColors()
  const localStyles = useMemo(() => createLocalStyles(themedColors), [themedColors])
  const mapSettingsStyles = useMemo(
    () => getFiltersPanelStyles(themedColors as any, !isWideScreen, windowWidth),
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
  const [showMobilePanel, setShowMobilePanel] = React.useState(() => !isWideScreen)
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce)
  const [mapUiApi, setMapUiApi] = React.useState<MapUiApi | null>(null)
  const didInitialFitRef = React.useRef(false)
  const [searchMarker, setSearchMarker] = React.useState<null | { lat: number; lng: number; label?: string }>(null)
  const geocodeAbortRef = React.useRef<AbortController | null>(null)
  const geocodeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedQueryRef = React.useRef<string>('')
  const panelOptions = React.useMemo(
    () => [
      { key: 'filters', label: 'Фильтры' },
      { key: 'list', label: `Список (${filteredPoints.length})` },
    ],
    [filteredPoints.length]
  )

  const renderMapCanvas = React.useCallback(
    () => (
      <View style={styles.mapInner}>
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
          label="Моё местоположение"
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
            showLegend={false}
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
            style={localStyles.listSearchInput as any}
            value={searchQuery}
            onChangeText={onSearch}
            placeholder="Поиск по названию..."
            placeholderTextColor={themedColors.textMuted}
            accessibilityLabel="Поиск по названию..."
            testID="userpoints-list-search"
          />

          <IconButton
            icon={<Feather name="sliders" size={16} color={themedColors.text} />}
            label="Фильтры"
            onPress={() => setPanelTab('filters')}
            size="sm"
            testID="userpoints-list-open-filters"
            showLabel
          />

          <IconButton
            icon={<Feather name="rotate-ccw" size={16} color={themedColors.text} />}
            label="Сбросить"
            onPress={onResetFilters}
            disabled={!hasFilters}
            size="sm"
            testID="userpoints-list-reset-filters"
            showLabel
          />
        </View>

        {showingRecommendations ? (
          <View style={localStyles.recommendationsHeader}>
            <RNText style={localStyles.recommendationsTitle}>Куда поехать сегодня</RNText>
            <View style={localStyles.recommendationsActions}>
              <IconButton
                icon={<Feather name="refresh-cw" size={16} color={themedColors.text} />}
                label="Обновить"
                onPress={onRefreshRecommendations}
                size="sm"
                showLabel
              />
              <IconButton
                icon={<Feather name="x" size={16} color={themedColors.textOnPrimary} />}
                label="Все точки"
                onPress={onCloseRecommendations}
                size="sm"
                active
                showLabel
              />
            </View>
          </View>
        ) : null}
      </>
    ),
    [
      hasFilters,
      localStyles.listControlsRow,
      localStyles.listSearchInput,
      localStyles.recommendationsActions,
      localStyles.recommendationsHeader,
      localStyles.recommendationsTitle,
      onCloseRecommendations,
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

  const renderListPanel = React.useCallback(
    () => (
      isWeb ? (
        <ScrollView
          key={listKey ?? 'userpoints-list'}
          style={localStyles.rightPanelScroll}
          contentContainerStyle={[localStyles.rightPanelContent, localStyles.pointsList] as any}
          testID="userpoints-panel-content-list"
          showsVerticalScrollIndicator={true}
        >
          {renderListHeader()}
          {filteredPoints.map((item: any) => {
            const routeInfo = recommendedRoutes?.[Number(item?.id)]
            return (
              <View key={String(item?.id)} style={localStyles.pointsListItem}>
                {renderItem({ item })}
                {showingRecommendations && routeInfo ? (
                  <View style={localStyles.routeInfo}>
                    <RNText style={localStyles.routeInfoText}>
                      {routeInfo.distance} км · ~{routeInfo.duration} мин
                    </RNText>
                  </View>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
      ) : (
        <FlashList
          key={listKey ?? 'userpoints-list'}
          style={localStyles.rightPanelScroll}
          contentContainerStyle={[localStyles.rightPanelContent, localStyles.pointsList] as any}
          data={filteredPoints}
          extraData={listExtraData}
          keyExtractor={(item) => String((item as any)?.id)}
          testID="userpoints-panel-content-list"
          renderItem={({ item }) => {
            const routeInfo = recommendedRoutes?.[Number((item as any)?.id)]
            return (
              <View style={localStyles.pointsListItem}>
                {renderItem({ item })}
                {showingRecommendations && routeInfo ? (
                  <View style={localStyles.routeInfo}>
                    <RNText style={localStyles.routeInfoText}>
                      {routeInfo.distance} км · ~{routeInfo.duration} мин
                    </RNText>
                  </View>
                ) : null}
              </View>
            )
          }}
          ListHeaderComponent={renderListHeader()}
          showsVerticalScrollIndicator={true}
          drawDistance={600}
        />
      )
    ),
    [
      filteredPoints,
      isWeb,
      listExtraData,
      listKey,
      localStyles.pointsList,
      localStyles.pointsListItem,
      localStyles.rightPanelContent,
      localStyles.rightPanelScroll,
      localStyles.routeInfo,
      localStyles.routeInfoText,
      recommendedRoutes,
      renderItem,
      renderListHeader,
      showingRecommendations,
    ]
  )
  
  // Auto-switch to list tab when showing recommendations
  React.useEffect(() => {
    if (showingRecommendations) {
      setPanelTab('list');
    }
  }, [setPanelTab, showingRecommendations]);
  
  // Listen to map panel toggle for mobile
  React.useEffect(() => {
    if (toggleNonce > 0 && !isWideScreen) {
      setShowMobilePanel((prev) => !prev);
    }
  }, [toggleNonce, isWideScreen]);

  // Initial viewport fit: after first load, auto-fit to currently visible points once.
  React.useEffect(() => {
    if (didInitialFitRef.current) return;
    if (viewMode !== 'map') return;
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
  }, [activePointId, filteredPoints, isLoading, mapUiApi, showingRecommendations, viewMode]);

  React.useEffect(() => {
    const q = String(searchQuery || '').trim();
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
      focusWith({ lat: 53.902496, lng: 27.561481, label: 'Минск', zoom: 10 })
    }

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => {
      geocodeTimerRef.current = null
      geocodeAbortRef.current?.abort()

      const controller = new AbortController()
      geocodeAbortRef.current = controller

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&accept-language=ru`

      fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })
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
    }
  }, [filteredPoints, mapUiApi, searchQuery])

  if (viewMode === 'list') {
    const columns = typeof numColumns === 'number' && Number.isFinite(numColumns) ? numColumns : 1
    if (isWeb) {
      return (
        <ScrollView
          contentContainerStyle={columns > 1 ? styles.gridListContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
          }
        >
          {renderHeader()}
          {filteredPoints.length === 0 && !isLoading ? renderEmpty() : null}
          {columns > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {filteredPoints.map((item: any, index: number) => {
                const gap = 12
                const col = columns > 0 ? index % columns : 0
                const isFirst = col === 0
                const isLast = col === columns - 1
                const paddingLeft = isFirst ? 0 : gap / 2
                const paddingRight = isLast ? 0 : gap / 2
                return (
                  <View key={String(item.id)} style={{ paddingLeft, paddingRight, width: `${100 / columns}%` }}>
                    {renderItem({ item })}
                  </View>
                )
              })}
            </View>
          ) : (
            filteredPoints.map((item: any) => (
              <React.Fragment key={String(item.id)}>
                {renderItem({ item })}
              </React.Fragment>
            ))
          )}
          {renderFooter?.()}
        </ScrollView>
      )
    }
    return (
      <FlashList
        data={filteredPoints}
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
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
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
              accessibilityLabel="Панель"
              compact
            />
          </View>

          {panelTab === 'filters' ? renderFiltersPanel(false) : renderListPanel()}
        </View>
      </View>
    )
  }

  // Map mode for mobile/narrow screens
  return (
    <View style={styles.mapContainer}>
      {showMobilePanel ? (
        <View style={localStyles.mobilePanelContainer}>
          <View style={localStyles.panelTabs}>
            <SegmentedControl
              options={panelOptions}
              value={panelTab}
              onChange={(key) => setPanelTab(key as 'filters' | 'list')}
              accessibilityLabel="Панель"
              compact
            />
          </View>

          {panelTab === 'filters' ? renderFiltersPanel(true) : renderListPanel()}
        </View>
      ) : (
        renderMapCanvas()
      )}
    </View>
  )
}

const createLocalStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  mapLayoutContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mapMainContent: {
    flex: 1,
  },
  mapRightPanel: {
    width: 420,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '-10px 0 30px rgba(0,0,0,0.06)',
          zIndex: 2,
        } as any)
      : null),
  },
  mobilePanelContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  panelTabs: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  rightPanelScroll: {
    flex: 1,
  },
  rightPanelContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pointsList: {
    padding: 16,
  },
  listControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  listSearchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  pointsListItem: {
    marginBottom: 16,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    marginBottom: 16,
    gap: 12,
  },
  recommendationsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: colors.text,
    flex: 1,
  },
  routeInfo: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: '600' as any,
    color: colors.text,
  },
});
