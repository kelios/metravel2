import type { Travel } from '@/types/types';
import { DEFAULT_LOCALE, i18n, translate as i18nT } from '@/i18n'
import { SEO_TITLE_MAX_LENGTH, buildSeoTitle, htmlToPlainText, normalizeSeoLead } from '@/utils/seoText'
import { normalizeOgImageUrl } from '@/utils/seo'
import { buildTravelPath as buildRouteTravelPath, buildTravelPathFromTravel } from '@/utils/routePaths'


const getSeoHtmlFallback = () => i18nT('travel:utils.travelSeo.htmlFallback');
const getTravelFallbackDescription = () => i18nT('travel:utils.travelSeo.descriptionFallback');
const SITE_URL = 'https://metravel.by';
const TRAVEL_SLUG_STOP_WORDS = new Set(['i', 'k', 'ko', 'na', 'o', 'ot', 'po', 's', 'so', 'v', 'vo', 'za']);

/**
 * Возвращает относительный путь к странице путешествия: `/travels/{slug|id}`.
 * Без encodeURIComponent — для совместимости с существующими прямыми
 * использованиями в hero/sticky-actions.
 *
 * #1438: это тонкая обёртка над `utils/routePaths.buildTravelPath`, а не вторая
 * реализация. Раньше две одноимённые функции расходились контрактом: здесь
 * пригодность сегмента проверялась собственным `key !== ''`, поэтому литералы
 * (`'null'`) и нулевой id проходили насквозь — share-ссылка и запись избранного
 * получали адрес в 404.
 */
export function buildTravelPath(
  travel: Pick<Travel, 'slug' | 'id'> | null | undefined,
): string | null {
  return buildTravelPathFromTravel(travel, { encode: false });
}

/**
 * Путь, который допустимо публиковать краулерам. От навигационного отличается
 * одним: числовая форма не проходит. Прямой заход на `/travels/<id>` прод
 * отдаёт пустым 404 (#1512), поэтому в canonical/og:url и JSON-LD такой адрес
 * был бы тем же самообъявленным 404, что и `/travels/null` из #1438.
 */
export function buildIndexableTravelPath(value: unknown): string | null {
  const path = buildRouteTravelPath(value, { encode: false });
  if (!path) return null;
  return /^\/travels\/-?\d+$/.test(path) ? null : path;
}

/**
 * Собственный адрес страницы статьи для структурированных данных.
 *
 * `canonicalUrl` — адрес, который экран уже посчитал для `<link rel=canonical>`;
 * страница обязана объявлять один и тот же адрес и в голове, и в JSON-LD,
 * поэтому переданное значение всегда в приоритете.
 *
 * #1438: `/^[a-z0-9-]+$/` пропускает литерал `'null'` — он состоит из тех же
 * символов, что и настоящий слаг, и структурированные данные ссылались на
 * `https://metravel.by/travels/null`.
 * #1512: числовая форма адреса сюда не годится — прямой заход на
 * `/travels/<id>` прод отдаёт пустым 404, так что публиковать её краулерам
 * значит повторять тот же дефект другими словами.
 */
function getTravelCanonicalUrl(
  travel: Travel | null | undefined,
  canonicalUrl?: string | null,
): string | null {
  if (canonicalUrl) return canonicalUrl;
  if (!travel) return null;

  const slugPath = buildIndexableTravelPath(travel.slug);
  return slugPath ? `${SITE_URL}${slugPath}` : null;
}

export function stripHtmlForSeo(html?: string | null): string {
  if (!html) return getSeoHtmlFallback();

  const stripped = htmlToPlainText(html);

  return stripped || getSeoHtmlFallback();
}

function getFirstValidGalleryUrl(gallery: any[] | undefined): string | null {
  if (!Array.isArray(gallery) || gallery.length === 0) return null;

  const first = gallery[0];
  const url = typeof first === 'string' ? first : first?.url;

  if (typeof url !== 'string') return null;
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) {
    return url;
  }

  return null;
}

export function buildTravelSeoTitle(base?: string | null): string {
  return buildSeoTitle(base, SEO_TITLE_MAX_LENGTH);
}

