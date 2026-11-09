import React from 'react'
import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { UserPointsMap } from '@/components/UserPoints/UserPointsMap'
import IconButton from '@/components/ui/IconButton'
import { translate as i18nT } from '@/i18n'
import type { MapUiApi } from '@/types/mapUi'
import type { ImportedPoint } from '@/types/userPoints'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'

import type { PointsListStyles } from './types'
import type { UserPointsSearchMarker } from './useUserPointsGeocode'

type Props = {
  styles: PointsListStyles
  colors: { text: string }
  points: ImportedPoint[]
  currentLocation: { lat: number; lng: number } | null
  searchMarker: UserPointsSearchMarker | null
  routeLines: Array<{ id: number; line: Array<[number, number]> }>
  activePointId?: number | null
  pendingMarker: { lat: number; lng: number } | null
  pendingMarkerColor: string
  isLocating: boolean
  onLocateMe: () => void
  onMapPress?: (coords: { lat: number; lng: number }) => void
  onMapPointPress?: (point: ImportedPoint) => void
  onPointEdit?: (point: ImportedPoint) => void
  onPointDelete?: (point: ImportedPoint) => void
  onMapUiApiReady: (api: MapUiApi | null) => void
}

/** Канвас карты «Моих точек» с кнопкой «Моё местоположение» (#3135: вынесен из `PointsListGrid`). */
export const UserPointsMapCanvas: React.FC<Props> = ({
  styles,
  colors,
  points,
  currentLocation,
  searchMarker,
  routeLines,
  activePointId,
  pendingMarker,
  pendingMarkerColor,
  isLocating,
  onLocateMe,
  onMapPress,
  onMapPointPress,
  onPointEdit,
  onPointDelete,
  onMapUiApiReady,
}) => (
  <View style={styles.mapInner} {...SCREEN_CONTENT_FIRST_PROPS}>
    <UserPointsMap
      points={points}
      center={currentLocation ?? undefined}
      searchMarker={searchMarker}
      routeLines={routeLines}
      onMapPress={onMapPress}
      onEditPoint={onPointEdit}
      onDeletePoint={onPointDelete}
      pendingMarker={pendingMarker}
      pendingMarkerColor={pendingMarkerColor}
      activePointId={activePointId ?? undefined}
      onPointPress={onMapPointPress}
      onMapUiApiReady={onMapUiApiReady}
    />

    <IconButton
      icon={<Feather name="crosshair" size={20} color={colors.text} />}
      label={i18nT('map:components.UserPoints.PointsListGrid.moe_mestopolozhenie_852e92f2')}
      onPress={onLocateMe}
      disabled={isLocating}
      style={[styles.locateFab, isLocating && styles.locateFabDisabled]}
    />
  </View>
)
