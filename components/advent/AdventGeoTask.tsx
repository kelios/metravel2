import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatNumber } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventGeoTarget } from '@/types/advent'
import { checkAdventGeoAnswer } from '@/utils/advent/adventRiddle'

// Карта тяжёлая (Leaflet на web, нативная карта в приложении) и нужна одной
// дверце из 27 — грузится при открытии её листа, а не вместе с экраном.
const UserPointsMap = lazy(() => import('@/components/UserPoints/UserPointsMap'))

type Props = {
  target: AdventGeoTarget
  onComplete: () => void
}

const MAP_HEIGHT = 280
const DEFAULT_CENTER = { lat: 53.9, lng: 27.56 }

/** «Где это?»: клик по карте засчитывается в радиусе цели — расчёт расстояния квестов (#2862). */
function AdventGeoTask({ target, onComplete }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null)
  const [result, setResult] = useState<{ hit: boolean; distanceMeters: number } | null>(null)

  const handleMapPress = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (result?.hit) return
      setMarker(coords)
      const check = checkAdventGeoAnswer(target, coords)
      setResult(check)
      if (check.hit) onComplete()
    },
    [target, result?.hit, onComplete],
  )

  return (
    <View style={styles.wrap} testID="advent-geo">
      <Text style={styles.instruction}>{i18nT('adventStatic:geo.instruction')}</Text>
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
            center={target.mapCenter ?? DEFAULT_CENTER}
            onMapPress={handleMapPress}
            pendingMarker={marker}
            pendingMarkerColor={result?.hit ? colors.success : colors.primary}
            height={MAP_HEIGHT}
          />
        </Suspense>
      </View>
      {result ? (
        <Text
          testID="advent-geo-result"
          accessibilityLiveRegion="polite"
          style={[styles.result, { color: result.hit ? colors.success : colors.danger }]}
        >
          {result.hit
            ? i18nT('adventStatic:geo.hit')
            : i18nT('adventStatic:geo.miss', { value1: formatNumber(result.distanceMeters / 1000, { maximumFractionDigits: 1 }) })}
        </Text>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    instruction: { fontSize: 15, lineHeight: 22, color: colors.text },
    map: { height: MAP_HEIGHT, borderRadius: DESIGN_TOKENS.radii.md, overflow: 'hidden', backgroundColor: colors.backgroundSecondary },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: DESIGN_TOKENS.spacing.xs },
    loadingText: { fontSize: 13, color: colors.textMuted },
    result: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  })

export default memo(AdventGeoTask)
