// Регрессия: таймаут fetchWithTimeout должен помечаться name='TimeoutError' и
// распознаваться isTimeoutError, чтобы retry-предикаты (achievements, профиль
// автора, главный travel) НЕ ретраили зависший бэк и не утраивали ожидание под
// спиннером (~10с вместо ~33с). См. правку «no-retry-on-timeout».

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { isTimeoutError } from '@/api/clientErrors';

describe('fetchWithTimeout timeout error', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('rejects with a TimeoutError (name) when the request hangs past the timeout', async () => {
    // fetch, который никогда не резолвится сам, но уважает AbortSignal.
    global.fetch = jest.fn((_url, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      }),
    ) as unknown as typeof fetch;

    await expect(fetchWithTimeout('https://example.test/api/slow', {}, 20)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('isTimeoutError recognises the timeout error and ignores external aborts', () => {
    const timeout = new Error('Превышено время ожидания (10000ms). Попробуйте позже.');
    timeout.name = 'TimeoutError';
    expect(isTimeoutError(timeout)).toBe(true);

    const externalAbort = new Error('Aborted');
    externalAbort.name = 'AbortError';
    expect(isTimeoutError(externalAbort)).toBe(false);

    expect(isTimeoutError(new Error('Failed to fetch'))).toBe(false);
  });
});
