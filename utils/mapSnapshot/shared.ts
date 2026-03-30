import { DESIGN_TOKENS } from '@/constants/designSystem'

export function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    !!(process as any).env &&
    (process as any).env.NODE_ENV === 'test'
  )
}

export function ensureLeafletSnapshotStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('metravel-leaflet-snapshot-styles')) return

  const style = document.createElement('style')
  style.id = 'metravel-leaflet-snapshot-styles'
  style.textContent = `
    .leaflet-container {
      overflow: hidden;
      background: ${DESIGN_TOKENS.colors.backgroundSecondary};
      outline: 0;
      position: relative;
      font-family: sans-serif;
    }
    .leaflet-pane,
    .leaflet-tile,
    .leaflet-marker-icon,
    .leaflet-marker-shadow,
    .leaflet-tile-container,
    .leaflet-pane > svg,
    .leaflet-pane > canvas,
    .leaflet-zoom-box,
    .leaflet-image-layer,
    .leaflet-layer {
      position: absolute;
      left: 0;
      top: 0;
    }
    .leaflet-pane > svg,
    .leaflet-pane > canvas {
      width: 100%;
      height: 100%;
    }
    .leaflet-tile-container {
      pointer-events: none;
    }
    .leaflet-marker-icon,
    .leaflet-marker-shadow {
      display: block;
    }
    .leaflet-control-container,
    .leaflet-attribution-flag {
      display: none !important;
    }
  `
  document.head.appendChild(style)
}

export function normalizeCoordPair(lat: number, lng: number): string {
  const safeLat = Number.isFinite(lat) ? Number(lat).toFixed(6) : 'NaN'
  const safeLng = Number.isFinite(lng) ? Number(lng).toFixed(6) : 'NaN'
  return `${safeLat},${safeLng}`
}

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}

export function latToTileY(lat: number, zoom: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom)
}

export function calculateFitZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  width: number,
  height: number,
): number {
  for (let z = 16; z >= 2; z--) {
    const x1 = lngToTileX(minLng, z) * 256
    const x2 = lngToTileX(maxLng, z) * 256
    const y1 = latToTileY(maxLat, z) * 256
    const y2 = latToTileY(minLat, z) * 256
    if ((x2 - x1) * 1.3 <= width && (y2 - y1) * 1.3 <= height) return z
  }
  return 2
}

export function loadCrossOriginImage(
  url: string,
  timeoutMs: number = 8000,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => {
      reject(new Error('timeout'))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('load error'))
    }
    img.src = url
  })
}

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function filterValidCoords<T extends { lat: number; lng: number }>(
  points: T[],
): T[] {
  return points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180,
  )
}

export function filterValidRouteLine(
  routeLine: Array<[number, number]>,
): Array<[number, number]> {
  return routeLine.filter(
    ([lat, lng]) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180,
  )
}
