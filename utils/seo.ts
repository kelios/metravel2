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
 * Дешёвым и кэшируемым такой запрос делает ширина в URL: производная приходит с
 * `public, max-age=31536000, immutable`, мастер — с `no-store`, а `no-store` не
 * кэширует ни nginx, ни браузер, каким бы роутом он ни пришёл. Замер прода
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
 * Тот же адрес, по которому кадр запрашивает читатель (#1873).
 *
 * ЗАЧЕМ. Обложка соцпревью и `<img>` обязаны совпадать до символа: иначе тот же
 * файл живёт в кэше дважды, а краулер греет запись, которой читатель не
 * пользуется. До #1204 совпадение означало увод на `/media-resize/legacy/` —
 * тогда только он кэшировался (`x-cache-status: BYPASS` литералом на
 * model-owned роутах). С #1920 кэш включён и на них (замер прода 15.09.2026:
 * `MISS` → `HIT`), поэтому conversion-ключ остаётся на своём family-роуте, а
 * переписывание сохранилось у класса `uploads/**`.
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ У ВЫЗЫВАЮЩИХ. Обложку соцпревью во фронте объявляют
 * четверо — Helmet (`useTravelDetailsHeadSync`), вьюмодель страницы,
 * `createTravelStructuredData` и `InstantSEO`, — и все они уже ходят сюда за
 * ступенью (#1221). Правило адреса обязано жить в той же единственной точке,
 * иначе повторится ровно то расхождение, ради которого заведён #1873: SSG уводил
 * на legacy-роут, а клиент возвращал family-роут поверх него.
 *
 * ПОРЯДОК НЕ КОММУТИРУЕТ — он тот же, что у `toSocialPreviewUrl` в
 * `scripts/postprocess-route-shells.js`. `withSocialPreviewWidth` узнаёт семейство по
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
 * pins a stored-derivative width and keeps first-party media on the route the
 * reader actually requests (see `toSocialPreviewUrl`). Returns null for
 * empty/invalid input.
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

/**
 * `robots` документа по умолчанию: его ставит каждому HTML экспорта `app/+html.tsx`,
 * и его же менеджер head (`utils/webHeadManager`) пишет после SPA-перехода странице
 * без своего robots — вместо robots прежней страницы или пустоты (#2756).
 */
export function siteDefaultRobots(): string {
  const isProduction = typeof process !== 'undefined'
    && (process.env.EXPO_PUBLIC_SITE_URL === 'https://metravel.by' || process.env.NODE_ENV === 'production')
  return isProduction ? 'max-image-preview:large' : 'noindex,nofollow'
}
