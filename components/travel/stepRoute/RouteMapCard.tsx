import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'

import { ROUTE_MARKERS_ANCHOR_ID } from './helpers'
import { NativeMapPlaceholder } from './NativeMapPlaceholder'
import { NativePointList } from './NativePointList'
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
}: RouteMapCardProps) {
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
          <NativeMapPlaceholder styles={styles} />
        )}
      </View>
      {Platform.OS !== 'web' ? (
        <NativePointList markers={markers} onChange={onMarkerEditSave} />
      ) : null}
    </View>
  )
})
