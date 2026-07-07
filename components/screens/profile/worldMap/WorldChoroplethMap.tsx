// [FE-634] T3 — SVG-хорплет мира для scratch-карты профиля.
// Серая заливка (surfaceMuted) для не посещённых стран, акцент (primary) для
// посещённых. Кросс-платформенно (react-native-svg работает на web и native),
// без web-only API. visited-набор приходит пропсом (источник — T2).
// [FE-635-T2] Зум/пан: <G> анимируется reanimated-трансформом (translate+scale),
// жесты pinch/pan (native) + onWheel (web). Тап по Path сохранён.

import React, { useCallback, useMemo } from 'react'
import {
  PanResponder,
  Platform,
  StyleProp,
  View,
  ViewStyle,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, { useAnimatedProps } from 'react-native-reanimated'
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

const countryBounds = worldCountryCodes.map((code) => {
  const geom = worldCountryGeometry[code]
  const values = geom.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index]
    const y = values[index + 1]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return {
    code,
    minX,
    minY,
    maxX,
    maxY,
    area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY),
  }
})

const getCountryCodeAtViewBoxPoint = (x: number, y: number): string | null => {
  let bestCode: string | null = null
  let bestArea = Number.POSITIVE_INFINITY
  for (const bounds of countryBounds) {
    const contains =
      x >= bounds.minX &&
      x <= bounds.maxX &&
      y >= bounds.minY &&
      y <= bounds.maxY
    if (!contains || bounds.area >= bestArea) continue
    bestCode = bounds.code
    bestArea = bounds.area
  }
  return bestCode
}

const getRenderedMapRect = (width: number, height: number) => {
  const scale = Math.min(width / WORLD_MAP_WIDTH, height / WORLD_MAP_HEIGHT)
  const renderedWidth = WORLD_MAP_WIDTH * scale
  const renderedHeight = WORLD_MAP_HEIGHT * scale
  return {
    scale,
    offsetX: (width - renderedWidth) / 2,
    offsetY: (height - renderedHeight) / 2,
  }
}

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
  /** Заполнять высоту родителя вместо 2:1-аспекта (fullscreen на портрете). */
  fillParent?: boolean
  /** Пиксельный размер контейнера на layout — для fit-to-fill зума родителем. */
  onContainerLayout?: (width: number, height: number) => void
  /** Native: lets the parent list stop stealing touches while map gestures run. */
  onGestureActiveChange?: (active: boolean) => void
  style?: StyleProp<ViewStyle>
}

