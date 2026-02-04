// src/utils/mapImageGenerator.ts
// ✅ АРХИТЕКТУРА: Утилита для генерации статичных изображений карт

import type { MapPoint } from '@/src/types/article-pdf';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
 * Генерирует URL для статичной карты через OpenStreetMap
 * Использует публичный бесплатный сервис staticmap.openstreetmap.fr (без API-ключа)
 */
function generateOSMStaticMapUrl(
  points: MapPoint[],
  options: { width: number; height: number; zoom: number }
): string {
  const { width, height, zoom } = options;

  // Вычисляем центр
  const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

  // Формируем маркеры (упрощённо: одинаковый стиль для всех точек)
  const markers = points
    .map((point) => `${point.lat},${point.lng},lightblue1`)
    .join('|');

  // Стандартный статичный OSM без ключа
  // Используем французский зеркальный сервер staticmap.openstreetmap.fr
  const size = `${Math.round(width)}x${Math.round(height)}`;

  const url =
    `https://staticmap.openstreetmap.fr/staticmap.php?` +
    `center=${centerLat},${centerLng}` +
    `&zoom=${zoom}` +
    `&size=${size}` +
    `&markers=${markers}` +
    `&maptype=mapnik&format=png`;

  return url;
}

/**
 * Генерирует статичную карту через html2canvas (клиентский рендеринг)
 * Используется как fallback, если нет доступа к API карт
 */
export async function generateMapImageFromDOM(
  container: HTMLElement,
  width: number = 800,
  height: number = 600
): Promise<string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('generateMapImageFromDOM can only be used in a browser environment');
  }

  // Загружаем html2canvas через CDN, обходя metro-stub
  const ensureHtml2Canvas = async (): Promise<any> => {
    const w = window as any;
    if (w.html2canvas) {
      return w.html2canvas;
    }

    // Не создаём несколько тегов <script> при конкурентных вызовах
    if (!(ensureHtml2Canvas as any)._loader) {
      (ensureHtml2Canvas as any)._loader = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (err) => {
          // Сбрасываем кеш промиса при ошибке загрузки, чтобы можно было повторить попытку
          (ensureHtml2Canvas as any)._loader = null;
          reject(err);
        };
        document.body.appendChild(script);
      });
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
 * Генерирует снимок маршрута с помощью Leaflet + html2canvas
 * Использует скрытый off-screen контейнер, поэтому не влияет на основную верстку
 */
