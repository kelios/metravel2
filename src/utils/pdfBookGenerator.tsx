// src/utils/pdfBookGenerator.tsx
// Обновленный генератор PDF-фотоальбома с поддержкой шаблонов и карт

import QRCode from 'qrcode';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { sanitizeRichText } from './sanitizeRichText';

export interface TravelForBook {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
  description?: string | null;
  recommendation?: string | null;
  plus?: string | null;
  minus?: string | null;
  countryName?: string;
  cityName?: string;
  year?: string | number;
  monthName?: string;
  number_days?: number;
  travel_image_thumb_url?: string;
  travel_image_url?: string;
  gallery?: Array<{
    url: string;
    id?: number | string;
    updated_at?: string;
  }>;
  travelAddress?: Array<{
    id: string;
    address: string;
    coord: string;
    travelImageThumbUrl?: string;
    categoryName?: string;
  }>;
  youtube_link?: string;
  userName?: string;
}

type TemplateName = BookSettings['template'];

interface TemplateTheme {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  text: string;
  muted: string;
  mutedLight: string;
  pageBackground: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  highlight: string;
  coverGradient: [string, string];
  coverText: string;
  headingFont: string;
  bodyFont: string;
}

const TEMPLATE_THEMES: Record<TemplateName, TemplateTheme> = {
  classic: {
    accent: '#ff9f5a',
    accentStrong: '#ff8c42',
    accentSoft: '#ffe0c7',
    text: '#1f2937',
    muted: '#6b7280',
    mutedLight: '#9ca3af',
    pageBackground: '#f3f4f6',
    surface: '#ffffff',
    surfaceAlt: '#fdf8f3',
    border: '#e5e7eb',
    highlight: '#fff4e5',
    coverGradient: ['#2b1a12', '#ff9f5a'],
    coverText: '#ffffff',
    headingFont: "'Playfair Display', 'Times New Roman', serif",
    bodyFont: "'Cormorant Garamond', 'Georgia', serif",
  },
  modern: {
    accent: '#38bdf8',
    accentStrong: '#0ea5e9',
    accentSoft: '#dbeafe',
    text: '#0f172a',
    muted: '#475569',
    mutedLight: '#94a3b8',
    pageBackground: '#e2e8f0',
    surface: '#ffffff',
    surfaceAlt: '#f8fafc',
    border: '#cbd5f5',
    highlight: '#e0f2fe',
    coverGradient: ['#0f172a', '#1d4ed8'],
    coverText: '#f8fafc',
    headingFont: "'Poppins', 'Inter', 'Segoe UI', sans-serif",
    bodyFont: "'Inter', 'Helvetica Neue', sans-serif",
  },
  romantic: {
    accent: '#f472b6',
    accentStrong: '#ec4899',
    accentSoft: '#fbcfe8',
    text: '#4a1d32',
    muted: '#9d4b73',
    mutedLight: '#d68fb4',
    pageBackground: '#fff5f8',
    surface: '#ffffff',
    surfaceAlt: '#fff0f7',
    border: '#f9c6dd',
    highlight: '#ffe4ef',
    coverGradient: ['#f472b6', '#fda4af'],
    coverText: '#ffffff',
    headingFont: "'Cormorant Garamond', 'Georgia', serif",
    bodyFont: "'Source Sans Pro', 'Helvetica Neue', sans-serif",
  },
  adventure: {
    accent: '#f97316',
    accentStrong: '#ea580c',
    accentSoft: '#fed7aa',
    text: '#2b1b14',
    muted: '#7c4a2d',
    mutedLight: '#c05621',
    pageBackground: '#f3f0ea',
    surface: '#ffffff',
    surfaceAlt: '#fef3c7',
    border: '#fcd34d',
    highlight: '#fff7ed',
    coverGradient: ['#1e3a8a', '#f97316'],
    coverText: '#ffffff',
    headingFont: "'Oswald', 'Montserrat', 'Arial', sans-serif",
    bodyFont: "'Nunito', 'Helvetica Neue', sans-serif",
  },
  minimal: {
    accent: '#10b981',
    accentStrong: '#059669',
    accentSoft: '#d1fae5',
    text: '#111827',
    muted: '#6b7280',
    mutedLight: '#94a3b8',
    pageBackground: '#f6f6f4',
    surface: '#ffffff',
    surfaceAlt: '#f4f4f1',
    border: '#e5e7eb',
    highlight: '#e0f2f1',
    coverGradient: ['#0f172a', '#10b981'],
    coverText: '#ffffff',
    headingFont: "'IBM Plex Sans', 'Inter', 'Segoe UI', sans-serif",
    bodyFont: "'Inter', 'Segoe UI', sans-serif",
  },
};

