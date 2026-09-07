/**
 * SEO utilities for canonical URLs and site base URL normalization
 */

import { familyRouteFromPathname, socialPreviewWidthForRoute } from '@/constants/imageContract';
import { resolveLegacyResizeOrigin, toLegacyResizePath } from '@/utils/mediaUrl';

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
    const route = familyRouteFromPathname(url.pathname);
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
 * Тот же кэшируемый transform-роут, по которому кадр запрашивает читатель (#1873).
 *
 * ЗАЧЕМ. Ownership/family-роуты идут мимо кэша nginx (`x-cache-status: BYPASS`)
 * даже со ступенью: тело правильное и `immutable`, но каждый обход краулера и
 * каждый шеринг заново гоняют ресайз в Django — на одном vCPU с transform
 * concurrency = 1. Тот же ключ на legacy-роуте кэшируется (замер прода
 * 07.09.2026, `3860/conversions/…-detail_hd.jpg?w=1280`: family `BYPASS`,
 * legacy `MISS` → `HIT`, тело байт в байт 83 182 B).
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ У ВЫЗЫВАЮЩИХ. Обложку соцпревью во фронте объявляют
 * четверо — Helmet (`useTravelDetailsHeadSync`), вьюмодель страницы,
 * `createTravelStructuredData` и `InstantSEO`, — и все они уже ходят сюда за
 * ступенью (#1221). Правило адреса обязано жить в той же единственной точке,
 * иначе повторится ровно то расхождение, ради которого заведён #1873: SSG уводил
 * на legacy-роут, а клиент возвращал family-роут поверх него.
 *
 * ПОРЯДОК НЕ КОММУТИРУЕТ — он тот же, что у `toSocialPreviewUrl` в
 * `scripts/generate-seo-pages.js`. `withSocialPreviewWidth` узнаёт семейство по
 * ПЕРВОМУ сегменту пути; после переписывания это `media-resize`, такого
 * семейства в контракте нет, ширина не проставится вовсе, и краулер получит
 * мастер с `no-store` — регресс #1221.
 *
 * Origin берём у `resolveLegacyResizeOrigin`, а не склеиваем сами: чужой хост и
 * прямая ссылка в бакет обязаны остаться нетронутыми — построить им наш
 * transform-роут значило бы выдать краулеру адрес, по которому картинки нет.
 * Классам без legacy-роута (плоский корень `/gallery/<hash>.webp` — большинство
 * обложек) отдельной ветки не нужно: `toLegacyResizePath` отдаёт на них `null`.
 */
function toSocialPreviewUrl(absoluteUrl: string): string {
  const withWidth = withSocialPreviewWidth(absoluteUrl);
  const origin = resolveLegacyResizeOrigin(withWidth);
  if (!origin) return withWidth;
  const legacyPath = toLegacyResizePath(withWidth);
  return legacyPath ? `${origin}${legacyPath}` : withWidth;
}

/**
 * Ensures any image URL is absolute and HTTPS for use in og:image / twitter:image,
 * pins a stored-derivative width and moves first-party media onto the cacheable
 * reader route (see `toSocialPreviewUrl`). Returns null for empty/invalid input.
 */
export function normalizeOgImageUrl(image?: string | null): string | null {
  if (!image) return null;
  const trimmed = String(image).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) return toSocialPreviewUrl(`https:${trimmed}`);
  if (trimmed.startsWith('http://'))
    return toSocialPreviewUrl(trimmed.replace(/^http:\/\//i, 'https://'));
  if (trimmed.startsWith('https://')) return toSocialPreviewUrl(trimmed);
  if (trimmed.startsWith('/')) return toSocialPreviewUrl(buildOgImageUrl(trimmed));
  return toSocialPreviewUrl(buildOgImageUrl(`/${trimmed}`));
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

type WebSeoMetadata = {
  title: string;
  description?: string;
};

const normalizeSeoContent = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
};

const syncLatestTitleTag = (title: string): HTMLTitleElement => {
  const nodes = Array.from(document.head.querySelectorAll('title'));
  const element = nodes.filter((node) => node.getAttribute('data-rh') === 'true').at(-1)
    ?? nodes.at(-1)
    ?? document.createElement('title');

  if (element.textContent !== title) element.textContent = title;
  if (!element.parentNode) document.head.insertBefore(element, document.head.firstChild);

  nodes.filter((node) => node !== element).forEach((node) => node.parentNode?.removeChild(node));
  return element;
};

const syncLatestMetaTag = (
  selector: string,
  attributes: Record<string, string>,
  content?: string,
): HTMLMetaElement | null => {
  if (typeof document === 'undefined') return null;

  const nodes = Array.from(document.head.querySelectorAll(selector)) as HTMLMetaElement[];
  if (!content) {
    nodes.forEach((node) => node.parentNode?.removeChild(node));
    return null;
  }

  const element = nodes.filter((node) => node.getAttribute('data-rh') === 'true').at(-1)
    ?? nodes.at(-1)
    ?? document.createElement('meta');

  for (const [name, value] of Object.entries(attributes)) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  if (element.getAttribute('content') !== content) element.setAttribute('content', content);
  if (!element.parentNode) document.head.appendChild(element);

  nodes.filter((node) => node !== element).forEach((node) => node.parentNode?.removeChild(node));
  return element;
};

/**
 * Makes the hydrated route metadata authoritative over the deterministic RU
 * SSG baseline. Expo Head may append its managed tags instead of adopting the
 * static ones. Keep the latest Expo-managed tag so route unmount can clean it
 * normally, and remove earlier static copies for the home-owned metadata.
 */
export function syncWebSeoMetadata({
  title,
  description,
}: WebSeoMetadata): ReadonlySet<Element> {
  const syncedNodes = new Set<Element>();
  if (typeof document === 'undefined') return syncedNodes;

  const normalizedTitle = normalizeSeoContent(title);
  if (!normalizedTitle) return syncedNodes;
  const normalizedDescription = normalizeSeoContent(description);

  syncedNodes.add(syncLatestTitleTag(normalizedTitle));

  const targets: Array<{
    selector: string;
    attributes: Record<string, string>;
    content: string | undefined;
  }> = [
    { selector: 'meta[name="description"]', attributes: { name: 'description' }, content: normalizedDescription },
    { selector: 'meta[property="og:title"]', attributes: { property: 'og:title' }, content: normalizedTitle },
    { selector: 'meta[property="og:description"]', attributes: { property: 'og:description' }, content: normalizedDescription },
    { selector: 'meta[name="twitter:title"]', attributes: { name: 'twitter:title' }, content: normalizedTitle },
    { selector: 'meta[name="twitter:description"]', attributes: { name: 'twitter:description' }, content: normalizedDescription },
  ];

  for (const target of targets) {
    const node = syncLatestMetaTag(target.selector, target.attributes, target.content);
    if (node) syncedNodes.add(node);
  }

  return syncedNodes;
}

/**
 * Removes only nodes captured by the active home sync and only while they still
 * carry that home value. Destination routes may intentionally use identical
 * fallback copy or duplicate static/runtime tags, so global selector/value
 * cleanup would corrupt their existing head contract.
 */
export function removeOwnedWebSeoMetadata(
  { title, description }: WebSeoMetadata,
  ownedNodes: ReadonlySet<Element>,
): void {
  if (typeof document === 'undefined') return;

  const normalizedTitle = normalizeSeoContent(title);
  const normalizedDescription = normalizeSeoContent(description);

  for (const node of ownedNodes) {
    if (!node.isConnected || node.ownerDocument !== document) continue;
    if (node.matches('title')) {
      if (normalizedTitle && normalizeSeoContent(node.textContent) === normalizedTitle) node.remove();
      continue;
    }

    const expectedContent = node.matches('meta[property="og:title"], meta[name="twitter:title"]')
      ? normalizedTitle
      : node.matches('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]')
        ? normalizedDescription
        : undefined;
    if (expectedContent && normalizeSeoContent(node.getAttribute('content')) === expectedContent) {
      node.remove();
    }
  }
}
