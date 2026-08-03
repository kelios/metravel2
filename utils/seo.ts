/**
 * SEO utilities for canonical URLs and site base URL normalization
 */

import { socialPreviewWidthForRoute } from '@/constants/imageContract';

export const DEFAULT_OG_IMAGE_PATH = '/assets/icons/logo_yellow_512x512.png';

/** Thematic 1200×630 cover for the /quests catalog (Open Graph). */
export const QUESTS_OG_IMAGE_PATH = '/og/quests.jpg';

/** Branded 1200×630 cover for the /map page (Open Graph). */
export const MAP_OG_IMAGE_PATH = '/og-map.png';

/**
 * Returns normalized site base URL without trailing slash.
 * Uses EXPO_PUBLIC_SITE_URL from environment or defaults to production URL.
 * 
 * @example
 * getSiteBaseUrl() // => "https://metravel.by"
 */
export function getSiteBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
  return raw.replace(/\/+$/, ''); // remove trailing slashes
}

/**
 * Builds canonical URL for a given pathname.
 * Ensures proper URL structure without double slashes.
 * 
 * @param pathname - Route pathname (e.g., "/travels/my-route" or "/")
 * @example
 * buildCanonicalUrl("/travels/123") // => "https://metravel.by/travels/123"
 * buildCanonicalUrl("/") // => "https://metravel.by/"
 */
export function buildCanonicalUrl(pathname: string): string {
  const base = getSiteBaseUrl();
  const rawPath = String(pathname || '').trim();
  if (!rawPath || /^\/+$/.test(rawPath)) {
    return `${base}/`;
  }

  const normalizedWithLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const normalized = normalizedWithLeadingSlash.replace(/\/+$/, '');
  return `${base}${normalized}`;
}

/**
 * Builds Open Graph image URL.
 * 
 * @param imagePath - Relative image path (e.g., "/og-home.jpg")
 * @example
 * buildOgImageUrl("/og-home.jpg") // => "https://metravel.by/og-home.jpg"
 */
export function buildOgImageUrl(imagePath: string): string {
  const base = getSiteBaseUrl();
  const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${base}${normalized}`;
}

/**
 * Ownership-роут в начале пути: `/gallery/…`, `/address-image/…` и т.д.
 * По нему определяется семейство, а значит и доступные ступени ширины.
 */
const OWNERSHIP_ROUTE_PATTERN = /^\/([a-z-]+)\//i;

/**
 * Соцпревью просят картинку по «голому» адресу, без `?w=` — и получают МАСТЕР.
 *
 * Ownership-роуты объявлены `X-Cache-Status: BYPASS` в nginx, поэтому дешёвым и
 * кэшируемым такой запрос делает только ширина в URL: производная приходит с
 * `public, max-age=31536000, immutable`, мастер — с `no-store`. Замер прода
 * 2026-08-03 (#1221): 6% медиа-запросов уходили без `w=` и стоили 44 МБ за
 * 4 ч 43 мин, в среднем ~370 КБ на запрос, а самые медленные ответы сайта —
 * это именно они (avg 18 с, max 58 с на `-thumb_200.jpg`).
 *
 * Ширину берём из контракта семейства, а не константой: спрашивать ступень вне
 * `derivatives` нельзя — чтение fail-closed и отвечает 400 (#1224).
 */
function withSocialPreviewWidth(absoluteUrl: string): string {
  try {
    const url = new URL(absoluteUrl);
    if (url.searchParams.has('w')) return absoluteUrl;
    const route = OWNERSHIP_ROUTE_PATTERN.exec(url.pathname)?.[1];
    if (!route) return absoluteUrl;
    const width = socialPreviewWidthForRoute(route);
    if (!width) return absoluteUrl;
    url.searchParams.set('w', String(width));
    return url.toString();
  } catch {
    return absoluteUrl;
  }
}

/**
 * Ensures any image URL is absolute and HTTPS for use in og:image / twitter:image,
 * and pins a stored-derivative width for first-party media (see `withSocialPreviewWidth`).
 * Returns null for empty/invalid input.
 */
export function normalizeOgImageUrl(image?: string | null): string | null {
  if (!image) return null;
  const trimmed = String(image).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) return withSocialPreviewWidth(`https:${trimmed}`);
  if (trimmed.startsWith('http://'))
    return withSocialPreviewWidth(trimmed.replace(/^http:\/\//i, 'https://'));
  if (trimmed.startsWith('https://')) return withSocialPreviewWidth(trimmed);
  if (trimmed.startsWith('/')) return withSocialPreviewWidth(buildOgImageUrl(trimmed));
  return withSocialPreviewWidth(buildOgImageUrl(`/${trimmed}`));
}

export function ensureSingleTitleTag(title: string): HTMLTitleElement | null {
  if (typeof document === 'undefined') return null;

  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) return null;

  const titleElements = Array.from(document.head.querySelectorAll('title'));
  const titleElement = titleElements[0] ?? document.createElement('title');

  if (!titleElement.parentNode) {
    document.head.insertBefore(titleElement, document.head.firstChild);
  }

  if (titleElement.textContent !== normalizedTitle) {
    titleElement.textContent = normalizedTitle;
  }

  titleElements.slice(1).forEach((element) => element.parentNode?.removeChild(element));

  return titleElement;
}
