// Чистые гео-/геометрические хелперы и константы, выделенные из TravelMap.tsx.
// Без React/JSX — только расчёты координат и размеров попапа.

export const DEFAULT_CENTER: [number, number] = [53.9006, 27.559] // Minsk
export const ROUTE_PANE_NAME = 'metravelRoutePane'
export const ROUTE_PANE_Z_INDEX = '450'

const POPUP_PAN_NARROW_X_THRESHOLD = 18
const POPUP_PAN_NARROW_Y_THRESHOLD = 24
const POPUP_PAN_MIN_DELTA = 6
const NARROW_MAP_WIDTH = 640
const VERY_NARROW_MAP_WIDTH = 420
const NARROW_VIEWPORT_WIDTH = 768
const VERY_NARROW_VIEWPORT_WIDTH = 480

export function ignoreTravelMapRuntimeError() {
  return
}

export function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function parseCoordString(raw: unknown): [number, number] | null {
  const str = String(raw ?? '').trim()
  if (!str) return null
  const cleaned = str.replace(/;/g, ',').replace(/\s+/g, '')
  const parts = cleaned.split(',')
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  return isValidLatLng(lat, lng) ? [lat, lng] : null
}

export function filterValidLatLngs(coords: [number, number][]) {
  return coords.filter(([lat, lng]) => isValidLatLng(lat, lng))
}

export function extractTravelPoints(travelData: any[]): [number, number][] {
  const out: [number, number][] = []
  for (const point of travelData) {
    const parsed = parseCoordString(point?.coord)
    if (parsed) out.push(parsed)
  }
  return out
}

export interface InitialView {
  center: [number, number]
  zoom: number
}

// Грубая (без Leaflet) оценка центра/зума по набору точек — чтобы ПЕРВЫЙ кадр карты
// уже показывал все маркеры в рамке, не дожидаясь асинхронного fitBounds.
// Точную подгонку всё равно делает map.fitBounds после whenReady.
export function computeInitialView(
  points: [number, number][],
  fallbackCenter: [number, number],
  singlePointZoom: number,
): InitialView {
  if (points.length === 0) return { center: fallbackCenter, zoom: singlePointZoom }
  if (points.length === 1) return { center: points[0], zoom: singlePointZoom }

  let minLat = points[0][0]
  let maxLat = points[0][0]
  let minLng = points[0][1]
  let maxLng = points[0][1]
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  const center: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2]

  const latSpan = Math.max(maxLat - minLat, 1e-6)
  // Долготный спан корректируем на широту: 1° долготы у́же 1° широты.
  const lngSpan = Math.max((maxLng - minLng) * Math.cos((center[0] * Math.PI) / 180), 1e-6)
  const span = Math.max(latSpan, lngSpan)

  // Земля ~360° долготы на zoom 0; на каждый зум спан делится надвое.
  // Добавляем запас (паддинг ~15%), чтобы маркеры не липли к краям.
  const zoom = Math.log2(360 / (span * 1.3))
  const clampedZoom = Math.max(2, Math.min(15, Math.floor(zoom)))
  return { center, zoom: clampedZoom }
}

export function calculatePopupPan(popupEl: HTMLElement, mapEl: HTMLElement) {
  const mapRect = mapEl.getBoundingClientRect()
  const popupRectAbs = popupEl.getBoundingClientRect()
  const popupRect = {
    left: popupRectAbs.left - mapRect.left,
    top: popupRectAbs.top - mapRect.top,
    right: popupRectAbs.right - mapRect.left,
    bottom: popupRectAbs.bottom - mapRect.top,
    width: popupRectAbs.width,
    height: popupRectAbs.height,
  }

  const isNarrowMap = mapRect.width <= NARROW_MAP_WIDTH
  const horizontalPadding =
    mapRect.width <= VERY_NARROW_MAP_WIDTH ? 12 : isNarrowMap ? 16 : 24
  const verticalPadding = isNarrowMap ? 18 : 24

  const popupCenterX = popupRect.left + popupRect.width / 2
  const popupCenterY = popupRect.top + popupRect.height / 2
  const safeLeft = horizontalPadding
  const safeRight = mapRect.width - horizontalPadding
  const safeTop = verticalPadding
  const safeBottom = mapRect.height - verticalPadding
  const safeCenterX = (safeLeft + safeRight) / 2
  const safeCenterY = (safeTop + safeBottom) / 2

  const overflowLeft = horizontalPadding - popupRect.left
  const overflowRight = popupRect.right - (mapRect.width - horizontalPadding)
  const overflowTop = verticalPadding - popupRect.top
  const overflowBottom = popupRect.bottom - safeBottom

  let dx = 0
  let dy = 0

  if (overflowLeft > 0 && overflowRight > 0) dx = popupCenterX - safeCenterX
  else if (overflowLeft > 0) dx = -overflowLeft
  else if (overflowRight > 0) dx = overflowRight
  else if (isNarrowMap) {
    const deltaX = popupCenterX - safeCenterX
    if (Math.abs(deltaX) > POPUP_PAN_NARROW_X_THRESHOLD) dx = deltaX
  }

  if (overflowTop > 0 && overflowBottom > 0) dy = popupCenterY - safeCenterY
  else if (overflowTop > 0) dy = -overflowTop
  else if (overflowBottom > 0) dy = overflowBottom
  else if (isNarrowMap) {
    const deltaY = popupCenterY - safeCenterY
    if (Math.abs(deltaY) > POPUP_PAN_NARROW_Y_THRESHOLD) dy = deltaY
  }

  if (Math.abs(dx) < POPUP_PAN_MIN_DELTA) dx = 0
  if (Math.abs(dy) < POPUP_PAN_MIN_DELTA) dy = 0
  return { dx, dy }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getPopupSize(viewportWidth: number, compact: boolean) {
  const isNarrow = viewportWidth <= NARROW_VIEWPORT_WIDTH
  const isVeryNarrow = viewportWidth <= VERY_NARROW_VIEWPORT_WIDTH

  const maxWidth = compact
    ? isVeryNarrow
      ? clamp(viewportWidth - 20, 208, 236)
      : isNarrow
        ? clamp(viewportWidth - 28, 236, 284)
        : clamp(viewportWidth - 32, 248, 300)
    : isVeryNarrow
      ? clamp(viewportWidth - 28, 240, 284)
      : isNarrow
        ? clamp(viewportWidth - 32, 264, 320)
        : clamp(viewportWidth - 40, 300, 388)

  const minWidth = compact
    ? isVeryNarrow
      ? clamp(maxWidth - 20, 188, 212)
      : isNarrow
        ? clamp(maxWidth - 32, 208, 236)
        : clamp(maxWidth - 44, 220, 248)
    : isVeryNarrow
      ? 220
      : isNarrow
        ? clamp(maxWidth - 44, 228, 260)
        : clamp(maxWidth - 72, 256, 308)

  const autoPanPaddingTopLeft = compact
    ? isVeryNarrow
      ? [8, 56]
      : [12, 72]
    : isNarrow
      ? [12, 72]
      : [24, 140]

  const autoPanPaddingBottomRight = compact
    ? isVeryNarrow
      ? [8, 104]
      : [12, 72]
    : isNarrow
      ? [12, 72]
      : [24, 140]

  return { maxWidth, minWidth, autoPanPaddingTopLeft, autoPanPaddingBottomRight }
}
