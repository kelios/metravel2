import React, { useMemo } from 'react'
import { FlatList, Platform, StyleSheet, View, TouchableOpacity, useWindowDimensions, ScrollView, TextInput, Text as RNText } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointsMap } from '@/components/UserPoints/PointsMap'
import { useThemedColors } from '@/hooks/useTheme'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import { getFiltersPanelStyles } from '@/components/MapPage/filtersPanelStyles'
import type { MapUiApi } from '@/src/types/mapUi'

import type { PointsListStyles } from './PointsList'

type ViewMode = 'list' | 'map'

export const PointsListGrid: React.FC<{
  styles: PointsListStyles
  colors: { text: string }

  viewMode: ViewMode
  isLoading: boolean
  filteredPoints: any[]

  numColumns?: number

  renderHeader: () => React.ReactElement
  renderItem: ({ item }: { item: any }) => React.ReactElement
  renderEmpty: () => React.ReactElement

  renderFooter?: () => React.ReactElement | null

  onRefresh: () => void

  currentLocation: { lat: number; lng: number } | null
  onMapPress: (coords: { lat: number; lng: number }) => void
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
}> = ({
  styles,
  colors,
  viewMode,
  isLoading,
  filteredPoints,
  numColumns,
  renderHeader,
  renderItem,
  renderEmpty,
  renderFooter,
  onRefresh,
  currentLocation,
  onMapPress,
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
  const [panelTab, setPanelTab] = React.useState<'filters' | 'list'>('list')
  const [showMobilePanel, setShowMobilePanel] = React.useState(() => !isWideScreen)
  const toggleNonce = useMapPanelStore((s) => s.toggleNonce)
  const [mapUiApi, setMapUiApi] = React.useState<MapUiApi | null>(null)
  
  // Auto-switch to list tab when showing recommendations
  React.useEffect(() => {
    if (showingRecommendations) {
      setPanelTab('list');
    }
  }, [showingRecommendations]);
  
  // Listen to map panel toggle for mobile
  React.useEffect(() => {
    if (toggleNonce > 0 && !isWideScreen) {
      setShowMobilePanel((prev) => !prev);
    }
  }, [toggleNonce, isWideScreen]);

  if (viewMode === 'list') {
    const columns = typeof numColumns === 'number' && Number.isFinite(numColumns) ? numColumns : 1
    return (
      <FlatList
        data={filteredPoints}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        numColumns={columns}
        key={String(columns)}
        contentContainerStyle={columns > 1 ? styles.gridListContent : styles.listContent}
        columnWrapperStyle={columns > 1 ? styles.gridColumnWrapper : undefined}
        refreshing={isLoading}
        onRefresh={onRefresh}
      />
    )
  }

  // Map mode with right panel for wide screens
  if (isWideScreen) {
    return (
      <View style={localStyles.mapLayoutContainer}>
        <View style={localStyles.mapMainContent}>
          <View style={styles.mapInner}>
            <PointsMap
              points={filteredPoints}
              center={currentLocation ?? undefined}
              routeLines={
                showingRecommendations
                  ? Object.entries(recommendedRoutes ?? {})
                      .map(([id, r]) => ({ id: Number(id), line: r?.line ?? [] }))
                      .filter((r) => Number.isFinite(r.id) && Array.isArray(r.line) && r.line.length > 1)
                  : []
              }
              onMapPress={onMapPress}
              onEditPoint={onPointEdit}
              onDeletePoint={onPointDelete}
              pendingMarker={showManualAdd ? manualCoords : null}
              pendingMarkerColor={manualColor}
              activePointId={activePointId ?? undefined}
              onPointPress={(p: any) => {
                // allow marker click to focus the same way as list click
                // (parent controls activePointId via list, this is a safe noop)
                void p;
              }}
              onMapUiApiReady={setMapUiApi}
            />

            <TouchableOpacity
              style={[styles.locateFab, isLocating && styles.locateFabDisabled]}
              onPress={onLocateMe}
              disabled={isLocating}
              accessibilityRole="button"
              accessibilityLabel="Моё местоположение"
            >
              <Feather name="crosshair" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={localStyles.mapRightPanel}>
          <View style={localStyles.panelTabs}>
            <TouchableOpacity
              style={[localStyles.panelTab, panelTab === 'filters' && localStyles.panelTabActive]}
              onPress={() => setPanelTab('filters')}
              accessibilityRole="button"
              accessibilityLabel="Фильтры"
              testID="userpoints-panel-tab-filters"
            >
              <RNText style={[localStyles.panelTabText, panelTab === 'filters' && localStyles.panelTabTextActive]}>
                Фильтры
              </RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.panelTab, panelTab === 'list' && localStyles.panelTabActive]}
              onPress={() => setPanelTab('list')}
              accessibilityRole="button"
              accessibilityLabel="Список"
              testID="userpoints-panel-tab-list"
            >
              <RNText style={[localStyles.panelTabText, panelTab === 'list' && localStyles.panelTabTextActive]}>
                Список ({filteredPoints.length})
              </RNText>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={localStyles.rightPanelScroll}
            contentContainerStyle={localStyles.rightPanelContent}
            showsVerticalScrollIndicator={true}
          >
            {panelTab === 'filters' && (
              <>
                {renderHeader()}
                {Platform.OS === 'web' ? (
                  <FiltersPanelMapSettings
                    colors={themedColors as any}
                    styles={mapSettingsStyles}
                    isMobile={false}
                    mode="radius"
                    mapUiApi={mapUiApi}
                    totalPoints={filteredPoints.length}
                    hasFilters={hasFilters}
                    canBuildRoute={false}
                    onReset={onResetFilters}
                    hideReset={!hasFilters}
                  />
                ) : null}
              </>
            )}
            
            {panelTab === 'list' && (
              <View style={localStyles.pointsList} testID="userpoints-panel-content-list">
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

                  <TouchableOpacity
                    style={localStyles.listControlButton}
                    onPress={() => setPanelTab('filters')}
                    accessibilityRole="button"
                    accessibilityLabel="Фильтры"
                    testID="userpoints-list-open-filters"
                  >
                    <Feather name="sliders" size={16} color={themedColors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[localStyles.listControlButton, !hasFilters && localStyles.listControlButtonDisabled]}
                    onPress={onResetFilters}
                    disabled={!hasFilters}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                    testID="userpoints-list-reset-filters"
                  >
                    <Feather name="rotate-ccw" size={16} color={themedColors.text} />
                  </TouchableOpacity>
                </View>

                {showingRecommendations && (
                  <View style={localStyles.recommendationsHeader}>
                    <RNText style={localStyles.recommendationsTitle}>Куда поехать сегодня</RNText>
                    <View style={localStyles.recommendationsActions}>
                      <TouchableOpacity
                        style={localStyles.recommendationsRefreshButton}
                        onPress={onRefreshRecommendations}
                        accessibilityRole="button"
                        accessibilityLabel="3 случайные точки"
                      >
                        <Feather name="refresh-cw" size={16} color={themedColors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={localStyles.closeRecommendationsButton}
                        onPress={onCloseRecommendations}
                        accessibilityRole="button"
                        accessibilityLabel="Показать все"
                      >
                        <Feather name="x" size={16} color={themedColors.textOnPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {filteredPoints.map((point) => {
                  const routeInfo = recommendedRoutes?.[Number(point.id)];
                  return (
                    <View key={point.id} style={localStyles.pointsListItem}>
                      {renderItem({ item: point })}
                      {showingRecommendations && routeInfo && (
                        <View style={localStyles.routeInfo}>
                          <RNText style={localStyles.routeInfoText}>
                            {routeInfo.distance} км · ~{routeInfo.duration} мин
                          </RNText>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
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
            <TouchableOpacity
              style={[localStyles.panelTab, panelTab === 'filters' && localStyles.panelTabActive]}
              onPress={() => setPanelTab('filters')}
              accessibilityRole="button"
              accessibilityLabel="Фильтры"
              testID="userpoints-panel-tab-filters"
            >
              <RNText style={[localStyles.panelTabText, panelTab === 'filters' && localStyles.panelTabTextActive]}>
                Фильтры
              </RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.panelTab, panelTab === 'list' && localStyles.panelTabActive]}
              onPress={() => setPanelTab('list')}
              accessibilityRole="button"
              accessibilityLabel="Список"
              testID="userpoints-panel-tab-list"
            >
              <RNText style={[localStyles.panelTabText, panelTab === 'list' && localStyles.panelTabTextActive]}>
                Список ({filteredPoints.length})
              </RNText>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={localStyles.rightPanelScroll}
            contentContainerStyle={localStyles.rightPanelContent}
            showsVerticalScrollIndicator={true}
          >
            {panelTab === 'filters' && (
              <>
                {renderHeader()}
                {Platform.OS === 'web' ? (
                  <FiltersPanelMapSettings
                    colors={themedColors as any}
                    styles={mapSettingsStyles}
                    isMobile={true}
                    mode="radius"
                    mapUiApi={mapUiApi}
                    totalPoints={filteredPoints.length}
                    hasFilters={hasFilters}
                    canBuildRoute={false}
                    onReset={onResetFilters}
                    hideReset={!hasFilters}
                  />
                ) : null}
              </>
            )}
            
            {panelTab === 'list' && (
              <View style={localStyles.pointsList} testID="userpoints-panel-content-list">
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

                  <TouchableOpacity
                    style={localStyles.listControlButton}
                    onPress={() => setPanelTab('filters')}
                    accessibilityRole="button"
                    accessibilityLabel="Фильтры"
                    testID="userpoints-list-open-filters"
                  >
                    <Feather name="sliders" size={16} color={themedColors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[localStyles.listControlButton, !hasFilters && localStyles.listControlButtonDisabled]}
                    onPress={onResetFilters}
                    disabled={!hasFilters}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                    testID="userpoints-list-reset-filters"
                  >
                    <Feather name="rotate-ccw" size={16} color={themedColors.text} />
                  </TouchableOpacity>
                </View>

                {showingRecommendations && (
                  <View style={localStyles.recommendationsHeader}>
                    <RNText style={localStyles.recommendationsTitle}>Куда поехать сегодня</RNText>
                    <View style={localStyles.recommendationsActions}>
                      <TouchableOpacity
                        style={localStyles.recommendationsRefreshButton}
                        onPress={onRefreshRecommendations}
                        accessibilityRole="button"
                        accessibilityLabel="3 случайные точки"
                      >
                        <Feather name="refresh-cw" size={16} color={themedColors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={localStyles.closeRecommendationsButton}
                        onPress={onCloseRecommendations}
                        accessibilityRole="button"
                        accessibilityLabel="Показать все"
                      >
                        <Feather name="x" size={16} color={themedColors.textOnPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {filteredPoints.map((point) => {
                  const routeInfo = recommendedRoutes?.[Number(point.id)];
                  return (
                    <View key={point.id} style={localStyles.pointsListItem}>
                      {renderItem({ item: point })}
                      {showingRecommendations && routeInfo && (
                        <View style={localStyles.routeInfo}>
                          <RNText style={localStyles.routeInfoText}>
                            {routeInfo.distance} км · ~{routeInfo.duration} мин
                          </RNText>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mapInner}>
          <PointsMap
            points={filteredPoints}
            center={currentLocation ?? undefined}
            onMapPress={onMapPress}
            onEditPoint={onPointEdit}
            onDeletePoint={onPointDelete}
            pendingMarker={showManualAdd ? manualCoords : null}
            pendingMarkerColor={manualColor}
            activePointId={activePointId ?? undefined}
            onMapUiApiReady={setMapUiApi}
          />

          <TouchableOpacity
            style={[styles.locateFab, isLocating && styles.locateFabDisabled]}
          onPress={onLocateMe}
          disabled={isLocating}
          accessibilityRole="button"
          accessibilityLabel="Моё местоположение"
        >
          <Feather name="crosshair" size={20} color={colors.text} />
        </TouchableOpacity>
        </View>
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
  },
  mobilePanelContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  panelTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  panelTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTabActive: {
    backgroundColor: colors.background,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  panelTabText: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: colors.textMuted,
  },
  panelTabTextActive: {
    color: colors.primary,
    fontWeight: '700' as any,
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
  listControlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listControlButtonDisabled: {
    opacity: 0.5,
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
  recommendationsRefreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recommendationsRefreshText: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: colors.text,
  },
  closeRecommendationsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  closeRecommendationsText: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: colors.textOnPrimary,
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