export async function generateLeafletRouteSnapshot(
  points: { lat: number; lng: number; label?: string }[],
  options: { width?: number; height?: number; zoom?: number } = {}
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  if (!points.length) return null;

  const width = options.width ?? 800;
  const height = options.height ?? 480;
  const zoom = options.zoom ?? 10;

  const ensureLeaflet = async (): Promise<any> => {
    const w = window as any;
    if (w.L) {
      return w.L;
    }

    const isTestEnv =
      typeof process !== 'undefined' &&
      (process as any).env &&
      (process as any).env.NODE_ENV === 'test';

    if (isTestEnv) {
      try {
        // In Jest we mock 'leaflet', so prefer synchronous require to avoid hanging on CDN.
        // Use an indirect require so Metro doesn't statically include Leaflet in the web entry bundle.
        const req = (0, eval)('require') as NodeRequire;
        const leafletMod = req('leaflet');
        w.L = leafletMod?.default ?? leafletMod;
        return w.L;
      } catch {
        return null;
      }
    }

    if (!(ensureLeaflet as any)._loader) {
      (ensureLeaflet as any)._loader = new Promise<void>((resolve, reject) => {
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
        script.onload = () => resolve();
        script.onerror = (err) => {
          (ensureLeaflet as any)._loader = null;
          reject(err);
        };
        document.body.appendChild(script);
      });
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
  container.id = 'metravel-map-snapshot';
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
  const validPoints = points.filter((p) =>
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 &&
    p.lng >= -180 && p.lng <= 180
  );

  if (validPoints.length === 0) {
    document.body.removeChild(container);
    return null;
  }

  // Минимальная инициализация карты (без анимаций, чтобы избежать багов в off-screen режиме)
  const centerLat = validPoints.reduce((sum, p) => sum + p.lat, 0) / validPoints.length;
  const centerLng = validPoints.reduce((sum, p) => sum + p.lng, 0) / validPoints.length;

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

    const tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: ' OpenStreetMap  CartoDB',
        crossOrigin: true,
      }
    ).addTo(map);

    // Маркеры как в веб-карте + аккуратный номер точки поверх пина
    const latLngs = validPoints.map((p) => L.latLng(p.lat, p.lng));

    latLngs.forEach((latLng, index) => {
      const number = index + 1;

      const labelRaw = validPoints[index]?.label;
      const label =
        typeof labelRaw === 'string'
          ? labelRaw
              .replace(/\s+/g, ' ')
              .replace(/\s*,\s*/g, ', ')
              .replace(/,\s*,+/g, ', ')
              .replace(/[,\s]+$/g, '')
              .trim()
          : '';

      const isStart = index === 0;
      const isEnd = index === latLngs.length - 1;
      const markerUrl = isStart
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
        : isEnd
          ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png'
          : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png';

      const labelBg = DESIGN_TOKENS.colors.surface;
      const labelText = DESIGN_TOKENS.colors.text;
      const labelBorder = DESIGN_TOKENS.colors.border;
      const badgeBg = DESIGN_TOKENS.colors.surface;
      const badgeText = DESIGN_TOKENS.colors.text;
      const fontFamily = DESIGN_TOKENS.typography.fontFamily;

      const iconHtml = `
        <div style="position: relative; width: 25px; height: 41px;">
          <img src="${markerUrl}"
            style="width: 25px; height: 41px; display: block;" />
          <div style="
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 20px;
            border-radius: 999px;
            background: ${badgeBg};
            color: ${badgeText};
            border: 1px solid ${labelBorder};
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: ${fontFamily};
            font-size: 12px;
            font-weight: 700;
            box-shadow: 0 2px 6px rgba(0,0,0,0.28);
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
          ">${number}</div>
          ${label ? `
            <div style="
              position: absolute;
              top: -8px;
              left: 30px;
              max-width: 320px;
              padding: 10px 12px;
              border-radius: 14px;
              background: ${labelBg};
              border: 1px solid ${labelBorder};
              color: ${labelText};
              font-family: ${fontFamily};
              font-size: 14px;
              line-height: 1.25;
              font-weight: 700;
              white-space: normal;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 3;
              -webkit-box-orient: vertical;
              box-shadow: 0 4px 14px rgba(0,0,0,0.18);
              text-rendering: geometricPrecision;
              -webkit-font-smoothing: antialiased;
            ">
              <div style="
                position: absolute;
                left: -9px;
                top: 16px;
                width: 0;
                height: 0;
                border-top: 9px solid transparent;
                border-bottom: 9px solid transparent;
                border-right: 9px solid ${labelBorder};
              "></div>
              <div style="
                position: absolute;
                left: -8px;
                top: 16px;
                width: 0;
                height: 0;
                border-top: 9px solid transparent;
                border-bottom: 9px solid transparent;
                border-right: 9px solid ${labelBg};
              "></div>
              ${escapeHtml(label)}
            </div>
          ` : ''}
        </div>
      `;

      const icon = L.divIcon({
        className: 'metravel-map-marker',
        html: iconHtml,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      L.marker(latLng, { icon }).addTo(map);
    });

    // Подгоняем границы под маршрут (без плавной анимации)
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [28, 28], animate: false });
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
      }, 1500);

      tileLayer.on('load', () => {
        if (!resolved) {
          resolved = true;
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Скриншот контейнера
    const dataUrl = await generateMapImageFromDOM(container, width, height);
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
}