const DEFAULT_THEME = TEMPLATE_THEMES.classic;
const IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url=';
const DEFAULT_IMAGE_PARAMS = 'w=1600&fit=inside';
const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" rx="24" ry="24" fill="#f3f4f6"/>
    <path d="M160 600 L360 340 L520 480 L720 300 L1000 600" stroke="#d1d5db" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="360" cy="320" r="90" fill="#d1d5db"/>
    <circle cx="820" cy="420" r="60" fill="#e5e7eb"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#cbd5f5" font-family="sans-serif" font-size="48">Изображение недоступно</text>
  </svg>`
)}`;

function isLocalResource(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('192.168.') ||
    lower.startsWith('/') ||
    lower.startsWith('blob:')
  );
}

function buildSafeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) return trimmed;
  if (isLocalResource(trimmed)) return PLACEHOLDER_IMAGE;

  try {
    const normalized = trimmed.replace(/^https?:\/\//i, '');
    const delimiter = encodeURIComponent(normalized);
    return `${IMAGE_PROXY_BASE}${delimiter}&${DEFAULT_IMAGE_PARAMS}`;
  } catch {
    return trimmed;
  }
}

interface NormalizedLocation {
  id: string;
  address: string;
  categoryName?: string;
  coord?: string;
  travelImageThumbUrl?: string;
  lat?: number;
  lng?: number;
}

interface TravelSectionMeta {
  travel: TravelForBook;
  hasGallery: boolean;
  hasMap: boolean;
  locations: NormalizedLocation[];
  startPage: number;
}

function buildMapPlaceholder(theme: TemplateTheme) {
  return `
    <svg viewBox="0 0 100 60" role="img" aria-label="Маршрут" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mapPlaceholderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.surfaceAlt}" />
          <stop offset="100%" stop-color="${theme.highlight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="4" fill="url(#mapPlaceholderGradient)" />
      <text x="50" y="32" text-anchor="middle" fill="${theme.mutedLight}" font-size="8">Недостаточно данных</text>
    </svg>
  `;
}

function escapeHtml(value: string | null | undefined) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function makeQR(url: string): Promise<string> {
  if (!url) return '';
  try {
    return await QRCode.toDataURL(url, { margin: 1, scale: 4, width: 200 });
  } catch {
    return '';
  }
}

function getPrimaryPhoto(travel?: TravelForBook): string | undefined {
  if (!travel) return undefined;
  if (travel.travel_image_url) return travel.travel_image_url;
  if (travel.travel_image_thumb_url) return travel.travel_image_thumb_url;
  if (travel.gallery && travel.gallery.length > 0) {
    const [first] = travel.gallery;
    if (typeof first === 'string') return first;
    return first?.url;
  }
  return undefined;
}

function getBestCoverImage(travels: TravelForBook[]): string | undefined {
  for (const travel of travels) {
    const photo = getPrimaryPhoto(travel);
    if (photo) return photo;
  }
  return undefined;
}

function sortTravels(
  travels: TravelForBook[],
  sortOrder: BookSettings['sortOrder']
): TravelForBook[] {
  const sorted = [...travels];
  switch (sortOrder) {
    case 'date-desc':
      return sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    case 'date-asc':
      return sorted.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
    case 'country':
      return sorted.sort((a, b) => (a.countryName || '').localeCompare(b.countryName || '', 'ru'));
    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    default:
      return sorted;
  }
}

function getYearRange(travels: TravelForBook[]): string | undefined {
  const years = travels
    .map((t) => Number(t.year))
    .filter((year) => !Number.isNaN(year) && year > 0);
  if (!years.length) return undefined;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
}

function getTemplateTheme(template?: TemplateName): TemplateTheme {
  if (!template) return DEFAULT_THEME;
  return TEMPLATE_THEMES[template] ?? DEFAULT_THEME;
}

