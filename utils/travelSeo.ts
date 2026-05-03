import type { Travel } from '@/types/types';

const SEO_HTML_FALLBACK = 'Найди место для путешествия и поделись своим опытом.';
const TRAVEL_FALLBACK_DESCRIPTION = 'Путешествие на Metravel.';
const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';
const SITE_URL = 'https://metravel.by';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

function getTravelCanonicalUrl(travel: Travel | null | undefined): string | null {
  if (!travel) return null;

  if (travel.slug && /^[a-z0-9-]+$/.test(travel.slug)) {
    return `${SITE_URL}/travels/${encodeURIComponent(travel.slug)}`;
  }

  if (typeof travel.id === 'number' || typeof travel.id === 'string') {
    const id = String(travel.id).trim();
    if (id) return `${SITE_URL}/travels/${encodeURIComponent(id)}`;
  }

  return null;
}

export function stripHtmlForSeo(html?: string | null): string {
  if (!html) return SEO_HTML_FALLBACK;

  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return stripped || SEO_HTML_FALLBACK;
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
  const normalized = String(base || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Metravel';

  const maxBaseLength = Math.max(10, SEO_TITLE_MAX_LENGTH - SEO_TITLE_SUFFIX.length);
  let clippedBase = normalized;
  if (normalized.length > maxBaseLength) {
    const sliceLen = Math.max(1, maxBaseLength - 1); // -1 for the ellipsis char "…"
    const cut = normalized.slice(0, sliceLen);
    const lastSpace = cut.lastIndexOf(' ');
    const wordSafe = lastSpace > sliceLen * 0.6 ? cut.slice(0, lastSpace) : cut;
    clippedBase = `${wordSafe.trimEnd()}…`;
  }

  return `${clippedBase}${SEO_TITLE_SUFFIX}`;
}

export function getTravelSeoDescription(html?: string | null, maxLen = 160): string {
  const stripped = stripHtmlForSeo(html);
  if (!stripped) return TRAVEL_FALLBACK_DESCRIPTION;
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
  travel: Travel | null | undefined
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
    const cleanDesc = stripHtmlForSeo(travel.description).slice(0, 500);
    if (cleanDesc) safeData.description = cleanDesc;
  }

  const imageUrl = getTravelSeoImage(travel);
  if (imageUrl) safeData.image = [imageUrl];

  const canonicalUrl = getTravelCanonicalUrl(travel);
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
  travel: Travel | null | undefined
): Record<string, any> | null {
  if (!travel?.name) return null;

  const cleanName = stripHtmlForSeo(travel.name).slice(0, 200);
  const canonicalUrl = getTravelCanonicalUrl(travel);
  if (!cleanName || !canonicalUrl) return null;

  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Поиск',
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
  travel: Travel | null | undefined
): Record<string, any> | null {
  const article = createTravelArticleJsonLd(travel);
  if (!article) return null;

  const canonicalUrl = getTravelCanonicalUrl(travel);
  const cleanName = stripHtmlForSeo(travel?.name).slice(0, 200);
  const breadcrumb = createTravelBreadcrumbJsonLd(travel);

  const graph: Record<string, any>[] = [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'MeTravel',
      url: SITE_URL,
    },
  ];

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
      inLanguage: 'ru',
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
