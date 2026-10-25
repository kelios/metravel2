/* global module */

// #2740: проектная форма SEO → `Metadata` expo-server для `generateMetadata`.
//
// Набор тегов 1:1 с тем, что рендерит `components/seo/LazyInstantSEO.tsx` на
// клиенте и пишет `injectMeta` генератора: title, description, robots,
// canonical, og:type/title/description/url/image(+secure_url, width, height,
// alt)/site_name/locale, twitter:card/title/description/image(+alt).
// JSON-LD, `<html lang>`, preload и apple-itunes-app в `Metadata` 58 не
// выражаются и остаются за `app/+html.tsx` и генератором.
//
// Plain CommonJS без импортов из приложения (см. staticRoutes.js).

const SITE_NAME = 'MeTravel';

function text(value) {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

/**
 * @param {object} seo
 * @param {string} seo.title
 * @param {string} [seo.description]
 * @param {string} [seo.canonical] абсолютный URL
 * @param {string} [seo.image] абсолютный URL
 * @param {string} [seo.imageAlt]
 * @param {number} [seo.imageWidth]
 * @param {number} [seo.imageHeight]
 * @param {'website'|'article'} [seo.ogType]
 * @param {string} [seo.robots]
 * @param {string} [seo.ogLocale] например `ru_RU`
 * @param {Record<string,string>} [seo.alternates] hreflang → абсолютный URL
 */
function buildRouteMetadata(seo) {
  const title = text(seo && seo.title);
  if (!title) {
    throw new Error('buildRouteMetadata: title is required');
  }
  const description = text(seo.description);
  const canonical = text(seo.canonical);
  const image = text(seo.image);
  const imageAlt = text(seo.imageAlt);
  const ogType = text(seo.ogType) || 'website';
  const robots = text(seo.robots);
  const ogLocale = text(seo.ogLocale);
  const alternates = seo.alternates && Object.keys(seo.alternates).length > 0 ? { ...seo.alternates } : undefined;

  const metadata = { title };
  if (description) metadata.description = description;
  if (robots) metadata.robots = robots;
  if (canonical || alternates) {
    metadata.alternates = {};
    if (canonical) metadata.alternates.canonical = canonical;
    if (alternates) metadata.alternates.languages = alternates;
  }

  const openGraph = { type: ogType, title, siteName: SITE_NAME };
  if (description) openGraph.description = description;
  if (canonical) openGraph.url = canonical;
  if (image) {
    const ogImage = { url: image, secureUrl: image };
    if (Number.isFinite(seo.imageWidth) && seo.imageWidth > 0) ogImage.width = seo.imageWidth;
    if (Number.isFinite(seo.imageHeight) && seo.imageHeight > 0) ogImage.height = seo.imageHeight;
    if (imageAlt) ogImage.alt = imageAlt;
    openGraph.images = [ogImage];
  }
  if (ogLocale) openGraph.locale = ogLocale;
  metadata.openGraph = openGraph;

  const twitter = { card: image ? 'summary_large_image' : 'summary', title };
  if (description) twitter.description = description;
  if (image) twitter.images = [imageAlt ? { url: image, alt: imageAlt } : image];
  metadata.twitter = twitter;

  return metadata;
}

module.exports = { SITE_NAME, buildRouteMetadata };
