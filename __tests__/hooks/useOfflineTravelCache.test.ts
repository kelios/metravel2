// __tests__/hooks/useOfflineTravelCache.test.ts
// AND-10: Tests for offline travel caching hook

import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const mockOfflinePackages = new Map<string, unknown>();

jest.mock('@/services/offline/packageStore', () => ({
  __esModule: true,
  default: {
    read: jest.fn(async (key: string) => mockOfflinePackages.get(key) ?? null),
    write: jest.fn(async (key: string, payload: unknown) => {
      mockOfflinePackages.set(key, payload);
      return { bytes: JSON.stringify(payload).length, includesAssetBytes: true };
    }),
    remove: jest.fn(async (key: string) => {
      mockOfflinePackages.delete(key);
    }),
  },
}));

import {
  cacheTravelOffline,
  getOfflineTravelCached,
  useOfflineTravelCache,
} from '@/hooks/useOfflineTravelCache';
import { offlineCatalog } from '@/services/offline/offlineCatalog';
import { saveTravelOffline } from '@/services/offline/travelOfflineAdapter';
import type { Travel } from '@/types/types';

describe('useOfflineTravelCache', () => {
  beforeEach(async () => {
    mockOfflinePackages.clear();
    await AsyncStorage.clear();
    // @ts-ignore -- override Platform.OS for native test scenario
    Platform.OS = 'android';
  });

  afterEach(() => {
    // @ts-ignore -- restore Platform.OS default for test isolation
    Platform.OS = 'web';
  });

  it('caches a travel and retrieves it', async () => {
    const { result } = renderHook(() => useOfflineTravelCache());

    const mockTravel = { id: 42, name: 'Test Travel', description: 'A test' };

    await act(async () => {
      await result.current.cacheTravel(42, mockTravel);
    });

    let cached: unknown = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(42);
    });

    expect(cached).toEqual(expect.objectContaining({
      ...mockTravel,
      schemaVersion: 1,
      descriptionHtml: 'A test',
    }));
  });

  it('returns null for non-cached travel', async () => {
    const { result } = renderHook(() => useOfflineTravelCache());

    let cached: unknown = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(999);
    });

    expect(cached).toBeNull();
  });

  it('does not downgrade a pinned package during background recent caching', async () => {
    const pinnedTravel = {
      id: 77,
      name: 'Pinned travel',
      description: 'Pinned snapshot',
    } as Travel;
    await saveTravelOffline(pinnedTravel, { pinned: true, includePhotos: false });

    await cacheTravelOffline(77, {
      ...pinnedTravel,
      name: 'Background refresh',
      description: 'Lightweight recent snapshot',
    }, true);

    const cached = await getOfflineTravelCached(77, true);
    const manifest = await offlineCatalog.get('travel:77');
    expect(cached).toEqual(expect.objectContaining({
      name: 'Pinned travel',
      description: 'Pinned snapshot',
    }));
    expect(manifest).toEqual(expect.objectContaining({
      pinned: true,
      includePhotos: false,
    }));
  });

  it('maintains index of cached IDs', async () => {
    const { result } = renderHook(() => useOfflineTravelCache());

    await act(async () => {
      await result.current.cacheTravel(1, { id: 1, name: 'First' });
      await result.current.cacheTravel(2, { id: 2, name: 'Second' });
    });

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.getCachedIds();
    });

    expect(ids).toEqual(['1', '2']);
  });

  it('deduplicates IDs in index when same travel cached again', async () => {
    const { result } = renderHook(() => useOfflineTravelCache());

    await act(async () => {
      await result.current.cacheTravel(1, { id: 1, name: 'First' });
      await result.current.cacheTravel(2, { id: 2, name: 'Second' });
      await result.current.cacheTravel(1, { id: 1, name: 'First Updated' });
    });

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.getCachedIds();
    });

    // 1 should be moved to the end
    expect(ids).toEqual(['2', '1']);

    // Updated data should be returned
    let cached: any = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(1);
    });
    expect(cached?.name).toBe('First Updated');
  });

  it('uses the same catalog contract on mobile web', async () => {
    // @ts-ignore -- override Platform.OS to test web no-op behavior
    Platform.OS = 'web';

    const { result } = renderHook(() => useOfflineTravelCache());

    await act(async () => {
      await result.current.cacheTravel(1, { id: 1, name: 'Web travel' });
    });

    let cached: unknown = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(1);
    });

    expect(cached).toEqual(expect.objectContaining({
      id: 1,
      name: 'Web travel',
      schemaVersion: 1,
    }));

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.getCachedIds();
    });

    expect(ids).toEqual(['1']);
  });
});
