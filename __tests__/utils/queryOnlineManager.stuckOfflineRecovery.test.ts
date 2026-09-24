/**
 * #603 / OFFLINE-001 regression control: a live native process that missed the
 * NetInfo callback when the network came back (Android per-uid background
 * firewall) must return online by itself — refresh on AppState `active` and a
 * bounded recheck while offline — without restarting the process.
 *
 * NetInfo is emulated at module level with the real library semantics
 * (@react-native-community/netinfo src/internal/state.ts): `fetch` answers from
 * the JS cache, `refresh` re-reads the native state and fans it out to every
 * subscriber. `changeSilently` models the stuck case: the OS state changed but
 * no event reached JS.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type EmulatedNetState = {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details?: Record<string, unknown> | null;
};

const WIFI_ONLINE: EmulatedNetState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: { ipAddress: '192.168.50.77', ssid: 'home-net', isConnectionExpensive: false },
};
const FIREWALL_BLOCKED: EmulatedNetState = {
  type: 'none',
  isConnected: false,
  isInternetReachable: false,
  details: null,
};
const UNRESOLVED: EmulatedNetState = { type: 'unknown', isConnected: null, isInternetReachable: null };

const mockNetInfo = {
  osState: WIFI_ONLINE,
  latest: null as EmulatedNetState | null,
  listeners: new Set<(state: EmulatedNetState) => void>(),
  refreshCalls: 0,
  reset(initial: EmulatedNetState) {
    this.osState = initial;
    this.latest = null;
    this.listeners.clear();
    this.refreshCalls = 0;
  },
  /** Native callback delivered: JS cache and all subscribers updated. */
  emit(state: EmulatedNetState) {
    this.osState = state;
    this.latest = state;
    this.listeners.forEach((listener) => listener(state));
  },
  /** OS state changed, but the callback never reached the JS layer. */
  changeSilently(state: EmulatedNetState) {
    this.osState = state;
  },
};

jest.mock('@react-native-community/netinfo', () => {
  const api = {
    fetch: jest.fn(() => {
      if (!mockNetInfo.latest) mockNetInfo.latest = mockNetInfo.osState;
      return Promise.resolve(mockNetInfo.latest);
    }),
    refresh: jest.fn(() => {
      mockNetInfo.refreshCalls += 1;
      const state = mockNetInfo.osState;
      mockNetInfo.latest = state;
      mockNetInfo.listeners.forEach((listener) => listener(state));
      return Promise.resolve(state);
    }),
    addEventListener: jest.fn((listener: (state: EmulatedNetState) => void) => {
      mockNetInfo.listeners.add(listener);
      if (mockNetInfo.latest) listener(mockNetInfo.latest);
      return () => {
        mockNetInfo.listeners.delete(listener);
      };
    }),
  };
  return { __esModule: true, default: api, ...api };
});

type AppStateValue = 'active' | 'background' | 'inactive';

function loadRuntime(platform: 'android' | 'ios' | 'web' = 'android') {
  const RN = require('react-native');
  Object.defineProperty(RN.Platform, 'OS', { value: platform, configurable: true });

  const appStateHandlers: Array<(state: AppStateValue) => void> = [];
  const removeAppStateListener = jest.fn();
  RN.AppState.currentState = 'active';
  RN.AppState.addEventListener = jest.fn((_type: string, handler: (state: AppStateValue) => void) => {
    appStateHandlers.push(handler);
    return { remove: removeAppStateListener };
  });

  const reactQuery = require('@tanstack/react-query');
  const { setupQueryOnlineManager } = require('@/utils/queryOnlineManager');

  const setAppState = async (next: AppStateValue) => {
    RN.AppState.currentState = next;
    appStateHandlers.forEach((handler) => handler(next));
    await jest.advanceTimersByTimeAsync(0);
  };

  return {
    onlineManager: reactQuery.onlineManager as typeof import('@tanstack/react-query').onlineManager,
    focusManager: reactQuery.focusManager as typeof import('@tanstack/react-query').focusManager,
    QueryClient: reactQuery.QueryClient as typeof import('@tanstack/react-query').QueryClient,
    setupQueryOnlineManager: setupQueryOnlineManager as () => void,
    setAppState,
    appStateAddEventListener: RN.AppState.addEventListener as jest.Mock,
    removeAppStateListener,
  };
}

