import { 
  fetchTravel, 
  fetchTravelBySlug, 
  fetchTravels, 
  fetchRandomTravels 
} from '@/src/api/travelsApi';
import { 
  fetchTravelsNear, 
  fetchTravelsPopular, 
  fetchTravelsForMap, 
  fetchTravelsNearRoute 
} from '@/src/api/map';
import { 
  fetchArticles, 
  fetchArticle 
} from '@/src/api/articles';
import { 
  fetchFilters, 
  fetchFiltersCountry, 
  fetchAllCountries 
} from '@/src/api/misc';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { devError } from '@/src/utils/logger';
import { getSecureItem } from '@/src/utils/secureStorage';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@/src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

jest.mock('@/src/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: jest.fn(),
  devLog: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;

jest.mock('@/src/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
}));

describe('src/api/travelsApi.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSecureItem.mockResolvedValue(null);
  });

  describe('fetchTravels', () => {
    it('должен возвращать массив, если API отдаёт массив', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce([
        { id: 1, name: 'T1' },
        { id: 2, name: 'T2' },
      ] as any);

      const result = await fetchTravels(0, 10, '', {}, {} as any);

      expect(result.total).toBe(2);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('должен возвращать {data,total} при объектном ответе', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [{ id: 1 }], total: 5 } as any);

      const result = await fetchTravels(0, 10, 'search', { countries: ['1', '2'], year: 2024 }, {} as any);

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
      expect(mockedFetchWithTimeout).toHaveBeenCalled();
    });

    it('должен корректно обрабатывать Invalid page в ошибочном ответе', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.' } as any);

      const result = await fetchTravels(10, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('не добавляет publish по умолчанию, если есть user_id (user-scoped)', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchTravels(0, 10, '', { user_id: 1, moderation: 0 }, {} as any);

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      // moderation берётся из urlParams, но user_id в where не добавляется
      expect(where.moderation).toBe(0);
      expect(where.publish).toBeUndefined();
    });

    it('нормализует year в whereObject как строку', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchTravels(0, 10, '', { year: 2024 }, {} as any);

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where.year).toBe('2024');
    });

    it('обрабатывает неожиданный объект без data как пустой результат', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ total: 10 } as any);

      const result = await fetchTravels(0, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 10 });
    });

    it('нормализует числовые массивы фильтров и отбрасывает мусорные значения', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchTravels(0, 10, '', {
        countries: ['1', '2', 'bad', '', null],
        categories: [1, 2, NaN],
      } as any, {} as any);

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where.countries).toEqual([1, 2]);
      expect(where.categories).toEqual([1, 2]);
    });
  });

  describe('fetchRandomTravels', () => {
    it('использует endpoint /api/travels/random и всегда проставляет moderation=1,publish=1 без page/perPage', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchRandomTravels(0, 12, '', { countries: [1, 2] }, {} as any);

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      expect(urlObj.pathname).toContain('/api/travels/random');

      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');
      expect(where.moderation).toBe(1);
      expect(where.publish).toBe(1);
      expect(where.countries).toEqual([1, 2]);
    });

    it('возвращает массив и total при объектном ответе', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [{ id: 1 }], total: 3 } as any);

      const result = await fetchRandomTravels(1, 12, 'q', {}, {} as any);

      expect(result.total).toBe(3);
      expect(result.data).toEqual([{ id: 1 }]);
    });

    it('корректно обрабатывает Invalid page', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.' } as any);

      const result = await fetchRandomTravels(10, 12, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('простые API-обёртки', () => {
    it('fetchTravel возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchTravel(123);

      expect(devError).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('fetchTravel использует кэш только для неавторизованных пользователей', async () => {
      const travelPayload = { id: 99 } as any;
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      const first = await fetchTravel(99);
      expect(first).toBe(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      const second = await fetchTravel(99);

      expect(second).toBe(travelPayload);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('fetchTravel добавляет Authorization и не кэширует авторизованные ответы', async () => {
      const travelPayload = { id: 42 } as any;
      mockedFetchWithTimeout.mockResolvedValue({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValue(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce('secret-token');
      await fetchTravel(42);

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      const [, options] = mockedFetchWithTimeout.mock.calls[0];
      expect(options).toMatchObject({ headers: { Authorization: 'Token secret-token' } });

      mockedGetSecureItem.mockResolvedValueOnce('secret-token');
      await fetchTravel(42);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('fetchTravelBySlug возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchTravelBySlug('slug');

      expect(devError).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('fetchTravelBySlug передаёт токен, если он есть', async () => {
      const travelPayload = { id: 77 } as any;
      mockedFetchWithTimeout.mockResolvedValue({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValue(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce('slug-token');
      await fetchTravelBySlug('my-trip');

      const [, options] = mockedFetchWithTimeout.mock.calls[0];
      expect(options).toMatchObject({ headers: { Authorization: 'Token slug-token' } });
    });

    it('fetchTravelBySlug использует путь /api/travels/by-slug/{slug}/', async () => {
      mockedGetSecureItem.mockResolvedValueOnce(null);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ id: 1, slug: 'sluggy' } as any);

      await fetchTravelBySlug('sluggy');

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      expect(url).toBe('http://example.test/api/travels/by-slug/sluggy');
    });

    it('fetchTravelsNear пробрасывает AbortError', async () => {
      const abortError: any = new Error('aborted');
      abortError.name = 'AbortError';
      mockedFetchWithTimeout.mockRejectedValueOnce(abortError);

      await expect(fetchTravelsNear(1, {} as any)).rejects.toBe(abortError);
    });

    it('fetchTravelsPopular возвращает пустой объект при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchTravelsPopular();

      expect(result).toEqual({} as any);
    });

    it('fetchTravelsForMap возвращает пустой массив при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchTravelsForMap(0, 10, {});

      expect(result).toEqual([]);
    });
  });

  describe('fetchTravelsNearRoute и справочные методы', () => {
    it('fetchTravelsNearRoute возвращает данные при успешном ответе', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce([{ id: 1 }] as any);

      const route: [number, number][] = [[27.5, 53.9]];
      const result = await fetchTravelsNearRoute(route, 2);

      expect(result).toEqual([{ id: 1 }]);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('fetchTravelsNearRoute возвращает пустой массив при неуспешном ответе', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, text: jest.fn().mockResolvedValue('err') } as any);

      const route: [number, number][] = [[27.5, 53.9]];
      const result = await fetchTravelsNearRoute(route, 2);

      expect(result).toEqual([]);
    });

    it('fetchArticle возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchArticle(1 as any);

      expect(devError).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('fetchFilters возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchFilters();

      expect(devError).toHaveBeenCalled();
      expect(result).toEqual([] as any);
    });

    it('fetchFiltersCountry возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchFiltersCountry();

      expect(devError).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('fetchAllCountries возвращает дефолт при ошибке', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await fetchAllCountries();

      expect(devError).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('fetchArticles/fetchTravelsby/fetchFiltersTravel', () => {
    it('fetchArticles подставляет publish/moderation по умолчанию', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce([{ id: 1 }] as any);

      const result = await fetchArticles(0, 10, {});

      expect(result).toEqual({ data: [{ id: 1 }], total: 1 });

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where.publish).toBe(1);
      expect(where.moderation).toBe(1);
    });

  });
});
