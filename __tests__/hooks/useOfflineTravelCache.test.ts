// __tests__/hooks/useOfflineTravelCache.test.ts
// AND-10: Tests for offline travel caching hook

import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useOfflineTravelCache } from '@/hooks/useOfflineTravelCache';

describe('useOfflineTravelCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // @ts-ignore — override Platform for tests
    Platform.OS = 'android';
  });

  afterEach(() => {
    // @ts-ignore
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

    expect(cached).toEqual(mockTravel);
  });

  it('returns null for non-cached travel', async () => {
    const { result } = renderHook(() => useOfflineTravelCache());

    let cached: unknown = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(999);
    });

    expect(cached).toBeNull();
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

  it('is a no-op on web', async () => {
    // @ts-ignore
    Platform.OS = 'web';

    const { result } = renderHook(() => useOfflineTravelCache());

    await act(async () => {
      await result.current.cacheTravel(1, { id: 1 });
    });

    let cached: unknown = null;
    await act(async () => {
      cached = await result.current.getCachedTravel(1);
    });

    expect(cached).toBeNull();

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.getCachedIds();
    });

    expect(ids).toEqual([]);
  });
});

