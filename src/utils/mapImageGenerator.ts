// src/utils/mapImageGenerator.ts
// ✅ АРХИТЕКТУРА: Утилита для генерации статичных изображений карт

import type { MapPoint } from '@/src/types/article-pdf';

/**
 * Генерирует URL для статичной карты через Google Static Maps API
 * TODO: Можно заменить на другой сервис (Mapbox, OpenStreetMap и т.д.)
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
 * Использует сервис staticmapmaker.com
 */
function generateOSMStaticMapUrl(
  points: MapPoint[],
  options: { width: number; height: number; zoom: number }
): string {
  const { width, height, zoom } = options;

  // Вычисляем центр
  const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

  // Формируем маркеры
  const markers = points
    .map((point, index) => {
      const color = index === 0 ? 'green' : index === points.length - 1 ? 'red' : 'blue';
      return `${point.lat},${point.lng},${color}pin${index + 1}`;
    })
    .join('|');

  // Используем OpenStreetMap через staticmapmaker
  // Альтернатива: можно использовать другие бесплатные сервисы
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/path-5+ff9f5a-0.8(${points.map((p) => `${p.lng},${p.lat}`).join(';')})/auto/${width}x${height}@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
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
  // Динамически импортируем html2canvas только при необходимости
  const html2canvas = await import('html2canvas').then((m) => m.default);

  const canvas = await html2canvas(container, {
    width,
    height,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    scale: 2,
  });

  return canvas.toDataURL('image/png');
}

