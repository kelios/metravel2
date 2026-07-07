// [FE-635-T2] Зум/пан для scratch-карты мира профиля.
// Состояние трансформа в координатах viewBox (0..contentWidth / 0..contentHeight):
// точка p карты рисуется как (translate + scale * p). Кламп scale [1..maxScale],
// кламп пана так, чтобы контент всегда покрывал вьюпорт (без «улёта» за край).
// Reanimated SharedValue — общий источник для SVG-трансформа (<G>) и оверлея флажков.

import { useCallback, useReducer, useRef } from 'react'
import { Platform } from 'react-native'
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
  /** Реальный видимый вьюпорт в единицах viewBox (cover: viewW < content по X). */
  setViewport: (viewW: number, viewH: number) => void
}

const clamp = (value: number, min: number, max: number): number => {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

// Кламп пана: контент имеет размер content*scale, видимый вьюпорт (в единицах
// viewBox) = viewport. translate лежит в [viewport - content*scale, 0]. Когда
// content*scale <= viewport (контент уже вписан) — пан по этой оси залочен на 0.
// Инлайн (meet, viewport === content) это даёт прежний [content*(1-scale), 0].
// Fullscreen cover: viewportW < content по X → пан E↔W доступен уже при scale=1.
const clampTranslate = (
  value: number,
  content: number,
  scale: number,
  viewport: number,
): number => {
  'worklet'
  const min = Math.min(0, viewport - content * scale)
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
  // Видимый вьюпорт в единицах viewBox (для cover-режима меньше content по X).
  // По умолчанию = content (инлайн meet-2:1, без регрессий). Обновляется картой
  // через setViewport на layout. Ref, а не state — clamp не должен ре-рендерить.
  const viewportRef = useRef({ w: contentWidth, h: contentHeight })
  const [, bumpWebRender] = useReducer((value: number) => value + 1, 0)

  const syncWebRender = useCallback(() => {
    if (Platform.OS === 'web') bumpWebRender()
  }, [])

  const applyZoom = useCallback(
    (factor: number, focusX: number, focusY: number, animated: boolean) => {
      const prev = scale.value
      const next = clamp(prev * factor, MAP_ZOOM_MIN, maxScale)
      if (next === prev) return
      // Удержать фокус-точку: focusScreen = translate + prev*focus = translateNext + next*focus.
      const viewport = viewportRef.current
      const nextTx = clampTranslate(
        translateX.value + focusX * (prev - next),
        contentWidth,
        next,
        viewport.w,
      )
      const nextTy = clampTranslate(
        translateY.value + focusY * (prev - next),
        contentHeight,
        next,
        viewport.h,
      )
      const shouldAnimate = animated && Platform.OS !== 'web'
      if (shouldAnimate) {
        scale.value = withTiming(next, { duration: 160 })
        translateX.value = withTiming(nextTx, { duration: 160 })
        translateY.value = withTiming(nextTy, { duration: 160 })
      } else {
        scale.value = next
        translateX.value = nextTx
        translateY.value = nextTy
      }
      syncWebRender()
    },
    [scale, translateX, translateY, contentWidth, contentHeight, maxScale, syncWebRender],
  )

  const zoomAtPoint = useCallback(
    (factor: number, focusX: number, focusY: number, animated = false) =>
      applyZoom(factor, focusX, focusY, animated),
    [applyZoom],
  )

  const zoomByCentered = useCallback(
    (factor: number) => {
      const s = scale.value
      const viewport = viewportRef.current
      const centerX = (-translateX.value + viewport.w / 2) / s
      const centerY = (-translateY.value + viewport.h / 2) / s
      applyZoom(factor, centerX, centerY, true)
    },
    [applyZoom, scale, translateX, translateY],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const s = scale.value
      const viewport = viewportRef.current
      translateX.value = clampTranslate(translateX.value + dx, contentWidth, s, viewport.w)
      translateY.value = clampTranslate(translateY.value + dy, contentHeight, s, viewport.h)
      syncWebRender()
    },
    [scale, translateX, translateY, contentWidth, contentHeight, syncWebRender],
  )

  // Карта сообщает реальный видимый вьюпорт в единицах viewBox (cover: viewW < content
  // по X → пан E↔W). Ре-клампит текущий translate под новый вьюпорт (напр. смена
  // ориентации/размера контейнера), чтобы контент не «висел» за краем.
  const setViewport = useCallback(
    (viewW: number, viewH: number) => {
      if (!(viewW > 0) || !(viewH > 0)) return
      const prev = viewportRef.current
      if (prev.w === viewW && prev.h === viewH) return
      viewportRef.current = { w: viewW, h: viewH }
      const s = scale.value
      translateX.value = clampTranslate(translateX.value, contentWidth, s, viewW)
      translateY.value = clampTranslate(translateY.value, contentHeight, s, viewH)
      syncWebRender()
    },
    [scale, translateX, translateY, contentWidth, contentHeight, syncWebRender],
  )

  const reset = useCallback(
    (animated = true) => {
      const shouldAnimate = animated && Platform.OS !== 'web'
      if (shouldAnimate) {
        scale.value = withTiming(1, { duration: 200 })
        translateX.value = withTiming(0, { duration: 200 })
        translateY.value = withTiming(0, { duration: 200 })
      } else {
        scale.value = 1
        translateX.value = 0
        translateY.value = 0
      }
      syncWebRender()
    },
    [scale, translateX, translateY, syncWebRender],
  )

  return { scale, translateX, translateY, zoomAtPoint, zoomByCentered, panBy, reset, setViewport }
}

export default useMapZoomPan
