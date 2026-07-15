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
import { translate as i18nT } from '@/i18n'


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
        format === 'kml' ? i18nT('travel:components.travel.details.sections.TravelPointsBlock.sohranit_tochki_dlya_oflayn_kart_8c53aa7a') : i18nT('travel:components.travel.details.sections.TravelPointsBlock.sohranit_tochki_marshruta_e800918a'),
      )
      if (!saved) throw new Error('save-unavailable')
      showToast({
        type: 'success',
        text1: Platform.OS === 'web'
          ? i18nT('travel:components.travel.details.sections.TravelPointsBlock.fayl_value1_sohranen_86fa3f3b', { value1: format.toUpperCase() })
          : i18nT('travel:components.travel.details.sections.TravelPointsBlock.fayl_value1_gotov_dlya_karty_63707e91', { value1: format.toUpperCase() }),
        visibilityTime: 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: i18nT('travel:components.travel.details.sections.TravelPointsBlock.ne_udalos_peredat_tochki_85a7dc9b'),
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
        text1: i18nT('travel:components.travel.details.sections.TravelPointsBlock.nedostatochno_tochek_dlya_marshruta_5f4ab155'),
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
      accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelPointsBlock.koordinaty_mest_149babcb')}
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
        >{i18nT('travel:components.travel.details.sections.TravelPointsBlock.koordinaty_mest_149babcb')}</Text>
        {canExportPoints ? (
          <View style={styles.pointsExportWrap}>
            <View
              style={styles.pointsExportActions}
              {...(Platform.OS === 'web'
                ? ({
                    role: 'group',
                    'aria-label': i18nT('travel:components.travel.details.sections.TravelPointsBlock.eksport_tochek_marshruta_32f3945f'),
                    'aria-describedby': 'travel-points-export-hint',
                  } as any)
                : {})}
            >
              <Button
                label={i18nT('travel:components.travel.details.sections.TravelPointsBlock.gpx_560eddf5')}
                size="sm"
                variant="secondary"
                icon={<Feather name="download" size={14} color={colors.text} />}
                accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelPointsBlock.skachat_vse_tochki_v_gpx_ecbc7d1f')}
                testID="travel-points-export-gpx"
                onPress={() => handleExportPoints('gpx')}
                loading={exportingFormat === 'gpx'}
                disabled={Boolean(exportingFormat)}
                style={styles.pointsExportButton}
                labelStyle={styles.pointsExportButtonText}
              />
              <Button
                label={i18nT('travel:components.travel.details.sections.TravelPointsBlock.kml_ebbe16fa')}
                size="sm"
                variant="secondary"
                icon={<Feather name="download" size={14} color={colors.text} />}
                accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelPointsBlock.skachat_vse_tochki_v_kml_dlya_organic_maps_i_3f382085')}
                testID="travel-points-export-kml"
                onPress={() => handleExportPoints('kml')}
                loading={exportingFormat === 'kml'}
                disabled={Boolean(exportingFormat)}
                style={styles.pointsExportButton}
                labelStyle={styles.pointsExportButtonText}
              />
              <Button
                label={i18nT('travel:components.travel.details.sections.TravelPointsBlock.google_ebcfc697')}
                size="sm"
                variant="secondary"
                icon={<Feather name="map" size={14} color={colors.text} />}
                accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelPointsBlock.otkryt_vse_tochki_v_google_maps_67b6c145')}
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
            >{i18nT('travel:components.travel.details.sections.TravelPointsBlock.kml_organic_maps_maps_me_gpx_navigatory_24953070')}</Text>
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
