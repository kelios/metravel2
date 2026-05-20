import React, { Suspense } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Platform, Text, View } from 'react-native'

import { PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import PointList from '@/components/travel/PointList'
import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { buildGpx, buildKml, downloadTextFileWeb } from '@/utils/routeExport'
import { showToast } from '@/utils/toast'
import {
  buildGoogleMapsDirectionsUrl,
  buildTravelPointsExportInput,
  getExportableTravelPointWaypoints,
} from '@/utils/travelPointsExport'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const

const PointListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <PointListSkeleton />
    </View>
  )
}

export const TravelPointsBlock: React.FC<{
  anchors: AnchorsMap
  handlePointCardPress: (point: any) => void
  styles: any
  travel: Travel
}> = ({ anchors, handlePointCardPress, styles, travel }) => {
  const colors = useThemedColors()

  if (!travel.travelAddress || (travel.travelAddress as any[]).length <= 0) return null

  const exportableWaypoints = getExportableTravelPointWaypoints(travel.travelAddress)
  const canExportPoints = Platform.OS === 'web' && exportableWaypoints.length > 0

  const handleExportPoints = (format: 'gpx' | 'kml') => {
    try {
      const input = buildTravelPointsExportInput(travel)
      const result = format === 'gpx' ? buildGpx(input) : buildKml(input)
      downloadTextFileWeb(result)
      showToast({
        type: 'success',
        text1: `Файл ${format.toUpperCase()} сохранён`,
        visibilityTime: 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: 'Не удалось сохранить файл',
        visibilityTime: 3000,
      })
    }
  }

  const handleOpenGoogleMaps = () => {
    const url = buildGoogleMapsDirectionsUrl(exportableWaypoints)
    if (!url) {
      showToast({
        type: 'info',
        text1: 'Недостаточно точек для маршрута',
        visibilityTime: 2500,
      })
      return
    }
    void openExternalUrlInNewTab(url)
  }

  return (
    <View
      ref={anchors.points}
      testID="travel-details-points"
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
      collapsable={false}
      accessibilityLabel="Координаты мест"
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
      {...(Platform.OS === 'web'
        ? { 'data-testid': 'travel-details-points', 'data-section-key': 'points' }
        : {})}
    >
      <View style={styles.pointsHeaderRow}>
        <Text
          style={styles.sectionHeaderText}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
          aria-level={2 as any}
        >Координаты мест</Text>
        {canExportPoints ? (
          <View style={styles.pointsExportWrap}>
            <View style={styles.pointsExportActions}>
              <Button
                label="GPX"
                size="sm"
                variant="secondary"
                icon={<Feather name="download" size={14} color={colors.text} />}
                accessibilityLabel="Скачать все точки в GPX"
                testID="travel-points-export-gpx"
                onPress={() => handleExportPoints('gpx')}
                style={styles.pointsExportButton}
                labelStyle={styles.pointsExportButtonText}
              />
              <Button
                label="KML"
                size="sm"
                variant="secondary"
                icon={<Feather name="download" size={14} color={colors.text} />}
                accessibilityLabel="Скачать все точки в KML для Organic Maps и MAPS.ME"
                testID="travel-points-export-kml"
                onPress={() => handleExportPoints('kml')}
                style={styles.pointsExportButton}
                labelStyle={styles.pointsExportButtonText}
              />
              <Button
                label="Google"
                size="sm"
                variant="secondary"
                icon={<Feather name="map" size={14} color={colors.text} />}
                accessibilityLabel="Открыть все точки в Google Maps"
                testID="travel-points-open-google"
                onPress={handleOpenGoogleMaps}
                style={styles.pointsExportButton}
                labelStyle={styles.pointsExportButtonText}
              />
            </View>
            <Text style={styles.pointsExportHint}>KML — Organic Maps / MAPS.ME, GPX — навигаторы</Text>
          </View>
        ) : null}
      </View>
      <View style={SECTION_CONTENT_MARGIN_STYLE}>
        <Suspense fallback={<PointListFallback />}>
          <PointList
            points={travel.travelAddress as any}
            baseUrl={travel.url}
            travelName={travel.name}
            onPointCardPress={handlePointCardPress}
          />
        </Suspense>
      </View>
    </View>
  )
}

export default React.memo(TravelPointsBlock)