function resolveCoverImage(travels: TravelForBook[], settings: BookSettings): string | undefined {
  if (settings.coverType === 'gradient') return undefined;
  if (settings.coverType === 'first-photo') {
    return getPrimaryPhoto(travels[0]);
  }
  if (settings.coverType === 'custom') {
    return settings.coverImage;
  }
  if (settings.coverType === 'auto') {
    return settings.coverImage || getBestCoverImage(travels);
  }
  return settings.coverImage || getBestCoverImage(travels);
}

function normalizeLocations(travel: TravelForBook): NormalizedLocation[] {
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
        travelImageThumbUrl: point.travelImageThumbUrl,
        lat: coords?.lat,
        lng: coords?.lng,
      };
    })
    .filter((location) => location.address.trim().length > 0);
}

function parseCoordinates(coord?: string | null): { lat: number; lng: number } | null {
  if (!coord) return null;
  const [latStr, lngStr] = coord.split(',').map((value) => Number(value.trim()));
  if (Number.isNaN(latStr) || Number.isNaN(lngStr)) return null;
  return { lat: latStr, lng: lngStr };
}

function buildRouteSvg(locations: NormalizedLocation[], theme: TemplateTheme) {
  const points = locations
    .map((location) => {
      if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
      return { lat: location.lat, lng: location.lng };
    })
    .filter(Boolean) as Array<{ lat: number; lng: number }>;

  if (!points.length) {
    return buildMapPlaceholder(theme);
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.0001, maxLat - minLat);
  const lngRange = Math.max(0.0001, maxLng - minLng);

  const paddingX = 6;
  const paddingY = 8;
  const width = 100 - paddingX * 2;
  const height = 60 - paddingY * 2;

  const normalized = points.map((point, index) => {
    const x = paddingX + ((point.lng - minLng) / lngRange) * width;
    const y = paddingY + ((maxLat - point.lat) / latRange) * height;
    return { x, y, index };
  });

  const path = normalized
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');

  const circles = normalized
    .map(
      (point) => `
      <g>
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2"
          fill="${theme.accent}" stroke="${theme.surface}" stroke-width="0.8" />
        <text x="${point.x.toFixed(2)}" y="${(point.y - 3).toFixed(2)}"
          font-size="4" text-anchor="middle" fill="${theme.coverText}" font-weight="700">
          ${point.index + 1}
        </text>
      </g>`
    )
    .join('');

  return `
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Маршрут путешествия">
      <defs>
        <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.surfaceAlt}" />
          <stop offset="100%" stop-color="${theme.highlight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" rx="5" fill="url(#mapGradient)" />
      <path d="${path}" fill="none" stroke="${theme.accentStrong}" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" />
      ${circles}
    </svg>
  `;
}

function buildLocationList(locations: NormalizedLocation[], theme: TemplateTheme) {
  return locations
    .map(
      (location, index) => `
        <div style="display: flex; gap: 10px; align-items: flex-start; padding: 8px 0;
          border-bottom: 1px solid ${theme.border};">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: ${theme.accentSoft};
            color: ${theme.accentStrong}; display: flex; align-items: center; justify-content: center;
            font-weight: 700;">${index + 1}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: ${theme.text}; margin-bottom: 2px;">
              ${escapeHtml(location.address)}
            </div>
            ${
              location.categoryName
                ? `<div style="font-size: 11pt; color: ${theme.muted};">${escapeHtml(location.categoryName)}</div>`
                : ''
            }
            ${
              location.coord
                ? `<div style="font-size: 10pt; color: ${theme.mutedLight};">${escapeHtml(location.coord)}</div>`
                : ''
            }
          </div>
        </div>
      `
    )
    .join('');
}

function formatDays(days?: number | null): string {
  if (typeof days !== 'number' || Number.isNaN(days)) return '';
  const normalized = Math.max(0, Math.round(days));
  if (normalized === 0) return '';
  if (normalized % 10 === 1 && normalized % 100 !== 11) return `${normalized} день`;
  if ([2, 3, 4].includes(normalized % 10) && ![12, 13, 14].includes(normalized % 100)) {
    return `${normalized} дня`;
  }
  return `${normalized} дней`;
}

