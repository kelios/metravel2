/**
 * #1647: `country_code` — признак страны, не зависящий от языка адреса, и в
 * запрос он уходит query-параметром. Тест хука проверяет только объект
 * параметров, поэтому сама сериализация в URL не была покрыта ничем: опечатка в
 * имени параметра прошла бы и типы, и jest, а на проде тихо вернула бы
 * ранжирование по дистанции без фильтра страны.
 */
import { apiClient } from '@/api/client';
import { fetchQuestsNearLocation } from '@/api/quests';

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

// Офлайн-кэш каталога к near-location отношения не имеет, но тянется модулем
// `api/quests` вместе с AsyncStorage — держим его немым, как в `quests.test.ts`.
jest.mock('@/api/questBundleCache', () => ({
  readCachedQuestsList: jest.fn(async () => null),
  writeCachedQuestsList: jest.fn(async () => {}),
  readCachedQuestBundle: jest.fn(async () => null),
  writeCachedQuestBundle: jest.fn(async () => {}),
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

/** Query-строка единственного ушедшего запроса. */
function requestedQuery(): URLSearchParams {
  expect(mockedGet).toHaveBeenCalledTimes(1);
  const [url] = mockedGet.mock.calls[0] as [string];
  const [path, search = ''] = url.split('?');
  expect(path).toBe('/quests/near-location/');
  return new URLSearchParams(search);
}

describe('fetchQuestsNearLocation: query-строка', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValueOnce({ results: [], count: 0 });
  });

  it('передаёт город, страну, код страны, координаты и лимит (travel 737)', async () => {
    await fetchQuestsNearLocation({
      city: 'Dominikanów · Краков · Малопольское воеводство · Польша',
      country: 'Польша',
      country_code: 'pl',
      lat: 50.086575,
      lng: 19.9663028,
      limit: 6,
    });

    const query = requestedQuery();
    expect(query.get('city')).toBe('Dominikanów · Краков · Малопольское воеводство · Польша');
    expect(query.get('country')).toBe('Польша');
    expect(query.get('country_code')).toBe('pl');
    expect(query.get('lat')).toBe('50.086575');
    expect(query.get('lng')).toBe('19.9663028');
    expect(query.get('limit')).toBe('6');
  });

  it('пустой или пробельный код страны параметром не становится', async () => {
    await fetchQuestsNearLocation({ city: 'Минск', country: null, country_code: '   ' });

    const query = requestedQuery();
    expect(query.has('country_code')).toBe(false);
    expect(query.has('country')).toBe(false);
    expect(query.get('city')).toBe('Минск');
  });
});
