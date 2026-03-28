import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { GalleryLayout } from '@/types/pdf-gallery';
import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig';
import { buildSafeImageUrl } from '../../../utils/htmlUtils';
import type { NormalizedLocation, TravelSectionMeta } from './types';

export function sortTravels(
  travels: TravelForBook[],
  sortOrder: BookSettings['sortOrder']
): TravelForBook[] {
  const sorted = [...travels];
  switch (sortOrder) {
    case 'manual':
      return sorted;
    case 'date-desc':
      return sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    case 'date-asc':
      return sorted.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
    case 'country':
      return sorted.sort((a, b) =>
        (a.countryName || '').localeCompare(b.countryName || '', 'ru')
      );
    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    default:
      return sorted;
  }
}

export function getYearRange(travels: TravelForBook[]): string | undefined {
  const years = travels
    .map((travel) => Number(travel.year))
    .filter((year) => !Number.isNaN(year) && year > 0);
  if (!years.length) return undefined;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
}

export function resolveCoverImage(
  travels: TravelForBook[],
  settings: BookSettings
): string | undefined {
  if (settings.coverType === 'gradient') return undefined;
  if (settings.coverType === 'first-photo') {
    const first = travels[0];
    return first?.travel_image_url || first?.travel_image_thumb_url;
  }
  if (settings.coverType === 'custom') {
    return settings.coverImage;
  }
  if (settings.coverType === 'auto') {
    return settings.coverImage || getBestCoverImage(travels);
  }
  return settings.coverImage || getBestCoverImage(travels);
}

export function getBestCoverImage(travels: TravelForBook[]): string | undefined {
  for (const travel of travels) {
    const photo = travel.travel_image_url || travel.travel_image_thumb_url;
    if (photo) return photo;
  }
  return undefined;
}

export function buildTravelMeta(params: {
  travels: TravelForBook[];
  settings: BookSettings;
  getGalleryPhotosPerPage: (
    layout: GalleryLayout,
    totalPhotos: number,
    settings: BookSettings
  ) => number;
}): TravelSectionMeta[] {
  const { travels, settings, getGalleryPhotosPerPage } = params;
  const meta: TravelSectionMeta[] = [];
  let currentPage = settings.includeToc ? 3 : 2;

  travels.forEach((travel) => {
    const locations = normalizeLocations(travel);
    const galleryPhotos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url;
        return buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);
    const hasGallery = Boolean(settings.includeGallery && galleryPhotos.length);
    const galleryPageCount = hasGallery
      ? Math.max(
          1,
          Math.ceil(
            galleryPhotos.length /
              getGalleryPhotosPerPage(
                (settings.galleryLayout || 'grid') as GalleryLayout,
                galleryPhotos.length,
                settings
              )
          )
        )
      : 0;
    const hasMap = Boolean(settings.includeMap && locations.length);

    meta.push({
      travel,
      hasGallery,
      hasMap,
      locations,
      startPage: currentPage,
    });

    currentPage += 2;
    if (hasGallery) currentPage += galleryPageCount;
    if (hasMap) currentPage += 1;
  });

  return meta;
}

export function normalizeLocations(travel: TravelForBook): NormalizedLocation[] {
  if (!Array.isArray(travel.travelAddress)) return [];
  return travel.travelAddress
    .filter(Boolean)
    .map((point, index) => {
      const coords = parseCoordinates(point.coord);
      return {
        id: String(point.id ?? index),
        address: point.address || `Точка ${index + 1}`,
        categoryName: point.categoryName,
        coord: point.coord,
        thumbnailUrl: point.travelImageThumbUrl,
        lat: coords?.lat,
        lng: coords?.lng,
      };
    })
    .filter((location) => location.address.trim().length > 0);
}

export function parseCoordinates(coord?: string | null): { lat: number; lng: number } | null {
  if (!coord) return null;
  const [latStr, lngStr] = coord.split(',').map((value) => Number(value.trim()));
  if (Number.isNaN(latStr) || Number.isNaN(lngStr)) return null;
  return { lat: latStr, lng: lngStr };
}

