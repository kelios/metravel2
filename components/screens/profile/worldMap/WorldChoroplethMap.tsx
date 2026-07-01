// [FE-634] T3 — SVG-хорплет мира для scratch-карты профиля.
// Серая заливка (surfaceMuted) для не посещённых стран, акцент (primary) для
// посещённых. Кросс-платформенно (react-native-svg работает на web и native),
// без web-only API. visited-набор приходит пропсом (источник — T2).
// [FE-635-T2] Зум/пан: <G> анимируется reanimated-трансформом (translate+scale),
// жесты pinch/pan (native) + onWheel (web). Тап по Path сохранён.

import React, { useCallback, useMemo } from 'react'
import { Platform, StyleProp, View, ViewStyle, type LayoutChangeEvent } from 'react-native'
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedProps, runOnJS } from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'

import { useTheme, useThemedColors } from '@/hooks/useTheme'
import type { MapZoomPanControls } from '@/hooks/useMapZoomPan'

import {
  WORLD_MAP_HEIGHT,
  WORLD_MAP_VIEWBOX,
  WORLD_MAP_WIDTH,
  getWorldMapUnvisitedFill,
  worldCountryCodes,
  worldCountryGeometry,
} from './worldGeometry'

const AnimatedG = Animated.createAnimatedComponent(G)

export interface WorldChoroplethMapProps {
  /** ISO alpha-2 (UPPERCASE) посещённых стран. */
  visitedCodes: ReadonlySet<string>
  /** Выделенная страна (тап/клик), подсвечивается сильнее. */
  selectedCode?: string | null
  /** Тап/клик по стране — отдаёт ISO alpha-2. Работает на web и native. */
  onCountryPress?: (code: string) => void
  /** Накладывается поверх карты (например, флаг-маркеры T4). */
  children?: React.ReactNode
  /** Зум/пан-контроллер (T2). Без него карта статична (scale=1). */
  zoom?: MapZoomPanControls
  style?: StyleProp<ViewStyle>
}

