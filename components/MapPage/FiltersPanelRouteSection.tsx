import React, { useMemo } from 'react'
import { Text, View } from 'react-native'

import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import RouteBuilder from '@/components/MapPage/RouteBuilder'
import RoutingStatus from '@/components/MapPage/RoutingStatus'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import ValidationMessage from '@/components/MapPage/ValidationMessage'
import MapIcon from './MapIcon'
import { RouteValidator } from '@/utils/routeValidator'
import type { ThemedColors } from '@/hooks/useTheme'
import type { LatLng } from '@/types/coordinates'
import type { RoutePoint } from '@/types/route'
import {
  getTransportLabel,
  getTransportModes,
  TRANSPORT_SPEED_KMH,
  type TransportMode,
} from './transportModes'
import { translate as i18nT } from '@/i18n'


function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function sumHaversineDistance(points: RoutePoint[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]?.coordinates
    const next = points[i]?.coordinates
    if (!prev || !next) continue
    if (
      !Number.isFinite(prev.lat) ||
      !Number.isFinite(prev.lng) ||
      !Number.isFinite(next.lat) ||
      !Number.isFinite(next.lng)
    ) {
      continue
    }
    total += haversineMeters(
      { lat: prev.lat, lng: prev.lng },
      { lat: next.lat, lng: next.lng },
    )
  }
  return Number.isFinite(total) ? total : 0
}

function estimateDurationSeconds(meters: number, mode: TransportMode) {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  const speed = TRANSPORT_SPEED_KMH[mode] ?? TRANSPORT_SPEED_KMH.car
  const seconds = Math.round((meters / 1000 / speed) * 3600)
  return Number.isFinite(seconds) ? seconds : 0
}

interface FiltersPanelRouteSectionProps {
  colors: ThemedColors
  styles: any
  isMobile?: boolean
  mode: 'radius' | 'route'
  transportMode: TransportMode
  setTransportMode: (m: TransportMode) => void
  startAddress: string
  endAddress: string
  routingLoading?: boolean
  routingError?: string | boolean | null
  routeDistance?: number | null
  routeDuration?: number | null
  routeElevationGain?: number | null
  routeElevationLoss?: number | null
  routePoints?: RoutePoint[]
  onRemoveRoutePoint?: (id: string) => void
  onClearRoute?: () => void
  swapStartEnd?: () => void
  onRetryRoute?: () => void
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void
  onAddressClear?: (isStart: boolean) => void
}