export function buildRouteSvg(
  locations: NormalizedLocation[],
  theme: Pick<PdfThemeConfig, 'colors'>,
  options: { routeLineCoords?: Array<[number, number]> } = {}
): string {
  const points = locations
    .map((location) => {
      if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
      return { lat: location.lat, lng: location.lng, label: location.address };
    })
    .filter(Boolean) as Array<{ lat: number; lng: number; label?: string }>;

  const routeLine = (Array.isArray(options.routeLineCoords) ? options.routeLineCoords : [])
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        point[0] >= -90 &&
        point[0] <= 90 &&
        point[1] >= -180 &&
        point[1] <= 180
    )
    .map(([lat, lng]) => ({ lat, lng }));

  const layoutPoints = routeLine.length >= 2 ? [...routeLine, ...points] : points;

  if (!layoutPoints.length) {
    return buildMapPlaceholder(theme);
  }

  const lats = layoutPoints.map((point) => point.lat);
  const lngs = layoutPoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.0001, maxLat - minLat);
  const lngRange = Math.max(0.0001, maxLng - minLng);

  const paddingX = 8;
  const paddingY = 8;
  const width = 100 - paddingX * 2;
  const height = 60 - paddingY * 2;

  const projectPoint = (point: { lat: number; lng: number }) => {
    const x = paddingX + ((point.lng - minLng) / lngRange) * width;
    const y = paddingY + ((maxLat - point.lat) / latRange) * height;
    return { x, y };
  };

  const normalized = points.map((point, index) => {
    const rawLabel = point.label ?? '';
    const firstSegment = rawLabel.split(' · ')[0].trim();
    const shortLabel = firstSegment.length > 15 ? firstSegment.slice(0, 14) + '…' : firstSegment;
    return {
      ...projectPoint(point),
      index,
      label: shortLabel,
    };
  });

  const normalizedRouteLine = routeLine.map(projectPoint);

  const routeLineMarkup =
    normalizedRouteLine.length >= 2
      ? `<polyline
          points="${normalizedRouteLine.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')}"
          fill="none"
          stroke="${theme.colors.surface}"
          stroke-width="2.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.95"
        />
        <polyline
          points="${normalizedRouteLine.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')}"
          fill="none"
          stroke="${theme.colors.accentStrong}"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.95"
        />`
      : '';

  const markers = normalized
    .map(
      (point) => `
      <g>
        <path
          d="M ${point.x.toFixed(2)} ${(point.y - 0.6).toFixed(2)} c -1.9 0 -3.4 1.5 -3.4 3.4 c 0 2.7 3.4 6.4 3.4 6.4 s 3.4 -3.7 3.4 -6.4 c 0 -1.9 -1.5 -3.4 -3.4 -3.4 z"
          fill="${point.index === 0 ? theme.colors.accentStrong : theme.colors.accent}"
          stroke="${theme.colors.surface}"
          stroke-width="0.55"
        />
        <circle
          cx="${point.x.toFixed(2)}"
          cy="${(point.y + 2.2).toFixed(2)}"
          r="2.2"
          fill="${theme.colors.surface}"
          stroke="${theme.colors.accentStrong}"
          stroke-width="0.7"
        />
        <text
          x="${point.x.toFixed(2)}"
          y="${(point.y + 2.75).toFixed(2)}"
          font-size="3"
          text-anchor="middle"
          fill="${theme.colors.text}"
          font-weight="700"
        >
          ${point.index + 1}
        </text>
        ${
          point.label
            ? `
        <g transform="translate(${Math.min(77, point.x + 3.4).toFixed(2)} ${Math.max(4.8, point.y - 2.2).toFixed(2)})">
          <rect
            x="0"
            y="0"
            rx="2"
            width="${Math.min(22, Math.max(9, point.label.length * 0.95)).toFixed(2)}"
            height="6.4"
            fill="${theme.colors.surface}"
            stroke="${theme.colors.border}"
            stroke-width="0.45"
          />
          <text
            x="1.8"
            y="4.15"
            font-size="2.1"
            fill="${theme.colors.text}"
            font-weight="600"
          >${escapeXml(point.label)}</text>
        </g>
        `
            : ''
        }
      </g>
    `
    )
    .join('');

  return `
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-label="Маршрут путешествия">
      <defs>
        <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${theme.colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="5" fill="url(#mapGradient)" />
      <path d="M 0 48 C 16 42, 24 52, 39 46 S 66 39, 82 44 S 95 50, 100 46 L 100 60 L 0 60 Z" fill="${theme.colors.surface}" opacity="0.55" />
      <path d="M 0 16 C 15 10, 28 22, 41 17 S 66 9, 82 16 S 95 22, 100 17" fill="none" stroke="${theme.colors.borderLight}" stroke-width="0.8" opacity="0.75" />
      <path d="M 0 26 C 18 20, 28 31, 43 25 S 68 18, 84 24 S 95 30, 100 25" fill="none" stroke="${theme.colors.borderLight}" stroke-width="0.8" opacity="0.75" />
      <path d="M 0 37 C 16 31, 29 42, 44 36 S 69 28, 85 35 S 95 41, 100 36" fill="none" stroke="${theme.colors.borderLight}" stroke-width="0.8" opacity="0.75" />
      ${routeLineMarkup}
      ${markers}
    </svg>
  `;
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildMapPlaceholder(theme: Pick<PdfThemeConfig, 'colors'>): string {
  return `
    <svg viewBox="0 0 100 60" role="img" aria-label="Маршрут" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mapPlaceholderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${theme.colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="4" fill="url(#mapPlaceholderGradient)" />
      <text x="50" y="32" text-anchor="middle" fill="${theme.colors.textMuted}" font-size="8">Недостаточно данных</text>
    </svg>
  `;
}

export function buildGoogleMapsUrl(location: Pick<NormalizedLocation, 'lat' | 'lng'>): string {
  if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return '';
  const query = `${location.lat},${location.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function calculateRouteDistanceFromPreview(
  preview: import('@/types/travelRoutes').ParsedRoutePreview
): number {
  const linePoints = Array.isArray(preview?.linePoints) ? preview.linePoints : [];
  if (linePoints.length < 2) return 0;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;

  let totalKm = 0;
  let prevCoord: { lat: number; lng: number } | null = null;

  for (const point of linePoints) {
    const [latStr, lngStr] = String(point.coord ?? '').replace(/;/g, ',').split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    if (prevCoord) {
      const dLat = toRad(lat - prevCoord.lat);
      const dLng = toRad(lng - prevCoord.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(prevCoord.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalKm += radiusKm * c;
    }
    prevCoord = { lat, lng };
  }

  return totalKm;
}
