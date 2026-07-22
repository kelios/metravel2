import React, { Suspense, useCallback, useState } from 'react'
import { Platform, Text, View } from 'react-native'

import { ROUTE_MARKERS_ANCHOR_ID } from './helpers'
import { NativePointList } from './NativePointList'
import { NativeRoutePickerMap } from './NativeRoutePickerMap'
import { PointEditorSheet } from './PointEditorSheet'
import type { RouteMapCardProps } from './types'
import { translate as i18nT } from '@/i18n'


const WebMapComponent = Platform.OS === 'web'
  ? React.lazy(() => import('@/components/travel/WebMapComponent'))
  : null

export const RouteMapCard = React.memo(function RouteMapCard({
  categoryTravelAddress,
  countries,
  markers,
  styles,
  isCompactLayout,
  anchorRef,
  onMarkersChange,
  onCountrySelect,
  onCountryDeselect,
  onPhotoMarkerReady,
  onMarkerEditSave,
  onMarkerAdded,
  onMapPointAdd,
  onMapPointMove,
}: RouteMapCardProps) {
  // Единый редактор точки на native: открывается и тапом по маркеру на карте,
  // и кнопкой «Изменить» в списке точек.
  const [editorIndex, setEditorIndex] = useState<number | null>(null)
  const closeEditor = useCallback(() => setEditorIndex(null), [])

  const handlePointSave = useCallback(
    (index: number, payload: { address: string; categories: number[]; image: string | null }) => {
      const next = markers.map((marker, i) =>
        i === index
          ? { ...marker, address: payload.address, categories: payload.categories, image: payload.image }
          : marker,
      )
      onMarkerEditSave(next)
    },
    [markers, onMarkerEditSave],
  )

  const handlePointRemove = useCallback(
    (index: number) => {
      onMarkerEditSave(markers.filter((_, i) => i !== index))
    },
    [markers, onMarkerEditSave],
  )

  return (
    <View style={styles.card}>
      <View ref={anchorRef} nativeID={ROUTE_MARKERS_ANCHOR_ID} />
      <View style={[styles.mapContainer, isCompactLayout && styles.mapContainerCompact]}>
        {Platform.OS === 'web' && WebMapComponent ? (
          <Suspense
            fallback={
              <View style={styles.lazyFallback}>
                <Text style={styles.lazyFallbackText}>{i18nT('travel:components.travel.stepRoute.RouteMapCard.zagruzka_karty_1b8eb2da')}</Text>
              </View>
            }
          >
            <WebMapComponent
              markers={markers}
              onMarkersChange={onMarkersChange}
              categoryTravelAddress={categoryTravelAddress}
              countrylist={countries}
              onCountrySelect={onCountrySelect}
              onCountryDeselect={onCountryDeselect}
              onPhotoMarkerReady={onPhotoMarkerReady}
              onMarkerEditSave={onMarkerEditSave}
              onMarkerAdded={onMarkerAdded}
            />
          </Suspense>
        ) : (
          <NativeRoutePickerMap
            markers={markers}
            onAddPoint={onMapPointAdd}
            onMovePoint={onMapPointMove}
            onSelectPoint={setEditorIndex}
          />
        )}
      </View>
      {Platform.OS !== 'web' ? (
        <>
          <NativePointList
            markers={markers}
            onChange={onMarkerEditSave}
            onRequestEdit={setEditorIndex}
          />
          <PointEditorSheet
            visible={editorIndex != null}
            marker={editorIndex != null ? markers[editorIndex] ?? null : null}
            index={editorIndex ?? 0}
            categoryTravelAddress={categoryTravelAddress}
            onSave={handlePointSave}
            onRemove={handlePointRemove}
            onClose={closeEditor}
          />
        </>
      ) : null}
    </View>
  )
})
