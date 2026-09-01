import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import {
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native'

const IS_WEB = Platform.OS === 'web'

// Субпиксельные хвосты scrollLeft не должны зажигать индикатор в крайнем положении.
const EDGE_EPSILON = 4

/**
 * DOM-узел, который на вебе реально прокручивается.
 *
 * На вебе меряем именно его: onLayout/onContentSizeChange от RNW для
 * горизонтального ScrollView приходят не всегда и не с теми размерами.
 */
export const getScrollableWebNode = (scrollView: unknown): HTMLElement | null => {
  if (!IS_WEB) return null
  const host = scrollView as { getScrollableNode?: () => unknown } | null
  const node = host?.getScrollableNode?.() as HTMLElement | undefined
  return node && typeof node.scrollWidth === 'number' ? node : null
}

export type HorizontalScrollMetrics = {
  offsetX: number
  contentWidth: number
  layoutWidth: number
}

export type HorizontalScrollEdges = {
  /** Есть ли содержимое, скрытое за левым краем. */
  canScrollLeft: boolean
  /** Есть ли содержимое, скрытое за правым краем. */
  canScrollRight: boolean
  /** Текущие размеры прокрутки — для программного листания. */
  metricsRef: MutableRefObject<HorizontalScrollMetrics>
  recompute: () => void
  /**
   * Раскрывается на самом `ScrollView`: без этих обработчиков состояние краёв
   * не обновится. Свои `onScroll`/`onLayout`/`onContentSizeChange` вызывающая
   * сторона должна скомпоновать сама.
   */
  edgeScrollProps: {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    scrollEventThrottle: number
    onLayout: (event: LayoutChangeEvent) => void
    onContentSizeChange: (width: number, height: number) => void
  }
}

/**
 * Считает, есть ли у горизонтального ряда куда прокручиваться влево и вправо.
 *
 * Зачем отдельным хуком: индикаторы прокрутки нужны и рельсе карточек (стрелки
 * на десктопе), и рядам-переключателям (затухание у края на телефоне). Логика
 * замера одна и та же и раньше копировалась вместе с заготовкой ряда — из-за
 * этого на трёх экранах ряд обрезался вовсе без признака прокрутки (#1672).
 */
export function useHorizontalScrollEdges(
  scrollRef: RefObject<ScrollView | null>,
  /** Пересчитать края, когда меняется содержимое ряда. */
  contentKey?: unknown,
): HorizontalScrollEdges {
  const metricsRef = useRef<HorizontalScrollMetrics>({ offsetX: 0, contentWidth: 0, layoutWidth: 0 })

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const recompute = useCallback(() => {
    const node = getScrollableWebNode(scrollRef.current)
    if (node) {
      metricsRef.current.offsetX = node.scrollLeft
      metricsRef.current.layoutWidth = node.clientWidth
      metricsRef.current.contentWidth = node.scrollWidth
    }
    const { offsetX, contentWidth, layoutWidth } = metricsRef.current
    setCanScrollLeft(offsetX > EDGE_EPSILON)
    setCanScrollRight(layoutWidth > 0 && offsetX + layoutWidth < contentWidth - EDGE_EPSILON)
  }, [scrollRef])

  // Содержимое ряда приезжает асинхронно (данные + картинки), поэтому досчитываем
  // ещё несколько раз после маунта — иначе индикатор не появится до первой прокрутки.
  useEffect(() => {
    recompute()
    if (!IS_WEB) return
    const raf = requestAnimationFrame(recompute)
    const timers = [120, 400, 1000].map((ms) => setTimeout(recompute, ms))
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [recompute, contentKey])

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nativeEvent = event?.nativeEvent
      if (!nativeEvent) return
      metricsRef.current.offsetX = nativeEvent.contentOffset?.x ?? 0
      metricsRef.current.contentWidth = nativeEvent.contentSize?.width ?? metricsRef.current.contentWidth
      metricsRef.current.layoutWidth =
        nativeEvent.layoutMeasurement?.width ?? metricsRef.current.layoutWidth
      recompute()
    },
    [recompute],
  )

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      metricsRef.current.layoutWidth = event?.nativeEvent?.layout?.width ?? 0
      recompute()
    },
    [recompute],
  )

  const onContentSizeChange = useCallback(
    (width: number) => {
      metricsRef.current.contentWidth = width
      recompute()
    },
    [recompute],
  )

  // Стабильная ссылка: иначе ScrollView получал бы новые обработчики на каждый рендер.
  const edgeScrollProps = useMemo(
    () => ({ onScroll, scrollEventThrottle: 16, onLayout, onContentSizeChange }),
    [onScroll, onLayout, onContentSizeChange],
  )

  return { canScrollLeft, canScrollRight, metricsRef, recompute, edgeScrollProps }
}

export default useHorizontalScrollEdges
