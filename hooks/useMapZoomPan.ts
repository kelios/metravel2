// [FE-635-T2] Зум/пан для scratch-карты мира профиля.
// Состояние трансформа в координатах viewBox (0..contentWidth / 0..contentHeight):
// точка p карты рисуется как (translate + scale * p). Кламп scale [1..maxScale],
// кламп пана так, чтобы контент всегда покрывал вьюпорт (без «улёта» за край).
// Reanimated SharedValue — общий источник для SVG-трансформа (<G>) и оверлея флажков.

import { useCallback } from 'react'
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

export const MAP_ZOOM_MIN = 1
export const MAP_ZOOM_MAX = 8

export interface MapZoomPanState {
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
}

export interface MapZoomPanControls extends MapZoomPanState {
  /** Зум относительно фокус-точки в координатах viewBox (фокус остаётся на месте). */
  zoomAtPoint: (factor: number, focusX: number, focusY: number, animated?: boolean) => void
  /** Зум к центру текущего вьюпорта (для кнопок +/−). */
  zoomByCentered: (factor: number) => void
  /** Сдвиг пана в координатах viewBox (драг). */
  panBy: (dx: number, dy: number) => void
  /** Возврат к scale=1, центр. */
  reset: (animated?: boolean) => void
}

const clamp = (value: number, min: number, max: number): number => {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

// Кламп пана: при scale контент имеет размер content*scale, вьюпорт = content.
// translate должен лежать в [content - content*scale, 0] = [content*(1-scale), 0].
const clampTranslate = (value: number, content: number, scale: number): number => {
  'worklet'
  const min = content * (1 - scale)
  return clamp(value, min, 0)
}

interface UseMapZoomPanArgs {
  contentWidth: number
  contentHeight: number
  maxScale?: number
}

export function useMapZoomPan({
  contentWidth,
  contentHeight,
  maxScale = MAP_ZOOM_MAX,
}: UseMapZoomPanArgs): MapZoomPanControls {
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const applyZoom = useCallback(
    (factor: number, focusX: number, focusY: number, animated: boolean) => {
      const prev = scale.value
      const next = clamp(prev * factor, MAP_ZOOM_MIN, maxScale)
      if (next === prev) return
      // Удержать фокус-точку: focusScreen = translate + prev*focus = translateNext + next*focus.
      const nextTx = clampTranslate(
        translateX.value + focusX * (prev - next),
        contentWidth,
        next,
      )
      const nextTy = clampTranslate(
        translateY.value + focusY * (prev - next),
        contentHeight,
        next,
      )
      if (animated) {
        scale.value = withTiming(next, { duration: 160 })
        translateX.value = withTiming(nextTx, { duration: 160 })
        translateY.value = withTiming(nextTy, { duration: 160 })
      } else {
        scale.value = next
        translateX.value = nextTx
        translateY.value = nextTy
      }
    },
    [scale, translateX, translateY, contentWidth, contentHeight, maxScale],
  )

  const zoomAtPoint = useCallback(
    (factor: number, focusX: number, focusY: number, animated = false) =>
      applyZoom(factor, focusX, focusY, animated),
    [applyZoom],
  )

  const zoomByCentered = useCallback(
    (factor: number) => {
      const s = scale.value
      const centerX = (-translateX.value + contentWidth / 2) / s
      const centerY = (-translateY.value + contentHeight / 2) / s
      applyZoom(factor, centerX, centerY, true)
    },
    [applyZoom, scale, translateX, translateY, contentWidth, contentHeight],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const s = scale.value
      translateX.value = clampTranslate(translateX.value + dx, contentWidth, s)
      translateY.value = clampTranslate(translateY.value + dy, contentHeight, s)
    },
    [scale, translateX, translateY, contentWidth, contentHeight],
  )

  const reset = useCallback(
    (animated = true) => {
      if (animated) {
        scale.value = withTiming(1, { duration: 200 })
        translateX.value = withTiming(0, { duration: 200 })
        translateY.value = withTiming(0, { duration: 200 })
      } else {
        scale.value = 1
        translateX.value = 0
        translateY.value = 0
      }
    },
    [scale, translateX, translateY],
  )

  return { scale, translateX, translateY, zoomAtPoint, zoomByCentered, panBy, reset }
}

export default useMapZoomPan
