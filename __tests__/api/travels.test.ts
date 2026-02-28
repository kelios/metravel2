const loadTravelsApi = (): typeof import('@/api/travelsApi') => {
  let mod!: typeof import('@/api/travelsApi');
  jest.isolateModules(() => {
    mod = require('@/api/travelsApi') as typeof import('@/api/travelsApi');
  });
  return mod;
};
import { 
  fetchTravelsNear, 
  fetchTravelsPopular, 
  fetchTravelsForMap, 
  fetchTravelsNearRoute 
} from '@/api/map';
import { 
  fetchArticles, 
  fetchArticle 
} from '@/api/articles';
import { 
  fetchFilters, 
  fetchFiltersCountry, 
  fetchAllCountries 
} from '@/api/misc';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { devError } from '@/utils/logger';
import { getSecureItem } from '@/utils/secureStorage';
import { apiClient } from '@/api/client';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: jest.fn(),
  devLog: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;
const mockedApiClientGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
}));

describe('src/api/travelsApi.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSecureItem.mockResolvedValue(null);
  });

  describe('normalizeTravelItem', () => {
    it('builds canonical travel url and hydrates user from user_ids', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        id: '12',
        slug: 'trip-slug',
        url: 'test',
        user_ids: '55,77',
        user_name: 'Alice',
      } as any);

      expect(travel.url).toBe('/travels/trip-slug');
      expect(travel.userName).toBe('Alice');
      expect(travel.user).toEqual(expect.objectContaining({ id: 55, name: 'Alice' }));
    });

    it('normalizes gallery urls and keeps existing user id unchanged', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        user: { id: 999, name: 'Old' },
        userIds: '55,77',
        gallery: [
          '/gallery/a.jpg',
          { id: 1, url: 'http://example.com/pic.jpg', extra: 'x' },
          null,
        ],
      } as any);

      expect(travel.user).toEqual(expect.objectContaining({ id: 999 }));
      expect(travel.gallery).toHaveLength(2);
      expect(String(travel.gallery[0])).toMatch(/\/gallery\/a\.jpg$/);
      expect(travel.gallery[1]).toEqual(
        expect.objectContaining({ id: 1, url: 'https://example.com/pic.jpg', extra: 'x' })
      );
    });
  });

  describe('fetchTravelsForMap normalization', () => {
    it('normalizes snake_case payload into TravelCoords shape', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        1: {
          id: 1,
          coord: '50.0619474,19.9368564',
          address: 'Kraków, Poland',
          category_name: 'Cafe',
          travel_image_thumb_url: 'https://example.com/thumb.jpg',
          url: '/travels/test',
        },
      } as any);

      const result = await fetchTravelsForMap(0, 10, {
        lat: '50.0619474',
        lng: '19.9368564',
        radius: '60',
      });

      expect(result).toEqual(
        expect.objectContaining({
          1: expect.objectContaining({
            address: 'Kraków, Poland',
            categoryName: 'Cafe',
            travelImageThumbUrl: 'https://example.com/thumb.jpg',
            urlTravel: '/travels/test',
          }),
        })
      );
    });

    it('derives coord from lat/lng and supports categoryName field', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        0: {
          id: 2,
          lat: 50.1,
          lng: 19.9,
          address: 'Some place',
          categoryName: 'Museum',
          travelImageThumbUrl: 'https://example.com/img.jpg',
          urlTravel: '/travels/2',
        },
      } as any);

      const result = await fetchTravelsForMap(0, 10, {
        lat: '50.1',
        lng: '19.9',
        radius: '60',
      });

      expect(result[0]).toEqual(
        expect.objectContaining({
          coord: '50.1,19.9',
          categoryName: 'Museum',
          address: 'Some place',
        })
      );
    });
  });

  describe('fetchTravels', () => {
    it('должен возвращать массив, если API отдаёт массив', async () => {
      const { fetchTravels } = loadTravelsApi();
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
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [{ id: 1 }], total: 5 } as any);

      const result = await fetchTravels(0, 10, 'search', { countries: ['1', '2'], year: 2024 }, {} as any);

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
      expect(mockedFetchWithTimeout).toHaveBeenCalled();
    });

    it('нормализует total/count, даже если backend прислал строки', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ results: [{ id: 1 }], count: '7' } as any);

      const result = await fetchTravels(0, 10, '', {}, {} as any);

      expect(result.total).toBe(7);
      expect(result.data).toHaveLength(1);
    });

    it('должен корректно обрабатывать Invalid page в ошибочном ответе', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.' } as any);

      const result = await fetchTravels(10, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('корректно обрабатывает Invalid page в успешном payload', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.', total: '15' } as any);

      const result = await fetchTravels(10, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 15 });
    });

    it('не добавляет publish по умолчанию, если есть user_id (user-scoped)', async () => {
      const { fetchTravels } = loadTravelsApi();
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
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchTravels(0, 10, '', { year: 2024 }, {} as any);

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where.year).toBe('2024');
    });

    it('обрабатывает неожиданный объект без data как пустой результат', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ total: 10 } as any);

      const result = await fetchTravels(0, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 10 });
    });

    it('обрабатывает unknown shape со строковым total', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ foo: 'bar', total: '12' } as any);

      const result = await fetchTravels(0, 10, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 12 });
    });

    it('нормализует числовые массивы фильтров и отбрасывает мусорные значения', async () => {
      const { fetchTravels } = loadTravelsApi();
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

    it('отбрасывает Infinity/NaN/whitespace и сохраняет только конечные числа', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [], total: 0 } as any);

      await fetchTravels(
        0,
        10,
        '',
        {
          countries: [' ', 'Infinity', Infinity, -Infinity, '2', 3, null, '0'],
          categories: [NaN, ' 4 ', undefined],
        } as any,
        {} as any
      );

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where.countries).toEqual([2, 3, 0]);
      expect(where.categories).toEqual([4]);
    });
  });

  describe('fetchRandomTravels', () => {
    it('использует endpoint /api/travels/random и всегда проставляет moderation=1,publish=1 без page/perPage', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
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
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [{ id: 1 }], total: 3 } as any);

      const result = await fetchRandomTravels(1, 12, 'q', {}, {} as any);

      expect(result.total).toBe(3);
      expect(result.data).toEqual([{ id: 1 }]);
    });

    it('нормализует total/count строки в random-ответах', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [{ id: 1 }], total: '9' } as any);

      const result = await fetchRandomTravels(1, 12, 'q', {}, {} as any);

      expect(result.total).toBe(9);
      expect(result.data).toEqual([{ id: 1 }]);
    });

    it('корректно обрабатывает Invalid page', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 400 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.' } as any);

      const result = await fetchRandomTravels(10, 12, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('корректно обрабатывает Invalid page в успешном random payload', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true, status: 200 } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Invalid page.', total: '6' } as any);

      const result = await fetchRandomTravels(10, 12, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 6 });
    });

    it('возвращает total из unknown shape со строковым total', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ foo: 'bar', total: '11' } as any);

      const result = await fetchRandomTravels(0, 12, '', {}, {} as any);

      expect(result).toEqual({ data: [], total: 11 });
    });
  });

  describe('fetchMyTravels', () => {
    it('ставит publish/moderation по умолчанию и сериализует where', async () => {
      const { fetchMyTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [] } as any);

      await fetchMyTravels({ user_id: 42 });

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where).toEqual(
        expect.objectContaining({
          user_id: 42,
          publish: 1,
          moderation: 1,
        })
      );
    });

    it('собирает country/year/gallery и не подставляет статусы при includeDrafts=true', async () => {
      const { fetchMyTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ data: [] } as any);

      await fetchMyTravels({
        user_id: 'u-1',
        includeDrafts: true,
        country: 'BY',
        yearFrom: '2020',
        yearTo: '2024',
        onlyWithGallery: true,
      });

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');

      expect(where).toEqual(
        expect.objectContaining({
          user_id: 'u-1',
          countries: ['BY'],
          hasGallery: true,
          year: { gte: '2020', lte: '2024' },
        })
      );
      expect(where.publish).toBeUndefined();
      expect(where.moderation).toBeUndefined();
    });

    it('unwrapMyTravelsPayload нормализует total/count и списки', () => {
      const { unwrapMyTravelsPayload } = loadTravelsApi();

      expect(unwrapMyTravelsPayload([{ id: 1 } as any])).toEqual({
        items: [{ id: 1 }],
        total: 1,
      });

      expect(
        unwrapMyTravelsPayload({
          results: [{ id: 1 }, { id: 2 }] as any,
          count: '7',
        } as any)
      ).toEqual({
        items: [{ id: 1 }, { id: 2 }],
        total: 7,
      });
    });
  });

  describe('простые API-обёртки', () => {
    it('fetchTravel бросает ошибку при ошибке', async () => {
      const { fetchTravel } = loadTravelsApi();
      mockedApiClientGet.mockRejectedValueOnce(new Error('network'));

      await expect(fetchTravel(123)).rejects.toThrow('network');

      expect(devError).toHaveBeenCalled();
    });

    it('fetchTravel использует кэш только для неавторизованных пользователей', async () => {
      const { fetchTravel } = loadTravelsApi();
      const travelPayload = { id: 99 } as any;
      mockedApiClientGet.mockResolvedValueOnce(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      const first = await fetchTravel(99);
      expect(first).toEqual(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      const second = await fetchTravel(99);

      expect(second).toEqual(travelPayload);
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
    });

    it('fetchTravel добавляет Authorization и не кэширует авторизованные ответы', async () => {
      const { fetchTravel } = loadTravelsApi();
      const travelPayload = { id: 42 } as any;
      mockedApiClientGet.mockResolvedValue(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce('secret-token');
      await fetchTravel(42);

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/42/');

      mockedGetSecureItem.mockResolvedValueOnce('secret-token');
      await fetchTravel(42);
      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
    });

    it('fetchTravelBySlug бросает ошибку при ошибке', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedApiClientGet.mockRejectedValueOnce(new Error('network'));

      await expect(fetchTravelBySlug('slug')).rejects.toThrow('network');

      expect(devError).toHaveBeenCalled();
    });

    it('fetchTravelBySlug передаёт токен, если он есть', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const travelPayload = { id: 77 } as any;
      mockedApiClientGet.mockResolvedValue(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce('slug-token');
      await fetchTravelBySlug('my-trip');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/by-slug/my-trip/');
    });

    it('fetchTravelBySlug использует путь /api/travels/by-slug/{slug}/', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce(null);
      mockedApiClientGet.mockResolvedValueOnce({ id: 1, slug: 'sluggy' } as any);

      await fetchTravelBySlug('sluggy');

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/by-slug/sluggy/');
    });

    it('fetchTravelBySlug использует fallback-поиск по похожему slug при 404', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        data: [
          {
            id: 2677,
            name: 'Модынь  - одна из самых высоких вершин Бескидов',
            slug: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
            url: '/travels/modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
            publish: true,
            moderation: true,
          },
          {
            id: 3000,
            name: 'Нерелевантный маршрут',
            slug: 'modyn-random',
            url: '/travels/modyn-random',
            publish: true,
            moderation: true,
          },
        ],
        total: 2,
      } as any);

      const result = await fetchTravelBySlug('modyn-odna-iz-samykh-vershin-beskidov');

      expect(result.slug).toBe('modyn-odna-iz-samykh-vysokikh-vershin-beskidov');
      expect(result.id).toBe(2677);
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      expect(urlObj.pathname).toContain('/api/travels/');
      expect(urlObj.searchParams.get('query')).toContain('modyn');
    });

    it('fetchTravelBySlug продолжает fallback-скан, если первые query не дают результатов', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError);

      mockedFetchWithTimeout
        .mockResolvedValueOnce({ ok: true } as any)
        .mockResolvedValueOnce({ ok: true } as any)
        .mockResolvedValueOnce({ ok: true } as any)
        .mockResolvedValueOnce({ ok: true } as any);

      mockedSafeJsonParse
        .mockResolvedValueOnce({ data: [], total: 0 } as any)
        .mockResolvedValueOnce({ data: [], total: 0 } as any)
        .mockResolvedValueOnce({ data: [], total: 0 } as any)
        .mockResolvedValueOnce({
          data: [
            {
              id: 2677,
              name: 'Модынь  - одна из самых высоких вершин Бескидов',
              slug: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
              url: '/travels/modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
              publish: true,
              moderation: true,
            },
          ],
          total: 1,
        } as any);

      const result = await fetchTravelBySlug('modyn-odna-iz-samykh-vershin-beskidov');

      expect(result.id).toBe(2677);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(4);
      const firstUrl = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const firstUrlObj = new URL(firstUrl);
      expect(firstUrlObj.searchParams.get('query')).toContain('modyn');
    });

    it('fetchTravelBySlug fallback использует короткий токен slug, когда длинные query пустые', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError);

      mockedFetchWithTimeout.mockImplementation(async (url: string) => ({
        ok: true,
        __url: url,
      } as any));
      mockedSafeJsonParse.mockImplementation(async (res: any) => {
        const url = new URL(res.__url);
        const query = url.searchParams.get('query') || '';
        if (query === 'modyn') {
          return {
            data: [
              {
                id: 498,
                name: 'Модынь  - одна из самых высоких вершин Бескидов (1029)',
                slug: 'modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
                url: '/travels/modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
                publish: true,
                moderation: true,
              },
            ],
            total: 1,
          } as any;
        }
        return { data: [], total: 0 } as any;
      });

      const result = await fetchTravelBySlug('modyn-odna-iz-samykh-vysokikh-vershin-beskidov');

      expect(result.id).toBe(498);
      expect(result.slug).toBe('modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029');
      const requestedQueries = mockedFetchWithTimeout.mock.calls.map(
        (call) => new URL(call[0] as string).searchParams.get('query') || ''
      );
      expect(requestedQueries).toContain('modyn');
    });

    it('fetchTravelBySlug fallback пробует одиночный токен первым (prod API не поддерживает multi-word)', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError);

      mockedFetchWithTimeout.mockImplementation(async (url: string) => ({
        ok: true,
        __url: url,
      } as any));
      mockedSafeJsonParse.mockImplementation(async (res: any) => {
        const url = new URL(res.__url);
        const query = url.searchParams.get('query') || '';
        if (query === 'modyn') {
          return {
            data: [
              {
                id: 498,
                name: 'Модынь  - одна из самых высоких вершин Бескидов (1029)',
                slug: 'modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
                url: '/travels/modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029',
                publish: true,
                moderation: true,
              },
            ],
            total: 1,
          } as any;
        }
        return { data: [], total: 0 } as any;
      });

      const result = await fetchTravelBySlug('modyn-odna-iz-samykh-vysokikh-vershin-beskidov');

      expect(result.id).toBe(498);
      const firstQuery = new URL(mockedFetchWithTimeout.mock.calls[0][0] as string).searchParams.get('query') || '';
      expect(firstQuery.split(' ').length).toBe(1);
      expect(firstQuery).toBe('modyn');
    });

    it('fetchTravelBySlug fallback корректно обрабатывает slug с числовым суффиксом', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError);
      mockedFetchWithTimeout.mockResolvedValue({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValue({
        data: [
          {
            id: 1029,
            name: 'Модынь  - одна из самых высоких вершин Бескидов',
            slug: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
            url: '/travels/modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
            publish: true,
            moderation: true,
          },
        ],
        total: 1,
      } as any);

      const result = await fetchTravelBySlug('modyn-odna-iz-samyh-vysokih-vershin-beskidov-1029');

      expect(result.id).toBe(1029);
      expect(result.slug).toBe('modyn-odna-iz-samykh-vysokikh-vershin-beskidov');
      expect(mockedFetchWithTimeout.mock.calls.length).toBeGreaterThan(0);
      expect(mockedFetchWithTimeout.mock.calls.length).toBeLessThanOrEqual(3);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      const queryParam = urlObj.searchParams.get('query') || '';
      expect(queryParam).toContain('modyn');
      expect(queryParam).not.toContain('1029');
    });

    it('fetchTravel пробрасывает AbortError без логирования', async () => {
      const { fetchTravel } = loadTravelsApi();
      const abortError: any = new Error('aborted');
      abortError.name = 'AbortError';
      mockedApiClientGet.mockRejectedValueOnce(abortError);

      await expect(fetchTravel(7)).rejects.toBe(abortError);
      expect(devError).not.toHaveBeenCalledWith('Error fetching Travel:', abortError);
    });

    it('fetchTravelBySlug пробрасывает AbortError без логирования', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const abortError: any = new Error('aborted');
      abortError.name = 'AbortError';
      mockedApiClientGet.mockRejectedValueOnce(abortError);

      await expect(fetchTravelBySlug('trip')).rejects.toBe(abortError);
      expect(devError).not.toHaveBeenCalledWith('Error fetching Travel by slug:', abortError);
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

      const route: [number, number][] = [[27.5667, 53.9], [27.5767, 53.91]];
      const result = await fetchTravelsNearRoute(route, 2);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([expect.objectContaining({ id: 1 })]);
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
      expect(result).toEqual({
        countries: [],
        categories: [],
        categoryTravelAddress: [],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        sortings: [],
        transports: [],
        year: '',
      } as any);
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
