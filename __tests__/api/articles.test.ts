jest.mock('@/utils/logger', () => ({ devError: jest.fn() }));
jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));
jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

const { fetchWithTimeout } = require('@/utils/fetchWithTimeout') as {
  fetchWithTimeout: jest.Mock;
};
const { safeJsonParse } = require('@/utils/safeJsonParse') as {
  safeJsonParse: jest.Mock;
};

import { fetchArticles, fetchArticle, fetchArticleBySlug, extractArticleIdFromParam } from '@/api/articles';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchArticles', () => {
  it('returns parsed data on success (object response)', async () => {
    const mockRes = { ok: true, status: 200 };
    fetchWithTimeout.mockResolvedValue(mockRes);
    safeJsonParse.mockResolvedValue({ data: [{ id: 1, title: 'A' }], total: 1 });

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [{ id: 1, title: 'A' }], total: 1 });
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles?'),
      expect.any(Object),
      30000,
    );
  });

  it('returns parsed data on success (array response)', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 });
  });

  it('returns empty for 404', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('returns empty for non-404 error without throwOnError', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('throws for non-404 error with throwOnError', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

    await expect(
      fetchArticles(0, 10, {}, { throwOnError: true }),
    ).rejects.toThrow();
  });

  it('defaults publish=1 and moderation=1 when not specified', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValue([]);

    await fetchArticles(0, 10, {});

    const url = fetchWithTimeout.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    const where = JSON.parse(params.get('where')!);
    expect(where.publish).toBe(1);
    expect(where.moderation).toBe(1);
  });

  it('uses provided publish/moderation values', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValue([]);

    await fetchArticles(0, 10, { publish: 0, moderation: 0 });

    const url = fetchWithTimeout.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    const where = JSON.parse(params.get('where')!);
    expect(where.publish).toBe(0);
    expect(where.moderation).toBe(0);
  });

  it('sends correct page (1-indexed)', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValue([]);

    await fetchArticles(2, 20, {});

    const url = fetchWithTimeout.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('page')).toBe('3');
    expect(params.get('perPage')).toBe('20');
  });

  it('returns empty on network error without throwOnError', async () => {
    fetchWithTimeout.mockRejectedValue(new Error('network'));

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('throws user-friendly error on network error with throwOnError', async () => {
    fetchWithTimeout.mockRejectedValue(new Error('network'));

    await expect(
      fetchArticles(0, 10, {}, { throwOnError: true }),
    ).rejects.toThrow('Не удалось загрузить статьи');
  });

  it('returns empty on AbortError without throwOnError', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    fetchWithTimeout.mockRejectedValue(abortErr);

    const result = await fetchArticles(0, 10, {});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('rethrows AbortError with throwOnError', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    fetchWithTimeout.mockRejectedValue(abortErr);

    await expect(
      fetchArticles(0, 10, {}, { throwOnError: true }),
    ).rejects.toThrow();
  });
});

describe('fetchArticle', () => {
  it('returns parsed article on success', async () => {
    const article = { id: 5, title: 'Test Article' };
    fetchWithTimeout.mockResolvedValue({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValue(article);

    const result = await fetchArticle(5);
    expect(result).toEqual(article);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/5'),
      expect.any(Object),
      10000,
    );
  });

  it('returns empty object for HTTP error without throwOnError', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchArticle(999);
    expect(result).toEqual({});
  });

  it('throws for HTTP error with throwOnError', async () => {
    fetchWithTimeout.mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

    await expect(fetchArticle(1, { throwOnError: true })).rejects.toThrow();
  });

  it('returns empty object on network error without throwOnError', async () => {
    fetchWithTimeout.mockRejectedValue(new Error('fail'));

    const result = await fetchArticle(1);
    expect(result).toEqual({});
  });

  it('throws user-friendly error on network error with throwOnError', async () => {
    fetchWithTimeout.mockRejectedValue(new Error('fail'));

    await expect(fetchArticle(1, { throwOnError: true })).rejects.toThrow(
      'Не удалось загрузить статью',
    );
  });
});

describe('extractArticleIdFromParam', () => {
  it('extracts id from numeric param and slug variations', () => {
    expect(extractArticleIdFromParam('42')).toBe(42);
    expect(extractArticleIdFromParam('42-test-article')).toBe(42);
    expect(extractArticleIdFromParam('test-article-42')).toBe(42);
  });

  it('returns null for non-numeric slug without id', () => {
    expect(extractArticleIdFromParam('test-article')).toBeNull();
    expect(extractArticleIdFromParam('')).toBeNull();
  });
});

describe('fetchArticleBySlug', () => {
  it('returns article from direct by-slug endpoint', async () => {
    const article = { id: 7, slug: 'test-article' };
    fetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValueOnce(article);

    const result = await fetchArticleBySlug('test-article', { throwOnError: true });

    expect(result).toEqual(article);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/by-slug/test-article/'),
      expect.any(Object),
      10000,
    );
  });

  it('uses fallback search when by-slug endpoint returns 404', async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    safeJsonParse.mockResolvedValueOnce({
      data: [
        {
          id: 11,
          slug: 'old-test-article',
          url: '/article/old-test-article',
          name: 'Old Test Article',
        },
      ],
      total: 1,
    });

    const result = await fetchArticleBySlug('old-test-article', { throwOnError: true });

    expect(result.id).toBe(11);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    const fallbackUrl = fetchWithTimeout.mock.calls[1][0] as string;
    const fallbackParams = new URL(fallbackUrl).searchParams;
    expect(fallbackParams.get('query')).toContain('old');
  });
});
