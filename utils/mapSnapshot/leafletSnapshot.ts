import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  ensureLeafletSnapshotStyles,
  isTestEnvironment,
  normalizeCoordPair,
  filterValidCoords,
  filterValidRouteLine,
} from './shared'
import { generateMapImageFromDOM, isImageMostlyBlank } from './domCapture'

const leafletRouteSnapshotCache = new Map<string, Promise<string | null>>()

function buildCacheKey(
  points: { lat: number; lng: number; label?: string }[],
  routeLine: Array<[number, number]>,
  options: { width: number; height: number; zoom: number },
): string {
  const normalizedPoints = points
    .map((p) => {
      const label = typeof p.label === 'string' ? p.label.trim() : ''
      return `${normalizeCoordPair(p.lat, p.lng)},${label}`
    })
    .join('|')

  const normalizedRouteLine = routeLine
    .map(([lat, lng]) => normalizeCoordPair(lat, lng))
    .join('|')

  return `${options.width}x${options.height}@${options.zoom}:p=${normalizedPoints}:r=${normalizedRouteLine}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

let leafletLoaderPromise: Promise<void> | null = null

async function ensureLeaflet(): Promise<any> {
  const w = window as any
  if (w.L) {
    ensureLeafletSnapshotStyles()
    return w.L
  }

  if (!leafletLoaderPromise) {
    leafletLoaderPromise = (async () => {
      if (isTestEnvironment()) {
        try {
          const req = (0, eval)('require') as NodeRequire
          const leafletMod = req('leaflet')
          w.L = leafletMod?.default ?? leafletMod
          if (w.L) {
            ensureLeafletSnapshotStyles()
            return
          }
        } catch (error) {
          void error
        }
      }

      try {
        const leafletMod = await import('leaflet')
        w.L = leafletMod?.default ?? leafletMod
        if (w.L) {
          ensureLeafletSnapshotStyles()
          return
        }
      } catch (error) {
        void error
      }

      await new Promise<void>((resolve, reject) => {
        const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = cssHref
          document.head.appendChild(link)
        }

        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = () => {
          ensureLeafletSnapshotStyles()
          resolve()
        }
        script.onerror = (err) => {
          leafletLoaderPromise = null
          reject(err)
        }
        document.body.appendChild(script)
      })
    })()
  }

  try {
    await leafletLoaderPromise
  } finally {
    // Reset so a subsequent call (e.g. after test cleanup) retries loading
    leafletLoaderPromise = null
  }

  if (!w.L) {
    throw new Error('Leaflet failed to load from CDN')
  }

  return w.L
}

function buildMarkerIconHtml(
  index: number,
  totalPoints: number,
  label: string,
): string {
  const isStart = index === 0
  const isEnd = index === totalPoints - 1
  const number = index + 1

  const labelBg = DESIGN_TOKENS.colors.surface
  const labelText = DESIGN_TOKENS.colors.text
  const labelBorder = DESIGN_TOKENS.colors.border
  const fontFamily = DESIGN_TOKENS.typography.fontFamily

  const pinFill = isStart
    ? DESIGN_TOKENS.colors.success
    : isEnd
      ? DESIGN_TOKENS.colors.danger
      : DESIGN_TOKENS.colors.accent
  const pinStroke = DESIGN_TOKENS.colors.surface
  const pinShadow = 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))'
  const numberColor = DESIGN_TOKENS.colors.textOnPrimary

  return `
    <div style="position: relative; width: 28px; height: 42px;">
      <div style="width: 28px; height: 42px; display: block; filter: ${pinShadow};">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="42"
          viewBox="0 0 28 42"
          style="display: block;"
        >
          <path
            d="M14 0C6.27 0 0 6.27 0 14c0 11.2 14 28 14 28s14-16.8 14-28C28 6.27 21.73 0 14 0z"
            fill="${pinFill}"
            stroke="${pinStroke}"
            stroke-width="2"
          />
          <circle cx="14" cy="14" r="7" fill="${pinStroke}" opacity="0.22" />
        </svg>
      </div>
      <div style="
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ${fontFamily};
        font-size: 12px;
        font-weight: 800;
        color: ${numberColor};
        text-shadow: 0 1px 2px rgba(0,0,0,0.35);
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
      ">${number}</div>
      ${
        label
          ? `
        <div style="
          position: absolute;
          top: -4px;
          left: 34px;
          max-width: 150px;
          padding: 5px 8px;
          border-radius: 10px;
          background: ${labelBg};
          border: 1px solid ${labelBorder};
          color: ${labelText};
          font-family: ${fontFamily};
          font-size: 11px;
          line-height: 1.3;
          font-weight: 700;
          white-space: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          box-shadow: 0 2px 8px rgba(0,0,0,0.14);
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        ">
          <div style="
            position: absolute;
            left: -7px;
            top: 10px;
            width: 0;
            height: 0;
            border-top: 7px solid transparent;
            border-bottom: 7px solid transparent;
            border-right: 7px solid ${labelBorder};
          "></div>
          <div style="
            position: absolute;
            left: -6px;
            top: 10px;
            width: 0;
            height: 0;
            border-top: 7px solid transparent;
            border-bottom: 7px solid transparent;
            border-right: 7px solid ${labelBg};
          "></div>
          ${escapeHtml(label)}
        </div>
      `
          : ''
      }
    </div>
  `
}

/**
 * Генерирует снимок маршрута с помощью Leaflet + html2canvas
 */
export async function generateLeafletRouteSnapshot(
  points: { lat: number; lng: number; label?: string }[],
  options: {
    width?: number
    height?: number
    zoom?: number
    routeLine?: Array<[number, number]>
  } = {},
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  if (!points.length && !options.routeLine?.length) return null

  const width = options.width ?? 800
  const height = options.height ?? 480
  const zoom = options.zoom ?? 10
  const routeLine = options.routeLine ?? []

  // Пробуем захватить уже отрендеренную карту
  const mapSection = document.querySelector('[data-map-for-pdf="1"]') as HTMLElement | null
  const existingLeafletEl = mapSection?.querySelector('.leaflet-container') as HTMLElement | null
  if (existingLeafletEl && existingLeafletEl.clientWidth > 0 && existingLeafletEl.clientHeight > 0) {
    const domCapture = await generateMapImageFromDOM(
      existingLeafletEl,
      existingLeafletEl.clientWidth,
      existingLeafletEl.clientHeight,
      true,
    )
    if (domCapture) return domCapture
  }

  const cacheKey = buildCacheKey(points, routeLine, { width, height, zoom })
  const cached = leafletRouteSnapshotCache.get(cacheKey)
  if (cached) return cached

  const task = (async (): Promise<string | null> => {
    const L: any = await ensureLeaflet()
    if (!L) return null

    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-10000px'
    container.style.top = '-10000px'
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    container.style.zIndex = '-1'
    container.id = `metravel-map-snapshot-${Math.random().toString(16).slice(2)}`
    document.body.appendChild(container)

    const validPoints = filterValidCoords(points)
    const validRouteLine = filterValidRouteLine(routeLine)

    if (validPoints.length === 0 && validRouteLine.length === 0) {
      document.body.removeChild(container)
      return null
    }

    const viewCoords = [
      ...validPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...validRouteLine.map(([lat, lng]) => ({ lat, lng })),
    ]
    const centerLat = viewCoords.reduce((sum, p) => sum + p.lat, 0) / viewCoords.length
    const centerLng = viewCoords.reduce((sum, p) => sum + p.lng, 0) / viewCoords.length

    let map: any | null = null

    try {
      map = L.map(container, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      })

      const tileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          crossOrigin: 'anonymous',
          subdomains: 'abcd',
        },
      ).addTo(map)

      const latLngs = validPoints.map((p) => L.latLng(p.lat, p.lng))

      latLngs.forEach((latLng, index) => {
        const labelRaw = validPoints[index]?.label
        const labelFull =
          typeof labelRaw === 'string'
            ? labelRaw
                .replace(/\s+/g, ' ')
                .replace(/\s*,\s*/g, ', ')
                .replace(/,\s*,+/g, ', ')
                .replace(/[,\s]+$/g, '')
                .trim()
            : ''
        const firstSegment = labelFull.split(' · ')[0].trim()
        const label = firstSegment.length > 35 ? firstSegment.slice(0, 33) + '…' : firstSegment

        const iconHtml = buildMarkerIconHtml(index, latLngs.length, label)

        const icon = L.divIcon({
          className: 'metravel-map-marker',
          html: iconHtml,
          iconSize: [28, 42],
          iconAnchor: [14, 42],
        })

        L.marker(latLng, { icon }).addTo(map)
      })

      if (validRouteLine.length >= 2) {
        const routeLatLngs = validRouteLine.map(([lat, lng]) => L.latLng(lat, lng))

        if (routeLatLngs.length >= 2) {
          L.polyline(routeLatLngs, {
            color: DESIGN_TOKENS.colors.surface,
            weight: 8,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map)

          L.polyline(routeLatLngs, {
            color: DESIGN_TOKENS.colors.accent,
            weight: 5,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map)
        }
      }

      const allBoundsLatLngs = [...latLngs]
      if (validRouteLine.length >= 2) {
        validRouteLine.forEach(([lat, lng]) => {
          allBoundsLatLngs.push(L.latLng(lat, lng))
        })
      }

      if (allBoundsLatLngs.length > 0) {
        const bounds = L.latLngBounds(allBoundsLatLngs)
        if (bounds.isValid()) {
          const paddedBounds =
            typeof (bounds as { pad?: (padding: number) => unknown }).pad === 'function'
              ? bounds.pad(0.15)
              : bounds
          map.fitBounds(paddedBounds, { animate: false, maxZoom: 15 })
        }
      }

      await new Promise<void>((resolve) => {
        let resolved = false
        const timeout = window.setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve()
          }
        }, 6000)

        tileLayer.on('load', () => {
          if (!resolved) {
            resolved = true
            window.clearTimeout(timeout)
            window.setTimeout(resolve, 300)
          }
        })
      })

      const tileImages = container.querySelectorAll('.leaflet-tile-pane img, .leaflet-tile')
      let loadedTiles = 0
      tileImages.forEach((img) => {
        if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
          loadedTiles++
        }
      })

      if (loadedTiles === 0 && tileImages.length > 0) {
        if (typeof console !== 'undefined') {
          console.warn('[MAP_SNAPSHOT] No tiles loaded, skipping html2canvas capture')
        }
        return null
      }

      const dataUrl = await generateMapImageFromDOM(container, width, height)

      if (dataUrl && !dataUrl.startsWith('data:image/svg')) {
        const isBlank = await isImageMostlyBlank(dataUrl, width, height)
        if (isBlank) {
          if (typeof console !== 'undefined') {
            console.warn('[MAP_SNAPSHOT] Captured image is mostly blank, discarding')
          }
          return null
        }
      }

      return dataUrl
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('[MAP_SNAPSHOT] generateLeafletRouteSnapshot error', error)
      }
      return null
    } finally {
      if (map && typeof map.remove === 'function') {
        map.remove()
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  })()

  const wrapped = task
    .then((result) => {
      if (result === null) {
        leafletRouteSnapshotCache.delete(cacheKey)
      }
      return result
    })
    .catch((e) => {
      leafletRouteSnapshotCache.delete(cacheKey)
      throw e
    })

  leafletRouteSnapshotCache.set(cacheKey, wrapped)
  return wrapped
}