function buildStyles(theme: TemplateTheme): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0;
      font-family: ${theme.bodyFont};
      color: ${theme.text};
      background: ${theme.pageBackground};
      line-height: 1.6;
    }
    .pdf-page {
      width: 210mm;
      min-height: 297mm;
      background: ${theme.surface};
      margin: 0 auto 16px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
      position: relative;
    }
    img { max-width: 100%; display: block; }
    h1, h2, h3, h4 { font-family: ${theme.headingFont}; color: ${theme.text}; }
    @media print {
      body { background: #ffffff; }
      .pdf-page { page-break-after: always; box-shadow: none; margin: 0 auto; }
    }
  `;
}

function renderCoverPage(options: {
  settings: BookSettings;
  theme: TemplateTheme;
  travelCount: number;
  userName: string;
  yearRange?: string;
  coverImage?: string;
}) {
  const { settings, theme, travelCount, userName, yearRange, coverImage } = options;
  const travelLabel =
    travelCount === 1 ? 'путешествие' : travelCount < 5 ? 'путешествия' : 'путешествий';
  const safeCoverImage = buildSafeImageUrl(coverImage);
  const background = safeCoverImage
    ? `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%), url('${escapeHtml(
        safeCoverImage
      )}')`
    : `linear-gradient(135deg, ${theme.coverGradient[0]} 0%, ${theme.coverGradient[1]} 100%)`;

  return `
    <section class="pdf-page cover-page" style="
      padding: 0;
      height: 297mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      color: ${theme.coverText};
      background: ${background};
      background-size: cover;
      background-position: center;
      position: relative;
      overflow: hidden;
    ">
      <div style="padding: 40mm 30mm; position: relative; z-index: 2;">
        ${
          settings.subtitle
            ? `<div style="font-size: 14pt; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.8); margin-bottom: 12mm;">
              ${escapeHtml(settings.subtitle)}
            </div>`
            : ''
        }
        <h1 style="font-size: 48pt; font-weight: 800; line-height: 1.2; margin-bottom: 20mm;
          text-shadow: 0 10px 30px rgba(0,0,0,0.45);">
          ${escapeHtml(settings.title)}
        </h1>
        <div style="display: flex; gap: 24mm; align-items: center; margin-bottom: 16mm;">
          <div>
            <div style="font-size: 32pt; font-weight: 800; color: ${theme.accent};">
              ${travelCount}
            </div>
            <div style="font-size: 13pt; text-transform: uppercase; letter-spacing: 0.08em;">
              ${travelLabel}
            </div>
          </div>
          ${
            yearRange
              ? `<div style="border-left: 1px solid rgba(255,255,255,0.4); padding-left: 24mm;">
                  <div style="font-size: 32pt; font-weight: 700; color: ${theme.accent};">
                    ${yearRange}
                  </div>
                  <div style="font-size: 13pt; letter-spacing: 0.08em;">годы</div>
                </div>`
              : ''
          }
        </div>
        <div style="font-size: 16pt; font-style: italic; opacity: 0.95; margin-bottom: 28mm;">
          ${escapeHtml(userName)}
        </div>
        <div style="font-size: 11pt; opacity: 0.75;">
          Создано ${new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>
      <div style="position: absolute; top: 0; bottom: 0; left: 0; right: 0;
        background: linear-gradient(120deg, rgba(0,0,0,0.25), transparent 60%);"></div>
      <div style="position: absolute; bottom: 20mm; right: 25mm; font-weight: 600; letter-spacing: 0.12em;">
        MeTravel
      </div>
    </section>
  `;
}

