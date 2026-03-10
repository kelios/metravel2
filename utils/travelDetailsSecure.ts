/**
 * Security utilities for TravelDetailsContainer
 * Handles sanitization and safe transformations
 *
 * ⚠️ CRITICAL: All external data must pass through these functions
 * before being rendered or used in URLs
 */

import type { Travel } from "@/types/types";
export {
  createSafeImageUrl,
  safeGetYoutubeId,
  validateYoutubeId,
} from '@/utils/travelMedia';

// DOMPurify is ~60KB — lazy-loaded to keep it out of the critical JS bundle.
// stripHtml uses a fast regex path first; DOMPurify is only loaded on demand.
let _DOMPurify: typeof import('dompurify').default | null = null;
const getDOMPurify = (): typeof import('dompurify').default | null => {
  if (_DOMPurify) return _DOMPurify;
  try {
    // Synchronous require works in Metro/webpack bundles (already bundled, no network fetch).
    _DOMPurify = require('dompurify') as typeof import('dompurify').default;
    // Handle default export wrapper
    if (_DOMPurify && typeof (_DOMPurify as any).default?.sanitize === 'function') {
      _DOMPurify = (_DOMPurify as any).default;
    }
    return _DOMPurify;
  } catch {
    return null;
  }
};

/**
 * Create safe JSON-LD structured data without injection vulnerabilities
 * ⚠️ SECURITY: Uses explicit whitelist, never spreads unknown properties
 */
export function createSafeJsonLd(
  travel: Travel | null | undefined
): Record<string, any> | null {
  if (!travel) return null;

  // Only include properties we explicitly define
  // Never use object spreading to avoid including unexpected properties
  const safeData: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
  };

  // Validate and add title (max 200 chars)
  if (travel.name && travel.name.length > 0) {
    const cleanName = stripHtml(travel.name).slice(0, 200);
    if (cleanName) {
      safeData.headline = cleanName;
    }
  }

  // Validate and add description (max 500 chars)
  if (travel.description && travel.description.length > 0) {
    const cleanDesc = stripHtml(travel.description).slice(0, 500);
    if (cleanDesc) {
      safeData.description = cleanDesc;
    }
  }

  // Validate and add images (prefer gallery; fallback to travel thumbnail URL)
  const imageFromGallery =
    Array.isArray(travel.gallery) && travel.gallery.length > 0
      ? getFirstValidGalleryUrl(travel.gallery)
      : null;
  const imageFallback =
    typeof travel.travel_image_thumb_url === 'string' && isValidImageUrl(travel.travel_image_thumb_url)
      ? travel.travel_image_thumb_url
      : null;
  const imageUrl = imageFromGallery || imageFallback;
  if (imageUrl) {
    safeData.image = [imageUrl]; // Always array format per schema.org
  }

  // Validate and add URL (slugified)
  if (travel.slug && travel.slug.length > 0) {
    try {
      // Validate slug format (alphanumeric + hyphens only)
      if (/^[a-z0-9-]+$/.test(travel.slug)) {
        const url = new URL(`https://metravel.by/travels/${encodeURIComponent(travel.slug)}`);
        safeData.url = url.toString();
      }
    } catch {
      // Skip if URL is malformed
    }
  }

  // Add datePublished / dateModified (required for Google Article rich results)
  if (travel.created_at) {
    const dateStr = typeof travel.created_at === 'number'
      ? new Date(travel.created_at * 1000).toISOString()
      : String(travel.created_at);
    if (dateStr && !isNaN(Date.parse(dateStr))) {
      safeData.datePublished = dateStr;
    }
  }
  if (travel.updated_at) {
    const dateStr = typeof travel.updated_at === 'number'
      ? new Date(travel.updated_at * 1000).toISOString()
      : String(travel.updated_at);
    if (dateStr && !isNaN(Date.parse(dateStr))) {
      safeData.dateModified = dateStr;
    }
  }

  // Add author (recommended for Article rich results)
  const authorName = travel.user?.name || travel.user?.first_name;
  if (authorName && authorName.length > 0) {
    safeData.author = {
      "@type": "Person",
      name: stripHtml(authorName).slice(0, 100),
    };
  }

  // Publisher (required for Article rich results)
  safeData.publisher = {
    "@type": "Organization",
    name: "MeTravel",
    url: "https://metravel.by",
  };

  return safeData;
}

