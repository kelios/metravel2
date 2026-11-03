import { Platform } from 'react-native';

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

jest.mock('@/utils/publicStaleCache', () => ({
  getPublicStalePayloadMeta: () => null,
  isRecoverablePublicStaleError: () => false,
  markPublicStalePayload: (travel: unknown) => travel,
  readPublicStalePayload: jest.fn(async () => null),
  savePublicStalePayload: jest.fn(async () => undefined),
}));

import { apiClient } from '@/api/client';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
import { resetAuthStoreForTests, useAuthStore } from '@/stores/authStore';
import { savePublicStalePayload } from '@/utils/publicStaleCache';

const mockGet = apiClient.get as jest.Mock;

const travelPayload = (id: number) => ({
  id,
  name: `Travel ${id}`,
  slug: `travel-${id}`,
  description: '<p>text</p>',
});

describe('travelDetailsQueries guest memory cache (API-3)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web';
    resetAuthStoreForTests();
    mockGet.mockReset();
    mockGet.mockImplementation(async (endpoint: string) => {
      const id = Number(endpoint.match(/\/travels\/(\d+)\//)?.[1]);
      return travelPayload(id);
    });
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalPlatform;
    resetAuthStoreForTests();
  });

  it('caches for guests only, bypasses the cache for a signed-in web session and drops it on identity change', async () => {
    // Guest: the second read is served from memory.
    useAuthStore.setState({ authReady: true, isAuthenticated: false, userId: null });
    await fetchTravel(101);
    await fetchTravel(101);
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Signed in on web: the token store is empty (HttpOnly cookie), so the auth
    // store must decide. Every read goes to the server; nothing is cached, and
    // the guest copy made before sign-in is forgotten.
    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: '7' });
    await fetchTravel(101);
    await fetchTravel(101);
    expect(mockGet).toHaveBeenCalledTimes(3);

    // Signed out in the same tab: whatever was cached meanwhile is dropped, the
    // next guest read refetches and then caches again.
    useAuthStore.setState({ isAuthenticated: false, userId: null });
    await fetchTravel(101);
    expect(mockGet).toHaveBeenCalledTimes(4);
    await fetchTravel(101);
    expect(mockGet).toHaveBeenCalledTimes(4);
  });

  it('switching between two accounts never serves the previous account a cached copy', async () => {
    useAuthStore.setState({ authReady: true, isAuthenticated: false, userId: null });
    await fetchTravel(202);
    expect(mockGet).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: '1' });
    await fetchTravel(202);
    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: '2' });
    await fetchTravel(202);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('keeps the shared slug transport alive for remaining observers', async () => {
    const first = new AbortController();
    const second = new AbortController();
    let resolveRequest!: (travel: ReturnType<typeof travelPayload>) => void;
    mockGet.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));

    const canceled = expect(fetchTravelBySlug('shared-slug', { signal: first.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    const remaining = fetchTravelBySlug('shared-slug', { signal: second.signal });
    await Promise.resolve();
    expect(mockGet).toHaveBeenCalledTimes(1);
    const transport = mockGet.mock.calls[0][2].signal as AbortSignal;
    first.abort();
    await canceled;
    expect(transport.aborted).toBe(false);

    resolveRequest(travelPayload(303));
    await expect(remaining).resolves.toMatchObject({ id: 303 });
  });

  it('aborts the last observer and ignores late failure while a new request proceeds', async () => {
    const first = new AbortController();
    let rejectOld!: (error: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }));

    const canceled = expect(fetchTravelBySlug('replaced-slug', { signal: first.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    const transport = mockGet.mock.calls[0][2].signal as AbortSignal;
    first.abort();
    await canceled;
    expect(transport.aborted).toBe(true);

    mockGet.mockResolvedValueOnce(travelPayload(404));
    const replacement = fetchTravelBySlug('replaced-slug');
    rejectOld(Object.assign(new Error('late 502'), { status: 502 }));
    await expect(replacement).resolves.toMatchObject({ id: 404 });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('keeps a guest resolver detail follow-up public across sign-in', async () => {
    let resolveLookup!: (result: { id: number; slug: string }) => void;
    mockGet.mockReturnValueOnce(new Promise((resolve) => { resolveLookup = resolve; }));
    const request = fetchTravelBySlug('session-switch-slug');
    await Promise.resolve();
    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: 'signed-in' });

    resolveLookup({ id: 707, slug: 'session-switch-slug' });

    await expect(request).resolves.toMatchObject({ id: 707 });
    expect(mockGet.mock.calls.map(([path, , options]) => [path, options.skipAuth])).toEqual([
      ['/travels/resolve-slug/session-switch-slug/', true],
      ['/travels/707/', true],
    ]);
  });

  it('detaches when the observer aborts during synchronous transport setup', async () => {
    const caller = new AbortController();
    let transportSignal: AbortSignal | undefined;
    mockGet.mockImplementationOnce((_path, _timeout, options) => {
      transportSignal = options.signal;
      caller.abort();
      return new Promise(() => {});
    });

    await expect(fetchTravelBySlug('cancel-during-setup', { signal: caller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(transportSignal?.aborted).toBe(true);
  });

  it('does not persist an exact fallback that finishes after the observer canceled', async () => {
    const caller = new AbortController();
    let finishExact!: (result: ReturnType<typeof travelPayload>) => void;
    let exactStarted!: () => void;
    const exactReady = new Promise<void>((resolve) => { exactStarted = resolve; });
    mockGet.mockRejectedValueOnce(Object.assign(new Error('502'), { status: 502 }));
    mockGet.mockImplementationOnce(() => {
      exactStarted();
      return new Promise((resolve) => { finishExact = resolve; });
    });
    jest.mocked(savePublicStalePayload).mockClear();
    const canceled = expect(fetchTravelBySlug('canceled-exact', { signal: caller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    await exactReady;
    caller.abort();
    await canceled;
    finishExact(travelPayload(808));
    await Promise.resolve();
    await Promise.resolve();
    expect(savePublicStalePayload).not.toHaveBeenCalled();
  });

});
