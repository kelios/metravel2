// hooks/useOfflineTravelCache.ts
// AND-10: Offline travel cache — кэширует просмотренные маршруты
// для offline-доступа через AsyncStorage. FIFO, лимит 20 маршрутов.

import { useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_INDEX_KEY = 'offline_travel_ids';
const CACHE_PREFIX = 'offline_travel_';
const MAX_CACHED_TRAVELS = 20;

export async function cacheTravelOffline(id: number | string, data: unknown, isNative: boolean) {
  if (!isNative || !id || !data) return;

  try {
    const key = `${CACHE_PREFIX}${id}`;
    const serialized = JSON.stringify(data);

    await AsyncStorage.setItem(key, serialized);

    const indexRaw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    let ids: string[] = [];
    try {
      ids = indexRaw ? JSON.parse(indexRaw) : [];
    } catch {
      ids = [];
    }

    const idStr = String(id);
    ids = ids.filter((i) => i !== idStr);
    ids.push(idStr);

    while (ids.length > MAX_CACHED_TRAVELS) {
      const removed = ids.shift();
      if (removed) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${removed}`).catch(() => {});
      }
    }

    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(ids));
  } catch {
    // Не критично — продолжаем без кэша
  }
}

export async function getOfflineTravelCached(id: number | string, isNative: boolean): Promise<unknown | null> {
  if (!isNative || !id) return null;

  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getOfflineTravelCachedIds(isNative: boolean): Promise<string[]> {
  if (!isNative) return [];

  try {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * AND-10: Хук для кэширования маршрутов для offline-просмотра.
 *
 * - `cacheTravel(id, data)` — сохраняет данные маршрута в AsyncStorage
 * - `getCachedTravel(id)` — возвращает данные из кэша (или null)
 * - `getCachedIds()` — возвращает массив кэшированных ID
 *
 * На web — no-op (веб работает только при наличии сети).
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
