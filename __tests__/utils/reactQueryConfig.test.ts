import { ApiError } from '@/api/clientErrors';
import { createOptimizedQueryClient } from '@/utils/reactQueryConfig';
import { Platform } from 'react-native';

describe('createOptimizedQueryClient', () => {
  const originalRequestIdleCallback = (window as any).requestIdleCallback;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    if (originalRequestIdleCallback === undefined) {
      delete (window as any).requestIdleCallback;
    } else {
      (window as any).requestIdleCallback = originalRequestIdleCallback;
    }
  });

  it('schedules static prefetch by default on web', () => {
    const requestIdleCallback = jest.fn(() => 1);
    (window as any).requestIdleCallback = requestIdleCallback;

    createOptimizedQueryClient();

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it('skips static prefetch when disabled for critical routes', () => {
    const requestIdleCallback = jest.fn(() => 1);
    (window as any).requestIdleCallback = requestIdleCallback;

    createOptimizedQueryClient(undefined, {
      enableStaticPrefetch: false,
    });

    expect(requestIdleCallback).not.toHaveBeenCalled();
  });

  // Синглтон для не-хукового кода (geoQueries) не привязан к маршруту: раньше
  // его загрузка давала второй, дублирующий префетч фильтров и стран.
  it('does not schedule a prefetch for the shared module-level client', () => {
    const requestIdleCallback = jest.fn(() => 1);
    (window as any).requestIdleCallback = requestIdleCallback;

    jest.isolateModules(() => {
      require('@/api/queryClient');
    });

    expect(requestIdleCallback).not.toHaveBeenCalled();
  });

  it('pauses first requests while the platform is offline', () => {
    const client = createOptimizedQueryClient(undefined, {
      enableStaticPrefetch: false,
    });

    expect(client.getDefaultOptions().queries?.networkMode).toBe('online');
  });

  it('does not retry mutations by default: writes carry no idempotency key', () => {
    const client = createOptimizedQueryClient(undefined, {
      enableStaticPrefetch: false,
    });

    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  // #2184: правило «сервер ещё считает — не повторять» опознаёт таймаут по имени
  // ошибки и 504 по статусу. По тексту оно работало только в RU и EN: текст
  // таймаута локализован, и в BE/UK/PL брошенный запрос повторялся дважды.
  describe('default retry', () => {
    const defaultRetry = () => {
      const client = createOptimizedQueryClient(undefined, { enableStaticPrefetch: false });
      return client.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean;
    };
    const timeoutError = (message: string) => Object.assign(new Error(message), { name: 'TimeoutError' });

    it('does not retry a timeout in any locale', () => {
      const retry = defaultRetry();
      [
        'Превышено время ожидания (10000ms). Попробуйте позже.',
        'Перавышаны час чакання (10000ms). Паспрабуйце пазней.',
        'Перевищено час очікування (10000ms). Спробуйте пізніше.',
        'Przekroczono limit czasu (10000 ms). Spróbuj ponownie później.',
        'Timeout exceeded (10000ms). Please try again later.',
      ].forEach((message) => expect(retry(0, timeoutError(message))).toBe(false));
    });

    it('does not retry a 504: the upstream is still working', () => {
      expect(defaultRetry()(0, new ApiError(504, 'HTTP 504: '))).toBe(false);
    });

    it('keeps the rest of the policy: no retry for network failures and 4xx, two for other errors', () => {
      const retry = defaultRetry();
      expect(retry(0, new TypeError('Failed to fetch'))).toBe(false);
      expect(retry(0, new ApiError(404, 'HTTP 404: Not Found'))).toBe(false);
      expect(retry(0, new ApiError(500, 'HTTP 500: Internal Server Error'))).toBe(true);
      expect(retry(1, new ApiError(500, 'HTTP 500: Internal Server Error'))).toBe(true);
      expect(retry(2, new ApiError(500, 'HTTP 500: Internal Server Error'))).toBe(false);
    });
  });
});
