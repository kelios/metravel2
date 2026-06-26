import React, { Suspense, useCallback, useMemo, useState } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Platform, Text, View } from 'react-native'

import { PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import PointList from '@/components/travel/PointList'
import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { buildGpx, buildKml, saveRouteExportFile } from '@/utils/routeExport'
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
  const [exportingFormat, setExportingFormat] = useState<'gpx' | 'kml' | null>(null)

  const exportableWaypoints = useMemo(
    () => getExportableTravelPointWaypoints(travel.travelAddress),
    [travel.travelAddress],
  )
  const hasTravelAddressPoints = Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0
  const canExportPoints = exportableWaypoints.length > 0

  const handleExportPoints = useCallback(async (format: 'gpx' | 'kml') => {
    if (exportingFormat) return
    setExportingFormat(format)
    try {
      const input = buildTravelPointsExportInput(travel)
      const result = format === 'gpx' ? buildGpx(input) : buildKml(input)
      const saved = await saveRouteExportFile(
        result,
        format === 'kml' ? 'Сохранить точки для офлайн-карт' : 'Сохранить точки маршрута',
      )
      if (!saved) throw new Error('save-unavailable')
      showToast({
        type: 'success',
        text1: Platform.OS === 'web'
          ? `Файл ${format.toUpperCase()} сохранён`
          : `Файл ${format.toUpperCase()} готов для карты`,
        visibilityTime: 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: 'Не удалось передать точки',
        visibilityTime: 3000,
      })
    } finally {
      setExportingFormat(null)
    }
  }, [exportingFormat, travel])

  const handleOpenGoogleMaps = useCallback(() => {
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
  }, [exportableWaypoints])

  if (!hasTravelAddressPoints) return null

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
            <View
              style={styles.pointsExportActions}
              {...(Platform.OS === 'web'
                ? ({
                    role: 'group',
                    'aria-label': 'Экспорт точек маршрута',
                    'aria-describedby': 'travel-points-export-hint',
                  } as any)
                : {})}
            >
              <Button
                label="GPX"
                size="sm"
                variant="secondary"
                icon={<Feather name="download" size={14} color={colors.text} />}
                accessibilityLabel="Скачать все точки в GPX"
                testID="travel-points-export-gpx"
                onPress={() => handleExportPoints('gpx')}
                loading={exportingFormat === 'gpx'}
                disabled={Boolean(exportingFormat)}
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
                loading={exportingFormat === 'kml'}
                disabled={Boolean(exportingFormat)}
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
            <Text
              style={styles.pointsExportHint}
              nativeID="travel-points-export-hint"
              {...(Platform.OS === 'web'
                ? ({ id: 'travel-points-export-hint' } as any)
                : {})}
            >KML — Organic Maps / MAPS.ME, GPX — навигаторы</Text>
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
