import { Article } from '@/src/types/types';
import { devError } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';

const URLAPI: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!URLAPI) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

const GET_ARTICLES = `${URLAPI}/api/articles`;

export const fetchArticles = async (
  page: number,
  itemsPerPage: number,
  urlParams: Record<string, any>,
): Promise<{ data: any[]; total: number }> => {
  try {
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
    const res = await fetchWithTimeout(urlArticles, {}, LONG_TIMEOUT);
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
    return { data: [], total: 0 };
  }
};

export const fetchArticle = async (id: number): Promise<Article> => {
  try {
    const res = await fetchWithTimeout(`${GET_ARTICLES}/${id}`, {}, 10000);
    return await safeJsonParse<Article>(res, {} as Article);
  } catch (e: any) {
    devError('Error fetching Article:', e);
    return {} as Article;
  }
};
