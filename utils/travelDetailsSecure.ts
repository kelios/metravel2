/**
 * Security utilities for TravelDetailsContainer
 * Handles sanitization and safe transformations
 *
 * ⚠️ CRITICAL: All external data must pass through these functions
 * before being rendered or used in URLs
 */

import type { Travel } from "@/src/types/types";
import DOMPurify from 'dompurify';

/**
 * Validate YouTube ID format to prevent injection attacks
 * YouTube IDs are exactly 11 alphanumeric characters (including -, _)
 * ⚠️ SECURITY: This prevents malformed IDs that could be used in attacks
 */
export function validateYoutubeId(id: string): boolean {
  // Must be exactly 11 characters
  if (!id || id.length !== 11) {
    return false;
  }

  // Must contain only alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return false;
  }

  // Additional check: no consecutive special characters
  return !/[_-]{2,}/.test(id);
}

/**
 * Safely extract YouTube ID from various URL formats with validation
 * ⚠️ SECURITY: Returns null if ID doesn't match strict YouTube format
 */
export function safeGetYoutubeId(url?: string | null): string | null {
  if (!url) return null;

  // Maximum reasonable length for a YouTube URL
  if (url.length > 2000) {
    return null;
  }

  try {
    // Sanitize the URL first - remove control characters (avoid ESLint no-control-regex)
    const controlCharRegex = /[\x00-\x1f\x7f]/g; // eslint-disable-line no-control-regex
    const sanitizedUrl = url.replace(controlCharRegex, '');

    const patterns = [
      /(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/,
      /youtube\.com\/.*?[?&]v=([^?&#]+)/,
    ];

    for (const pattern of patterns) {
      const match = sanitizedUrl.match(pattern);
      const id = match?.[1] ?? null;

      if (id && validateYoutubeId(id)) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

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

  // Validate and add images (only first valid image)
  if (Array.isArray(travel.gallery) && travel.gallery.length > 0) {
    const imageUrl = getFirstValidGalleryUrl(travel.gallery);
    if (imageUrl) {
      safeData.image = [imageUrl]; // Always array format per schema.org
    }
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


  return safeData;
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

  try {
    // Use dompurify to sanitize and then strip tags
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [], // Strip all tags
      ALLOWED_ATTR: [] // Strip all attributes
    });

    // Clean up whitespace and return
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
  } catch {
    // Fallback: basic regex sanitization if dompurify fails
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || fallback;
  }
}

/**
 * Create safe image URL with versioning without revealing implementation
 * ⚠️ SECURITY: Validates URL format and prevents path traversal attacks
 */
export function createSafeImageUrl(
  baseUrl?: string,
  updatedAt?: string | null,
  id?: any
): string {
  if (!baseUrl) {
    return "";
  }

  // Reject URLs that look like path traversal
  if (baseUrl.includes('..') || baseUrl.includes('//..')) {
    return "";
  }

  try {
    // Ensure HTTPS
    let urlString = baseUrl.replace(/^http:\/\//i, "https://");

    // Create URL object to validate format
    const url = new URL(urlString);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return "";
    }

    // Add version parameter if provided
    const ver = updatedAt
      ? Date.parse(updatedAt)
      : id && Number.isFinite(Number(id))
        ? Number(id)
        : 0;

    if (ver && Number.isFinite(ver) && ver > 0) {
      url.searchParams.append("v", String(ver));
    }

    return url.toString();
  } catch {
    return "";
  }
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
  "https://api.metravel.by",
  "https://cdn.metravel.by",
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
