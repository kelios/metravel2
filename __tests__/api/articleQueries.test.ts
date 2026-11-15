import { QueryClient } from '@tanstack/react-query';
import { articleQueryOptions } from '@/api/articleQueries';
import { fetchArticle, fetchArticleBySlug } from '@/api/articles';

jest.mock('@/api/articles', () => ({
  fetchArticle: jest.fn(),
  fetchArticleBySlug: jest.fn(),
}));

const detail = jest.mocked(fetchArticle);
const slug = jest.mocked(fetchArticleBySlug);
let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it('shares an in-flight detail and its cache between the page and its breadcrumb', async () => {
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  let release!: (article: Awaited<ReturnType<typeof fetchArticle>>) => void;
  detail.mockImplementation(() => {
    started();
    return new Promise((resolve) => { release = resolve; });
  });
  const page = client.fetchQuery(articleQueryOptions('rozygrysh-trekh-termosov-1'));
  const breadcrumb = client.fetchQuery(articleQueryOptions('rozygrysh-trekh-termosov-1'));
  await requestStarted;
  expect(detail).toHaveBeenCalledTimes(1);
  release({ id: 1, name: 'Article' } as Awaited<ReturnType<typeof fetchArticle>>);
  expect(await page).toEqual(await breadcrumb);
  await client.fetchQuery(articleQueryOptions('rozygrysh-trekh-termosov-1'));
  expect(detail).toHaveBeenCalledTimes(1);
});

it('keeps strict failure handling and permits a later retry instead of caching an empty success', async () => {
  detail.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ id: 1 } as Awaited<ReturnType<typeof fetchArticle>>);
  await expect(client.fetchQuery(articleQueryOptions('1'))).rejects.toThrow('503');
  await expect(client.fetchQuery(articleQueryOptions('1'))).resolves.toHaveProperty('id', 1);
  expect(detail).toHaveBeenCalledTimes(2);
});

it('retains the slug fallback and rejects an invalid successful payload', async () => {
  detail.mockRejectedValueOnce(new Error('404'));
  slug.mockResolvedValueOnce({ id: 2 } as Awaited<ReturnType<typeof fetchArticle>>);
  await expect(client.fetchQuery(articleQueryOptions('renamed-1'))).resolves.toHaveProperty('id', 2);
  expect(slug).toHaveBeenCalledWith('renamed-1', expect.objectContaining({ throwOnError: true }));
  detail.mockRejectedValueOnce(new Error('404'));
  await expect(client.fetchQuery(articleQueryOptions('1'))).rejects.toThrow('404');
  detail.mockResolvedValueOnce({} as Awaited<ReturnType<typeof fetchArticle>>);
  await expect(client.fetchQuery(articleQueryOptions('3'))).rejects.toThrow();
});
