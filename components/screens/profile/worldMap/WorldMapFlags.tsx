// [FE-634] T4 — Флаг-маркеры посещённых стран поверх scratch-карты.
// Позиционируются по центроиду страны (cx/cy в системе viewBox 0 0 1000 500),
// переведённому в проценты контейнера. Контейнер карты имеет aspectRatio 2 == 1000:500,
// а SVG использует preserveAspectRatio по умолчанию (meet) без леттербоксинга,
// поэтому процент центроида = процент пикселя. pointerEvents='none' — тапы проходят
// сквозь флажки к путям карты (T6). Флаг = эмодзи из ISO; XK/невалидные → код-пилюля.
// [FE-635-T2] При зуме оверлей трансформируется синхронно с SVG-<G> (px-space:
// scale viewBox→px = ширина/1000), а каждый маркер counter-scale (1/scale), чтобы
// флажки не раздувались.

import React, { useCallback, useMemo } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { useThemedColors } from '@/hooks/useTheme'
import type { MapZoomPanControls } from '@/hooks/useMapZoomPan'

import {
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
  getCountryGeometry,
} from './worldGeometry'

const REGIONAL_INDICATOR_A = 0x1f1e6

// ISO alpha-2 → эмодзи-флаг. null для кодов без флага (XK и т.п.).
const toFlagEmoji = (code: string): string | null => {
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return null
  if (cc === 'XK') return null // у Косова нет официального эмодзи-флага
  return String.fromCodePoint(
    REGIONAL_INDICATOR_A + (cc.charCodeAt(0) - 65),
    REGIONAL_INDICATOR_A + (cc.charCodeAt(1) - 65)
  )
}

export interface WorldMapFlagsProps {
  visitedCodes: ReadonlySet<string>
  /** Размер флажка в px (по умолчанию 16). */
  size?: number
  /** Зум/пан-контроллер (T2): оверлей следует за картой. */
  zoom?: MapZoomPanControls
}

function WorldMapFlagsComponent({ visitedCodes, size = 16, zoom }: WorldMapFlagsProps) {
  const colors = useThemedColors()
  const widthRef = React.useRef(WORLD_MAP_WIDTH)
  const widthValue = useSharedValue(WORLD_MAP_WIDTH)
  const [, forceTick] = React.useState(0)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0 && Math.abs(w - widthRef.current) > 0.5) {
      widthRef.current = w
      widthValue.value = w
      forceTick((t) => t + 1)
    }
  }, [widthValue])

  const markers = useMemo(() => {
    const list: { code: string; left: DimensionValue; top: DimensionValue; emoji: string | null }[] = []
    for (const code of visitedCodes) {
      const geom = getCountryGeometry(code)
      if (!geom) continue // микрогосударства без полигона в 110m — пропускаем (см. T1)
      list.push({
        code,
        left: `${(geom.cx / WORLD_MAP_WIDTH) * 100}%` as DimensionValue,
        top: `${(geom.cy / WORLD_MAP_HEIGHT) * 100}%` as DimensionValue,
        emoji: toFlagEmoji(code),
      })
    }
    return list
  }, [visitedCodes])

  // Оверлей-трансформ в px: viewBox-translate * k (k = ширина/1000), origin top-left.
  const overlayStyle = useAnimatedStyle(() => {
    if (!zoom) return {}
    const k = widthValue.value / WORLD_MAP_WIDTH
    return {
      transform: [
        { translateX: zoom.translateX.value * k },
        { translateY: zoom.translateY.value * k },
        { scale: zoom.scale.value },
      ],
    }
  })

  // Counter-scale маркеров: 1/scale, чтобы флажки не раздувались.
  const markerCounterStyle = useAnimatedStyle(() => {
    if (!zoom) return {}
    return { transform: [{ scale: 1 / zoom.scale.value }] }
  })

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { ...StyleSheet.absoluteFillObject, transformOrigin: 'top left' },
        marker: {
          position: 'absolute',
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emoji: {
          fontSize: size,
          lineHeight: size + 2,
        },
        pill: {
          paddingHorizontal: 3,
          borderRadius: 3,
          backgroundColor: colors.primary,
        },
        pillText: {
          fontSize: size - 6,
          fontWeight: '700',
          color: colors.primaryText,
        },
      }),
    [colors, size]
  )

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" onLayout={onLayout}>
      {markers.map((m) => (
        <Animated.View
          key={m.code}
          style={[styles.marker, { left: m.left, top: m.top }, markerCounterStyle]}
        >
          {m.emoji ? (
            <Text style={styles.emoji}>{m.emoji}</Text>
          ) : (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{m.code}</Text>
            </View>
          )}
        </Animated.View>
      ))}
    </Animated.View>
  )
}

export const WorldMapFlags = React.memo(WorldMapFlagsComponent)
export default WorldMapFlags
