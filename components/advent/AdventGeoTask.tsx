import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatNumber } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventGeoTarget } from '@/types/advent'
import type { AdventPaperPalette } from '@/constants/adventVisuals'
import { checkAdventGeoAnswer } from '@/utils/advent/adventRiddle'
import AdventCelebration from './AdventCelebration'
import { useAdventPaper } from './useAdventPaper'

// Карта тяжёлая (Leaflet на web, нативная карта в приложении) и нужна одной
// дверце из 27 — грузится при открытии её листа, а не вместе с экраном.
const UserPointsMap = lazy(() => import('@/components/UserPoints/UserPointsMap'))

type Props = {
  target: AdventGeoTarget
  xp?: number
  onComplete: () => void
}

const MAP_HEIGHT = 280
/** Беларусь целиком — вид по умолчанию, если у задания свой не задан. */
const DEFAULT_VIEW = { lat: 53.7, lng: 27.9, zoom: 6 }

type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
const DIRECTIONS: Direction[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
/** Явные ключи: компилятор локализации web инлайнит только литералы. */
const directionLabel = (direction: Direction): string => {
  switch (direction) {
    case 'n':
      return i18nT('adventStatic:geo.dir.n')
    case 'ne':
      return i18nT('adventStatic:geo.dir.ne')
    case 'e':
      return i18nT('adventStatic:geo.dir.e')
    case 'se':
      return i18nT('adventStatic:geo.dir.se')
    case 's':
      return i18nT('adventStatic:geo.dir.s')
    case 'sw':
      return i18nT('adventStatic:geo.dir.sw')
    case 'w':
      return i18nT('adventStatic:geo.dir.w')
    default:
      return i18nT('adventStatic:geo.dir.nw')
  }
}

/** Куда двигаться от клика к цели: восемь румбов по начальному азимуту. */
export const adventGeoDirection = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): Direction => {
  const rad = Math.PI / 180
  const dLng = (to.lng - from.lng) * rad
  const y = Math.sin(dLng) * Math.cos(to.lat * rad)
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLng)
  const bearing = (Math.atan2(y, x) / rad + 360) % 360
  return DIRECTIONS[Math.round(bearing / 45) % 8]
}

/**
 * «Где это?»: клик по карте засчитывается в радиусе цели (#2862). Карта
 * открывается на виде задания (`mapCenter`/`mapZoom`), без маркера «Моё
 * местоположение»; промах подсказывает направление, попадание празднуется и
 * карта с меткой остаётся на виду (#3482).
 */
function AdventGeoTask({ target, xp, onComplete }: Props) {
  const colors = useThemedColors()
  const paper = useAdventPaper()
  const styles = useMemo(() => createStyles(colors, paper), [colors, paper])
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null)
  const [result, setResult] = useState<{ hit: boolean; distanceMeters: number; direction: Direction } | null>(null)
  const initialView = useMemo(
    () => ({
      lat: target.mapCenter?.lat ?? DEFAULT_VIEW.lat,
      lng: target.mapCenter?.lng ?? DEFAULT_VIEW.lng,
      zoom: target.mapZoom ?? DEFAULT_VIEW.zoom,
    }),
    [target.mapCenter?.lat, target.mapCenter?.lng, target.mapZoom],
  )

  const handleMapPress = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (result?.hit) return
      setMarker(coords)
      const check = checkAdventGeoAnswer(target, coords)
      setResult({ ...check, direction: adventGeoDirection(coords, target) })
      if (check.hit) onComplete()
    },
    [target, result?.hit, onComplete],
  )

  return (
    <View style={styles.wrap} testID="advent-geo">
      <View style={styles.map}>
        <Suspense
          fallback={
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>{i18nT('adventStatic:geo.loading')}</Text>
            </View>
          }
        >
          <UserPointsMap
            points={[]}
            initialView={initialView}
            onMapPress={handleMapPress}
            pendingMarker={marker}
            pendingMarkerColor={result?.hit ? paper.gold : colors.primary}
            height={MAP_HEIGHT}
          />
        </Suspense>
      </View>
      {result?.hit ? (
        <AdventCelebration testID="advent-geo-result" text={i18nT('adventStatic:geo.hit')} xp={xp} />
      ) : result ? (
        <Text testID="advent-geo-result" accessibilityLiveRegion="polite" style={styles.miss}>
          {i18nT('adventStatic:geo.miss', {
            value1: formatNumber(result.distanceMeters / 1000, { maximumFractionDigits: 0 }),
            value2: directionLabel(result.direction),
          })}
        </Text>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors, paper: AdventPaperPalette) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    map: { height: MAP_HEIGHT, borderRadius: DESIGN_TOKENS.radii.md, overflow: 'hidden', backgroundColor: colors.backgroundSecondary },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: DESIGN_TOKENS.spacing.xs },
    loadingText: { fontSize: 13, color: colors.textMuted },
    miss: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: paper.gold },
  })

export default memo(AdventGeoTask)
