import {
  lngToTileX,
  latToTileY,
  calculateFitZoom,
  loadCrossOriginImage,
  drawRoundRect,
  filterValidCoords,
  filterValidRouteLine,
} from './shared'

const MAP_COLORS = {
  route: '#0f5ea8',
  routeHalo: 'rgba(255,255,255,0.96)',
  routeShadow: 'rgba(12,37,68,0.28)',
  pinStart: '#3a8a5c',
  pinEnd: '#c0504d',
  pinMid: '#4a7fb5',
  labelBg: '#fff',
  labelBorder: '#d0d5dd',
  labelText: '#1a1a1a',
}

/**
 * Генерирует карту маршрута напрямую на Canvas.
 * Загружает тайлы, рисует маршрут и маркеры — без html2canvas.
 * Самый надёжный метод для PDF-экспорта.
 */
export async function generateCanvasMapSnapshot(
  points: { lat: number; lng: number; label?: string }[],
  options: {
    width?: number
    height?: number
    routeLine?: Array<[number, number]>
    maxZoom?: number
    fitPaddingFactor?: number
  } = {},
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null

  const width = options.width ?? 800
  const height = options.height ?? 480
  const maxZoom = options.maxZoom ?? 15
  const fitPaddingFactor = options.fitPaddingFactor ?? 1.3
  const routeLine = filterValidRouteLine(options.routeLine ?? [])
  const validPoints = filterValidCoords(points)

  const allCoords = [
    ...validPoints.map((p) => [p.lat, p.lng] as [number, number]),
    ...routeLine,
  ]
  if (!allCoords.length) return null

  const lats = allCoords.map((c) => c[0])
  const lngs = allCoords.map((c) => c[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const zoom = Math.min(maxZoom, calculateFitZoom(minLat, maxLat, minLng, maxLng, width, height, fitPaddingFactor, maxZoom))
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  const cxPx = lngToTileX(centerLng, zoom) * 256
  const cyPx = latToTileY(centerLat, zoom) * 256

  const tileSize = 256
  const maxTile = Math.pow(2, zoom) - 1
  const startTX = Math.max(0, Math.floor((cxPx - width / 2) / tileSize))
  const endTX = Math.min(maxTile, Math.floor((cxPx + width / 2) / tileSize))
  const startTY = Math.max(0, Math.floor((cyPx - height / 2) / tileSize))
  const endTY = Math.min(maxTile, Math.floor((cyPx + height / 2) / tileSize))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#e8e4df'
  ctx.fillRect(0, 0, width, height)

  const subdomains = 'abcd'
  const tilePromises: Promise<void>[] = []

  for (let tx = startTX; tx <= endTX; tx++) {
    for (let ty = startTY; ty <= endTY; ty++) {
      const s = subdomains[Math.abs(tx + ty) % subdomains.length]
      const url = `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}@2x.png`
      const drawX = tx * tileSize - (cxPx - width / 2)
      const drawY = ty * tileSize - (cyPx - height / 2)

      tilePromises.push(
        loadCrossOriginImage(url)
          .then((img) => {
            ctx.drawImage(img, drawX, drawY, tileSize, tileSize)
          })
          .catch(() => {
            /* skip failed tiles */
          }),
      )
    }
  }

  await Promise.all(tilePromises)

  const toCanvasX = (lng: number) => lngToTileX(lng, zoom) * 256 - (cxPx - width / 2)
  const toCanvasY = (lat: number) => latToTileY(lat, zoom) * 256 - (cyPx - height / 2)

  if (routeLine.length >= 2) {
    ctx.strokeStyle = MAP_COLORS.routeShadow
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    routeLine.forEach(([lat, lng], i) => {
      const px = toCanvasX(lng),
        py = toCanvasY(lat)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    ctx.strokeStyle = MAP_COLORS.routeHalo
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    routeLine.forEach(([lat, lng], i) => {
      const px = toCanvasX(lng),
        py = toCanvasY(lat)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    ctx.strokeStyle = MAP_COLORS.route
    ctx.lineWidth = 5
    ctx.beginPath()
    routeLine.forEach(([lat, lng], i) => {
      const px = toCanvasX(lng),
        py = toCanvasY(lat)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  const labelRects: Array<{ x: number; y: number; w: number; h: number }> = []

  validPoints.forEach((point, index) => {
    const px = toCanvasX(point.lng)
    const py = toCanvasY(point.lat)
    const isStart = index === 0
    const isEnd = index === validPoints.length - 1
    const pinColor = isStart
      ? MAP_COLORS.pinStart
      : isEnd
        ? MAP_COLORS.pinEnd
        : MAP_COLORS.pinMid

    ctx.beginPath()
    ctx.ellipse(px, py + 3, 8, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(px - 8, py - 8)
    ctx.lineTo(px, py + 4)
    ctx.lineTo(px + 8, py - 8)
    ctx.fillStyle = pinColor
    ctx.fill()

    ctx.beginPath()
    ctx.arc(px, py - 13, 13, 0, Math.PI * 2)
    ctx.fillStyle = pinColor
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(index + 1), px, py - 13)

    const rawLabel = typeof point.label === 'string' ? point.label : ''
    const firstSegment = rawLabel.split(' · ')[0].trim()
    const label = firstSegment.length > 34 ? firstSegment.slice(0, 32) + '…' : firstSegment
    if (label) {
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif'
      const labelW = Math.min(220, ctx.measureText(label).width + 16)
      const labelH = 24
      const candidates = [
        { x: px + 20, y: py - 33, pointer: 'left' as const },
        { x: px - labelW - 20, y: py - 33, pointer: 'right' as const },
        { x: px + 20, y: py + 4, pointer: 'left' as const },
        { x: px - labelW - 20, y: py + 4, pointer: 'right' as const },
        { x: px - labelW / 2, y: py - 58, pointer: 'bottom' as const },
        { x: px - labelW / 2, y: py + 18, pointer: 'top' as const },
      ]
      const padding = 6
      const clampRect = (candidate: (typeof candidates)[number]) => ({
        ...candidate,
        x: Math.max(padding, Math.min(width - labelW - padding, candidate.x)),
        y: Math.max(padding, Math.min(height - labelH - padding, candidate.y)),
      })
      const intersects = (rect: { x: number; y: number; w: number; h: number }) =>
        labelRects.some(
          (placed) =>
            rect.x < placed.x + placed.w + 4 &&
            rect.x + rect.w + 4 > placed.x &&
            rect.y < placed.y + placed.h + 4 &&
            rect.y + rect.h + 4 > placed.y,
        )
      const placement =
        candidates.map(clampRect).find((candidate) => !intersects({ x: candidate.x, y: candidate.y, w: labelW, h: labelH })) ??
        clampRect(candidates[index % candidates.length])
      const lx = placement.x
      const ly = placement.y
      labelRects.push({ x: lx, y: ly, w: labelW, h: labelH })

      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2

      drawRoundRect(ctx, lx, ly, labelW, 24, 6)
      ctx.fillStyle = MAP_COLORS.labelBg
      ctx.fill()
      ctx.strokeStyle = MAP_COLORS.labelBorder
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      ctx.beginPath()
      if (placement.pointer === 'right') {
        ctx.moveTo(lx + labelW, ly + 8)
        ctx.lineTo(lx + labelW + 7, ly + 12)
        ctx.lineTo(lx + labelW, ly + 16)
      } else if (placement.pointer === 'top') {
        ctx.moveTo(lx + labelW / 2 - 7, ly)
        ctx.lineTo(lx + labelW / 2, ly - 7)
        ctx.lineTo(lx + labelW / 2 + 7, ly)
      } else if (placement.pointer === 'bottom') {
        ctx.moveTo(lx + labelW / 2 - 7, ly + labelH)
        ctx.lineTo(lx + labelW / 2, ly + labelH + 7)
        ctx.lineTo(lx + labelW / 2 + 7, ly + labelH)
      } else {
        ctx.moveTo(lx, ly + 8)
        ctx.lineTo(lx - 7, ly + 12)
        ctx.lineTo(lx, ly + 16)
      }
      ctx.fillStyle = MAP_COLORS.labelBg
      ctx.fill()

      ctx.fillStyle = MAP_COLORS.labelText
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, lx + 8, ly + 12)
    }
  })

  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('© OpenStreetMap © CARTO', width - 6, height - 4)

  return canvas.toDataURL('image/png')
}
