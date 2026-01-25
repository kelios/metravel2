/**
 * SEO utilities for canonical URLs and site base URL normalization
 */

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
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${normalized}`;
}

/**
 * Builds Open Graph image URL.
 * 
 * @param imagePath - Relative image path (e.g., "/og-preview.jpg")
 * @example
 * buildOgImageUrl("/og-preview.jpg") // => "https://metravel.by/og-preview.jpg"
 */
export function buildOgImageUrl(imagePath: string): string {
  const base = getSiteBaseUrl();
  const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${base}${normalized}`;
}