function renderTocPage(options: {
  meta: TravelSectionMeta[];
  pageNumber: number;
  includeGallery: boolean;
  theme: TemplateTheme;
}) {
  const { meta, pageNumber, theme } = options;
    const tocItems = meta
    .map((item, index) => {
      const travel = item.travel;
      const thumbRaw =
        (travel as any).travel_image_thumb_small_url ||
        travel.travel_image_thumb_url ||
        getPrimaryPhoto(travel);
      const thumb = buildSafeImageUrl(thumbRaw);
      return `
        <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 16px;
          padding: 12px 16px; background: ${theme.surface}; border-radius: 14px;
          border: 1px solid ${theme.border}; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);">
          ${
            thumb
              ? `<div style="width: 52px; height: 52px; border-radius: 12px; overflow: hidden;">
                  <img src="${escapeHtml(thumb)}" alt="${escapeHtml(travel.name)}"
                    style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />
                </div>`
              : `<div style="width: 52px; height: 52px; border-radius: 12px; background: ${theme.accentSoft};
                  display: flex; align-items: center; justify-content: center; font-size: 18pt;">🧭</div>`
          }
          <div>
            <div style="font-weight: 700; font-size: 14pt;">${index + 1}. ${escapeHtml(travel.name)}</div>
            <div style="font-size: 11pt; color: ${theme.muted}; display: flex; gap: 12px;">
              ${travel.countryName ? `<span>📍 ${escapeHtml(travel.countryName)}</span>` : ''}
              ${travel.year ? `<span>📅 ${escapeHtml(String(travel.year))}</span>` : ''}
            </div>
          </div>
          <div style="font-weight: 700; color: ${theme.accent}; font-size: 16pt;">
            ${item.startPage}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="pdf-page toc-page" style="padding: 30mm 28mm; background: linear-gradient(180deg, ${theme.surfaceAlt}, #ffffff);">
      <div style="text-align: center; margin-bottom: 24mm;">
        <h2 style="font-size: 34pt; margin-bottom: 8px;">Содержание</h2>
        <p style="color: ${theme.muted}; font-size: 12pt;">
          ${meta.length} ${meta.length === 1 ? 'путешествие' : meta.length < 5 ? 'путешествия' : 'путешествий'}
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${tocItems}
      </div>
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

function renderTravelPhotoPage(options: { travel: TravelForBook; pageNumber: number; theme: TemplateTheme }) {
  const { travel, pageNumber, theme } = options;
  const coverImage = getPrimaryPhoto(travel);
  const safeCoverImage = buildSafeImageUrl(coverImage);
  const metaPieces = [
    travel.countryName ? `📍 ${escapeHtml(travel.countryName)}` : null,
    travel.year ? `📅 ${escapeHtml(String(travel.year))}` : null,
    formatDays(travel.number_days),
  ].filter(Boolean);

  return `
    <section class="pdf-page travel-photo-page" style="padding: 20mm;">
      ${
        safeCoverImage
          ? `<div style="border-radius: 18px; overflow: hidden; position: relative; box-shadow: 0 15px 40px rgba(15,23,42,0.25);">
              <img src="${escapeHtml(safeCoverImage)}" alt="${escapeHtml(travel.name)}"
                style="width: 100%; height: 210mm; object-fit: cover;" crossorigin="anonymous" />
              <div style="position: absolute; left: 0; right: 0; bottom: 0;
                background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%);
                padding: 24mm 18mm;">
                <h1 style="color: #ffffff; font-size: 28pt; margin-bottom: 6mm;">${escapeHtml(travel.name)}</h1>
                ${
                  metaPieces.length
                    ? `<div style="color: rgba(255,255,255,0.9); font-size: 12pt; display: flex; gap: 14px;">
                        ${metaPieces.join('<span>•</span>')}
                      </div>`
                    : ''
                }
              </div>
            </div>`
          : `<div style="border-radius: 18px; background: ${theme.accentSoft}; height: 210mm;
              display: flex; align-items: center; justify-content: center; color: ${theme.accentStrong};">
              <h1 style="font-size: 28pt;">${escapeHtml(travel.name)}</h1>
            </div>`
      }
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

function renderTravelTextPage(options: {
  travel: TravelForBook;
  qr: string;
  url?: string;
  pageNumber: number;
  theme: TemplateTheme;
}) {
  const { travel, qr, url, pageNumber, theme } = options;
  const description = travel.description ? sanitizeRichText(travel.description) : null;
  const recommendation = travel.recommendation ? sanitizeRichText(travel.recommendation) : null;
  const plus = travel.plus ? sanitizeRichText(travel.plus) : null;
  const minus = travel.minus ? sanitizeRichText(travel.minus) : null;

  return `
    <section class="pdf-page travel-text-page" style="padding: 28mm 30mm;">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <h2 style="font-size: 18pt; text-transform: uppercase; letter-spacing: 0.1em; color: ${theme.accent};">
            Описание
          </h2>
          <div style="font-size: 12pt; color: ${theme.text};">
            ${
              description ||
              `<p style="color: ${theme.mutedLight}; font-style: italic;">Описание путешествия отсутствует</p>`
            }
          </div>
        </div>
        ${
          recommendation
            ? `<div>
                <h2 style="font-size: 18pt; text-transform: uppercase; letter-spacing: 0.1em; color: ${theme.accent};">
                  Рекомендации
                </h2>
                <div style="font-size: 12pt;">${recommendation}</div>
              </div>`
            : ''
        }
        ${
          plus || minus
            ? `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
                ${
                  plus
                    ? `<div style="background: #f0fdf4; border-radius: 12px; padding: 12px 14px; border: 1px solid #86efac;">
                        <h3 style="margin-bottom: 8px; color: #15803d;">Плюсы</h3>
                        <div style="font-size: 11pt;">${plus}</div>
                      </div>`
                    : ''
                }
                ${
                  minus
                    ? `<div style="background: #fef2f2; border-radius: 12px; padding: 12px 14px; border: 1px solid #fca5a5;">
                        <h3 style="margin-bottom: 8px; color: #b91c1c;">Минусы</h3>
                        <div style="font-size: 11pt;">${minus}</div>
                      </div>`
                    : ''
                }
              </div>`
            : ''
        }
        ${
          url
            ? `<div style="margin-top: 24px; display: flex; gap: 16px; align-items: center; border-top: 1px solid ${theme.border}; padding-top: 16px;">
                ${
                  qr
                    ? `<img src="${qr}" alt="QR" style="width: 45mm; height: 45mm; border-radius: 12px; border: 4px solid ${theme.surfaceAlt};" />`
                    : ''
                }
                <div style="font-size: 11pt; color: ${theme.muted};">
                  <div style="text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">Онлайн-версия</div>
                  <div style="word-break: break-all;">${escapeHtml(url)}</div>
                </div>
              </div>`
            : ''
        }
      </div>
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

function renderGalleryPage(options: { travel: TravelForBook; pageNumber: number; theme: TemplateTheme }) {
  const { travel, pageNumber, theme } = options;
  const photos = (travel.gallery || [])
    .map((item) => {
      const raw = typeof item === 'string' ? item : item?.url;
      return buildSafeImageUrl(raw);
    })
    .filter((url): url is string => !!url && url.trim().length > 0);
  if (!photos.length) return '';

  const columns = photos.length <= 4 ? 2 : photos.length <= 6 ? 3 : 4;

  return `
    <section class="pdf-page gallery-page" style="padding: 22mm 24mm;">
      <div style="text-align: center; margin-bottom: 16mm;">
        <h2 style="font-size: 22pt; margin-bottom: 4mm;">Фотогалерея</h2>
        <p style="color: ${theme.muted};">${escapeHtml(travel.name)}</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 8mm;">
        ${photos
          .map(
            (photo, index) => `
              <div style="border-radius: 12px; overflow: hidden; position: relative; box-shadow: 0 8px 20px rgba(15,23,42,0.15);">
                <img src="${escapeHtml(photo)}" alt="Фото ${index + 1}"
                  style="width: 100%; height: 70mm; object-fit: cover;" crossorigin="anonymous" />
                <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.55);
                  color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex;
                  align-items: center; justify-content: center; font-size: 11pt;">${index + 1}</div>
              </div>
            `
          )
          .join('')}
      </div>
      <div style="margin-top: 12mm; text-align: center; color: ${theme.muted}; font-size: 11pt;">
        ${photos.length} ${photos.length === 1 ? 'фотография' : photos.length < 5 ? 'фотографии' : 'фотографий'}
      </div>
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

function renderMapPage(options: {
  travel: TravelForBook;
  locations: NormalizedLocation[];
  pageNumber: number;
  theme: TemplateTheme;
}) {
  const { travel, locations, pageNumber, theme } = options;
  if (!locations.length) return '';

  const mapSvg = buildRouteSvg(locations, theme);
  const locationList = buildLocationList(locations, theme);

  return `
    <section class="pdf-page map-page" style="padding: 24mm 26mm;">
      <div style="display: grid; grid-template-columns: 2fr 3fr; gap: 20mm;">
        <div style="background: ${theme.surfaceAlt}; border-radius: 16px; padding: 12px 12px 4px 12px; border: 1px solid ${theme.border};">
          ${mapSvg}
        </div>
        <div>
          <h2 style="font-size: 20pt; margin-bottom: 8px;">Маршрут</h2>
          <p style="color: ${theme.muted}; margin-bottom: 16px;">${escapeHtml(travel.name)}</p>
          <div>
            ${locationList}
          </div>
        </div>
      </div>
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

function renderFinalPage(pageNumber: number, theme: TemplateTheme) {
  return `
    <section class="pdf-page final-page" style="padding: 40mm 32mm; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center;">
      <div style="font-size: 60pt; margin-bottom: 24mm;">✨</div>
      <h2 style="font-size: 28pt; margin-bottom: 12px;">Спасибо за путешествие!</h2>
      <p style="color: ${theme.muted}; max-width: 110mm;">
        Пусть эта книга напоминает о самых теплых эмоциях и помогает планировать новые приключения.
      </p>
      <div style="margin-top: 28mm; font-size: 11pt; color: ${theme.mutedLight};">
        © MeTravel ${new Date().getFullYear()}
      </div>
      <div style="position: absolute; bottom: 15mm; right: 25mm; font-size: 12pt; color: ${theme.mutedLight};">
        ${pageNumber}
      </div>
    </section>
  `;
}

export async function buildPhotoBookHTML(
  travels: TravelForBook[],
  settings: BookSettings
): Promise<string> {
  const sortedTravels = sortTravels(travels, settings.sortOrder);
  const theme = getTemplateTheme(settings.template);
  const coverImage = resolveCoverImage(sortedTravels, settings);
  const yearRange = getYearRange(sortedTravels);
  const userName = sortedTravels[0]?.userName || 'Путешественник';

  const qrCodes = await Promise.all(
    sortedTravels.map((travel) => {
      const url = travel.slug ? `https://metravel.by/travels/${travel.slug}` : travel.url || '';
      return makeQR(url);
    })
  );

  let currentPage = settings.includeToc ? 3 : 2;
  const meta: TravelSectionMeta[] = [];

  sortedTravels.forEach((travel, index) => {
    const locations = normalizeLocations(travel);
    const hasGallery = Boolean(settings.includeGallery && travel.gallery && travel.gallery.length);
    const hasMap = Boolean(settings.includeMap && locations.length);
    meta.push({
      travel,
      hasGallery,
      hasMap,
      locations,
      startPage: currentPage,
    });
    currentPage += 2; // photo + text
    if (hasGallery) currentPage += 1;
    if (hasMap) currentPage += 1;
  });

  const finalPageNumber = currentPage;

  let runningPage = 1;
  const pages: string[] = [];
  pages.push(
    renderCoverPage({
      settings,
      theme,
      travelCount: sortedTravels.length,
      userName,
      yearRange,
      coverImage,
    })
  );

  if (settings.includeToc) {
    pages.push(
      renderTocPage({
        meta,
        pageNumber: 2,
        includeGallery: settings.includeGallery,
        theme,
      })
    );
    runningPage = 3;
  } else {
    runningPage = 2;
  }

  meta.forEach((item, index) => {
    const photoPageNumber = runningPage;
    pages.push(
      renderTravelPhotoPage({
        travel: item.travel,
        pageNumber: photoPageNumber,
        theme,
      })
    );
    runningPage += 1;

    const textPageNumber = runningPage;
    pages.push(
      renderTravelTextPage({
        travel: item.travel,
        qr: qrCodes[index],
        url: item.travel.slug
          ? `https://metravel.by/travels/${item.travel.slug}`
          : item.travel.url,
        pageNumber: textPageNumber,
        theme,
      })
    );
    runningPage += 1;

    if (item.hasGallery) {
      pages.push(
        renderGalleryPage({
          travel: item.travel,
          pageNumber: runningPage,
          theme,
        })
      );
      runningPage += 1;
    }

    if (item.hasMap) {
      pages.push(
        renderMapPage({
          travel: item.travel,
          locations: item.locations,
          pageNumber: runningPage,
          theme,
        })
      );
      runningPage += 1;
    }
  });

  pages.push(renderFinalPage(finalPageNumber, theme));

  const html = `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(settings.title)}</title>
  <style>
    ${buildStyles(theme)}
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>
  `;

  const sanitizedHtml = html.replace(/var\s*\(--[^)]+\)/gi, 'transparent');

  if (sanitizedHtml.includes('var(')) {
    const tokens = sanitizedHtml.match(/var\([^)]*\)/g);
    console.warn('[PDFGenerator] Unresolved CSS variables detected:', tokens);
  }

  return sanitizedHtml;
}

