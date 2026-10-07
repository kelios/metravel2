// API-2: после 401 клиент повторяет запрос анонимно только для чтения
// (GET/HEAD). Запись (POST/PUT/PATCH/DELETE) без учётных данных на эндпоинте,
// принимающем анонимные вызовы, сохранилась бы как анонимная и удваивала бы
// трафик — вместо этого вызывающий получает исходный 401. GET-путь с
// fallback по-прежнему покрыт `__tests__/api/client.test.ts`.

import { apiClient, ApiError } from '@/api/client';
import { fetchStatusWithTimeout, fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem, readSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { Platform } from 'react-native';

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
  fetchStatusWithTimeout: jest.fn(),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
  readSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  removeSecureItems: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
  devWarn: jest.fn(),
}));

const mockedFetchStatusWithTimeout = fetchStatusWithTimeout as jest.MockedFunction<typeof fetchStatusWithTimeout>;
const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;
const mockedReadSecureItem = readSecureItem as jest.MockedFunction<typeof readSecureItem>;
const mockedRemoveSecureItems = removeSecureItems as jest.MockedFunction<typeof removeSecureItems>;
const originalPlatformOS = Platform.OS;

Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

const unauthorized = () => ({
  ok: false,
  status: 401,
  text: async () => JSON.stringify({ detail: 'Invalid token.' }),
  headers: { get: () => null },
}) as any;

const probeAlive = () => ({ ok: true, status: 200 }) as any;

describe('api/client: anonymous 401 retry is limited to safe methods (API-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchWithTimeout.mockReset();
    mockedFetchStatusWithTimeout.mockReset();
    mockedFetchStatusWithTimeout.mockImplementation(async (...args) => {
      const response = await mockedFetchWithTimeout(...args);
      return { status: response.status, ok: response.ok };
    });
    mockedGetSecureItem.mockReset();
    mockedReadSecureItem.mockReset();
    mockedReadSecureItem.mockImplementation(async (key) => ({
      value: await mockedGetSecureItem(key),
      unavailable: false,
    }));
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  it.each([
    ['post', () => apiClient.post('/quests/42/result', { answer: 'x' })],
    ['put', () => apiClient.put('/user/me', { name: 'x' })],
    ['delete', () => apiClient.delete('/points/1')],
  ] as const)('%s with a live token: probe runs, no anonymous re-send, original 401 is thrown', async (_name, call) => {
    mockedGetSecureItem
      .mockResolvedValueOnce('token') // access token в request()
      .mockResolvedValueOnce('token'); // повторное чтение в пробе

    mockedFetchWithTimeout
      .mockResolvedValueOnce(unauthorized()) // основной запрос → 401
      .mockResolvedValueOnce(probeAlive()); // контрольная проба → токен жив

    await expect(call()).rejects.toMatchObject({ status: 401 });

    // Ровно два вызова: запрос + проба. Анонимного повтора записи нет.
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
    const probeUrl = String(mockedFetchWithTimeout.mock.calls[1][0]);
    expect(probeUrl).toContain('/user/me/verifications/');
    expect(mockedRemoveSecureItems).not.toHaveBeenCalled();
  });

  it('post with a dead token: tokens are still cleared, write is not re-sent anonymously', async () => {
    mockedGetSecureItem
      .mockResolvedValueOnce('deadToken')
      .mockResolvedValueOnce('deadToken');

    mockedFetchWithTimeout
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce({ ok: false, status: 401 } as any); // проба подтвердила 401

    await expect(apiClient.post('/quests/42/result', { answer: 'x' })).rejects.toBeInstanceOf(ApiError);

    expect(mockedRemoveSecureItems).toHaveBeenCalledWith(['userToken', 'refreshToken']);
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('download with POST: original 401 is thrown without an anonymous retry', async () => {
    mockedGetSecureItem
      .mockResolvedValueOnce('token')
      .mockResolvedValueOnce('token');

    mockedFetchWithTimeout
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(probeAlive());

    await expect(
      apiClient.download('/travels/7/export', { method: 'POST', body: JSON.stringify({ format: 'pdf' }) }),
    ).rejects.toMatchObject({ status: 401 });

    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
  });
});
