/** @jest-environment node */

import { QueryClient, QueryObserver, timeoutManager } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { getActiveQueryClient, setActiveQueryClient } from '@/api/activeQueryClient';
import { createOptimizedQueryClient } from '@/utils/reactQueryConfig';
import { setupQueryOnlineManager } from '@/utils/queryOnlineManager';
import { setupQueryFocusManager } from '@/utils/queryFocusManager';

jest.mock('@/utils/queryOnlineManager', () => ({ setupQueryOnlineManager: jest.fn() }));
jest.mock('@/utils/queryFocusManager', () => ({ setupQueryFocusManager: jest.fn() }));

describe('request-owned SSR QueryClient (#2767)', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalPlatformOS = Platform.OS;
  const clients: QueryClient[] = [];
  const createClient = () => {
    const client = createOptimizedQueryClient({
      queries: { gcTime: 1234 },
      mutations: { gcTime: 1234 },
    });
    clients.push(client);
    return client;
  };

  beforeEach(() => {
    delete (globalThis as { window?: unknown }).window;
    Platform.OS = 'web';
    jest.clearAllMocks();
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    Platform.OS = originalPlatformOS;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  });

  it('creates no GC timeout for hook-level options, even after observer teardown', () => {
    const schedule = jest.spyOn(timeoutManager, 'setTimeout');
    const client = createClient();
    const observer = new QueryObserver(client, {
      queryKey: ['travel', 'article'],
      initialData: { description: 'request-local document' },
      gcTime: 10 * 60 * 1000,
    });
    const query = observer.getCurrentQuery();

    // Later direct updates cannot reduce the initial Infinity in TanStack's
    // Removable.updateGcTime; teardown also must not retain this render.
    query.setOptions({ queryKey: query.queryKey, gcTime: 600_000 });
    observer.destroy();

    expect(query.gcTime).toBe(Infinity);
    expect(client.getDefaultOptions().queries?.gcTime).toBe(Infinity);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('also enforces timer-free mutations and already-defaulted options', () => {
    const schedule = jest.spyOn(timeoutManager, 'setTimeout');
    const client = createClient();
    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['request-local'],
      gcTime: 600_000,
      _defaulted: true,
    });

    expect(client.defaultQueryOptions({
      queryKey: ['defaulted'], gcTime: 600_000, _defaulted: true,
    }).gcTime).toBe(Infinity);
    expect(mutation.gcTime).toBe(Infinity);
    expect(client.getDefaultOptions().mutations?.gcTime).toBe(Infinity);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('keeps request caches isolated and does not register process-wide listeners or client', () => {
    const first = createClient();
    const second = createClient();
    first.setQueryData(['profile'], { id: 'first-request' });
    setActiveQueryClient(first);
    setActiveQueryClient(second);

    expect(second.getQueryData(['profile'])).toBeUndefined();
    expect(getActiveQueryClient()).toBeNull();
    expect(setupQueryOnlineManager).not.toHaveBeenCalled();
    expect(setupQueryFocusManager).not.toHaveBeenCalled();
  });

  it.each(['android', 'ios'] as const)('preserves finite cache policy and imperative client on %s without window', (os) => {
    Platform.OS = os;
    const client = createClient();
    const query = client.getQueryCache().build(client, {
      queryKey: ['native'], gcTime: 4321,
    });
    setActiveQueryClient(client);

    expect(query.gcTime).toBe(4321);
    expect(client.getDefaultOptions().queries?.gcTime).toBe(1234);
    expect(getActiveQueryClient()).toBe(client);
    expect(setupQueryOnlineManager).toHaveBeenCalledTimes(1);
    expect(setupQueryFocusManager).toHaveBeenCalledTimes(1);
    setActiveQueryClient(null);
  });
});
