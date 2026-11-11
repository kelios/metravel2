/**
 * Security utilities for TravelDetailsContainer
 * Handles sanitization and safe transformations
 *
 * ⚠️ CRITICAL: All external data must pass through these functions
 * before being rendered or used in URLs
 */

import type { Travel } from "@/types/types";
import { translate as i18nT } from '@/i18n'

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
      name: i18nT('seoStatic:structuredData.home'),
      item: "https://metravel.by/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: i18nT('seoStatic:structuredData.search'),
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
 * Strip HTML tags from content using dompurify + regex fallback
 * ⚠️ SECURITY: This prevents XSS attacks via HTML encoding
 */
export function stripHtml(html?: string | null): string {
  const fallback = i18nT('shared:utils.travelDetailsSecure.naydi_mesto_dlya_puteshestviya_i_podelis_svo_0f229be4');
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
