import { Article } from '@/types/types';
import { devError } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isWebLocalHost =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.location?.hostname === 'string' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const webOriginApi =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : '';

const rawApiUrl: string =
  (Platform.OS === 'web' && isWebLocalHost && webOriginApi
    ? webOriginApi
    : (Platform.OS === 'web' && isLocalApi && webOriginApi
        ? webOriginApi
        : process.env.EXPO_PUBLIC_API_URL)) ||
  (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
  const trimmed = rawApiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

const GET_ARTICLES = `${URLAPI}/articles`;

const ARTICLE_STOPWORDS = new Set([
  'a',
  'i',
  'k',
  'na',
  'o',
  'po',
  's',
  'v',
  'iz',
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeParamValue = (value: string): string => {
  const trimmed = String(value || '').trim().split('#')[0].split('?')[0];
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

export const extractArticleIdFromParam = (value: string | null | undefined): number | null => {
  const normalized = normalizeParamValue(String(value || ''));
  if (!normalized) return null;

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const startMatch = normalized.match(/^(\d+)(?:-|$)/);
  if (startMatch?.[1]) {
    const parsed = Number(startMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const endMatch = normalized.match(/(?:^|[-_])(\d+)$/);
  if (endMatch?.[1]) {
    const parsed = Number(endMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const slugTokenize = (value: string): string[] =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

const simplifySlugToken = (token: string): string =>
  token
    .replace(/kh/g, 'h')
    .replace(/ii/g, 'i')
    .replace(/yi/g, 'i');

const extractSlugFromArticleUrl = (urlValue: string): string => {
  if (!urlValue) return '';
  try {
    const parsed = new URL(urlValue, 'https://metravel.by');
    const parts = parsed.pathname.split('/').filter(Boolean);
    const articleIndex = parts.findIndex((p) => p === 'article');
    if (articleIndex >= 0 && parts[articleIndex + 1]) {
      return normalizeParamValue(parts[articleIndex + 1]);
    }
    return '';
  } catch {
    const cleaned = String(urlValue).split('?')[0].split('#')[0];
    const parts = cleaned.split('/').filter(Boolean);
    const articleIndex = parts.findIndex((p) => p === 'article');
    if (articleIndex >= 0 && parts[articleIndex + 1]) {
      return normalizeParamValue(parts[articleIndex + 1]);
    }
    return '';
  }
};

const extractArticleSlugCandidate = (article: Article): string => {
  const directSlug = normalizeParamValue(String((article as any)?.slug || ''));
  if (directSlug) return directSlug;

  const directUrl = String((article as any)?.url || '');
  const fromUrl = extractSlugFromArticleUrl(directUrl);
  if (fromUrl) return fromUrl;

  return '';
};

const scoreArticleSlugSimilarity = (requestedSlug: string, article: Article): number => {
  const requestedTokens = slugTokenize(requestedSlug)
    .map(simplifySlugToken)
    .filter((token) => !/^\d+$/.test(token));
  if (!requestedTokens.length) return 0;

  const candidateSlug = extractArticleSlugCandidate(article);
  const candidateTokens = slugTokenize(candidateSlug)
    .map(simplifySlugToken)
    .filter((token) => !/^\d+$/.test(token));
  if (!candidateTokens.length) return 0;

  const candidateSet = new Set(candidateTokens);
  const overlap = requestedTokens.reduce((acc, token) => (candidateSet.has(token) ? acc + 1 : acc), 0);
  const overlapRatio = overlap / requestedTokens.length;
  const firstTokenBonus = requestedTokens[0] === candidateTokens[0] ? 0.2 : 0;
  const tailToken = requestedTokens[requestedTokens.length - 1];
  const tailBonus = candidateSet.has(tailToken) ? 0.1 : 0;

  return overlapRatio + firstTokenBonus + tailBonus;
};

const buildArticleFallbackQueries = (slug: string): string[] => {
  const tokens = slugTokenize(slug).filter((token) => !/^\d+$/.test(token));
  if (tokens.length === 0) return [];

  const full = tokens.join(' ');
  const firstThree = tokens.slice(0, 3).join(' ');
  const firstTwo = tokens.slice(0, 2).join(' ');
  const firstToken = tokens[0];
  const simplified = tokens.map(simplifySlugToken).join(' ');
  const meaningful = tokens.filter((t) => t.length >= 4 && !ARTICLE_STOPWORDS.has(t));

  return Array.from(
    new Set([full, firstThree, firstTwo, simplified, ...meaningful.slice(0, 3), firstToken].map((q) => q.trim()).filter(Boolean))
  );
};

const fetchArticleFallbackCandidates = async (
  query: string,
  page: number,
  options?: { signal?: AbortSignal }
): Promise<Article[]> => {
  const params = new URLSearchParams({
    page: String(page),
    perPage: '50',
    where: JSON.stringify({ publish: 1, moderation: 1 }),
  });
  if (query) {
    params.set('query', query);
  }

  const res = await fetchWithTimeout(`${GET_ARTICLES}?${params.toString()}`, { signal: options?.signal }, LONG_TIMEOUT);
  if (!res.ok) return [];

  const payload = await safeJsonParse<unknown>(res, []);
  if (Array.isArray(payload)) return payload as Article[];

  const source = asRecord(payload);
  if (Array.isArray(source.data)) return source.data as Article[];
  if (Array.isArray(source.results)) return source.results as Article[];
  if (Array.isArray(source.items)) return source.items as Article[];
  return [];
};

const findArticleBySlugFallback = async (
  slug: string,
  options?: { signal?: AbortSignal }
): Promise<Article | null> => {
  const queries = buildArticleFallbackQueries(slug);
  if (queries.length === 0) return null;

  let bestMatch: Article | null = null;
  let bestScore = 0;

  for (const query of queries) {
    const queryWordCount = query.split(/\s+/).filter(Boolean).length;
    const maxPages = queryWordCount <= 1 ? 4 : 2;

    for (let page = 1; page <= maxPages; page += 1) {
      const candidates = await fetchArticleFallbackCandidates(query, page, options);
      if (!candidates.length) break;

      for (const candidate of candidates) {
        const score = scoreArticleSlugSimilarity(slug, candidate);
        if (score < 0.72) continue;
        if (!bestMatch || score > bestScore) {
          bestMatch = candidate;
          bestScore = score;
        }
      }

      if (bestMatch && bestScore >= 1.1) {
        return bestMatch;
      }
    }
  }

  return bestMatch;
};

export const fetchArticles = async (
  page: number,
  itemsPerPage: number,
  urlParams: Record<string, any>,
  options?: { signal?: AbortSignal; throwOnError?: boolean },
): Promise<{ data: any[]; total: number }> => {
  try {
    const signal = options?.signal;
    const whereObject: Record<string, any> = {
      ...urlParams,
    };

    if (urlParams?.moderation === undefined && urlParams?.publish === undefined) {
      whereObject.publish = 1;
      whereObject.moderation = 1;
    }
    if (urlParams?.publish !== undefined) {
      whereObject.publish = urlParams.publish;
    }
    if (urlParams?.moderation !== undefined) {
      whereObject.moderation = urlParams.moderation;
    }

    const params = new URLSearchParams({
      page: (page + 1).toString(),
      perPage: itemsPerPage.toString(),
      where: JSON.stringify(whereObject),
    }).toString();

    const urlArticles = `${GET_ARTICLES}?${params}`;
    const res = await fetchWithTimeout(urlArticles, { signal }, LONG_TIMEOUT);
    if (!res.ok) {
      if (res.status === 404) {
        return { data: [], total: 0 };
      }
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return { data: [], total: 0 };
    }
    const result = await safeJsonParse<any>(res, []);

    if (Array.isArray(result)) {
      return { data: result, total: result.length };
    }

    if (result && typeof result === 'object') {
      const data = Array.isArray(result.data) ? result.data : [];
      const total = typeof result.total === 'number' ? result.total : data.length;
      return { data, total };
    }

    return { data: [], total: 0 };
  } catch (e: any) {
    devError('Error fetching Articles:', e);
    if (e?.name === 'AbortError') {
      if (options?.throwOnError) throw e;
      return { data: [], total: 0 };
    }
    if (options?.throwOnError) {
      throw new Error('Не удалось загрузить статьи');
    }
    return { data: [], total: 0 };
  }
};

export const fetchArticle = async (
  id: number,
  options?: { signal?: AbortSignal; throwOnError?: boolean }
): Promise<Article> => {
  try {
    const res = await fetchWithTimeout(`${GET_ARTICLES}/${id}`, { signal: options?.signal }, 10000);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return {} as Article;
    }
    return await safeJsonParse<Article>(res, {} as Article);
  } catch (e: any) {
    devError('Error fetching Article:', e);
    if (e?.name === 'AbortError') {
      if (options?.throwOnError) throw e;
      return {} as Article;
    }
    if (options?.throwOnError) {
      throw new Error('Не удалось загрузить статью');
    }
    return {} as Article;
  }
};

export const fetchArticleBySlug = async (
  slug: string,
  options?: { signal?: AbortSignal; throwOnError?: boolean }
): Promise<Article> => {
  const normalizedSlug = normalizeParamValue(String(slug || '')).replace(/^\/+|\/+$/g, '');
  if (!normalizedSlug) {
    throw new Error('Пустой slug статьи');
  }

  try {
    const safeSlug = encodeURIComponent(normalizedSlug);
    const directRes = await fetchWithTimeout(
      `${GET_ARTICLES}/by-slug/${safeSlug}/`,
      { signal: options?.signal },
      10000
    );

    if (directRes.ok) {
      return await safeJsonParse<Article>(directRes, {} as Article);
    }

    if (directRes.status !== 404) {
      throw new Error(`HTTP ${directRes.status}: ${directRes.statusText}`);
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
  }

  try {
    const fallbackArticle = await findArticleBySlugFallback(normalizedSlug, options);
    if (fallbackArticle && fallbackArticle.id) {
      return fallbackArticle;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
  }

  const notFoundError = new Error(`Статья со slug "${normalizedSlug}" не найдена`);
  if (options?.throwOnError) {
    throw notFoundError;
  }
  return {} as Article;
};
