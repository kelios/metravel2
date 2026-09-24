/**
 * Browsers can report navigator.onLine=false while same-origin HTTP still works.
 * Exercise the real QueryClient so the regression cannot pass with a working
 * offline banner while catalog queries remain paused indefinitely.
 */
type QueryRuntime = typeof import('@tanstack/react-query');
type NetworkRuntime = typeof import('@/utils/webNetworkStatus');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

function setVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibilityState });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function flush(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('web reachability restores catalog queries despite a false offline signal', () => {
  const originalFetch = global.fetch;
  const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let query: QueryRuntime;
  let network: NetworkRuntime;
  let setupQueryOnlineManager: typeof import('@/utils/queryOnlineManager').setupQueryOnlineManager;
  let clients: InstanceType<QueryRuntime['QueryClient']>[];
  let unsubscribe: Array<() => void>;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    setNavigatorOnline(true);
    setVisibility('visible');
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    clients = [];
    unsubscribe = [];

    const { Platform } = require('react-native');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    query = require('@tanstack/react-query');
    network = require('@/utils/webNetworkStatus');
    ({ setupQueryOnlineManager } = require('@/utils/queryOnlineManager'));
    query.focusManager.setFocused(true);
  });

  afterEach(() => {
    clients.forEach((client) => {
      client.unmount();
      client.clear();
    });
    unsubscribe.forEach((cleanup) => cleanup());
    query.onlineManager.setEventListener(() => undefined);
    query.focusManager.setEventListener(() => undefined);
    jest.restoreAllMocks();
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline);
    else Reflect.deleteProperty(navigator, 'onLine');
    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
    else Reflect.deleteProperty(document, 'visibilityState');
  });

  function createClient() {
    const client = new query.QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    client.mount();
    clients.push(client);
    return client;
  }

  function subscribe(listener: (online: boolean) => void) {
    const cleanup = network.subscribeWebNetworkStatus(listener);
    unsubscribe.push(cleanup);
    return cleanup;
  }

  function preparePausedCatalog() {
    setupQueryOnlineManager();
    const client = createClient();
    const queryFn = jest.fn(async () => ['quest-1', 'quest-2']);
    const pending = client.fetchQuery({ queryKey: ['quests', 'catalog'], queryFn });
    // Cleanup cancels deliberately paused requests in the genuine-offline cases.
    void pending.catch(() => undefined);
    return { client, queryFn, pending };
  }

  it('starts normal online queries immediately without a reachability request', async () => {
    const { pending, queryFn } = preparePausedCatalog();

    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    await flush(60_000);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(query.onlineManager.isOnline()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 405, 503])('resumes paused queries after an HTTP %s probe response', async (status) => {
    setNavigatorOnline(false);
    const probe = deferred<Response>();
    fetchMock.mockReturnValueOnce(probe.promise);
    const { client, pending, queryFn } = preparePausedCatalog();

    expect(client.getQueryState(['quests', 'catalog'])?.fetchStatus).toBe('paused');
    expect(queryFn).not.toHaveBeenCalled();

    probe.resolve({ status, ok: status === 200 } as Response);
    await flush();

    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['quests', 'catalog'])?.fetchStatus).toBe('idle');
    expect(query.onlineManager.isOnline()).toBe(true);
    expect(navigator.onLine).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    const probeUrl = new URL(String(url));
    expect(probeUrl.origin).toBe(window.location.origin);
    expect(probeUrl.pathname).toBe('/favicon.ico');
    expect(probeUrl.search).not.toBe('');
    expect(options).toEqual(expect.objectContaining({
      method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: expect.any(AbortSignal),
    }));
    await flush(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps genuine offline queries paused without discarding previously loaded data', async () => {
    setNavigatorOnline(false);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    setupQueryOnlineManager();
    const client = createClient();
    const cachedCatalog = ['saved-quest'];
    const key = ['quests', 'catalog'];
    client.setQueryData(key, cachedCatalog);
    const queryFn = jest.fn(async () => ['new-quest']);
    const pending = client.fetchQuery({ queryKey: key, queryFn });
    void pending.catch(() => undefined);

    await flush();

    expect(query.onlineManager.isOnline()).toBe(false);
    expect(client.getQueryState(key)?.fetchStatus).toBe('paused');
    expect(client.getQueryData(key)).toEqual(cachedCatalog);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it.each(['focus', 'online', 'visible'] as const)(
    'retries on %s and resumes queries even if navigator stays offline',
    async (event) => {
      setNavigatorOnline(false);
      fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
      fetchMock.mockResolvedValue({ status: 200, ok: true } as Response);
      const { pending, queryFn } = preparePausedCatalog();
      await flush();
      expect(queryFn).not.toHaveBeenCalled();

      if (event === 'visible') {
        setVisibility('hidden');
        setVisibility('visible');
      } else {
        window.dispatchEvent(new Event(event));
      }
      await flush();

      await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(navigator.onLine).toBe(false);
    },
  );

  it('shares the pending probe and recovered state between query setup and multiple subscribers', async () => {
    setNavigatorOnline(false);
    const probe = deferred<Response>();
    fetchMock.mockReturnValueOnce(probe.promise);
    const { pending } = preparePausedCatalog();
    const first = jest.fn();
    const second = jest.fn();
    subscribe(first);
    subscribe(second);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    probe.resolve({ status: 200 } as Response);
    await flush();

    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    expect(first).toHaveBeenLastCalledWith(true);
    expect(second).toHaveBeenLastCalledWith(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives the offline banner hook the same recovered state as the query manager', async () => {
    const { act, renderHook } = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
    const { useNetworkStatus } = require('@/hooks/useNetworkStatus') as typeof import('@/hooks/useNetworkStatus');
    setNavigatorOnline(false);
    const probe = deferred<Response>();
    fetchMock.mockReturnValueOnce(probe.promise);
    const { pending } = preparePausedCatalog();
    const { result, unmount } = renderHook(() => useNetworkStatus());

    try {
      expect(result.current).toEqual({
        isConnected: false, isInternetReachable: false, type: 'unknown',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        probe.resolve({ status: 200 } as Response);
        await flush();
      });

      await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
      expect(result.current).toEqual({
        isConnected: true, isInternetReachable: true, type: 'unknown',
      });
      expect(query.onlineManager.isOnline()).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it('does not let a late failed probe overwrite a newer browser online event', async () => {
    setNavigatorOnline(false);
    const probe = deferred<Response>();
    fetchMock.mockReturnValueOnce(probe.promise);
    const { pending, queryFn } = preparePausedCatalog();

    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
    await flush();
    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);

    probe.reject(new TypeError('Old request failed'));
    await flush(120_000);

    expect(query.onlineManager.isOnline()).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out a hanging probe and keeps queries paused until a fresh successful attempt', async () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    fetchMock.mockResolvedValue({ status: 200 } as Response);
    const { pending, queryFn } = preparePausedCatalog();
    const signal = fetchMock.mock.calls[0][1]?.signal;

    await flush(4_999);
    expect(signal?.aborted).toBe(false);
    await flush(1);
    expect(signal?.aborted).toBe(true);
    expect(query.onlineManager.isOnline()).toBe(false);
    expect(queryFn).not.toHaveBeenCalled();

    await flush(2_000);
    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backs off failed probes, suspends them in hidden tabs and recovers when visible', async () => {
    setNavigatorOnline(false);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { pending } = preparePausedCatalog();
    await flush();

    await flush(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flush(4_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await flush(8_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    setVisibility('hidden');
    await flush(60 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    fetchMock.mockResolvedValue({ status: 200 } as Response);
    setVisibility('visible');
    await flush();
    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('limits automatic retries to ten per foreground episode and permits an explicit focus recovery', async () => {
    setNavigatorOnline(false);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { pending, queryFn } = preparePausedCatalog();

    await flush(60 * 60_000);

    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(queryFn).not.toHaveBeenCalled();
    expect(query.onlineManager.isOnline()).toBe(false);

    fetchMock.mockResolvedValue({ status: 200 } as Response);
    window.dispatchEvent(new Event('focus'));
    await flush();

    await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('aborts pending work and removes browser listeners only after the last subscriber leaves', async () => {
    setNavigatorOnline(false);
    const probe = deferred<Response>();
    fetchMock.mockReturnValueOnce(probe.promise);
    const removeWindowListener = jest.spyOn(window, 'removeEventListener');
    const removeDocumentListener = jest.spyOn(document, 'removeEventListener');
    const first = jest.fn();
    const second = jest.fn();
    const removeFirst = subscribe(first);
    const removeSecond = subscribe(second);
    const signal = fetchMock.mock.calls[0][1]?.signal;

    removeFirst();
    expect(signal?.aborted).toBe(false);
    removeSecond();
    expect(signal?.aborted).toBe(true);
    expect(removeWindowListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    first.mockClear();
    second.mockClear();
    probe.resolve({ status: 200 } as Response);
    window.dispatchEvent(new Event('focus'));
    await flush(60 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
