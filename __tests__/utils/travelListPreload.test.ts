/**
 * #1372: прогрев первой страницы каталога `/search` до гидратации.
 *
 * Главный инвариант здесь — идентичность URL. Прогрев обязан просить ровно тот
 * же адрес, что построит `fetchTravels`, иначе это второй запрос, а не прогрев.
 * Поэтому URL сравнивается не с константой-двойником, а с тем, что реально ушло
 * в `fetchWithTimeout`.
 */
import { Platform } from 'react-native';

import { PER_PAGE } from '@/components/listTravel/utils/listTravelConstants';
import { TEST_API_BASE_URL } from '@/utils/resolveApiBaseUrl';
import {
  buildTravelListPreloadQuery,
  buildTravelListPreloadUrl,
  takeTravelListPreload,
  TRAVEL_LIST_PRELOAD_GLOBAL,
} from '@/utils/travelListPreload';

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(async () => ({ ok: true })),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(async () => ({ data: [], total: 0 })),
}));

jest.mock('@/utils/publicStaleCache', () => ({
  isRecoverablePublicStaleError: jest.fn(() => false),
  readPublicStalePayload: jest.fn(async () => null),
  savePublicStalePayload: jest.fn(async () => undefined),
  getPublicStalePayloadMeta: jest.fn(() => null),
}));

const { fetchWithTimeout } = require('@/utils/fetchWithTimeout') as {
  fetchWithTimeout: jest.Mock;
};

const { fetchTravels } = require('@/api/travelListQueries') as {
  fetchTravels: (
    page: number,
    perPage: number,
    search: string,
    params: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<{ data: unknown[]; total: number }>;
};

/** Ровно те queryParams, которые `/search` собирает без фильтров и поиска. */
const SEARCH_DEFAULT_PARAMS = { moderation: 1, publish: 1 };

const setPreload = (entry: unknown) => {
  (window as unknown as Record<string, unknown>)[TRAVEL_LIST_PRELOAD_GLOBAL] = entry;
};

const readPreload = () =>
  (window as unknown as Record<string, unknown>)[TRAVEL_LIST_PRELOAD_GLOBAL];

const clearPreload = () => {
  delete (window as unknown as Record<string, unknown>)[TRAVEL_LIST_PRELOAD_GLOBAL];
};

describe('travelListPreload', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web';
    fetchWithTimeout.mockClear();
    fetchWithTimeout.mockImplementation(async () => ({ ok: true }));
    clearPreload();
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalPlatform;
    clearPreload();
  });

  it('строит тот же URL, что и fetchTravels для первой страницы /search', async () => {
    await fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchWithTimeout.mock.calls[0][0] as string;

    expect(buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE)).toBe(requestedUrl);
    expect(requestedUrl.endsWith(`?${buildTravelListPreloadQuery(PER_PAGE)}`)).toBe(true);
  });

  it('прогревает публичный запрос без учётных данных — тот же init, что у fetchTravels', async () => {
    await fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);

    const init = fetchWithTimeout.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
  });

  it('отдаёт прогретый Response вместо собственного запроса', async () => {
    const preloadedResponse = { ok: true } as unknown as Response;
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({ url, startedAt: Date.now(), response: Promise.resolve(preloadedResponse) });

    const result = await fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);

    expect(result).toEqual({ data: [], total: 0 });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(readPreload()).toBeUndefined();
  });

  it('падает обратно на обычный запрос, если прогрев отказал', async () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    const response = Promise.reject(new Error('aborted'));
    // Инлайновый скрипт гасит unhandled rejection тем же способом, не подменяя промис.
    response.catch(() => {});
    setPreload({ url, startedAt: Date.now(), response });

    const result = await fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);

    expect(result).toEqual({ data: [], total: 0 });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  // Отменённый React Query'ем запрос не должен молча дописывать public-stale кэш.
  it('уважает отмену потребителя, случившуюся пока прогрев был в полёте', async () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({ url, startedAt: Date.now(), response: Promise.resolve({ ok: true } as Response) });

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('не применяет прогрев к другому запросу и оставляет его нетронутым', async () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    const entry = { url, startedAt: Date.now(), response: Promise.resolve({ ok: true } as Response) };
    setPreload(entry);

    // Вторая страница — другой URL.
    await fetchTravels(1, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(readPreload()).toBe(entry);
  });

  it('одноразовый: второй запрос по тому же URL идёт обычным путём', async () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({ url, startedAt: Date.now(), response: Promise.resolve({ ok: true } as Response) });

    expect(takeTravelListPreload(url)).not.toBeNull();
    expect(takeTravelListPreload(url)).toBeNull();
  });

  it('игнорирует и снимает протухший прогрев', () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({
      url,
      startedAt: Date.now() - 61_000,
      response: Promise.resolve({ ok: true } as Response),
    });

    expect(takeTravelListPreload(url)).toBeNull();
    expect(readPreload()).toBeUndefined();
  });

  it('игнорирует мусор в глобали', () => {
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({ url, startedAt: Date.now(), response: 'not-a-promise' });
    expect(takeTravelListPreload(url)).toBeNull();

    setPreload(null);
    expect(takeTravelListPreload(url)).toBeNull();
  });

  it('buildTravelListPreloadUrl возвращает пустую строку без базы API', () => {
    expect(buildTravelListPreloadUrl('', PER_PAGE)).toBe('');
  });

  // Прогрев живёт только в web-HTML: на Android его глобали нет в принципе, и
  // ранний старт запроса не может продублироваться в native.
  it('на native прогрев не применяется даже при заполненной глобали', async () => {
    (Platform as { OS: string }).OS = 'android';
    const url = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE);
    setPreload({ url, startedAt: Date.now(), response: Promise.resolve({ ok: true } as Response) });

    expect(takeTravelListPreload(url)).toBeNull();

    await fetchTravels(0, PER_PAGE, '', SEARCH_DEFAULT_PARAMS, {} as any);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });
});
