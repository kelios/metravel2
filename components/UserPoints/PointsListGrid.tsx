import React from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointsMap } from '@/components/UserPoints/PointsMap'

import type { PointsListStyles } from './PointsList'

type ViewMode = 'list' | 'map'

export const PointsListGrid: React.FC<{
  styles: PointsListStyles
  colors: { text: string }

  viewMode: ViewMode
  isLoading: boolean
  filteredPoints: any[]

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
}> = ({
  styles,
  colors,
  viewMode,
  isLoading,
  filteredPoints,
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
}) => {
  if (viewMode === 'list') {
    return (
      <FlatList
        data={filteredPoints}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={onRefresh}
      />
    )
  }

  return (
    <View style={styles.mapContainer}>
      {renderHeader()}
      <View style={styles.mapInner}>
        <PointsMap
          points={filteredPoints}
          center={currentLocation ?? undefined}
          onMapPress={onMapPress}
          onEditPoint={onPointEdit}
          onDeletePoint={onPointDelete}
          pendingMarker={showManualAdd ? manualCoords : null}
          pendingMarkerColor={manualColor}
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
  )
}
