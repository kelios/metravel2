// Регрессия: таймаут fetchWithTimeout должен помечаться name='TimeoutError' и
// распознаваться isTimeoutError, чтобы retry-предикаты (achievements, профиль
// автора, главный travel) НЕ ретраили зависший бэк и не утраивали ожидание под
// спиннером (~10с вместо ~33с). См. правку «no-retry-on-timeout».

import { fetchStatusWithTimeout, fetchWithTimeout } from '@/utils/fetchWithTimeout';
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


describe('status-only fetch body lifecycle', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

  function deferredResponse(status = 200) {
    let signal: AbortSignal;
    let releaseBody: () => void;
    let rejectBody: (error: Error) => void;
    let bodyStarted: () => void;
    const started = new Promise<void>(resolve => { bodyStarted = resolve; });
    const arrayBuffer = jest.fn(() => new Promise<ArrayBuffer>((resolve, reject) => {
      releaseBody = () => resolve(new ArrayBuffer(0)); rejectBody = reject;
      signal.addEventListener('abort', () => {
        const error = new Error('Aborted'); error.name = 'AbortError'; reject(error);
      }, { once: true });
      bodyStarted();
    }));
    const response = { status, ok: status >= 200 && status < 300, arrayBuffer } as unknown as Response;
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      signal = init!.signal!;
      return response;
    }) as typeof fetch;
    return { response, arrayBuffer, started, finish: () => releaseBody(), reject: (error: Error) => rejectBody(error), signal: () => signal };
  }

  it('default Response is unread/reusable for existing JSON consumers and its deadline ends at headers', async () => {
    const clear = jest.spyOn(global, 'clearTimeout');
    const { Response: FixtureResponse } = jest.requireActual('whatwg-fetch');
    const response: Response = new FixtureResponse('{"fixture":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    global.fetch = jest.fn(async () => response) as typeof fetch;
    const result = await fetchWithTimeout('https://example.test/api/json', {}, 20);
    expect(result).toBe(response); expect(result.bodyUsed).toBe(false);
    expect(clear).toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ fixture: true });
    expect(result.bodyUsed).toBe(true);
  });

  it.each([200, 401, 403, 503])('returns only HTTP%s status after the actual deferred body completes', async status => {
    jest.useFakeTimers();
    const fixture = deferredResponse(status);
    let settled = false;
    const pending = fetchStatusWithTimeout('https://example.test/api/status', {}, 20).then(value => { settled = true; return value; });
    await fixture.started;
    expect(settled).toBe(false); expect(fixture.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(fixture.signal().aborted).toBe(false); expect(jest.getTimerCount()).toBe(1);
    fixture.finish();
    await expect(pending).resolves.toEqual({ status, ok: status >= 200 && status < 300 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('one deadline starts before headers and remains active while body is unfinished', async () => {
    jest.useFakeTimers();
    const fixture = deferredResponse();
    const pending = fetchStatusWithTimeout('https://example.test/api/status', {}, 20);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await fixture.started;
    jest.advanceTimersByTime(19); expect(fixture.signal().aborted).toBe(false);
    jest.advanceTimersByTime(1);
    await rejection; expect(fixture.signal().aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not reset the deadline after slow headers arrive', async () => {
    jest.useFakeTimers();
    let headerReady: (response: Response) => void;
    let bodyStarted: () => void;
    const started = new Promise<void>(resolve => { bodyStarted = resolve; });
    global.fetch = jest.fn((_url, init?: RequestInit) => new Promise<Response>(resolve => {
      headerReady = resolve;
      const response = { status: 200, ok: true, arrayBuffer: () => new Promise<ArrayBuffer>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); }, { once: true });
        bodyStarted();
      }) } as unknown as Response;
      setTimeout(() => headerReady(response), 15);
    })) as typeof fetch;
    const pending = fetchStatusWithTimeout('https://example.test/api/status', {}, 20);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    jest.advanceTimersByTime(15); await started;
    jest.advanceTimersByTime(5); await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('external abort during body read remains AbortError and listener/timer are cleaned', async () => {
    jest.useFakeTimers();
    const fixture = deferredResponse(); const external = new AbortController();
    const remove = jest.spyOn(external.signal, 'removeEventListener');
    const pending = fetchStatusWithTimeout('https://example.test/api/status', { signal: external.signal }, 20);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await fixture.started; external.abort(); await rejection;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('already-aborted status call never fetches; body failure never reports a successful status', async () => {
    const external = new AbortController(); external.abort(); global.fetch = jest.fn();
    await expect(fetchStatusWithTimeout('https://example.test/api/status', { signal: external.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).not.toHaveBeenCalled();
    const fixture = deferredResponse(401);
    const pending = fetchStatusWithTimeout('https://example.test/api/status');
    const rejection = expect(pending).rejects.toThrow('fixture body failure');
    await fixture.started; fixture.reject(new Error('fixture body failure')); await rejection;
  });
});