async function flush(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('queryOnlineManager: recovery from a stuck offline state (#603)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    mockNetInfo.reset(WIFI_ONLINE);
    delete process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS;
    else process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS = originalFlag;
  });

  it.each(['android', 'ios'] as const)(
    '%s: paused queries resume on return to active once NetInfo re-reads a live network',
    async (platform) => {
      const runtime = loadRuntime(platform);
      runtime.setupQueryOnlineManager();
      runtime.focusManager.setFocused(true);
      const client = new runtime.QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      client.mount();
      await flush();
      expect(runtime.onlineManager.isOnline()).toBe(true);

      // Background firewall block reaches JS as an explicit isConnected=false.
      await runtime.setAppState('background');
      mockNetInfo.emit(FIREWALL_BLOCKED);
      expect(runtime.onlineManager.isOnline()).toBe(false);

      const queryFn = jest.fn(() => Promise.resolve(['quest-1', 'quest-2']));
      const pending = client.fetchQuery({ queryKey: ['quests', 'catalog'], queryFn });
      await flush();
      expect(queryFn).not.toHaveBeenCalled();
      expect(client.getQueryState(['quests', 'catalog'])?.fetchStatus).toBe('paused');

      // The block is lifted, but the native callback never arrives: the stuck state.
      mockNetInfo.changeSilently(WIFI_ONLINE);
      await flush(10 * 60_000);
      expect(mockNetInfo.refreshCalls).toBe(0);
      expect(runtime.onlineManager.isOnline()).toBe(false);
      expect(queryFn).not.toHaveBeenCalled();

      await runtime.setAppState('active');
      expect(mockNetInfo.refreshCalls).toBe(1);
      expect(runtime.onlineManager.isOnline()).toBe(true);
      await expect(pending).resolves.toEqual(['quest-1', 'quest-2']);
      expect(queryFn).toHaveBeenCalledTimes(1);

      client.unmount();
    },
  );

  it('rechecks with backoff while offline in the foreground and stops once NetInfo reports online', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    await flush();

    mockNetInfo.emit(FIREWALL_BLOCKED);
    expect(runtime.onlineManager.isOnline()).toBe(false);

    await flush(2_000);
    expect(mockNetInfo.refreshCalls).toBe(1);
    await flush(4_000);
    expect(mockNetInfo.refreshCalls).toBe(2);
    expect(runtime.onlineManager.isOnline()).toBe(false);

    mockNetInfo.changeSilently(WIFI_ONLINE);
    await flush(8_000);
    expect(mockNetInfo.refreshCalls).toBe(3);
    expect(runtime.onlineManager.isOnline()).toBe(true);

    await flush(30 * 60_000);
    expect(mockNetInfo.refreshCalls).toBe(3);
  });

  it('stops rechecking in the background and refreshes again on return to active', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    await flush();

    mockNetInfo.emit(FIREWALL_BLOCKED);
    await flush(2_000);
    expect(mockNetInfo.refreshCalls).toBe(1);

    await runtime.setAppState('background');
    await flush(30 * 60_000);
    expect(mockNetInfo.refreshCalls).toBe(1);

    await runtime.setAppState('active');
    expect(mockNetInfo.refreshCalls).toBe(2);
    expect(runtime.onlineManager.isOnline()).toBe(false);

    await flush(2_000);
    expect(mockNetInfo.refreshCalls).toBe(3);
  });

  it('keeps an explicit isConnected=false offline and bounds the recheck budget per foreground', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    await flush();

    mockNetInfo.emit(FIREWALL_BLOCKED);
    await flush(60 * 60_000);
    expect(mockNetInfo.refreshCalls).toBe(10);
    expect(runtime.onlineManager.isOnline()).toBe(false);

    await runtime.setAppState('background');
    await runtime.setAppState('active');
    expect(mockNetInfo.refreshCalls).toBe(11);
    await flush(2_000);
    expect(mockNetInfo.refreshCalls).toBe(12);
    expect(runtime.onlineManager.isOnline()).toBe(false);
  });

  it('treats an unresolved NetInfo answer as provisionally online, per the offline.md contract', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    await flush();

    mockNetInfo.emit(FIREWALL_BLOCKED);
    mockNetInfo.changeSilently(UNRESOLVED);
    await runtime.setAppState('background');
    await runtime.setAppState('active');

    expect(runtime.onlineManager.isOnline()).toBe(true);
  });

  it('tears down timers, the NetInfo subscription and the AppState listener', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    await flush();
    mockNetInfo.emit(FIREWALL_BLOCKED);
    expect(mockNetInfo.listeners.size).toBe(1);

    runtime.onlineManager.setEventListener(() => undefined);

    expect(mockNetInfo.listeners.size).toBe(0);
    expect(runtime.removeAppStateListener).toHaveBeenCalledTimes(1);
    await flush(60 * 60_000);
    expect(mockNetInfo.refreshCalls).toBe(0);
  });

  it('leaves web on navigator.onLine without NetInfo or AppState', async () => {
    const runtime = loadRuntime('web');
    runtime.setupQueryOnlineManager();
    await flush(60_000);

    expect(runtime.appStateAddEventListener).not.toHaveBeenCalled();
    expect(mockNetInfo.listeners.size).toBe(0);
    expect(mockNetInfo.refreshCalls).toBe(0);
  });

  it('delivers the recovered state to useNetworkStatus (offline banner source) through the NetInfo fan-out', async () => {
    const runtime = loadRuntime();
    runtime.setupQueryOnlineManager();
    const { result } = renderHook(() => useNetworkStatus());
    await act(async () => {
      await flush();
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      await runtime.setAppState('background');
      mockNetInfo.emit(FIREWALL_BLOCKED);
    });
    expect(result.current.isConnected).toBe(false);

    mockNetInfo.changeSilently(WIFI_ONLINE);
    await act(async () => {
      await runtime.setAppState('active');
    });

    expect(result.current).toEqual({ isConnected: true, isInternetReachable: true, type: 'wifi' });
    expect(mockNetInfo.refreshCalls).toBe(1);
  });

  describe('diagnostic trace', () => {
    const diagnosticLines = (spy: jest.SpyInstance) =>
      spy.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith('[NET-DIAG]'));

    it('is silent without EXPO_PUBLIC_NETWORK_DIAGNOSTICS', async () => {
      const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const runtime = loadRuntime();
        runtime.setupQueryOnlineManager();
        mockNetInfo.emit(FIREWALL_BLOCKED);
        await runtime.setAppState('background');
        await runtime.setAppState('active');

        expect(diagnosticLines(info)).toEqual([]);
        expect(diagnosticLines(error)).toEqual([]);
      } finally {
        info.mockRestore();
        error.mockRestore();
      }
    });

    const withDevFlag = async (isDev: boolean, run: () => Promise<void>) => {
      const globalWithDev = globalThis as { __DEV__?: boolean };
      const originalDev = globalWithDev.__DEV__;
      globalWithDev.__DEV__ = isDev;
      try {
        await run();
      } finally {
        globalWithDev.__DEV__ = originalDev;
      }
    };

    it('traces NetInfo and AppState transitions to console.error in release, without network identifiers', async () => {
      process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS = '1';
      const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await withDevFlag(false, async () => {
          const runtime = loadRuntime();
          runtime.setupQueryOnlineManager();
          await flush();
          mockNetInfo.emit(FIREWALL_BLOCKED);
          mockNetInfo.changeSilently(WIFI_ONLINE);
          await runtime.setAppState('background');
          await runtime.setAppState('active');
        });

        // Release bundles keep only console.error (babel transform-remove-console).
        const lines = diagnosticLines(error);
        expect(lines).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^\[NET-DIAG\] netinfo \{"type":"none","isConnected":false/),
            '[NET-DIAG] online-manager {"online":false}',
            '[NET-DIAG] appstate {"from":"active","to":"background","online":false}',
            '[NET-DIAG] appstate {"from":"background","to":"active","online":false}',
            expect.stringMatching(/^\[NET-DIAG\] refresh-result \{"reason":"foreground","type":"wifi","isConnected":true/),
            '[NET-DIAG] online-manager {"online":true}',
          ]),
        );
        expect(lines.join('\n')).not.toMatch(/192\.168|ssid|home-net|ipAddress/);
        expect(diagnosticLines(info)).toEqual([]);
      } finally {
        info.mockRestore();
        error.mockRestore();
      }
    });

    it('goes through devLog in dev so the trace never raises LogBox', async () => {
      process.env.EXPO_PUBLIC_NETWORK_DIAGNOSTICS = 'true';
      const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await withDevFlag(true, async () => {
          const runtime = loadRuntime();
          runtime.setupQueryOnlineManager();
          await flush();
          await runtime.setAppState('background');
        });

        expect(diagnosticLines(info)).toContain(
          '[NET-DIAG] appstate {"from":"active","to":"background","online":true}',
        );
        expect(diagnosticLines(error)).toEqual([]);
      } finally {
        info.mockRestore();
        error.mockRestore();
      }
    });
  });
});
