// services/pdf-export/generators/v2/runtime/atlas/mapSvg.ts
// SVG глобальной карты со всеми точками книги

import type { PdfThemeConfig } from '../../../../themes/PdfThemeConfig'
import type { AtlasTravelEntry } from './types'

type ProjectedPoint = {
  x: number
  y: number
  travelOrdinal: number
  pointOrdinal: number
  color: string
  label: string
}

function projectAtlasPoints(entries: AtlasTravelEntry[]): {
  points: ProjectedPoint[]
  viewBoxW: number
  viewBoxH: number
} {
  const viewBoxW = 200
  const viewBoxH = 120
  const paddingX = 10
  const paddingY = 10

  const flat: Array<{
    lat: number
    lng: number
    travelOrdinal: number
    pointOrdinal: number
    color: string
    label: string
  }> = []
  for (const entry of entries) {
    entry.pointsWithCoords.forEach((point, idx) => {
      flat.push({
        lat: point.lat as number,
        lng: point.lng as number,
        travelOrdinal: entry.travelOrdinal,
        pointOrdinal: idx + 1,
        color: entry.color,
        label: point.address || '',
      })
    })
  }

  if (!flat.length) return { points: [], viewBoxW, viewBoxH }

  const lats = flat.map((p) => p.lat)
  const lngs = flat.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latRange = Math.max(0.0001, maxLat - minLat)
  const lngRange = Math.max(0.0001, maxLng - minLng)
  const innerW = viewBoxW - paddingX * 2
  const innerH = viewBoxH - paddingY * 2

  const points: ProjectedPoint[] = flat.map((p) => ({
    x: paddingX + ((p.lng - minLng) / lngRange) * innerW,
    y: paddingY + ((maxLat - p.lat) / latRange) * innerH,
    travelOrdinal: p.travelOrdinal,
    pointOrdinal: p.pointOrdinal,
    color: p.color,
    label: p.label,
  }))

  return { points, viewBoxW, viewBoxH }
}

export function buildAtlasMapSvg(
  entries: AtlasTravelEntry[],
  theme: PdfThemeConfig,
): string {
  const { colors } = theme
  const { points, viewBoxW, viewBoxH } = projectAtlasPoints(entries)

  if (!points.length) {
    return `
      <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Атлас">
        <rect x="0" y="0" width="${viewBoxW}" height="${viewBoxH}" rx="6" fill="${colors.surfaceAlt}" />
        <text x="${viewBoxW / 2}" y="${viewBoxH / 2}" text-anchor="middle" font-size="6" fill="${colors.textMuted}">
          Недостаточно координат для атласа
        </text>
      </svg>
    `
  }

  // Маркеры
  const markers = points
    .map((p) => {
      const px = p.x.toFixed(2)
      return `
        <g>
          <path
            d="M ${px} ${(p.y - 0.6).toFixed(2)} c -2.4 0 -4.2 1.9 -4.2 4.2 c 0 3.4 4.2 7.8 4.2 7.8 s 4.2 -4.4 4.2 -7.8 c 0 -2.3 -1.8 -4.2 -4.2 -4.2 z"
            fill="${p.color}"
            stroke="#FFFFFF"
            stroke-width="0.6"
          />
          <circle cx="${px}" cy="${(p.y + 2.5).toFixed(2)}" r="2.6" fill="#FFFFFF" stroke="${p.color}" stroke-width="0.8" />
          <text x="${px}" y="${(p.y + 3.25).toFixed(2)}" text-anchor="middle" font-size="3" font-weight="800" fill="${p.color}" font-family="Georgia, serif">
            ${p.pointOrdinal}
          </text>
        </g>
      `
    })
    .join('')

  // Декоративный «бумажный» фон карты — мягкие волны и сетка широт
  const decorLines = Array.from({ length: 5 })
    .map((_, i) => {
      const yPos = (viewBoxH / 6) * (i + 1)
      return `<line x1="0" y1="${yPos}" x2="${viewBoxW}" y2="${yPos}" stroke="${colors.borderLight || colors.border}" stroke-width="0.35" stroke-dasharray="1 2" opacity="0.55" />`
    })
    .join('')
  const decorMeridians = Array.from({ length: 5 })
    .map((_, i) => {
      const xPos = (viewBoxW / 6) * (i + 1)
      return `<line x1="${xPos}" y1="0" x2="${xPos}" y2="${viewBoxH}" stroke="${colors.borderLight || colors.border}" stroke-width="0.35" stroke-dasharray="1 2" opacity="0.45" />`
    })
    .join('')

  return `
    <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-label="Карта всех точек книги">
      <defs>
        <linearGradient id="atlasBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${viewBoxW}" height="${viewBoxH}" rx="5" fill="url(#atlasBg)" />
      ${decorMeridians}
      ${decorLines}
      <path d="M 0 ${viewBoxH * 0.78} C ${viewBoxW * 0.18} ${viewBoxH * 0.71}, ${viewBoxW * 0.36} ${viewBoxH * 0.85}, ${viewBoxW * 0.55} ${viewBoxH * 0.76} S ${viewBoxW * 0.88} ${viewBoxH * 0.68}, ${viewBoxW} ${viewBoxH * 0.75} L ${viewBoxW} ${viewBoxH} L 0 ${viewBoxH} Z" fill="${colors.surface}" opacity="0.55" />
      ${markers}
    </svg>
  `
}
