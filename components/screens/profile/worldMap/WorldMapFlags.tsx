// [FE-634] T4 — Флаг-маркеры посещённых стран поверх scratch-карты.
// Позиционируются по центроиду страны (cx/cy в системе viewBox 0 0 1000 500).
// Оверлей привязан не ко всему контейнеру, а к фактическому SVG-rect после
// preserveAspectRatio=meet: в fullscreen на портретном экране вокруг карты есть
// letterbox-отступы, и проценты от полной высоты сдвигают флаги с геометрии.
// pointerEvents='none' — тапы проходят сквозь флажки к путям карты (T6).
// Флаг = эмодзи из ISO; XK/невалидные → код-пилюля.
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
  getCountryFlagAnchor,
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
  /** Cover-режим (fullscreen-портрет): SVG заполняет контейнер (slice), а не вписан. */
  cover?: boolean
}

function WorldMapFlagsComponent({ visitedCodes, size = 16, zoom, cover = false }: WorldMapFlagsProps) {
  const colors = useThemedColors()
  const mapScaleValue = useSharedValue(1)
  const [mapRect, setMapRect] = React.useState({
    left: 0,
    top: 0,
    width: WORLD_MAP_WIDTH,
    height: WORLD_MAP_HEIGHT,
  })
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width <= 0 || height <= 0) return

    // meet (inline): min-scale + положит. offset (леттербокс). cover (fullscreen):
    // max-scale + отрицат. offset (кадр за краем) — как SVG slice центрирует.
    const scale = cover
      ? Math.max(width / WORLD_MAP_WIDTH, height / WORLD_MAP_HEIGHT)
      : Math.min(width / WORLD_MAP_WIDTH, height / WORLD_MAP_HEIGHT)
    const next = {
      left: (width - WORLD_MAP_WIDTH * scale) / 2,
      top: (height - WORLD_MAP_HEIGHT * scale) / 2,
      width: WORLD_MAP_WIDTH * scale,
      height: WORLD_MAP_HEIGHT * scale,
    }
    mapScaleValue.value = scale
    setMapRect((current) => {
      const changed =
        Math.abs(current.left - next.left) > 0.5 ||
        Math.abs(current.top - next.top) > 0.5 ||
        Math.abs(current.width - next.width) > 0.5 ||
        Math.abs(current.height - next.height) > 0.5
      return changed ? next : current
    })
  }, [mapScaleValue, cover])

  const markers = useMemo(() => {
    const list: { code: string; left: DimensionValue; top: DimensionValue; emoji: string | null }[] = []
    for (const code of visitedCodes) {
      const geom = getCountryFlagAnchor(code)
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

  // Оверлей-трансформ в px: viewBox-translate * k, где k — реальный SVG scale.
  const overlayStyle = useAnimatedStyle(() => {
    if (!zoom) return {}
    const k = mapScaleValue.value
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
        overlayRoot: { ...StyleSheet.absoluteFillObject },
        mapLayer: {
          position: 'absolute',
          transformOrigin: 'top left',
        },
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
    <View style={styles.overlayRoot} pointerEvents="none" onLayout={onLayout}>
      <Animated.View
        style={[
          styles.mapLayer,
          {
            left: mapRect.left,
            top: mapRect.top,
            width: mapRect.width,
            height: mapRect.height,
          },
          overlayStyle,
        ]}
      >
        {markers.map((m) => (
          <Animated.View
            key={m.code}
            testID={`world-map-flag-${m.code}`}
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
    </View>
  )
}

export const WorldMapFlags = React.memo(WorldMapFlagsComponent)
export default WorldMapFlags