export function humanizeTravelRouteKey(value?: string | number | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const normalized = decoded
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/\.(html?|php)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return i18nT('seo:utils.travelSeo.puteshestvie_value1_49e1afe0', { value1: normalized });

  const words = normalized
    .split(' ')
    .filter((word) => word && !TRAVEL_SLUG_STOP_WORDS.has(word.toLowerCase()));
  const text = (words.length ? words : normalized.split(' ')).join(' ').trim();
  if (!text) return null;

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildTravelSeoFallbackTitle(routeKey?: string | number | null): string {
  return buildTravelSeoTitle(
    humanizeTravelRouteKey(routeKey) ?? i18nT('travel:utils.travelSeo.titleFallback'),
  );
}

export function buildTravelSeoFallbackDescription(routeKey?: string | number | null): string {
  const title = humanizeTravelRouteKey(routeKey);
  if (!title) return getTravelFallbackDescription();

  return i18nT('seo:utils.travelSeo.marshrut_value1_na_metravel_opisanie_poezdki_148133d5', { value1: title });
}

export function getTravelSeoDescription(html?: string | null, maxLen = 160): string {
  // Декор чистим только на пути описания: названия и FAQ проходят через
  // stripHtmlForSeo как есть, иначе правило служебной строки могло бы срезать
  // осмысленный заголовок вида «Маршрут Краков - Закопане (107 км) за день».
  const stripped = normalizeSeoLead(stripHtmlForSeo(html));
  if (!stripped) return getTravelFallbackDescription();
  if (stripped.length <= maxLen) return stripped;

  const cut = stripped.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const wordSafe = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${wordSafe.replace(/[\s,.;:!?-]+$/, '').trimEnd()}…`;
}

export function getTravelSeoImage(travel: Travel | null | undefined): string | null {
  if (!travel) return null;

  const imageFromGallery =
    Array.isArray(travel.gallery) && travel.gallery.length > 0
      ? getFirstValidGalleryUrl(travel.gallery)
      : null;
  const imageFallback =
    typeof travel.travel_image_thumb_url === 'string' ? travel.travel_image_thumb_url : null;

  return imageFromGallery || imageFallback;
}

export function createTravelArticleJsonLd(
  travel: Travel | null | undefined,
  canonicalOverride?: string | null
): Record<string, any> | null {
  if (!travel) return null;

  const safeData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
  };

  if (travel.name) {
    const cleanName = stripHtmlForSeo(travel.name).slice(0, 200);
    if (cleanName) safeData.headline = cleanName;
  }

  if (travel.description) {
    const cleanDesc = normalizeSeoLead(stripHtmlForSeo(travel.description)).slice(0, 500);
    if (cleanDesc) safeData.description = cleanDesc;
  }

  // #1221: в JSON-LD уходил «голый» ownership-URL без `?w=`, а такой адрес отдаёт
  // мастер с `no-store` — краулеры и превью тянули по 0.4–1 МБ на каждый обход.
  // Та же нормализация, что у og:image: абсолютный HTTPS + ступень производной.
  const imageUrl = normalizeOgImageUrl(getTravelSeoImage(travel));
  if (imageUrl) safeData.image = [imageUrl];

  const canonicalUrl = getTravelCanonicalUrl(travel, canonicalOverride);
  if (canonicalUrl) safeData.url = canonicalUrl;

  if (travel.created_at) {
    const dateStr =
      typeof travel.created_at === 'number'
        ? new Date(travel.created_at * 1000).toISOString()
        : String(travel.created_at);
    if (dateStr && !isNaN(Date.parse(dateStr))) safeData.datePublished = dateStr;
  }

  if (travel.updated_at) {
    const dateStr =
      typeof travel.updated_at === 'number'
        ? new Date(travel.updated_at * 1000).toISOString()
        : String(travel.updated_at);
    if (dateStr && !isNaN(Date.parse(dateStr))) safeData.dateModified = dateStr;
  }

  const authorName = travel.user?.name || travel.user?.first_name;
  if (authorName) {
    safeData.author = {
      '@type': 'Person',
      name: stripHtmlForSeo(authorName).slice(0, 100),
    };
  }

  safeData.publisher = {
    '@type': 'Organization',
    name: 'MeTravel',
    url: SITE_URL,
  };

  return safeData;
}

export function createTravelBreadcrumbJsonLd(
  travel: Travel | null | undefined,
  canonicalOverride?: string | null
): Record<string, any> | null {
  if (!travel?.name) return null;

  const cleanName = stripHtmlForSeo(travel.name).slice(0, 200);
  const canonicalUrl = getTravelCanonicalUrl(travel, canonicalOverride);
  if (!cleanName || !canonicalUrl) return null;

  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: i18nT('travel:utils.travelSeo.breadcrumb.home'),
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: i18nT('travel:utils.travelSeo.breadcrumb.search'),
        item: `${SITE_URL}/search`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: cleanName,
        item: canonicalUrl,
      },
    ],
  };
}

export function createTravelStructuredData(
  travel: Travel | null | undefined,
  options?: { canonicalUrl?: string | null }
): Record<string, any> | null {
  const canonicalUrl = getTravelCanonicalUrl(travel, options?.canonicalUrl);
  const article = createTravelArticleJsonLd(travel, canonicalUrl);
  if (!article) return null;

  const cleanName = stripHtmlForSeo(travel?.name).slice(0, 200);
  const breadcrumb = createTravelBreadcrumbJsonLd(travel, canonicalUrl);

  // #1622: the site-wide Organization identity is already published once per
  // page by the static HTML shell (`app/+html.tsx`, same `https://metravel.by/#organization`
  // id). Re-declaring a second top-level Organization node here duplicated it
  // after hydration — two `Organization` script payloads for one entity.
  // Nothing in this graph needs the full entity locally (WebPage links to the
  // WebSite id, Article embeds its own lightweight publisher stub), so the
  // per-page graph no longer emits its own copy.
  const graph: Record<string, any>[] = [];

  if (canonicalUrl) {
    graph.push({
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: cleanName || article.headline || buildTravelSeoTitle(travel?.name),
      description: article.description,
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'MeTravel',
      },
      about: {
        '@id': `${canonicalUrl}#article`,
      },
      breadcrumb: breadcrumb
        ? {
            '@id': `${canonicalUrl}#breadcrumb`,
          }
        : undefined,
      inLanguage: i18n.resolvedLanguage || DEFAULT_LOCALE,
    });
  }

  graph.push({
    ...article,
    '@id': canonicalUrl ? `${canonicalUrl}#article` : undefined,
    mainEntityOfPage: canonicalUrl
      ? {
          '@id': `${canonicalUrl}#webpage`,
        }
      : undefined,
  });

  if (breadcrumb && canonicalUrl) {
    graph.push({
      ...breadcrumb,
      '@id': `${canonicalUrl}#breadcrumb`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph.map((item) =>
      Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined))
    ),
  };
}
