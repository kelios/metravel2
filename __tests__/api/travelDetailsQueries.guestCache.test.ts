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
import { fetchTravel } from '@/api/travelDetailsQueries';
import { resetAuthStoreForTests, useAuthStore } from '@/stores/authStore';

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
});
