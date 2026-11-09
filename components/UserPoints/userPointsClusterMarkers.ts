import { DESIGN_COLORS } from '@/constants/designSystem'
import type { ImportedPoint } from '@/types/userPoints'

import type { UserPointMarkerHandle, UserPointMarkerIconGetter } from './UserPointsClusterLayer.web'
import { isSitePoint as isSitePointOf } from './userPointPresentation'

/**
 * Чистые помощники слоя кластеров «Моих точек» (#3135: вынесены из
 * `UserPointsClusterLayer.web.tsx`, поведение без изменений): доступное имя и
 * клавиатура маркера, опции попапа, иконка точки и ручка маркера для
 * `useMapApi` (попап, z-index, координаты).
 */
export const DEFAULT_SITE_POINT_COLOR = DESIGN_COLORS.travelPoint
export const POPUP_CLASS_NAME = 'metravel-user-point-popup metravel-place-popup'
export const POPUP_MAX_WIDTH = 360
/** Пауза перед раскрытием кластера с выбранной точкой — после анимации центрирования. */
export const REVEAL_ACTIVE_DELAY_MS = 350

export const toFiniteId = (point: ImportedPoint): number | null => {
  const id = Number(point?.id)
  return Number.isFinite(id) ? id : null
}

export const applyMarkerAccessibleName = (marker: any, title: string) => {
  try {
    const element: HTMLElement | null = marker?._icon || marker?.getElement?.() || null
    if (!element) return
    element.setAttribute('aria-label', title)
    element.setAttribute('title', title)
  } catch {
    // noop
  }
}

/**
 * Leaflet ставит `tabindex="0"` и `role="button"` в `_initIcon` только при
 * `options.keyboard`, но при повторном `setIcon` переиспользует тот же `<div>`
 * и уже поставленные атрибуты не снимает. Снимаем сами, когда точка перестаёт
 * быть активной: в tab-порядке остаётся одна выбранная булавка, а не вся коллекция.
 */
export const applyMarkerKeyboard = (marker: any, active: boolean) => {
  try {
    const element: HTMLElement | null = marker?._icon || marker?.getElement?.() || null
    if (!element) return
    if (active) {
      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
    } else {
      element.removeAttribute('tabindex')
      element.removeAttribute('role')
    }
  } catch {
    // noop
  }
}

export const buildPopupOptions = (isCompactPopup: boolean) => ({
  className: POPUP_CLASS_NAME,
  closeButton: false,
  autoPan: true,
  autoPanPadding: isCompactPopup ? [16, 92] : [28, 120],
  maxWidth: POPUP_MAX_WIDTH,
  minWidth: 0,
})

/** Иконка точки: цвет точки, у точек сайта — акцент travelPoint и подчёркивание. */
export const resolvePointMarkerIcon = (
  point: ImportedPoint,
  active: boolean,
  getMarkerIconCached: UserPointMarkerIconGetter,
  fallbackColor: string,
) => {
  const sitePoint = isSitePointOf(point)
  const baseColor = String(point?.color ?? '').trim()
  const fill = sitePoint ? baseColor || DEFAULT_SITE_POINT_COLOR : baseColor
  return getMarkerIconCached(String(fill || '').trim() || fallbackColor, {
    active,
    emphasize: sitePoint,
  })
}

/**
 * Ручка маркера для индекса карты: открыть попап (раскрыв кластер, если точка
 * в нём), закрыть, z-index, координаты, DOM-узел и карта маркера.
 */
export const createMarkerHandle = (
  id: number,
  marker: any,
  map: any,
  getGroup: () => any,
): UserPointMarkerHandle => ({
  pointId: id,
  marker,
  openPopup: () => {
    try {
      const currentGroup = getGroup()
      const onMap = typeof map?.hasLayer === 'function' ? map.hasLayer(marker) : true
      if (!onMap && currentGroup && typeof currentGroup.zoomToShowLayer === 'function') {
        currentGroup.zoomToShowLayer(marker, () => {
          try {
            marker.openPopup?.()
          } catch {
            // noop
          }
        })
        return
      }
      marker.openPopup?.()
    } catch {
      // noop
    }
  },
  closePopup: () => {
    try {
      marker.closePopup?.()
    } catch {
      // noop
    }
  },
  setZIndexOffset: (offset: number) => {
    try {
      marker.setZIndexOffset?.(offset)
    } catch {
      // noop
    }
  },
  getLatLng: () => marker.getLatLng?.(),
  getElement: () => marker.getElement?.() ?? marker._icon ?? null,
  get _map() {
    return marker._map ?? null
  },
})
