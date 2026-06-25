import type { Href } from 'expo-router';

const ARTICLE_DETAIL_PREFIX = /^\/article(?:\/|$)/;
const ARTICLES_PATH = '/articles';
type ArticleHref = Extract<Href, string>;

const normalizeInternalHref = (value: unknown): ArticleHref | null => {
  const raw = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
  if (!raw.trim()) return null;

  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw value; the checks below still reject external URLs.
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  return (decoded.split('#')[0] || '/') as ArticleHref;
};

export const normalizeArticleReturnHref = (value: unknown): ArticleHref | null => {
  const href = normalizeInternalHref(value);
  if (!href) return null;
  if (ARTICLE_DETAIL_PREFIX.test(href)) return null;
  return href;
};

export const normalizeArticleListSourceHref = (value: unknown): ArticleHref | null => {
  const href = normalizeInternalHref(value);
  if (!href) return null;
  if (href === ARTICLES_PATH || href.startsWith(`${ARTICLES_PATH}?`)) return null;
  if (ARTICLE_DETAIL_PREFIX.test(href)) return null;
  return href;
};

export const buildArticlesHrefFromSource = (source: unknown): ArticleHref => {
  const sourceHref = normalizeArticleListSourceHref(source);
  if (!sourceHref) return ARTICLES_PATH;
  return `${ARTICLES_PATH}?from=${encodeURIComponent(sourceHref)}` as ArticleHref;
};