const FiltersPanelRouteSection: React.FC<FiltersPanelRouteSectionProps> = ({
  colors,
  styles,
  isMobile = false,
  mode,
  transportMode,
  setTransportMode,
  startAddress,
  endAddress,
  routingLoading,
  routingError,
  routeDistance,
  routeDuration,
  routeElevationGain,
  routeElevationLoss,
  routePoints = [],
  onRemoveRoutePoint,
  onClearRoute,
  swapStartEnd,
  onRetryRoute,
  onAddressSelect,
  onAddressClear,
}) => {
  const startSelected = !!routePoints[0]
  const endSelected = !!routePoints[1]
  const hasTwoPoints = mode === 'route' && routePoints.length >= 2
  const remainingPoints = Math.max(0, 2 - routePoints.length)
  const selectedTransportLabel = getTransportLabel(transportMode)

  const validation = useMemo(() => {
    if (mode === 'route' && routePoints.length > 0) {
      return RouteValidator.validate(routePoints)
    }
    return { valid: true, errors: [], warnings: [] }
  }, [mode, routePoints])

  const fallbackDistanceMeters = useMemo(
    () => (hasTwoPoints ? sumHaversineDistance(routePoints) : 0),
    [hasTwoPoints, routePoints],
  )

  const storeDistance = typeof routeDistance === 'number' ? routeDistance : 0
  const storeDuration = typeof routeDuration === 'number' ? routeDuration : 0
  const effectiveDistance = storeDistance > 0 ? storeDistance : fallbackDistanceMeters
  const effectiveDuration =
    storeDuration > 0 ? storeDuration : estimateDurationSeconds(effectiveDistance, transportMode)
  const isEstimated = !(storeDistance > 0 && storeDuration > 0)
  const shouldShowRouteStats =
    hasTwoPoints &&
    (Boolean(routingLoading) ||
      Boolean(routingError) ||
      effectiveDistance > 0 ||
      effectiveDuration > 0)

  return (
    <View style={[styles.section, styles.routeSectionCompact]}>
      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>1</Text>
          <Text style={styles.lightStepTitle}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.transport_aa70a7ea')}</Text>
          {isMobile && <Text style={styles.lightStepBadge}>{selectedTransportLabel}</Text>}
        </View>
        <SegmentedControl
          options={[...getTransportModes()]}
          value={transportMode}
          onChange={(key) => setTransportMode(key as TransportMode)}
          accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelRouteSection.transport_aa70a7ea')}
          compact
          dense
          noOuterMargins
          role="button"
          tone="subtle"
          iconOnly={isMobile}
        />
      </View>

      <View style={styles.lightStepBlock}>
        <View style={styles.lightStepHeader}>
          <Text style={styles.lightStepNumber}>2</Text>
          <Text style={styles.lightStepTitle}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}</Text>
          {startSelected && endSelected ? (
            <View style={styles.lightCheckBadge}>
              <MapIcon name="check" size={12} color={colors.success} />
              <Text style={styles.lightCheckText}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.gotovo_aab95a18')}</Text>
            </View>
          ) : (
            <Text style={styles.lightStepHint}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.vyberite_tochki_fb6530e6')}</Text>
          )}
        </View>

        {onAddressSelect && (
          <RouteBuilder
            startAddress={startAddress}
            endAddress={endAddress}
            onAddressSelect={onAddressSelect}
            onAddressClear={onAddressClear}
            onSwap={swapStartEnd}
            onClear={onClearRoute}
            compact
          />
        )}

        {!hasTwoPoints && (
          <View style={styles.noPointsToast} testID="route-empty-state">
            <Text style={styles.noPointsTitle}>
              {routePoints.length === 0
                ? i18nT('map:components.MapPage.FiltersPanelRouteSection.snachala_vyberite_start_i_finish_ffb07516')
                : i18nT('map:components.MapPage.FiltersPanelRouteSection.nuzhna_esche_odna_tochka_6663beeb')}
            </Text>
            <Text style={styles.noPointsSubtitle}>
              {routePoints.length === 0
                ? i18nT('map:components.MapPage.FiltersPanelRouteSection.nachnite_s_adresa_ili_otmette_pervuyu_tochku_1296572f')
                : i18nT('map:components.MapPage.FiltersPanelRouteSection.marshrut_pochti_gotov_dobavte_esche_value1_t_c7314962', { value1: remainingPoints })}
            </Text>
            {routePoints.length > 0 && onClearRoute && (
              <View style={styles.noPointsActions}>
                <Button
                  label={i18nT('map:components.MapPage.FiltersPanelRouteSection.ochistit_marshrut_cf553839')}
                  onPress={onClearRoute}
                  accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelRouteSection.ochistit_marshrut_cf553839')}
                  size="sm"
                  variant="outline"
                  style={styles.ctaButton}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {shouldShowRouteStats && (
        <View style={styles.lightStepBlock} testID="route-stats-block">
          <View style={styles.lightStepHeader}>
            <Text style={styles.lightStepNumber}>3</Text>
            <Text style={styles.lightStepTitle}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.itog_marshruta_aa8b7865')}</Text>
            {isEstimated && !routingLoading && !routingError && (
              <Text style={styles.lightStepHint}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.otsenka_b6ef51eb')}</Text>
            )}
          </View>
          <View testID="route-stats">
            <RoutingStatus
              isLoading={!!routingLoading}
              error={routingError || null}
              distance={effectiveDistance > 0 ? effectiveDistance : null}
              duration={effectiveDuration > 0 ? effectiveDuration : null}
              transportMode={transportMode}
              isEstimated={isEstimated}
              elevationGain={routeElevationGain ?? null}
              elevationLoss={routeElevationLoss ?? null}
              onRetry={onRetryRoute}
              compact
            />
          </View>
        </View>
      )}

      {!onAddressSelect && mode === 'route' && routePoints.length > 0 && (
        <View style={styles.lightStepBlock}>
          <Text style={styles.lightSectionLabel}>{i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}</Text>
          <View style={styles.lightPointsList} testID="route-points-list">
            {routePoints.map((p, index) => {
              const label = String(p?.address || '').trim() || i18nT(
                'map:components.MapPage.FiltersPanelRouteSection.pointFallback',
                { value1: index + 1 },
              )
              const canRemove = typeof onRemoveRoutePoint === 'function' && Boolean(p?.id)
              const key = String(p?.id ?? index)
              return (
                <View key={key} style={styles.lightPointRow}>
                  <View style={styles.lightPointDot}>
                    <Text style={styles.lightPointDotText}>{index + 1}</Text>
                  </View>
                  <Text
                    style={styles.lightPointLabel}
                    numberOfLines={1}
                    testID={`route-point-pill-${key}`}
                  >
                    {label}
                  </Text>
                  <IconButton
                    icon={<MapIcon name="close" size={14} color={colors.textMuted} />}
                    label={i18nT('map:components.MapPage.FiltersPanelRouteSection.udalit_tochku_value1_928ec407', { value1: label })}
                    size="sm"
                    disabled={!canRemove}
                    onPress={() => {
                      if (canRemove) onRemoveRoutePoint?.(String(p.id))
                    }}
                    style={[
                      styles.lightPointRemove,
                      !canRemove && styles.lightPointRemoveDisabled,
                    ]}
                    testID={`route-point-remove-${key}`}
                  />
                </View>
              )
            })}
          </View>
        </View>
      )}

      {!validation.valid && <ValidationMessage type="error" messages={validation.errors} />}
      {validation.warnings.length > 0 && (
        <ValidationMessage type="warning" messages={validation.warnings} />
      )}
    </View>
  )
}

export default React.memo(FiltersPanelRouteSection)
