import {
  MAP_IMAGE_HEIGHT,
  MAP_IMAGE_WIDTH,
  MAP_IMAGE_ZOOM,
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  PRINT_COLORS,
  type PrintableMapPoint,
} from './constants';

type MapImageGeneratorModule = typeof import('@/utils/mapImageGenerator');

let mapImageGeneratorModulePromise: Promise<MapImageGeneratorModule> | null = null;

function loadMapImageGenerator(): Promise<MapImageGeneratorModule> {
  if (!mapImageGeneratorModulePromise) {
    mapImageGeneratorModulePromise = Promise.resolve(import('@/utils/mapImageGenerator'));
  }
  return mapImageGeneratorModulePromise;
}

export async function buildPrintableCanvasMapDataUrl(points: PrintableMapPoint[]): Promise<string> {
  if (!points.length) return '';

  try {
    const { generateCanvasMapSnapshot } = await loadMapImageGenerator();
    const snapshot = await generateCanvasMapSnapshot(
      points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        label: `${point.num}. ${point.location}`,
      })),
      {
        width: MAP_IMAGE_WIDTH,
        height: MAP_IMAGE_HEIGHT,
        routeLine: points.map((point) => [point.lat, point.lng] as [number, number]),
      },
    );
    return snapshot || '';
  } catch {
    return '';
  }
}

export async function buildPrintableLeafletMapDataUrl(points: PrintableMapPoint[]): Promise<string> {
  if (!points.length) return '';

  try {
    const { generateLeafletRouteSnapshot } = await loadMapImageGenerator();
    const snapshot = await generateLeafletRouteSnapshot(
      points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        label: `${point.num}. ${point.location}`,
      })),
      {
        width: MAP_IMAGE_WIDTH,
        height: MAP_IMAGE_HEIGHT,
        zoom: MAP_IMAGE_ZOOM,
        routeLine: points.map((point) => [point.lat, point.lng] as [number, number]),
      },
    );
    return snapshot || '';
  } catch {
    return '';
  }
}

export function buildPrintableMapSvg(points: PrintableMapPoint[]): string {
  if (!points.length) return '';

  const allLats = points.map((point) => point.lat);
  const allLngs = points.map((point) => point.lng);

  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  const latSpan = Math.max(maxLat - minLat, 0.004);
  const lngSpan = Math.max(maxLng - minLng, 0.004);
  const latPad = latSpan * 0.16;
  const lngPad = lngSpan * 0.16;

  const safeMinLat = minLat - latPad;
  const safeMaxLat = maxLat + latPad;
  const safeMinLng = minLng - lngPad;
  const safeMaxLng = maxLng + lngPad;

  const frame = 34;
  const drawableWidth = MAP_VIEWBOX_WIDTH - frame * 2;
  const drawableHeight = MAP_VIEWBOX_HEIGHT - frame * 2;

  const project = (lat: number, lng: number) => {
    const x = frame + ((lng - safeMinLng) / Math.max(safeMaxLng - safeMinLng, 0.001)) * drawableWidth;
    const y = frame + (1 - (lat - safeMinLat) / Math.max(safeMaxLat - safeMinLat, 0.001)) * drawableHeight;
    return { x, y };
  };

  const projectedPoints = points.map((point) => ({ ...point, ...project(point.lat, point.lng) }));
  const routePath = projectedPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');

  const markers = projectedPoints
    .map((point, index) => {
      const isFirst = index === 0;
      const isLast = index === projectedPoints.length - 1;
      const markerFill = isFirst ? PRINT_COLORS.brand : isLast ? PRINT_COLORS.brandDark : PRINT_COLORS.success;

      return `
            <g>
                <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="12.8" fill="${markerFill}" stroke="${PRINT_COLORS.white}" stroke-width="2.5"></circle>
                <text x="${point.x.toFixed(2)}" y="${(point.y + 4.1).toFixed(2)}" text-anchor="middle" font-size="10" font-family="'Avenir Next','Segoe UI',sans-serif" font-weight="700" fill="${PRINT_COLORS.white}">${point.num}</text>
            </g>
        `;
    })
    .join('');

  return `
        <svg class="map-svg" viewBox="0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}" role="img" aria-label="Схема маршрута квеста">
            <defs>
                <linearGradient id="mapBgGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${PRINT_COLORS.mapGridBg}"></stop>
                    <stop offset="100%" stop-color="${PRINT_COLORS.mapGridBgEnd}"></stop>
                </linearGradient>
                <pattern id="mapGrid" width="42" height="42" patternUnits="userSpaceOnUse">
                    <path d="M 42 0 L 0 0 0 42" fill="none" stroke="${PRINT_COLORS.mapGridStroke}" stroke-width="1"></path>
                </pattern>
            </defs>
            <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapBgGradient)"></rect>
            <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapGrid)" opacity="0.9"></rect>
            <polyline points="${routePath}" fill="none" stroke="${PRINT_COLORS.brand}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"></polyline>
            <polyline points="${routePath}" fill="none" stroke="${PRINT_COLORS.white}" stroke-width="1.2" stroke-dasharray="3 6" opacity="0.72"></polyline>
            ${markers}
        </svg>
    `;
}
