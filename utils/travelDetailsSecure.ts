/**
 * Security utilities for TravelDetailsContainer
 * Handles sanitization and safe transformations
 */

import type { Travel } from "@/src/types/types";

/**
 * Validate YouTube ID format to prevent injection attacks
 * YouTube IDs are 11 alphanumeric characters (-, _)
 */
export function validateYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Safely extract YouTube ID from various URL formats with validation
 */
export function safeGetYoutubeId(url?: string | null): string | null {
  if (!url) return null;

  try {
    const patterns = [
      /(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/,
      /youtube\.com\/.*?[?&]v=([^?&#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
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

  // Validate and add title
  if (travel.name && travel.name.length > 0) {
    safeData.headline = travel.name.slice(0, 200); // Max length
  }

  // Validate and add description
  if (travel.description && travel.description.length > 0) {
    const plainText = stripHtml(travel.description);
    safeData.description = plainText.slice(0, 500); // Max length
  }

  // Validate and add images
  if (Array.isArray(travel.gallery) && travel.gallery.length > 0) {
    const imageUrl = getFirstValidGalleryUrl(travel.gallery);
    if (imageUrl) {
      safeData.image = [imageUrl]; // Always array format
    }
  }

  // Validate and add URL
  if (travel.slug) {
    try {
      const url = new URL(`https://metravel.by/travels/${encodeURIComponent(travel.slug)}`);
      safeData.url = url.toString();
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
 * Strip HTML tags from content (basic sanitization)
 * For full sanitization, use dompurify package
 */
export function stripHtml(html?: string | null): string {
  if (!html) {
    return "";
  }

  return (
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Найди место для путешествия и поделись своим опытом."
  );
}

/**
 * Create safe image URL with versioning and without revealing implementation
 */
export function createSafeImageUrl(
  baseUrl?: string,
  updatedAt?: string | null,
  id?: any
): string {
  if (!baseUrl) {
    return "";
  }

  try {
    const url = new URL(baseUrl.replace(/^http:\/\//i, "https://"));
    const ver = updatedAt ? Date.parse(updatedAt) : id ? Number(id) : 0;

    if (ver && Number.isFinite(ver)) {
      url.searchParams.append("v", String(ver));
    }

    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Get safe origin from URL for preconnect
 */
export function getSafeOrigin(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url.replace(/^http:\/\//i, "https://"));
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Common domains that are safe to preconnect
 */
export const SAFE_PRECONNECT_DOMAINS = [
  "https://maps.googleapis.com",
  "https://img.youtube.com",
  "https://api.metravel.by",
];

/**
 * Validate preconnect domain is in whitelist
 */
export function isSafePreconnectDomain(domain: string | null): boolean {
  if (!domain) return false;
  return SAFE_PRECONNECT_DOMAINS.includes(domain);
}

