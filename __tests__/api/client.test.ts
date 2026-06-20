import { apiClient, ApiError } from '@/api/client';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem, setSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { devError } from '@/utils/logger';
import { Platform } from 'react-native';

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  removeSecureItems: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;
const mockedRemoveSecureItems = removeSecureItems as jest.MockedFunction<typeof removeSecureItems>;
const originalPlatformOS = Platform.OS;

// эмулируем navigator для web-веток
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

describe('src/api/client.ts apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web' as typeof Platform.OS;
    (navigator as any).onLine = true;
    mockedRemoveSecureItems.mockResolvedValue(undefined);
  });

  afterAll(() => {
    Platform.OS = originalPlatformOS;
  });

  it('успешно делает GET запрос c токеном', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');
    mockedFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as any);

    const result = await apiClient.get('/test');

    expect(result).toEqual({ ok: true });
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, options] = mockedFetchWithTimeout.mock.calls[0];
    expect(String(url)).toContain('/test');
    expect((options as any).headers.Authorization).toBe('Token token');
  });

  it('на web не блокирует запрос заранее, если navigator.onLine=false', async () => {
    (navigator as any).onLine = false;
    mockedGetSecureItem.mockResolvedValueOnce(null);
    mockedFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as any);

    await expect(apiClient.get('/offline')).resolves.toEqual({ ok: true });
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('переводит сетевую ошибку в ApiError с offline=true и логирует devError', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');
    mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network failed'));

    await expect(apiClient.get('/network'))
      .rejects.toBeInstanceOf(ApiError);

    expect(devError).toHaveBeenCalled();
  });

  it('пробрасывает AbortError без devError логирования', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');
    const abortError = new DOMException('signal is aborted without reason', 'AbortError');
    mockedFetchWithTimeout.mockRejectedValueOnce(abortError);

    await expect(apiClient.get('/aborted')).rejects.toBe(abortError);

    expect(devError).not.toHaveBeenCalled();
  });

  it('не логирует пустой reject value', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');
    mockedFetchWithTimeout.mockRejectedValueOnce(undefined);

    await expect(apiClient.get('/empty-error')).rejects.toBeUndefined();

    expect(devError).not.toHaveBeenCalled();
  });

  it('пытается сделать refresh при 401 и повторяет запрос', async () => {
    mockedGetSecureItem
      .mockResolvedValueOnce('oldToken') // первый вызов в request
      .mockResolvedValueOnce('oldToken') // повторный вызов перед retry после refresh
      .mockResolvedValueOnce('oldToken');

    mockedFetchWithTimeout
      .mockResolvedValueOnce({ // первый запрос → 401
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      } as any)
      .mockResolvedValueOnce({ // refresh токена
        ok: true,
        status: 200,
        json: async () => ({ access: 'newToken' }),
      } as any)
      .mockResolvedValueOnce({ // повторный запрос с новым токеном
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as any);

    const result = await apiClient.get('/needs-refresh');

    expect(result).toEqual({ ok: true });
    expect(setSecureItem).toHaveBeenCalledWith('userToken', 'newToken');
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(3);
  });

  it('uploadFile повторяет запрос при 401 и кидает ApiError при неуспехе', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');

    mockedFetchWithTimeout
      .mockResolvedValueOnce({ // первый upload → 401
        ok: false,
        status: 401,
      } as any)
      .mockResolvedValueOnce({ // повторный upload после refresh
        ok: false,
        status: 500,
        statusText: 'Server error',
      } as any);

    const fd = new FormData();

    await expect(apiClient.uploadFile('/upload', fd))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('uploadFormData повторяет transient 502 и завершает upload после второго ответа', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');

    mockedFetchWithTimeout
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ url: '/media/retried.jpg' }),
      } as any);

    const fd = new FormData();
    const result = await apiClient.uploadFormData<{ url: string }>('/upload', fd);

    expect(result).toEqual({ url: '/media/retried.jpg' });
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('uploadFile повторяет transient 502 и выбрасывает ApiError, если retry тоже падает', async () => {
    mockedGetSecureItem.mockResolvedValueOnce('token');

    mockedFetchWithTimeout
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as any);

    const fd = new FormData();

    await expect(apiClient.uploadFile('/upload', fd)).rejects.toEqual(
      expect.objectContaining({
        status: 502,
      }),
    );
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('skipAuth: не читает и не отправляет токен', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as any);

    const result = await apiClient.get('/public', undefined, { skipAuth: true });

    expect(result).toEqual({ ok: true });
    expect(mockedGetSecureItem).not.toHaveBeenCalled();
    const [, options] = mockedFetchWithTimeout.mock.calls[0];
    expect((options as any).headers.Authorization).toBeUndefined();
  });

  it('skipAuth: при 401 не очищает сохранённый токен', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as any);

    await expect(apiClient.get('/public', undefined, { skipAuth: true })).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    expect(mockedRemoveSecureItems).not.toHaveBeenCalled();
  });
});