/**
 * Create BreadcrumbList structured data for travel detail pages.
 * Produces: Home > Поиск > [Travel Name]
 */
export function createBreadcrumbJsonLd(
  travel: Travel | null | undefined
): Record<string, any> | null {
  if (!travel?.name) return null;

  const cleanName = stripHtml(travel.name).slice(0, 200);
  if (!cleanName) return null;

  const travelUrl =
    travel.slug && /^[a-z0-9-]+$/.test(travel.slug)
      ? `https://metravel.by/travels/${encodeURIComponent(travel.slug)}`
      : travel.id
        ? `https://metravel.by/travels/${travel.id}`
        : undefined;

  const items: Record<string, any>[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: "https://metravel.by/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Поиск",
      item: "https://metravel.by/search",
    },
  ];

  const lastItem: Record<string, any> = {
    "@type": "ListItem",
    position: 3,
    name: cleanName,
  };
  if (travelUrl) lastItem.item = travelUrl;
  items.push(lastItem);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/**
 * Safely get first gallery image URL
 */
function getFirstValidGalleryUrl(
  gallery: any[] | undefined
): string | null {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return null;
  }

  const first = gallery[0];
  const url = typeof first === "string" ? first : first?.url;

  if (typeof url === "string" && isValidImageUrl(url)) {
    return url;
  }

  return null;
}

/**
 * Validate image URL is safe to use
 */
function isValidImageUrl(url: string): boolean {
  try {
    new URL(url);
    // Only allow relative paths or https/http URLs
    return url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://");
  } catch {
    return false;
  }
}

/**
 * Strip HTML tags from content using dompurify + regex fallback
 * ⚠️ SECURITY: This prevents XSS attacks via HTML encoding
 */
export function stripHtml(html?: string | null): string {
  const fallback = "Найди место для путешествия и поделись своим опытом.";
  if (!html) {
    return fallback;
  }

  // Fast regex path — works for the vast majority of cases (SEO descriptions, titles).
  // DOMPurify is only needed for untrusted rich HTML; for stripping tags regex is sufficient.
  const regexStripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (regexStripped) return regexStripped;

  // If regex produced empty result, try DOMPurify as a more robust fallback
  try {
    const purify = getDOMPurify();
    if (purify) {
      const sanitized = purify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
      const cleaned = sanitized
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      return cleaned || fallback;
    }
  } catch {
    // noop
  }

  return fallback;
}

/**
 * Get safe origin from URL for preconnect
 * ⚠️ SECURITY: Validates origin before returning
 */
export function getSafeOrigin(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    let urlString = url.replace(/^http:\/\//i, "https://");

    // Reject if looks like path traversal
    if (urlString.includes('..')) {
      return null;
    }

    const parsed = new URL(urlString);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Common domains that are safe to preconnect
 * ⚠️ CRITICAL: Only add trusted domains here. Whitelisting is security control.
 */
export const SAFE_PRECONNECT_DOMAINS = [
  "https://maps.googleapis.com",
  "https://img.youtube.com",
  "https://www.youtube.com",
  "https://youtu.be",
  "https://metravel.by",
  "https://www.metravel.by",
  "https://api.metravel.by",
  "https://cdn.metravel.by",
  "https://images.weserv.nl",
] as const;

/**
 * Validate preconnect domain is in whitelist
 * ⚠️ SECURITY: Only allows explicitly whitelisted domains
 */
export function isSafePreconnectDomain(domain: string | null): boolean {
  if (!domain) return false;
  return SAFE_PRECONNECT_DOMAINS.some(safe => safe === domain);
}

/**
 * Validate that a domain extracted from user content is safe
 * Used before adding preconnect/prefetch links
 * @deprecated - kept for future use, currently unused
 */
export function isWhitelistedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Check against whitelist
  return SAFE_PRECONNECT_DOMAINS.some(domain => domain.startsWith(origin));
}
