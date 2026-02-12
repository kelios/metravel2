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
