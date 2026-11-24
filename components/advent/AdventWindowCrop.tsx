import { memo, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ADVENT_VISUAL_ASSETS } from '@/constants/adventVisuals'
import { ADVENT_HOUSE_ASPECT_RATIO, ADVENT_WINDOW_COLUMNS, ADVENT_WINDOW_ROWS } from './adventHouseLayout'

type Props = {
  /** Окно 1…24 фасада; для бонусных дверец и без дня — крыша дома под луной. */
  day?: number | null
  /** Ширина / высота рамки кропа. */
  aspectRatio: number
  /** Доля ширины фасада, видимая в рамке: меньше — ближе к окну. */
  zoom?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

const ROOF_CENTER = { x: 0.5, y: 0.17 }
const ROOF_ZOOM = 0.92
const WINDOW_ZOOM = 0.46

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const pct = (value: number): `${number}%` => `${Number(value.toFixed(3))}%`

/**
 * Область фасада вокруг окна дня: та же иллюстрация, что на доме, поэтому
 * шапка листа и баннер главной продолжают картинку, а не заменяют её (#3482).
 * Чистая геометрия по `adventHouseLayout`, без замеров: одинаково в статическом
 * HTML, после гидратации и на native.
 */
export function resolveAdventWindowCrop(day: number | null | undefined, aspectRatio: number, zoom?: number) {
  const index = typeof day === 'number' && day >= 1 && day <= ADVENT_WINDOW_COLUMNS.length * ADVENT_WINDOW_ROWS.length ? day - 1 : -1
  const center = index >= 0
    ? { x: ADVENT_WINDOW_COLUMNS[index % ADVENT_WINDOW_COLUMNS.length] / 100, y: ADVENT_WINDOW_ROWS[Math.floor(index / ADVENT_WINDOW_COLUMNS.length)] / 100 }
    : ROOF_CENTER
  const fw = clamp(zoom ?? (index >= 0 ? WINDOW_ZOOM : ROOF_ZOOM), 0.05, 1)
  // Высота области в долях фасада: пропорции рамки при пропорциях картинки 2:3.
  const fh = clamp((fw * ADVENT_HOUSE_ASPECT_RATIO) / aspectRatio, 0.02, 1)
  const left = clamp(center.x - fw / 2, 0, 1 - fw)
  const top = clamp(center.y - fh / 2, 0, 1 - fh)
  return {
    width: pct(100 / fw),
    height: pct(100 / fh),
    left: pct((-left / fw) * 100),
    top: pct((-top / fh) * 100),
  }
}

function AdventWindowCrop({ day, aspectRatio, zoom, style, testID }: Props) {
  const crop = useMemo(() => resolveAdventWindowCrop(day, aspectRatio, zoom), [day, aspectRatio, zoom])
  return (
    <View
      style={[styles.frame, { aspectRatio }, style]}
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <View style={[styles.art, crop]}>
        <ImageCardMedia
          source={ADVENT_VISUAL_ASSETS.facade}
          alt=""
          fit="cover"
          borderRadius={0}
          placeholderColor="#00000000"
          transition={0}
          showImmediately
          showLoadingIndicator={false}
          style={styles.fill}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', position: 'relative' },
  art: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
})

export default memo(AdventWindowCrop)