function WorldChoroplethMapComponent({
  visitedCodes,
  selectedCode,
  onCountryPress,
  children,
  zoom,
  fillParent,
  onContainerLayout,
  onGestureActiveChange,
  style,
}: WorldChoroplethMapProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const unvisitedFill = getWorldMapUnvisitedFill(isDark)

  // px-размер контейнера → перевод экранных дельт жестов/колеса в координаты viewBox.
  const layoutRef = React.useRef({
    width: WORLD_MAP_WIDTH,
    height: WORLD_MAP_HEIGHT,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout
      if (w > 0 && h > 0) {
        const rect = getRenderedMapRect(w, h)
        layoutRef.current = {
          width: w,
          height: h,
          scale: rect.scale,
          offsetX: rect.offsetX,
          offsetY: rect.offsetY,
        }
      }
      if (w > 0 && h > 0) onContainerLayout?.(w, h)
    },
    [onContainerLayout]
  )

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
  const webTransform = zoom
    ? `translate(${zoom.translateX.value} ${zoom.translateY.value}) scale(${zoom.scale.value})`
    : ''

  const nativeTouchRef = React.useRef({
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    pinchDist: 0,
    moved: false,
  })
  const notifyNativeGestureActive = useCallback(
    (active: boolean) => {
      if (Platform.OS !== 'web' && zoom) {
        onGestureActiveChange?.(active)
      }
    },
    [onGestureActiveChange, zoom]
  )

  const nativePanHandlers = useMemo(() => {
    if (!zoom || Platform.OS === 'web') return null

    const toViewBox = () => 1 / Math.max(0.0001, layoutRef.current.scale)
    const toViewBoxPoint = (x: number, y: number) => {
      const layout = layoutRef.current
      const k = toViewBox()
      return {
        x: (x - layout.offsetX) * k,
        y: (y - layout.offsetY) * k,
      }
    }
    const getTouches = (event: GestureResponderEvent) => event.nativeEvent.touches
    const getCentroid = (event: GestureResponderEvent) => {
      const touches = getTouches(event)
      if (touches.length === 0) return null
      const total = touches.reduce(
        (acc, touch) => ({
          x: acc.x + touch.locationX,
          y: acc.y + touch.locationY,
        }),
        { x: 0, y: 0 }
      )
      return {
        x: total.x / touches.length,
        y: total.y / touches.length,
      }
    }
    const getPinchDistance = (event: GestureResponderEvent) => {
      const [a, b] = getTouches(event)
      if (!a || !b) return 0
      return Math.hypot(a.locationX - b.locationX, a.locationY - b.locationY)
    }
    const finishGesture = () => {
      nativeTouchRef.current = {
        startX: 0,
        startY: 0,
        x: 0,
        y: 0,
        pinchDist: 0,
        moved: false,
      }
      notifyNativeGestureActive(false)
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (event, state) =>
        getTouches(event).length >= 2 || Math.abs(state.dx) > 5 || Math.abs(state.dy) > 5,
      onMoveShouldSetPanResponderCapture: (event, state) =>
        getTouches(event).length >= 2 || Math.abs(state.dx) > 5 || Math.abs(state.dy) > 5,
      onPanResponderGrant: (event) => {
        notifyNativeGestureActive(true)
        const centroid = getCentroid(event)
        const x = centroid?.x ?? 0
        const y = centroid?.y ?? 0
        nativeTouchRef.current = {
          startX: x,
          startY: y,
          x,
          y,
          pinchDist: getPinchDistance(event),
          moved: false,
        }
      },
      onPanResponderMove: (event) => {
        const centroid = getCentroid(event)
        if (!centroid) return
        const k = toViewBox()
        const distance = getPinchDistance(event)
        const previous = nativeTouchRef.current
        const moved =
          previous.moved ||
          Math.abs(centroid.x - previous.startX) > 5 ||
          Math.abs(centroid.y - previous.startY) > 5

        if (getTouches(event).length >= 2 && distance > 0) {
          if (previous.pinchDist > 0) {
            const point = toViewBoxPoint(centroid.x, centroid.y)
            const fx = (point.x - zoom.translateX.value) / zoom.scale.value
            const fy = (point.y - zoom.translateY.value) / zoom.scale.value
            zoom.zoomAtPoint(distance / previous.pinchDist, fx, fy, false)
          }
          nativeTouchRef.current = {
            startX: previous.startX,
            startY: previous.startY,
            x: centroid.x,
            y: centroid.y,
            pinchDist: distance,
            moved: true,
          }
          return
        }

        zoom.panBy((centroid.x - previous.x) * k, (centroid.y - previous.y) * k)
        nativeTouchRef.current = {
          startX: previous.startX,
          startY: previous.startY,
          x: centroid.x,
          y: centroid.y,
          pinchDist: 0,
          moved,
        }
      },
      onPanResponderRelease: () => {
        const touch = nativeTouchRef.current
        if (!touch.moved && onCountryPress) {
          const point = toViewBoxPoint(touch.x, touch.y)
          const x = (point.x - zoom.translateX.value) / zoom.scale.value
          const y = (point.y - zoom.translateY.value) / zoom.scale.value
          const code = getCountryCodeAtViewBoxPoint(x, y)
          if (code) onCountryPress(code)
        }
        finishGesture()
      },
      onPanResponderTerminate: finishGesture,
      onPanResponderTerminationRequest: () => false,
    }).panHandlers
  }, [zoom, notifyNativeGestureActive, onCountryPress])

  // Web: колесо → зум к курсору; 1 палец/мышь → пан (порог 5px держит тап по
  // стране); 2 пальца → пинч-зум. RNGH-web-шим нестабилен, поэтому жесты на web
  // собираем сами на Pointer Events (мультитач через pointerId).
  const dragRef = React.useRef({ x: 0, y: 0, moved: false })
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistRef = React.useRef(0)

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
    // Отдаём браузеру знать, что жесты (пан/пинч) обрабатываем сами — иначе
    // мобильный браузер перехватывает 2 пальца под свой pinch-zoom страницы.
    if (node.style) node.style.touchAction = 'none'
    const onWheel = (e: WheelEvent) => {
      const z = zoomRef.current
      if (!z) return
      e.preventDefault()
      const rect = node.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      const mapRect = getRenderedMapRect(rect.width, rect.height)
      const px = e.clientX - rect.left - mapRect.offsetX
      const py = e.clientY - rect.top - mapRect.offsetY
      const fx = (px / mapRect.scale - z.translateX.value) / z.scale.value
      const fy = (py / mapRect.scale - z.translateY.value) / z.scale.value
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      z.zoomAtPoint(factor, fx, fy, false)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoom])

  type WebPointerEvent = {
    clientX: number
    clientY: number
    pointerId: number
    currentTarget: unknown
  }
  type WebClickEvent = {
    clientX: number
    clientY: number
    target: unknown
    currentTarget: unknown
  }
  const setCursor = useCallback((value: 'grab' | 'grabbing') => {
    const node = containerRef.current as unknown as HTMLElement | null
    if (node?.style) node.style.cursor = value
  }, [])
  const selectCountryAtClientPoint = useCallback(
    (clientX: number, clientY: number, currentTarget: unknown) => {
      if (!onCountryPress) return
      const node = currentTarget as HTMLElement | null
      const svg = node?.querySelector?.('svg')
      if (!svg || typeof svg.createSVGPoint !== 'function') return

      const screenPoint = svg.createSVGPoint()
      screenPoint.x = clientX
      screenPoint.y = clientY

      let bestCode: string | null = null
      let bestArea = Number.POSITIVE_INFINITY
      const paths = Array.from(svg.querySelectorAll<SVGGraphicsElement>('path[id^="wc-"]'))
      for (const path of paths) {
        const matrix = path.getScreenCTM()
        if (!matrix) continue
        const localPoint = screenPoint.matrixTransform(matrix.inverse())
        const box = path.getBBox()
        const contains =
          localPoint.x >= box.x &&
          localPoint.x <= box.x + box.width &&
          localPoint.y >= box.y &&
          localPoint.y <= box.y + box.height
        if (!contains) continue

        const area = box.width * box.height
        if (area < bestArea) {
          bestArea = area
          bestCode = path.id.replace(/^wc-/, '')
        }
      }

      if (bestCode) onCountryPress(bestCode)
    },
    [onCountryPress]
  )
  const endPointer = useCallback(
    (pointerId: number) => {
      const pts = pointersRef.current
      pts.delete(pointerId)
      if (pts.size < 2) pinchDistRef.current = 0
      if (pts.size === 1) {
        const only = pts.values().next().value
        if (only) dragRef.current = { x: only.x, y: only.y, moved: true }
      }
      if (pts.size === 0) setCursor('grab')
    },
    [setCursor]
  )

  const webProps =
    Platform.OS === 'web' && zoom
      ? {
          onPointerDown: (e: WebPointerEvent) => {
            const pts = pointersRef.current
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
            const target = e.currentTarget as {
              setPointerCapture?: (id: number) => void
            }
            // setPointerCapture кидает, если для pointerId нет активного касания
            // (напр. синтетические события) — не должно рвать инициализацию пинча.
            try {
              target.setPointerCapture?.(e.pointerId)
            } catch {
              // no-op: see comment above
            }
            setCursor('grabbing')
            if (pts.size === 1) {
              dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
            } else if (pts.size === 2) {
              const [a, b] = [...pts.values()]
              pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y)
            }
          },
          onPointerMove: (e: WebPointerEvent) => {
            const pts = pointersRef.current
            if (!pts.has(e.pointerId)) return
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
            const rect = (
              e.currentTarget as {
                getBoundingClientRect?: () => { width: number; height: number; left: number; top: number }
              }
            ).getBoundingClientRect?.()
            if (!rect || rect.width <= 0 || rect.height <= 0) return
            const mapRect = getRenderedMapRect(rect.width, rect.height)
            const k = 1 / Math.max(0.0001, mapRect.scale)
            // Два пальца → пинч-зум к середине щипка.
            if (pts.size >= 2) {
              const [a, b] = [...pts.values()]
              const dist = Math.hypot(a.x - b.x, a.y - b.y)
              const prev = pinchDistRef.current
              pinchDistRef.current = dist
              if (prev > 0 && dist > 0) {
                const midX = (a.x + b.x) / 2
                const midY = (a.y + b.y) / 2
                const fx = ((midX - rect.left - mapRect.offsetX) * k - zoom.translateX.value) / zoom.scale.value
                const fy = ((midY - rect.top - mapRect.offsetY) * k - zoom.translateY.value) / zoom.scale.value
                zoom.zoomAtPoint(dist / prev, fx, fy, false)
              }
              return
            }
            // Один палец/мышь → пан (порог 5px держит тап по стране).
            const d = dragRef.current
            const dx = e.clientX - d.x
            const dy = e.clientY - d.y
            if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
            d.moved = true
            zoom.panBy(dx * k, dy * k)
            d.x = e.clientX
            d.y = e.clientY
          },
          onPointerUp: (e: WebPointerEvent) => endPointer(e.pointerId),
          onPointerCancel: (e: WebPointerEvent) => endPointer(e.pointerId),
          onPointerLeave: (e: WebPointerEvent) => endPointer(e.pointerId),
          onClick: (e: WebClickEvent) => {
            if (dragRef.current.moved) return
            const target = e.target as Element | null
            const targetId = target?.id ?? ''
            if (targetId.startsWith('wc-')) return
            selectCountryAtClientPoint(e.clientX, e.clientY, e.currentTarget)
          },
        }
      : null

  const map = (
    <View
      ref={containerRef}
      style={[
        fillParent
          ? { width: '100%', height: '100%', flex: 1 }
          : { width: '100%', aspectRatio: WORLD_MAP_WIDTH / WORLD_MAP_HEIGHT },
        Platform.OS === 'web' && zoom ? ({ cursor: 'grab' } as object) : null,
        style,
      ]}
      onLayout={onLayout}
      onTouchStart={() => notifyNativeGestureActive(true)}
      onTouchEnd={() => notifyNativeGestureActive(false)}
      onTouchCancel={() => notifyNativeGestureActive(false)}
      // RN Web пробрасывает DOM-обработчики на <div>; типы RN View их не знают.
      {...((webProps ?? {}) as object)}
      {...((nativePanHandlers ?? {}) as object)}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={WORLD_MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
      >
        {zoom && Platform.OS === 'web' ? (
          <G transform={webTransform}>{paths}</G>
        ) : zoom ? (
          <AnimatedG animatedProps={animatedProps}>{paths}</AnimatedG>
        ) : (
          <G>{paths}</G>
        )}
      </Svg>
      {children}
    </View>
  )

  return map
}

export const WorldChoroplethMap = React.memo(WorldChoroplethMapComponent)
export default WorldChoroplethMap