function WorldChoroplethMapComponent({
  visitedCodes,
  selectedCode,
  onCountryPress,
  children,
  zoom,
  style,
}: WorldChoroplethMapProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const unvisitedFill = getWorldMapUnvisitedFill(isDark)

  // px-размер контейнера → перевод экранных дельт жестов/колеса в координаты viewBox.
  const widthRef = React.useRef(WORLD_MAP_WIDTH)
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) widthRef.current = w
  }, [])

  // react-native-svg типизирует onPress пересечением (event => object) & (event => void).
  // Наш void-обработчик валиден в рантайме, но не проходит по второй ветви типа — кастуем.
  type PathPress = React.ComponentProps<typeof Path>['onPress']

  const paths = useMemo(
    () =>
      worldCountryCodes.map((code) => {
        const geom = worldCountryGeometry[code]
        const visited = visitedCodes.has(code)
        const selected = selectedCode === code
        const fill = selected
          ? colors.primaryDark
          : visited
            ? colors.primary
            : unvisitedFill
        return (
          <Path
            key={code}
            id={`wc-${code}`}
            d={geom.d}
            fill={fill}
            stroke={colors.background}
            strokeWidth={selected ? 1.2 : 0.4}
            onPress={
              onCountryPress
                ? ((() => onCountryPress(code)) as unknown as PathPress)
                : undefined
            }
          />
        )
      }),
    [
      visitedCodes,
      selectedCode,
      onCountryPress,
      colors.primary,
      colors.primaryDark,
      unvisitedFill,
      colors.background,
    ]
  )

  const animatedProps = useAnimatedProps(() => {
    if (!zoom) return { transform: '' }
    return {
      transform: `translate(${zoom.translateX.value} ${zoom.translateY.value}) scale(${zoom.scale.value})`,
    }
  })

  // Жесты pinch/pan — только на native: RNGH-web-шим нестабилен (Gesture API
  // местами отсутствует и роняет рендер). На web зум — колесо + кнопки +/−/сброс.
  const gesture = useMemo(() => {
    if (!zoom || Platform.OS === 'web') return undefined
    const toViewBox = () => WORLD_MAP_WIDTH / Math.max(1, widthRef.current)

    const pan = Gesture.Pan()
      // activeOffset вместо minDistance: web-шим gesture-handler не всегда
      // экспонирует minDistance; порог активации держит тап по стране проходящим.
      .activeOffsetX([-6, 6])
      .activeOffsetY([-6, 6])
      .onChange((e) => {
        const k = WORLD_MAP_WIDTH / Math.max(1, widthRef.current)
        runOnJS(zoom.panBy)(e.changeX * k, e.changeY * k)
      })

    const pinch = Gesture.Pinch().onChange((e) => {
      const k = toViewBox()
      // Фокус щипка в координатах viewBox: (focalScreen*k - translate) / scale.
      const fx = (e.focalX * k - zoom.translateX.value) / zoom.scale.value
      const fy = (e.focalY * k - zoom.translateY.value) / zoom.scale.value
      runOnJS(zoom.zoomAtPoint)(e.scaleChange, fx, fy, false)
    })

    return Gesture.Simultaneous(pan, pinch)
  }, [zoom])

  // Web: колесо → зум к курсору; pointer-drag → пан (порог 5px держит тап по стране).
  const dragRef = React.useRef({ x: 0, y: 0, active: false, moved: false })

  // Web-only: колесо. React вешает `wheel` как passive-listener на корень,
  // поэтому preventDefault() в React-onWheel игнорируется → страница скроллится
  // ПОВЕРХ зума. Вешаем нативный listener с { passive: false } прямо на DOM-узел.
  const containerRef = React.useRef<View | null>(null)
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !zoom) return
    const node = containerRef.current as unknown as HTMLElement | null
    if (!node || typeof node.addEventListener !== 'function') return
    const onWheel = (e: WheelEvent) => {
      const z = zoomRef.current
      if (!z) return
      e.preventDefault()
      const rect = node.getBoundingClientRect()
      if (!rect || rect.width <= 0) return
      const k = WORLD_MAP_WIDTH / rect.width
      const fx = ((e.clientX - rect.left) * k - z.translateX.value) / z.scale.value
      const fy = ((e.clientY - rect.top) * k - z.translateY.value) / z.scale.value
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      z.zoomAtPoint(factor, fx, fy, false)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoom])

  const webProps =
    Platform.OS === 'web' && zoom
      ? {
          onPointerDown: (e: { clientX: number; clientY: number }) => {
            dragRef.current = { x: e.clientX, y: e.clientY, active: true, moved: false }
          },
          onPointerMove: (e: { clientX: number; clientY: number; currentTarget: unknown }) => {
            const d = dragRef.current
            if (!d.active) return
            const rect = (
              e.currentTarget as { getBoundingClientRect?: () => { width: number } }
            ).getBoundingClientRect?.()
            if (!rect || rect.width <= 0) return
            const dx = e.clientX - d.x
            const dy = e.clientY - d.y
            if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
            d.moved = true
            const k = WORLD_MAP_WIDTH / rect.width
            zoom.panBy(dx * k, dy * k)
            d.x = e.clientX
            d.y = e.clientY
          },
          onPointerUp: () => {
            dragRef.current.active = false
          },
          onPointerLeave: () => {
            dragRef.current.active = false
          },
        }
      : null

  const map = (
    <View
      ref={containerRef}
      style={[{ width: '100%', aspectRatio: WORLD_MAP_WIDTH / WORLD_MAP_HEIGHT }, style]}
      onLayout={onLayout}
      // RN Web пробрасывает DOM-обработчики на <div>; типы RN View их не знают.
      {...((webProps ?? {}) as object)}
    >
      <Svg width="100%" height="100%" viewBox={WORLD_MAP_VIEWBOX}>
        {zoom ? (
          <AnimatedG animatedProps={animatedProps}>{paths}</AnimatedG>
        ) : (
          <G>{paths}</G>
        )}
      </Svg>
      {children}
    </View>
  )

  if (gesture) {
    // GestureDetector требует GestureHandlerRootView выше по дереву. Глобального
    // root в app/_layout.tsx НЕТ (заменён на обычный View из-за краша dev-client,
    // см. RootContainerView) — поэтому, как MapScreenShell/questWizardStepCard,
    // оборачиваем локально. Без него на Android GestureDetector роняет рендер.
    // gesture !== undefined только на native (web-ветка выше возвращает undefined).
    return (
      <GestureHandlerRootView style={{ width: '100%' }}>
        <GestureDetector gesture={gesture}>{map}</GestureDetector>
      </GestureHandlerRootView>
    )
  }
  return map
}

export const WorldChoroplethMap = React.memo(WorldChoroplethMapComponent)
export default WorldChoroplethMap
