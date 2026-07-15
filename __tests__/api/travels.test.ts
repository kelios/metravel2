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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePublicStalePayload } from '@/utils/publicStaleCache';

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
    AsyncStorage.clear();
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

    it('uses title as the display name when backend omits name', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        id: '386',
        slug: 'trek-v-khokholovskoi-doline',
        title: 'Трек в Хохоловской долине',
      } as any);

      expect(travel.name).toBe('Трек в Хохоловской долине');
    });

    it('normalizes backend author_rank for travel card metadata', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        id: '646',
        slug: 'minsk-trip',
        author_rank: { level: 5, title: 'Эксперт' },
      } as any);

      expect(travel.authorRank).toEqual({ level: 5, title: 'Эксперт' });
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

    it('strips invalid /api prefix from media image paths', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        travel_image_thumb_url: '/api/travel-image/123/conversions/main.webp',
        travel_image_thumb_small_url: 'https://metravel.by/api/travel-image/123/conversions/main_small.webp',
        gallery: [
          '/api/gallery/777/conversions/cover.jpg',
          { id: 2, url: 'https://metravel.by/api/gallery/778/conversions/detail.jpg' },
        ],
      } as any);

      expect(String(travel.travel_image_thumb_url)).toMatch(/\/travel-image\/123\/conversions\/main\.webp$/);
      expect(String(travel.travel_image_thumb_url)).not.toContain('/api/travel-image/');
      expect(String(travel.travel_image_thumb_small_url)).toMatch(/\/travel-image\/123\/conversions\/main_small\.webp$/);
      expect(String(travel.travel_image_thumb_small_url)).not.toContain('/api/travel-image/');
      expect(Array.isArray(travel.gallery)).toBe(true);
      expect(String((travel.gallery as any[])[0])).toMatch(/\/gallery\/777\/conversions\/cover\.jpg$/);
      expect(String((travel.gallery as any[])[0])).not.toContain('/api/gallery/');
      expect((travel.gallery as any[])[1]).toEqual(
        expect.objectContaining({ id: 2, url: expect.stringMatching(/\/gallery\/778\/conversions\/detail\.jpg$/) })
      );
      expect(String((travel.gallery as any[])[1]?.url || '')).not.toContain('/api/gallery/');
    });

    it('upgrades insecure first-party media urls inside rich-text fields', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        description: '<p><img src="http://metravel.by/travel-description-image/548/description/a06feb1a8ba0433db10535734e618ebc.PNG.webp"></p>',
        recommendation: '<p><img src="http://cdn.metravel.by/gallery/123/conversions/cover.webp"></p>',
        plus: '<p><img src="http://api.metravel.by/address-image/77/conversions/main.webp"></p>',
        minus: '<p><img src="http://example.com/plain-http.jpg"></p>',
      } as any);

      expect(String(travel.description)).toContain('https://metravel.by/travel-description-image/548/description/a06feb1a8ba0433db10535734e618ebc.PNG.webp');
      expect(String(travel.recommendation)).toContain('https://metravel.by/gallery/123/conversions/cover.webp');
      expect(String(travel.plus)).toContain('https://metravel.by/address-image/77/conversions/main.webp');
      expect(String(travel.minus)).toContain('http://example.com/plain-http.jpg');
    });

    it('preserves backend gallery paths with entity id segment', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        gallery: [
          {
            id: 3328,
            url: 'https://metravel.by/gallery/536/gallery/2f83a570f20d4ab6bfa1b837007da001.JPG',
          },
        ],
      } as any);

      expect(Array.isArray(travel.gallery)).toBe(true);
      expect((travel.gallery as any[])[0]).toEqual(
        expect.objectContaining({
          id: 3328,
          url: 'https://metravel.by/gallery/536/gallery/2f83a570f20d4ab6bfa1b837007da001.JPG',
        })
      );
    });

    it('sorts gallery by saved image order arrays when backend gallery order drifts', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        gallery: [
          { id: 3, url: '/gallery/3/conversions/third.webp' },
          { id: 1, url: '/gallery/1/conversions/first.webp' },
          { id: 2, url: '/gallery/2/conversions/second.webp' },
        ],
        travelImageThumbUrlArr: [2, 1, 3],
      } as any);

      expect((travel.gallery as any[]).map((item) => item?.id)).toEqual([2, 1, 3]);
    });

    it('sorts string gallery items by saved order arrays using ids extracted from urls', () => {
      const { normalizeTravelItem } = loadTravelsApi();
      const travel = normalizeTravelItem({
        gallery: [
          '/gallery/30/conversions/third.webp',
          '/gallery/10/conversions/first.webp',
          '/gallery/20/conversions/second.webp',
        ],
        thumbs200ForCollectionArr: ['20', '10', '30'],
      } as any);

      expect(travel.gallery).toEqual([
        expect.stringMatching(/\/gallery\/20\/conversions\/second\.webp$/),
        expect.stringMatching(/\/gallery\/10\/conversions\/first\.webp$/),
        expect.stringMatching(/\/gallery\/30\/conversions\/third\.webp$/),
      ]);
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

    it('retries once for transient 502 errors', async () => {
      mockedFetchWithTimeout
        .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' } as any)
        .mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce([{ id: 11, lat: 53.9, lng: 27.56 }] as any);

      const result = await fetchTravelsForMap(0, 10, {
        lat: '53.9',
        lng: '27.56',
        radius: 60,
      });

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
      expect(Array.isArray(result)).toBe(true);
      expect((result as any)[0]).toEqual(expect.objectContaining({ id: 11 }));
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

    it('пробрасывает ошибку для неожиданного объекта без data', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ total: 10 } as any);

      await expect(fetchTravels(0, 10, '', {}, {} as any)).rejects.toThrow(
        'API путешествий вернул неожиданный формат данных.'
      );
    });

    it('пробрасывает ошибку для unknown shape со строковым total', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ foo: 'bar', total: '12' } as any);

      await expect(fetchTravels(0, 10, '', {}, {} as any)).rejects.toThrow(
        'API путешествий вернул неожиданный формат данных.'
      );
    });

    it('пробрасывает ошибку, если safeJsonParse вернул fallback вместо payload', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockImplementationOnce(async (_response, fallback) => fallback as any);

      await expect(fetchTravels(0, 10, '', {}, {} as any)).rejects.toThrow(
        'API путешествий вернул непарсируемый ответ.'
      );
    });

    it('пробрасывает HTTP-ошибку для невалидного не-Invalid-page ответа', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'Boom' } as any);

      await expect(fetchTravels(0, 10, '', {}, {} as any)).rejects.toMatchObject({
        message: 'Не удалось загрузить путешествия: 500 Server Error',
        status: 500,
      });
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

    it('пробрасывает AbortError без логирования', async () => {
      const { fetchTravels } = loadTravelsApi();
      const abortError: any = new Error('aborted');
      abortError.name = 'AbortError';
      mockedFetchWithTimeout.mockRejectedValueOnce(abortError);

      await expect(fetchTravels(0, 10, '', {}, {} as any)).rejects.toBe(abortError);
      expect(devError).not.toHaveBeenCalledWith('Error fetching Travels:', abortError);
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

    it('пробрасывает ошибку для unknown shape со строковым total', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ foo: 'bar', total: '11' } as any);

      await expect(fetchRandomTravels(0, 12, '', {}, {} as any)).rejects.toThrow(
        'API случайных путешествий вернул неожиданный формат данных.'
      );
    });

    it('пробрасывает ошибку, если random payload не распарсился', async () => {
      const { fetchRandomTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockImplementationOnce(async (_response, fallback) => fallback as any);

      await expect(fetchRandomTravels(0, 12, '', {}, {} as any)).rejects.toThrow(
        'API случайных путешествий вернул непарсируемый ответ.'
      );
    });
  });

  describe('fetchTravelFacets', () => {
    it('запрашивает /api/travels/facets/ и нормализует facets', async () => {
      const { fetchTravelFacets } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        total: '330',
        facets: {
          categories: [
            { id: 6, name: 'Автопутешествие', count: '226' },
            { id: '7', name: 'Велопоход', count: 15 },
          ],
        },
      } as any);

      const result = await fetchTravelFacets('авто', { categories: ['6'] }, {} as any);

      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const urlObj = new URL(url);
      expect(urlObj.pathname).toContain('/api/travels/facets/');
      expect(urlObj.searchParams.get('query')).toBe('авто');

      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');
      expect(where.categories).toEqual([6]);
      expect(where.publish).toBe(1);
      expect(where.moderation).toBe(1);

      expect(result).toEqual({
        total: 330,
        facets: {
          categories: [
            { id: 6, name: 'Автопутешествие', count: 226 },
            { id: '7', name: 'Велопоход', count: 15 },
          ],
        },
      });
    });

    it('возвращает пустые facets при неуспешном HTTP-ответе', async () => {
      const { fetchTravelFacets } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'error' } as any);

      const result = await fetchTravelFacets('', {}, {} as any);

      expect(result).toEqual({ total: 0, facets: {} });
      expect(devError).toHaveBeenCalledWith('Error fetching travel facets: HTTP', 500, 'Server Error');
    });

    it('подавляет devError при suppressErrors=true', async () => {
      const { fetchTravelFacets } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ detail: 'bad gateway' } as any);

      const result = await fetchTravelFacets('', {}, { suppressErrors: true } as any);

      expect(result).toEqual({ total: 0, facets: {} });
      expect(devError).not.toHaveBeenCalled();
    });

    it('пробрасывает AbortError без логирования', async () => {
      const { fetchTravelFacets } = loadTravelsApi();
      const abortError: any = new Error('aborted');
      abortError.name = 'AbortError';
      mockedFetchWithTimeout.mockRejectedValueOnce(abortError);

      await expect(fetchTravelFacets('', {}, {} as any)).rejects.toBe(abortError);
      expect(devError).not.toHaveBeenCalledWith('Error fetching travel facets:', abortError);
    });

    it('использует publication_status=pending_review для facets moderation queue', async () => {
      const { fetchTravelFacets } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce('staff-token');
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ total: 0, facets: {} } as any);

      await fetchTravelFacets('', { moderation: 0 }, {} as any);

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const init = mockedFetchWithTimeout.mock.calls[0][1] as RequestInit;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');
      expect(where).toEqual(expect.objectContaining({ publication_status: 'pending_review' }));
      expect(where.moderation).toBeUndefined();
      expect(where.publish).toBeUndefined();
      expect(init.headers).toEqual({ Authorization: 'Token staff-token' });
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
      expect(urlObj.searchParams.get('page')).toBe('1');
      expect(urlObj.searchParams.get('perPage')).toBe('9999');

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

    it('использует кастомные page/perPage и нормализует невалидные значения', async () => {
      const { fetchMyTravels } = loadTravelsApi();
      mockedFetchWithTimeout.mockResolvedValue({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValue({ data: [] } as any);

      await fetchMyTravels({ user_id: 7, page: 3, perPage: 25 });
      let url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      let urlObj = new URL(url);
      expect(urlObj.searchParams.get('page')).toBe('3');
      expect(urlObj.searchParams.get('perPage')).toBe('25');

      await fetchMyTravels({ user_id: 8, page: 0, perPage: -10 });
      url = mockedFetchWithTimeout.mock.calls[1][0] as string;
      urlObj = new URL(url);
      expect(urlObj.searchParams.get('page')).toBe('1');
      expect(urlObj.searchParams.get('perPage')).toBe('9999');
    });

    it('unwrapMyTravelsPayload нормализует total/count и списки', () => {
      const { unwrapMyTravelsPayload } = loadTravelsApi();

      expect(unwrapMyTravelsPayload([{ id: 1 } as any])).toEqual({
        engagementSummary: null,
        items: [{ id: 1 }],
        total: 1,
      });

      expect(
        unwrapMyTravelsPayload({
          results: [{ id: 1 }, { id: 2 }] as any,
          count: '7',
        } as any)
      ).toEqual({
        engagementSummary: null,
        items: [{ id: 1 }, { id: 2 }],
        total: 7,
      });
    });
  });

  describe('fetchTravels moderation/public contract', () => {
    it('использует publication_status=pending_review и staff auth для moderation queue', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce('staff-token');
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ results: [], count: 0 } as any);

      await fetchTravels(0, 20, '', { moderation: 0 }, {} as any);

      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const init = mockedFetchWithTimeout.mock.calls[0][1] as RequestInit;
      const urlObj = new URL(url);
      const where = JSON.parse(urlObj.searchParams.get('where') || '{}');
      expect(where).toEqual(expect.objectContaining({ publication_status: 'pending_review' }));
      expect(where.moderation).toBeUndefined();
      expect(where.publish).toBeUndefined();
      expect(init.headers).toEqual({ Authorization: 'Token staff-token' });
    });

    it('не отбрасывает pending-review записи client-side filterPublished', async () => {
      const { fetchTravels } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce('staff-token');
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({
        results: [
          {
            id: 77,
            name: 'Pending travel',
            publish: true,
            moderation: false,
            publication_status: 'pending_review',
          },
        ],
        count: 1,
      } as any);

      const result = await fetchTravels(0, 20, '', { publication_status: 'pending_review' }, {} as any);
      const url = mockedFetchWithTimeout.mock.calls[0][0] as string;
      const where = JSON.parse(new URL(url).searchParams.get('where') || '{}');

      expect(where).toEqual({ publication_status: 'pending_review' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(expect.objectContaining({
        id: 77,
        publication_status: 'pending_review',
      }));
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

    it('fetchTravel forceRefresh обходит гостевой кэш и обновляет detail', async () => {
      const { fetchTravel } = loadTravelsApi();
      mockedApiClientGet
        .mockResolvedValueOnce({ id: 98, slug: 'cached-trip', gallery: [{ id: 1, caption: '' }] } as any)
        .mockResolvedValueOnce({ id: 98, slug: 'cached-trip', gallery: [{ id: 1, caption: 'Новое место' }] } as any);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      await fetchTravel(98);

      mockedGetSecureItem.mockResolvedValueOnce(null);
      const refreshed = await fetchTravel(98, { forceRefresh: true });

      expect(refreshed.gallery?.[0]?.caption).toBe('Новое место');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockedApiClientGet.mock.calls[1][2]).toEqual(
        expect.objectContaining({ skipAuth: true })
      );
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

    it('fetchTravel не восстанавливает stale cache после ошибки авторизованного detail-запроса', async () => {
      await savePublicStalePayload('/travels/42/', { id: 42, name: 'Cached travel' } as any);

      const { fetchTravel } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce('secret-token');
      mockedApiClientGet.mockRejectedValueOnce(Object.assign(new Error('bad gateway'), { status: 503 }));

      await expect(fetchTravel(42)).rejects.toThrow('bad gateway');
    });

    it('fetchTravelBySlug бросает ошибку при ошибке', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedApiClientGet.mockRejectedValueOnce(new Error('network'));

      await expect(fetchTravelBySlug('slug')).rejects.toThrow('network');

      expect(devError).toHaveBeenCalled();
    });

    it('fetchTravelBySlug использует canonical resolve-slug endpoint', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const travelPayload = { id: 77, slug: 'my-trip', name: 'My trip' } as any;
      mockedApiClientGet.mockResolvedValue(travelPayload);

      mockedGetSecureItem.mockResolvedValueOnce('slug-token');
      await fetchTravelBySlug('my-trip');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/resolve-slug/my-trip/');
      expect(mockedApiClientGet.mock.calls[0][2]).toEqual(expect.objectContaining({ skipAuth: true }));
    });

    it('fetchTravelBySlug дотягивает полную деталь, когда resolve-slug item лёгкий (без description/точек)', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const lightItem = {
        id: 664,
        slug: 'my-trip',
        name: 'My trip',
        rich_text: { description: { safe_html: '<p>text</p>' } },
        points: [{ id: 1, lat: '52.0', lng: '23.6' }],
      } as any;
      const fullDetail = {
        id: 664,
        slug: 'my-trip',
        name: 'My trip',
        description: '<p>full text</p>',
        travelAddress: [{ id: 1, coord: '52.0,23.6' }],
        coordsMeTravel: [{ id: 1, lat: 52.0, lng: 23.6 }],
      } as any;
      mockedGetSecureItem.mockResolvedValue(null);
      mockedApiClientGet
        .mockResolvedValueOnce({ id: 664, slug: 'my-trip', status: 200, item: lightItem } as any)
        .mockResolvedValueOnce(fullDetail);

      const result = await fetchTravelBySlug('my-trip');

      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/resolve-slug/my-trip/');
      expect(mockedApiClientGet.mock.calls[1][0]).toBe('/travels/664/');
      expect(result.description).toBe('<p>full text</p>');
      expect(result.travelAddress).toHaveLength(1);
    });

    it('fetchTravelBySlug возвращает resolve-slug item без второго запроса, когда он полный', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const fullItem = {
        id: 664,
        slug: 'my-trip',
        name: 'My trip',
        description: '<p>full text</p>',
        travelAddress: [{ id: 1, coord: '52.0,23.6' }],
      } as any;
      mockedGetSecureItem.mockResolvedValue(null);
      mockedApiClientGet.mockResolvedValueOnce({ id: 664, slug: 'my-trip', status: 200, item: fullItem } as any);

      const result = await fetchTravelBySlug('my-trip');

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(result.description).toBe('<p>full text</p>');
    });

    it('fetchTravelBySlug не возвращает stale cache после ошибки авторизованного by-slug запроса', async () => {
      await savePublicStalePayload('/travels/by-slug/my-trip/', { id: 77, slug: 'my-trip', name: 'Cached slug' } as any);

      const { fetchTravelBySlug } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce('slug-token');
      mockedApiClientGet
        .mockRejectedValueOnce(Object.assign(new Error('bad gateway'), { status: 503 }))
        .mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
      mockedFetchWithTimeout.mockResolvedValue({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValue({ data: [], total: 0 } as any);

      await expect(fetchTravelBySlug('my-trip')).rejects.toThrow();
    });

    it('fetchTravelBySlug использует путь /api/travels/resolve-slug/{slug}/', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValueOnce(null);
      mockedApiClientGet.mockResolvedValueOnce({ id: 1, slug: 'sluggy', name: 'Sluggy' } as any);

      await fetchTravelBySlug('sluggy');

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/resolve-slug/sluggy/');
    });

    it('fetchTravelBySlug переиспользует in-flight guest-запросы для одного slug', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      let resolveRequest: ((value: any) => void) | null = null;
      const pendingRequest = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      mockedGetSecureItem.mockResolvedValue(null);
      mockedApiClientGet.mockReturnValue(pendingRequest as any);

      const first = fetchTravelBySlug('sluggy');
      const second = fetchTravelBySlug('sluggy');

      await Promise.resolve();
      await Promise.resolve();

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      resolveRequest?.({ id: 1, slug: 'sluggy', name: 'Sluggy' });

      await expect(Promise.all([first, second])).resolves.toEqual([
        { id: 1, slug: 'sluggy', name: 'Sluggy' },
        { id: 1, slug: 'sluggy', name: 'Sluggy' },
      ]);
    });

    it('fetchTravelBySlug кэширует guest detail после успешного slug-запроса', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedGetSecureItem.mockResolvedValue(null);
      mockedApiClientGet.mockResolvedValueOnce({ id: 1, slug: 'sluggy', name: 'Sluggy' } as any);

      await expect(fetchTravelBySlug('sluggy')).resolves.toEqual({
        id: 1,
        slug: 'sluggy',
        name: 'Sluggy',
      });
      await expect(fetchTravelBySlug('sluggy')).resolves.toEqual({
        id: 1,
        slug: 'sluggy',
        name: 'Sluggy',
      });

      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
    });

    it('fetchTravelBySlug не запускает broad fallback search при canonical 404', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError); // resolve-slug
      mockedApiClientGet.mockRejectedValueOnce(notFoundError); // legacy exact by-slug compat

      await expect(fetchTravelBySlug('missing-travel')).rejects.toThrow('Travel not found by slug: missing-travel');

      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/resolve-slug/missing-travel/');
      expect(mockedApiClientGet.mock.calls[1][0]).toBe('/travels/by-slug/missing-travel/');
      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('fetchTravelBySlug не превращает transient legacy 503 в canonical not-found', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const notFoundError = Object.assign(new Error('not found'), { status: 404 });
      const unavailableError = Object.assign(new Error('service unavailable'), { status: 503 });
      mockedApiClientGet.mockRejectedValueOnce(notFoundError); // resolve-slug
      mockedApiClientGet.mockRejectedValueOnce(unavailableError); // legacy exact by-slug

      await expect(fetchTravelBySlug('temporarily-unavailable')).rejects.toMatchObject({
        status: 503,
      });

      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('fetchTravelBySlug возвращает item из canonical resolve-slug без fan-out', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedApiClientGet.mockResolvedValueOnce({
        id: 384,
        slug: 'korotkiy-novyy-slug',
        canonical_url: '/travels/korotkiy-novyy-slug',
        status: 'fuzzy',
        item: {
          id: 384,
          name: 'Короткое новое название',
          slug: 'korotkiy-novyy-slug',
          description: '<p>detail payload</p>',
          travelAddress: [],
          coordsMeTravel: [],
          gallery: [],
        },
      } as any);

      const result = await fetchTravelBySlug('staryy-ochen-dlinnyy-razdutyy-slug');

      expect(result.id).toBe(384);
      expect(result.slug).toBe('korotkiy-novyy-slug');
      expect(result.description).toBe('<p>detail payload</p>');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(1);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe(
        '/travels/resolve-slug/staryy-ochen-dlinnyy-razdutyy-slug/'
      );
      expect(mockedApiClientGet.mock.calls[0][2]).toEqual(
        expect.objectContaining({ skipAuth: true })
      );
      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('fetchTravelBySlug догружает detail, когда resolver вернул только id', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      mockedApiClientGet.mockResolvedValueOnce({
        id: 512,
        slug: 'novyy-kanonicheskiy-slug',
        canonical_url: '/travels/novyy-kanonicheskiy-slug',
        status: 'redirect',
      } as any);
      mockedApiClientGet.mockResolvedValueOnce({
        id: 512,
        name: 'Каноническое название',
        slug: 'novyy-kanonicheskiy-slug',
        description: '<p>detail payload</p>',
        gallery: [],
      } as any); // detail fetch

      const result = await fetchTravelBySlug('pereimenovannyy-slug');

      expect(result.id).toBe(512);
      expect(result.slug).toBe('novyy-kanonicheskiy-slug');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockedApiClientGet.mock.calls[0][0]).toBe('/travels/resolve-slug/pereimenovannyy-slug/');
      expect(mockedApiClientGet.mock.calls[1][0]).toBe('/travels/512/');
      expect(mockedFetchWithTimeout).not.toHaveBeenCalled();
    });

    it('fetchTravelBySlug использует fallback-поиск по похожему slug при 502', async () => {
      const { fetchTravelBySlug } = loadTravelsApi();
      const badGatewayError = Object.assign(new Error('bad gateway'), { status: 502 });
      mockedApiClientGet.mockRejectedValueOnce(badGatewayError); // resolve-slug
      mockedApiClientGet.mockRejectedValueOnce(badGatewayError); // legacy by-slug
      mockedApiClientGet.mockResolvedValueOnce({
        id: 2677,
        name: 'Модынь  - одна из самых высоких вершин Бескидов',
        slug: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov',
        description: '<p>detail payload</p>',
        gallery: [],
        travelAddress: [{ id: 1, coord: '53.9,27.56' }],
      } as any);
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
        ],
        total: 1,
      } as any);

      const result = await fetchTravelBySlug('modyn-odna-iz-samykh-vershin-beskidov');

      expect(result.slug).toBe('modyn-odna-iz-samykh-vysokikh-vershin-beskidov');
      expect(result.id).toBe(2677);
      expect(result.description).toBe('<p>detail payload</p>');
      expect(mockedApiClientGet).toHaveBeenCalledTimes(3);
      expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
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

    // BE-015 verified-fixed contract (prod re-probe 2026-06-08): a valid travel
    // with no near-list returns `200` + `[]`, and `404` is reserved for a
    // non-existent travel id. These lock the new backend behaviour so the
    // 404->[] guard is no longer load-bearing (BE-015 verified-fixed; tracked on the MCP task board, area=back).
    it('fetchTravelsNear возвращает [] при 200 с пустым списком (валидный travel без соседей)', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce([] as any);

      const result = await fetchTravelsNear(391);

      expect(result).toEqual([]);
    });

    it('fetchTravelsNear возвращает данные при 200 с непустым списком', async () => {
      const rows = [{ id: 637, name: 'Near travel', lat: 53.9, lng: 27.56 }];
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce(rows as any);

      const result = await fetchTravelsNear(563);

      expect(result).toEqual(rows);
    });

    it('fetchTravelsNear возвращает [] при 404 (несуществующий travel)', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' } as any);

      const result = await fetchTravelsNear(99999999);

      expect(result).toEqual([]);
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
        categories: [],
        categoryTravelAddress: [],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        sortings: [],
        transports: [],
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
