// hooks/useOfflineTravelCache.ts
// Compatibility facade for the former AsyncStorage-only travel cache.
// OfflineCatalog now owns persistence, LRU policy and web/native parity.

import { useCallback } from 'react';
import { Platform } from 'react-native';
import type { Travel } from '@/types/types';
import { loadTravelOfflineAdapter } from '@/services/offline/loadTravelOfflineAdapter';

// #1552: все три функции ниже асинхронные, а вызываются только по действию
// пользователя или после первого экрана, поэтому статический импорт им не нужен —
// `await import(...)` внутри async-функции даёт настоящую границу чанка.
//
// #1552 разрывает все три прежних статических ребра к адаптеру. Сам import()
// живёт в одном `loadTravelOfflineAdapter`, чтобы Metro видел один async-корень
// и не переразбивал граф при добавлении новых потребителей (#1393/#1543).
type OfflineCatalogModule = typeof import('@/services/offline/offlineCatalog');

const loadOfflineCatalog = (): Promise<OfflineCatalogModule> =>
  import('@/services/offline/offlineCatalog');

export async function cacheTravelOffline(id: number | string, data: unknown, isNative: boolean) {
  void isNative;
  if (!id || !data || typeof data !== 'object') return;
  const travel = data as Travel;
  const sourceId = travel.id ?? travel.slug ?? id;
  const { offlineCatalog } = await loadOfflineCatalog();
  const existing = await offlineCatalog.get(`travel:${String(sourceId).trim()}`);

  // Opening a detail screen refreshes the lightweight "recent" fallback in
  // the background. It must never replace a user-pinned package (and its
  // downloaded photos) with the text-only recent snapshot.
  if (existing?.pinned && existing.status === 'ready') return;

  const { saveTravelOffline } = await loadTravelOfflineAdapter();
  await saveTravelOffline(travel, { routeParam: id });
}

export async function getOfflineTravelCached(id: number | string, isNative: boolean): Promise<unknown | null> {
  void isNative;
  if (!id) return null;
  const { readTravelOffline } = await loadTravelOfflineAdapter();
  return readTravelOffline(id);
}

export async function getOfflineTravelCachedIds(isNative: boolean): Promise<string[]> {
  void isNative;
  const { offlineCatalog } = await loadOfflineCatalog();
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
