// src/utils/mapImageGenerator.ts
// ✅ АРХИТЕКТУРА: Утилита для генерации статичных изображений карт

import type { MapPoint } from '@/types/article-pdf';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const leafletRouteSnapshotCache = new Map<string, Promise<string | null>>();

function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    !!(process as any).env &&
    (process as any).env.NODE_ENV === 'test'
  );
}

function ensureLeafletSnapshotStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('metravel-leaflet-snapshot-styles')) return;

  const style = document.createElement('style');
  style.id = 'metravel-leaflet-snapshot-styles';
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
  `;
  document.head.appendChild(style);
}

function normalizeCoordPair(lat: number, lng: number): string {
  const safeLat = Number.isFinite(lat) ? Number(lat).toFixed(6) : 'NaN';
  const safeLng = Number.isFinite(lng) ? Number(lng).toFixed(6) : 'NaN';
  return `${safeLat},${safeLng}`;
}

function buildLeafletRouteSnapshotCacheKey(
  points: { lat: number; lng: number; label?: string }[],
  routeLine: Array<[number, number]>,
  options: { width: number; height: number; zoom: number }
): string {
  const normalizedPoints = points
    .map((p) => {
      const label = typeof p.label === 'string' ? p.label.trim() : '';
      return `${normalizeCoordPair(p.lat, p.lng)},${label}`;
    })
    .join('|');

  const normalizedRouteLine = routeLine
    .map(([lat, lng]) => normalizeCoordPair(lat, lng))
    .join('|');

  return `${options.width}x${options.height}@${options.zoom}:p=${normalizedPoints}:r=${normalizedRouteLine}`;
}

/**
 * Генерирует URL для статичной карты через Google Static Maps API
 */
export function generateStaticMapUrl(
  points: MapPoint[],
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    apiKey?: string;
  } = {}
): string {
  if (points.length === 0) {
    return '';
  }

  const { width = 800, height = 600, zoom = 12, apiKey } = options;

  // Если нет API ключа, используем OpenStreetMap через staticmapmaker
  if (!apiKey) {
    return generateOSMStaticMapUrl(points, { width, height, zoom });
  }

  // Формируем маркеры
  const markers = points
    .map((point, index) => {
      const color = index === 0 ? 'green' : index === points.length - 1 ? 'red' : 'blue';
      return `color:${color}|label:${index + 1}|${point.lat},${point.lng}`;
    })
    .join('&markers=');

  // Вычисляем центр карты
  const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

  // Формируем путь (полилинию)
  const path = points.map((p) => `${p.lat},${p.lng}`).join('|');

  return `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&zoom=${zoom}&center=${centerLat},${centerLng}&markers=${markers}&path=color:0xff9f5a|weight:5|${path}&key=${apiKey}`;
}

/**
 * Ранее использовала staticmap.openstreetmap.fr — сервис недоступен.
 * Возвращает пустую строку; основной путь — generateCanvasMapSnapshot.
 */
function generateOSMStaticMapUrl(
  _points: MapPoint[],
  _options: { width: number; height: number; zoom: number }
): string {
  return '';
}

/**
 * Генерирует статичную карту через html2canvas (клиентский рендеринг)
 * Используется как fallback, если нет доступа к API карт
 *
 * @param returnNullOnError — если true, возвращает null при ошибке html2canvas
 *   вместо серой заглушки. Используется при попытке захватить DOM-карту,
 *   чтобы при провале перейти к off-screen подходу.
 */
export async function generateMapImageFromDOM(
  container: HTMLElement,
  width: number = 800,
  height: number = 600,
  returnNullOnError: boolean = false
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    if (returnNullOnError) return null;
    throw new Error('generateMapImageFromDOM can only be used in a browser environment');
  }

  // Загружаем html2canvas через CDN, обходя metro-stub
  const ensureHtml2Canvas = async (): Promise<any> => {
    const w = window as any;
    if (w.html2canvas) {
      return w.html2canvas;
    }

    if (!(ensureHtml2Canvas as any)._loader) {
      (ensureHtml2Canvas as any)._loader = (async () => {
        if (isTestEnvironment()) {
          try {
            const req = (0, eval)('require') as NodeRequire;
            const html2canvasMod = req('html2canvas');
            w.html2canvas = html2canvasMod?.default ?? html2canvasMod;
            if (w.html2canvas) return;
          } catch (error) {
            void error;
          }
        }

        try {
          const html2canvasMod = await import('html2canvas');
          w.html2canvas = html2canvasMod?.default ?? html2canvasMod;
          if (w.html2canvas) {
            return;
          }
        } catch (error) {
          void error;
        }

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (err) => {
            (ensureHtml2Canvas as any)._loader = null;
            reject(err);
          };
          document.body.appendChild(script);
        });
      })();
    }

    await (ensureHtml2Canvas as any)._loader;

    if (!w.html2canvas) {
      throw new Error('html2canvas failed to load from CDN');
    }

    return w.html2canvas;
  };

  const html2canvas = await ensureHtml2Canvas();

  try {
    const canvas = await html2canvas(container, {
      width,
      height,
      useCORS: true,
      allowTaint: false,
      backgroundColor: 'rgb(255, 255, 255)',
      scale: 2,
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    // Логируем реальную ошибку html2canvas для диагностики
    if (typeof console !== 'undefined') {
      console.error('[MAP_SNAPSHOT_DOM] generateMapImageFromDOM error', error);
    }

    if (returnNullOnError) return null;

    // Fallback: если карта не может быть экспортирована (CORS/DOM-ошибка),
    // возвращаем простую заглушку, чтобы PDF всё равно содержал валидное изображение
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = width;
    fallbackCanvas.height = height;
    const ctx = fallbackCanvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgb(102, 102, 102)';
      ctx.font = '20px Arial, sans-serif';
      const message = 'Карта не доступна для экспорта';
      const textWidth = ctx.measureText(message).width;
      ctx.fillText(message, Math.max(10, (width - textWidth) / 2), height / 2);
    }

    return fallbackCanvas.toDataURL('image/png');
  }
}

/**
 * Проверяет, является ли data URL изображение почти полностью одноцветным (пустая карта).
 * Проверяет выборку пикселей — если >95% одного цвета, считает изображение пустым.
 */
async function isImageMostlyBlank(dataUrl: string, _origWidth: number, _origHeight: number): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (isTestEnvironment()) return false;
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = dataUrl;
    });

    const sampleSize = 100;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;

    // Считаем количество «фоновых» пикселей (близких к первому пикселю)
    const r0 = data[0], g0 = data[1], b0 = data[2];
    let sameCount = 0;
    const totalPixels = sampleSize * sampleSize;
    const threshold = 30; // допуск на различие цвета

    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - r0) < threshold &&
        Math.abs(data[i + 1] - g0) < threshold &&
        Math.abs(data[i + 2] - b0) < threshold
      ) {
        sameCount++;
      }
    }

    return sameCount / totalPixels > 0.92;
  } catch {
    return false;
  }
}

/**
 * Загружает изображение по URL и конвертирует в data URI.
 * Используется для конвертации static map URLs в inline-формат для PDF.
 */
export async function fetchImageAsDataUri(
  url: string,
  timeoutMs: number = 10000
): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  if (!url || url.startsWith('data:')) return url || null;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
      img.onload = () => { window.clearTimeout(timer); resolve(); };
      img.onerror = () => { window.clearTimeout(timer); reject(new Error('load failed')); };
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────
// Canvas-based map renderer (без html2canvas, надёжный для PDF)
// ────────────────────────────────────────────────────

function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom)
}
function latToTileY(lat: number, zoom: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom)
}

function calculateFitZoom(
  minLat: number, maxLat: number, minLng: number, maxLng: number,
  width: number, height: number
): number {
  for (let z = 16; z >= 2; z--) {
    const x1 = lngToTileX(minLng, z) * 256
    const x2 = lngToTileX(maxLng, z) * 256
    const y1 = latToTileY(maxLat, z) * 256
    const y2 = latToTileY(minLat, z) * 256
    // Добавляем 15% padding
    if ((x2 - x1) * 1.3 <= width && (y2 - y1) * 1.3 <= height) return z
  }
  return 2
}

function loadCrossOriginImage(url: string, timeoutMs: number = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => { reject(new Error('timeout')) }, timeoutMs)
    img.onload = () => { window.clearTimeout(timer); resolve(img) }
    img.onerror = () => { window.clearTimeout(timer); reject(new Error('load error')) }
    img.src = url
  })
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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

/**
 * Генерирует карту маршрута напрямую на Canvas.
 * Загружает тайлы, рисует маршрут и маркеры — без html2canvas.
 * Самый надёжный метод для PDF-экспорта.
 */
export async function generateCanvasMapSnapshot(
  points: { lat: number; lng: number; label?: string }[],
  options: { width?: number; height?: number; routeLine?: Array<[number, number]> } = {}
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null

  const width = options.width ?? 800
  const height = options.height ?? 480
  const routeLine = (options.routeLine ?? []).filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
  const validPoints = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
      p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
  )

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

  const zoom = Math.min(15, calculateFitZoom(minLat, maxLat, minLng, maxLng, width, height))
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  // Pixel coordinates центра
  const cxPx = lngToTileX(centerLng, zoom) * 256
  const cyPx = latToTileY(centerLat, zoom) * 256

  // Диапазон тайлов
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

  // Фон
  ctx.fillStyle = '#e8e4df'
  ctx.fillRect(0, 0, width, height)

  // Загружаем и рисуем тайлы
  const subdomains = 'abcd'
  const tilePromises: Promise<void>[] = []

  for (let tx = startTX; tx <= endTX; tx++) {
    for (let ty = startTY; ty <= endTY; ty++) {
      const s = subdomains[Math.abs(tx + ty) % subdomains.length]
      const url = `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}@2x.png`
      const drawX = tx * tileSize - (cxPx - width / 2)
      const drawY = ty * tileSize - (cyPx - height / 2)

      tilePromises.push(
        loadCrossOriginImage(url).then((img) => {
          ctx.drawImage(img, drawX, drawY, tileSize, tileSize)
        }).catch(() => { /* skip failed tiles */ })
      )
    }
  }

  await Promise.all(tilePromises)

  // Проекция lat/lng → canvas px
  const toCanvasX = (lng: number) => lngToTileX(lng, zoom) * 256 - (cxPx - width / 2)
  const toCanvasY = (lat: number) => latToTileY(lat, zoom) * 256 - (cyPx - height / 2)

  // Прямые HEX-цвета для canvas (CSS var() не работает в Canvas API)
  const MAP_COLORS = {
    route: '#e07840',      // яркий оранжевый для маршрута
    routeHalo: 'rgba(255,255,255,0.92)',
    pinStart: '#3a8a5c',   // насыщенный зелёный
    pinEnd: '#c0504d',     // насыщенный красный
    pinMid: '#4a7fb5',     // насыщенный синий
    labelBg: '#fff',
    labelBorder: '#d0d5dd',
    labelText: '#1a1a1a',
  }

  // Линия маршрута
  if (routeLine.length >= 2) {
    // Белый ореол
    ctx.strokeStyle = MAP_COLORS.routeHalo
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    routeLine.forEach(([lat, lng], i) => {
      const px = toCanvasX(lng), py = toCanvasY(lat)
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // Основная линия
    ctx.strokeStyle = MAP_COLORS.route
    ctx.lineWidth = 4
    ctx.beginPath()
    routeLine.forEach(([lat, lng], i) => {
      const px = toCanvasX(lng), py = toCanvasY(lat)
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  // Маркеры
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

    // Тень пина
    ctx.beginPath()
    ctx.ellipse(px, py + 3, 8, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fill()

    // Хвост пина (треугольник)
    ctx.beginPath()
    ctx.moveTo(px - 8, py - 8)
    ctx.lineTo(px, py + 4)
    ctx.lineTo(px + 8, py - 8)
    ctx.fillStyle = pinColor
    ctx.fill()

    // Круг пина
    ctx.beginPath()
    ctx.arc(px, py - 13, 13, 0, Math.PI * 2)
    ctx.fillStyle = pinColor
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.stroke()

    // Номер
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(index + 1), px, py - 13)

    // Подпись
    const rawLabel = typeof point.label === 'string' ? point.label : ''
    const firstSegment = rawLabel.split(' · ')[0].trim()
    const label = firstSegment.length > 30 ? firstSegment.slice(0, 28) + '…' : firstSegment
    if (label) {
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif'
      const labelW = ctx.measureText(label).width + 16
      const lx = px + 18
      const ly = py - 22

      // Тень подписи
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2

      drawRoundRect(ctx, lx, ly, labelW, 24, 6)
      ctx.fillStyle = MAP_COLORS.labelBg
      ctx.fill()
      ctx.strokeStyle = MAP_COLORS.labelBorder
      ctx.lineWidth = 1
      ctx.stroke()

      // Сброс тени
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Треугольник-указатель
      ctx.beginPath()
      ctx.moveTo(lx, ly + 8)
      ctx.lineTo(lx - 7, ly + 12)
      ctx.lineTo(lx, ly + 16)
      ctx.fillStyle = MAP_COLORS.labelBg
      ctx.fill()

      ctx.fillStyle = MAP_COLORS.labelText
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, lx + 8, ly + 12)
    }
  })

  // Attribution (мелким шрифтом)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('© OpenStreetMap © CARTO', width - 6, height - 4)

  return canvas.toDataURL('image/png')
}

/**
 * Генерирует снимок маршрута с помощью Leaflet + html2canvas
 * Используется скрытый off-screen контейнер, поэтому не влияет на основную верстку
 *
 * @param points - массив точек маршрута с координатами и опциональными метками
 * @param options.routeLine - опциональная линия маршрута из GPX/KML файла [[lat, lng], ...]
 */
export async function generateLeafletRouteSnapshot(
  points: { lat: number; lng: number; label?: string }[],
  options: { width?: number; height?: number; zoom?: number; routeLine?: Array<[number, number]> } = {}
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (!points.length && !options.routeLine?.length) return null;

  const width = options.width ?? 800;
  const height = options.height ?? 480;
  const zoom = options.zoom ?? 10;
  const routeLine = options.routeLine ?? [];

  // Первым делом пробуем захватить уже отрендеренную карту со страницы путешествия.
  // Это даёт точно такой же вид, как на странице (тайлы + маркеры с номерами + линия).
  // Флаг [data-map-for-pdf="1"] выставляется на секции TravelRouteMapBlock.
  const mapSection = document.querySelector('[data-map-for-pdf="1"]') as HTMLElement | null;
  const existingLeafletEl = mapSection?.querySelector('.leaflet-container') as HTMLElement | null;
  if (existingLeafletEl && existingLeafletEl.clientWidth > 0 && existingLeafletEl.clientHeight > 0) {
    const domCapture = await generateMapImageFromDOM(
      existingLeafletEl,
      existingLeafletEl.clientWidth,
      existingLeafletEl.clientHeight,
      true // returnNullOnError — при провале переходим к off-screen подходу
    );
    if (domCapture) return domCapture;
  }

  const cacheKey = buildLeafletRouteSnapshotCacheKey(points, routeLine, { width, height, zoom });
  const cached = leafletRouteSnapshotCache.get(cacheKey);
  if (cached) return cached;

  const task = (async (): Promise<string | null> => {
    const ensureLeaflet = async (): Promise<any> => {
      const w = window as any;
      if (w.L) {
        ensureLeafletSnapshotStyles();
        return w.L;
      }

      if (!(ensureLeaflet as any)._loader) {
        (ensureLeaflet as any)._loader = (async () => {
          if (isTestEnvironment()) {
            try {
              const req = (0, eval)('require') as NodeRequire;
              const leafletMod = req('leaflet');
              w.L = leafletMod?.default ?? leafletMod;
              if (w.L) {
                ensureLeafletSnapshotStyles();
                return;
              }
            } catch (error) {
              void error;
            }
          }

          try {
            const leafletMod = await import('leaflet');
            w.L = leafletMod?.default ?? leafletMod;
            if (w.L) {
              ensureLeafletSnapshotStyles();
              return;
            }
          } catch (error) {
            void error;
          }

          await new Promise<void>((resolve, reject) => {
            const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            if (!document.querySelector(`link[href="${cssHref}"]`)) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = cssHref;
              document.head.appendChild(link);
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => {
              ensureLeafletSnapshotStyles();
              resolve();
            };
            script.onerror = (err) => {
              (ensureLeaflet as any)._loader = null;
              reject(err);
            };
            document.body.appendChild(script);
          });
        })();
      }

      await (ensureLeaflet as any)._loader;

      if (!w.L) {
        throw new Error('Leaflet failed to load from CDN');
      }

      return w.L;
    };

    const L: any = await ensureLeaflet();
    if (!L) {
      return null;
    }

    // Создаем off-screen контейнер
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-10000px';
    container.style.top = '-10000px';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.zIndex = '-1';
    container.id = `metravel-map-snapshot-${Math.random().toString(16).slice(2)}`;
    document.body.appendChild(container);

    const escapeHtml = (value: string): string => {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Фильтруем точки с валидными координатами
    const validPoints = points.filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        p.lat >= -90 &&
        p.lat <= 90 &&
        p.lng >= -180 &&
        p.lng <= 180
    );

    const validRouteLine = routeLine.filter(
      ([lat, lng]) =>
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );

    if (validPoints.length === 0 && validRouteLine.length === 0) {
      document.body.removeChild(container);
      return null;
    }

    const viewCoords = [
      ...validPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...validRouteLine.map(([lat, lng]) => ({ lat, lng })),
    ];
    const centerLat = viewCoords.reduce((sum, p) => sum + p.lat, 0) / viewCoords.length;
    const centerLng = viewCoords.reduce((sum, p) => sum + p.lng, 0) / viewCoords.length;

    let map: any | null = null;

    try {
      map = L.map(container, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      });

      // CARTO light_all — стабильные CORS-заголовки, светлый стиль идеален для печати
      const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        crossOrigin: 'anonymous',
        subdomains: 'abcd',
      }).addTo(map);

      // Маркеры как в веб-карте + аккуратный номер точки поверх пина
      const latLngs = validPoints.map((p) => L.latLng(p.lat, p.lng));

      latLngs.forEach((latLng, index) => {
        const number = index + 1;

        const labelRaw = validPoints[index]?.label;
        const labelFull =
          typeof labelRaw === 'string'
            ? labelRaw
                .replace(/\s+/g, ' ')
                .replace(/\s*,\s*/g, ', ')
                .replace(/,\s*,+/g, ', ')
                .replace(/[,\s]+$/g, '')
                .trim()
            : '';
        // Use only the first segment (before " · ") and cap length to keep labels compact on the map
        const firstSegment = labelFull.split(' · ')[0].trim();
        const label = firstSegment.length > 35 ? firstSegment.slice(0, 33) + '…' : firstSegment;

        const isStart = index === 0;
        const isEnd = index === latLngs.length - 1;
        const labelBg = DESIGN_TOKENS.colors.surface;
        const labelText = DESIGN_TOKENS.colors.text;
        const labelBorder = DESIGN_TOKENS.colors.border;
        const fontFamily = DESIGN_TOKENS.typography.fontFamily;

        const pinFill = isStart
          ? DESIGN_TOKENS.colors.success
          : isEnd
            ? DESIGN_TOKENS.colors.danger
            : DESIGN_TOKENS.colors.accent;
        const pinStroke = DESIGN_TOKENS.colors.surface;
        const pinShadow = 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))';
        const numberColor = DESIGN_TOKENS.colors.textOnPrimary;

        const iconHtml = `
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
          ${label ? `
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
          ` : ''}
        </div>
      `;

        const icon = L.divIcon({
          className: 'metravel-map-marker',
          html: iconHtml,
          iconSize: [28, 42],
          iconAnchor: [14, 42],
        });

        L.marker(latLng, { icon }).addTo(map);
      });

      // Рисуем линию маршрута в той же манере, что и на travel page: светлый halo + основная линия.
      if (validRouteLine.length >= 2) {
        const routeLatLngs = validRouteLine.map(([lat, lng]) => L.latLng(lat, lng));

        if (routeLatLngs.length >= 2) {
          L.polyline(routeLatLngs, {
            color: DESIGN_TOKENS.colors.surface,
            weight: 8,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          L.polyline(routeLatLngs, {
            color: DESIGN_TOKENS.colors.accent,
            weight: 5,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
        }
      }

      // Подгоняем границы под маршрут (без плавной анимации)
      const allBoundsLatLngs = [...latLngs];
      if (validRouteLine.length >= 2) {
        validRouteLine.forEach(([lat, lng]) => {
          allBoundsLatLngs.push(L.latLng(lat, lng));
        });
      }

      if (allBoundsLatLngs.length > 0) {
        const bounds = L.latLngBounds(allBoundsLatLngs);
        if (bounds.isValid()) {
          const paddedBounds =
            typeof (bounds as { pad?: (padding: number) => unknown }).pad === 'function'
              ? bounds.pad(0.15)
              : bounds;
          map.fitBounds(paddedBounds, { animate: false, maxZoom: 15 });
        }
      }

      // Ждем загрузки тайлов (или таймаут как fallback)
      await new Promise<void>((resolve) => {
        let resolved = false;
        const timeout = window.setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 6000);

        tileLayer.on('load', () => {
          if (!resolved) {
            resolved = true;
            window.clearTimeout(timeout);
            // Даём 300ms на финальный рендер после load-события
            window.setTimeout(resolve, 300);
          }
        });
      });

      // Проверяем, загрузились ли тайлы
      const tileImages = container.querySelectorAll('.leaflet-tile-pane img, .leaflet-tile');
      let loadedTiles = 0;
      tileImages.forEach((img) => {
        if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
          loadedTiles++;
        }
      });

      if (loadedTiles === 0 && tileImages.length > 0) {
        if (typeof console !== 'undefined') {
          console.warn('[MAP_SNAPSHOT] No tiles loaded, skipping html2canvas capture');
        }
        return null;
      }

      // Скриншот контейнера
      const dataUrl = await generateMapImageFromDOM(container, width, height);

      // Валидация: проверяем что изображение не пустое (все пиксели одного цвета)
      if (dataUrl && !dataUrl.startsWith('data:image/svg')) {
        const isBlank = await isImageMostlyBlank(dataUrl, width, height);
        if (isBlank) {
          if (typeof console !== 'undefined') {
            console.warn('[MAP_SNAPSHOT] Captured image is mostly blank, discarding');
          }
          return null;
        }
      }

      return dataUrl;
    } catch (error) {
      // В случае ошибки вернем null, чтобы генератор PDF мог использовать SVG как fallback
      if (typeof console !== 'undefined') {
        console.error('[MAP_SNAPSHOT] generateLeafletRouteSnapshot error', error);
      }
      return null;
    } finally {
      if (map && typeof map.remove === 'function') {
        map.remove();
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  })();

  const wrapped = task
    .then((result) => {
      if (result === null) {
        leafletRouteSnapshotCache.delete(cacheKey);
      }
      return result;
    })
    .catch((e) => {
      leafletRouteSnapshotCache.delete(cacheKey);
      throw e;
    });

  leafletRouteSnapshotCache.set(cacheKey, wrapped);
  return wrapped;
}
