import type { Travel } from '@/types/types';

const SEO_HTML_FALLBACK = 'Найди место для путешествия и поделись своим опытом.';

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

  const imageFromGallery =
    Array.isArray(travel.gallery) && travel.gallery.length > 0
      ? getFirstValidGalleryUrl(travel.gallery)
      : null;
  const imageFallback =
    typeof travel.travel_image_thumb_url === 'string' ? travel.travel_image_thumb_url : null;
  const imageUrl = imageFromGallery || imageFallback;
  if (imageUrl) safeData.image = [imageUrl];

  if (travel.slug && /^[a-z0-9-]+$/.test(travel.slug)) {
    safeData.url = `https://metravel.by/travels/${encodeURIComponent(travel.slug)}`;
  }

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
    url: 'https://metravel.by',
  };

  return safeData;
}
