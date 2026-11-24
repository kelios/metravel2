import { memo, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ADVENT_VISUAL_ASSETS, type AdventFacadeRegion, type AdventFacadeSource } from '@/constants/adventVisuals'
import { ADVENT_HOUSE_ASPECT_RATIO, ADVENT_WINDOW_COLUMNS, ADVENT_WINDOW_ROWS } from './adventHouseLayout'

type Props = {
  /** Окно 1…24 фасада; для бонусных дверец и без дня — крыша дома под луной. */
  day?: number | null
  /** Ширина / высота рамки кропа. */
  aspectRatio: number
  /** Доля ширины фасада, видимая в рамке: меньше — ближе к окну. */
  zoom?: number
  /**
   * Облегчённые производные фасада, подходящие по разрешению этой рамке (#3488).
   * Берётся наименьшая, чья область целиком содержит кроп; иначе — полный фасад.
   */
  sources?: readonly AdventFacadeSource[]
  /**
   * Рамка без картинки: вызывающий ещё не знает размер рамки, значит и
   * подходящую производную (ширина экрана до гидратации = 0). Иначе грузятся
   * две картинки — по догадке и по факту (#3488).
   */
  deferImage?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

const ROOF_CENTER = { x: 0.5, y: 0.17 }
const ROOF_ZOOM = 0.92
const WINDOW_ZOOM = 0.46

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const pct = (value: number): `${number}%` => `${Number(value.toFixed(3))}%`

/** Область кропа в долях фасада: левый верхний угол и размер. */
export type AdventWindowRect = { left: number; top: number; width: number; height: number }

const FULL_FACADE: AdventFacadeSource = {
  key: 'full',
  source: ADVENT_VISUAL_ASSETS.facade,
  region: { x: 0, y: 0, width: 1, height: 1 },
}
const EPSILON = 1e-6

/**
 * Область фасада вокруг окна дня: та же иллюстрация, что на доме, поэтому
 * шапка листа и баннер главной продолжают картинку, а не заменяют её (#3482).
 * Чистая геометрия по `adventHouseLayout`, без замеров: одинаково в статическом
 * HTML, после гидратации и на native.
 */
export function resolveAdventWindowRect(day: number | null | undefined, aspectRatio: number, zoom?: number): AdventWindowRect {
  const index = typeof day === 'number' && day >= 1 && day <= ADVENT_WINDOW_COLUMNS.length * ADVENT_WINDOW_ROWS.length ? day - 1 : -1
  const center = index >= 0
    ? { x: ADVENT_WINDOW_COLUMNS[index % ADVENT_WINDOW_COLUMNS.length] / 100, y: ADVENT_WINDOW_ROWS[Math.floor(index / ADVENT_WINDOW_COLUMNS.length)] / 100 }
    : ROOF_CENTER
  const fw = clamp(zoom ?? (index >= 0 ? WINDOW_ZOOM : ROOF_ZOOM), 0.05, 1)
  // Высота области в долях фасада: пропорции рамки при пропорциях картинки 2:3.
  const fh = clamp((fw * ADVENT_HOUSE_ASPECT_RATIO) / aspectRatio, 0.02, 1)
  return {
    left: clamp(center.x - fw / 2, 0, 1 - fw),
    top: clamp(center.y - fh / 2, 0, 1 - fh),
    width: fw,
    height: fh,
  }
}

/** Размер и сдвиг всего фасада относительно рамки кропа (проценты рамки). */
export function resolveAdventWindowCrop(day: number | null | undefined, aspectRatio: number, zoom?: number) {
  const { left, top, width: fw, height: fh } = resolveAdventWindowRect(day, aspectRatio, zoom)
  return {
    width: pct(100 / fw),
    height: pct(100 / fh),
    left: pct((-left / fw) * 100),
    top: pct((-top / fh) * 100),
  }
}

const covers = (region: AdventFacadeRegion, rect: AdventWindowRect) =>
  rect.left >= region.x - EPSILON &&
  rect.top >= region.y - EPSILON &&
  rect.left + rect.width <= region.x + region.width + EPSILON &&
  rect.top + rect.height <= region.y + region.height + EPSILON

/**
 * Из производных, внутри которых целиком лежит кроп, — с наименьшей областью
 * (меньше килобайт при том же разрешении); иначе полный фасад: пустых полей в
 * рамке не бывает, лишь лишние килобайты (#3488).
 */
export function pickAdventFacadeSource(rect: AdventWindowRect, sources: readonly AdventFacadeSource[] = []): AdventFacadeSource {
  let best: AdventFacadeSource | null = null
  for (const candidate of sources) {
    if (!covers(candidate.region, rect)) continue
    const area = candidate.region.width * candidate.region.height
    if (!best || area < best.region.width * best.region.height) best = candidate
  }
  return best ?? FULL_FACADE
}

function AdventWindowCrop({ day, aspectRatio, zoom, sources, deferImage = false, style, testID }: Props) {
  const crop = useMemo(() => resolveAdventWindowCrop(day, aspectRatio, zoom), [day, aspectRatio, zoom])
  const picked = useMemo(
    () => pickAdventFacadeSource(resolveAdventWindowRect(day, aspectRatio, zoom), sources),
    [day, aspectRatio, zoom, sources],
  )
  // Картинка закрывает свою часть фасада: полный фасад — весь блок, полоса — свой ряд.
  const placement = useMemo(
    () => ({
      left: pct(picked.region.x * 100),
      top: pct(picked.region.y * 100),
      width: pct(picked.region.width * 100),
      height: pct(picked.region.height * 100),
    }),
    [picked],
  )
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
      {deferImage ? null : (
        <View style={[styles.art, crop]}>
          <View style={[styles.art, placement]} testID={testID ? `${testID}-source-${picked.key}` : undefined}>
            <ImageCardMedia
              source={picked.source}
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
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', position: 'relative' },
  art: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
})

export default memo(AdventWindowCrop)
