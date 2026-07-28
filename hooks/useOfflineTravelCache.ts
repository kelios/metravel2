// hooks/useOfflineTravelCache.ts
// Compatibility facade for the former AsyncStorage-only travel cache.
// OfflineCatalog now owns persistence, LRU policy and web/native parity.

import { useCallback } from 'react';
import { Platform } from 'react-native';
import type { Travel } from '@/types/types';
import { offlineCatalog } from '@/services/offline/offlineCatalog';
import { readTravelOffline, saveTravelOffline } from '@/services/offline/travelOfflineAdapter';

export async function cacheTravelOffline(id: number | string, data: unknown, isNative: boolean) {
  void isNative;
  if (!id || !data || typeof data !== 'object') return;
  await saveTravelOffline(data as Travel, { routeParam: id });
}

export async function getOfflineTravelCached(id: number | string, isNative: boolean): Promise<unknown | null> {
  void isNative;
  if (!id) return null;
  return readTravelOffline(id);
}

export async function getOfflineTravelCachedIds(isNative: boolean): Promise<string[]> {
  void isNative;
  const items = await offlineCatalog.list();
  return items
    .filter((item) => item.type === 'travel' && item.status === 'ready')
    .sort((left, right) => left.lastOpenedAt - right.lastOpenedAt)
    .map((item) => item.sourceId);
}

/**
 * AND-10: Хук для кэширования маршрутов для offline-просмотра.
 *
 * - `cacheTravel(id, data)` — сохраняет данные маршрута в AsyncStorage
 * - `getCachedTravel(id)` — возвращает данные из кэша (или null)
 * - `getCachedIds()` — возвращает массив кэшированных ID
 *
 * На web используется IndexedDB; Service Worker и offline shell не добавляются.
 */
export function useOfflineTravelCache() {
  const isNative = Platform.OS !== 'web';

  const cacheTravel = useCallback(async (id: number | string, data: unknown) => {
    await cacheTravelOffline(id, data, isNative);
  }, [isNative]);

  const getCachedTravel = useCallback(async (id: number | string): Promise<unknown | null> => {
    return getOfflineTravelCached(id, isNative);
  }, [isNative]);

  const getCachedIds = useCallback(async (): Promise<string[]> => {
    return getOfflineTravelCachedIds(isNative);
  }, [isNative]);

  return { cacheTravel, getCachedTravel, getCachedIds };
}
