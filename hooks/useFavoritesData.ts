// FE-ARCH D1 #994 — избранное на React Query.
// Заменяет stores/favoritesStore.ts (ручной _fetched/_userId кэш-движок + два
// AsyncStorage-ключа). Логика намеренно перенесена «как есть» (optimistic add/
// remove с откатом, in-flight дедуп, авторский travel=сервер / article=локально,
// гость=локально), только хранилище состояния поменялось с Zustand на RQ-кэш
// queryKeys.favorites(userId) + persistQueryClient (whitelist 'favorites', #1015).
// Так убирается «параллельный движок» без изменения поведения фичи.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/api/queryKeys';
import { getActiveQueryClient } from '@/api/activeQueryClient';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';
import { clearUserFavorites, fetchUserFavoriteTravels } from '@/api/user';
import { isValidFavoriteId } from '@/utils/favoritesCleanup';
import { normalizeServerTravelCards } from '@/utils/normalizeServerTravelItem';

export type FavoriteItem = {
  id: string | number;
  type: 'travel' | 'article';
  title: string;
  imageUrl?: string;
  url: string;
  addedAt: number;
  country?: string;
  city?: string;
};

type Auth = { isAuthenticated: boolean; userId: string | null };

const EMPTY: FavoriteItem[] = [];

// Дедуп конкурентных тапов по одному айтему внутри одной auth identity.
const inFlightKeys = new Set<string>();

const getInFlightKey = (
  userId: string | null,
  type: FavoriteItem['type'],
  id: number | string,
): string => `${userId ?? 'guest'}:${type}:${String(id)}`;

const readFavorites = (userId: string | null): FavoriteItem[] =>
  getActiveQueryClient()?.getQueryData<FavoriteItem[]>(queryKeys.favorites(userId)) ?? [];

const writeFavorites = (userId: string | null, items: FavoriteItem[]): void => {
  getActiveQueryClient()?.setQueryData(queryKeys.favorites(userId), items);
};

const toFavoriteItems = (dto: unknown): FavoriteItem[] =>
  normalizeServerTravelCards(dto).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    url: n.url,
    imageUrl: n.imageUrl,
    addedAt: n.timestamp,
    country: n.country,
  }));

/**
 * Сервер владеет только travel-избранным. Article favorites остаются локальными
 * и поэтому должны переживать любой server refresh того же user-scoped ключа.
 */
export const mergeServerTravelFavorites = (
  current: FavoriteItem[],
  serverTravels: FavoriteItem[],
): FavoriteItem[] => [
  ...serverTravels,
  ...current.filter((item) => item.type === 'article'),
];

/**
 * queryFn избранного: авторизованному — актуальный серверный список travel
 * плюс сохранённые локальные article favorites; гостю — текущий локальный кэш.
 */
export const favoritesQueryFn =
  (userId: string | null) => async (): Promise<FavoriteItem[]> => {
    if (!userId) return readFavorites(null);
    const serverTravels = toFavoriteItems(await fetchUserFavoriteTravels(userId));
    return mergeServerTravelFavorites(readFavorites(userId), serverTravels);
  };

/** Форс-рефетч серверного избранного (best-effort sync после мутации / refresh). */
export const refreshFavoritesFromServer = async (userId: string | null): Promise<void> => {
  const client = getActiveQueryClient();
  if (!client || !userId) return;
  await client.fetchQuery({
    queryKey: queryKeys.favorites(userId),
    queryFn: favoritesQueryFn(userId),
    staleTime: 0,
  });
};

/**
 * Реактивное чтение избранного. enabled:false — авто-фетча нет (как и раньше:
 * список наполняют мутации + ленивый ensureFavoritesServerData, а не каждый
 * рендер сердечка).
 */
export function useFavoritesData(): FavoriteItem[] {
  const { userId } = useAuth();
  const { data } = useQuery({
    queryKey: queryKeys.favorites(userId ?? null),
    queryFn: favoritesQueryFn(userId ?? null),
    enabled: false,
  });
  return data ?? EMPTY;
}

export const isFavoriteInCache = (
  userId: string | null,
  id: number | string,
  type: FavoriteItem['type'],
): boolean => readFavorites(userId).some((f) => f.id === id && f.type === type);

/** Ленивый догруз серверного избранного (замена ensureServerData('favorites')). */
export async function ensureFavoritesServerData(userId: string | null): Promise<void> {
  const client = getActiveQueryClient();
  if (!client || !userId) return;
  await client.fetchQuery({
    queryKey: queryKeys.favorites(userId),
    queryFn: favoritesQueryFn(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export async function addFavorite(item: Omit<FavoriteItem, 'addedAt'>, { userId }: Auth): Promise<void> {
  const inflightKey = getInFlightKey(userId, item.type, item.id);
  if (inFlightKeys.has(inflightKey)) return;
  inFlightKeys.add(inflightKey);

  // Авторский travel — серверный путь с оптимистичным добавлением и откатом.
  if (userId && item.type === 'travel') {
    if (readFavorites(userId).some((f) => f.id === item.id && f.type === item.type)) {
      inFlightKeys.delete(inflightKey);
      return;
    }

    const optimistic: FavoriteItem = { ...item, addedAt: Date.now() };
    writeFavorites(userId, [...readFavorites(userId), optimistic]);

    try {
      await markTravelAsFavorite(item.id);
    } catch (error) {
      writeFavorites(userId, readFavorites(userId).filter((f) => !(f.id === item.id && f.type === item.type)));
      inFlightKeys.delete(inflightKey);
      throw error;
    }

    // Best-effort sync: добавление уже прошло на сервере, поэтому сбой рефетча
    // не откатывает и не показывает ошибку.
    try {
      await refreshFavoritesFromServer(userId);
    } catch {
      // ignore — оптимистичное состояние уже отражает добавление
    }
    inFlightKeys.delete(inflightKey);
    return;
  }

  // Гость или article — локальный путь (RQ-кэш + persist).
  if (!isValidFavoriteId(item.id)) {
    console.warn(`Suspicious favorite ID detected: ${item.id} (looks like HTTP error code), продолжим сохранение`);
  }
  const scoped = userId ?? null;
  if (readFavorites(scoped).some((f) => f.id === item.id && f.type === item.type)) {
    inFlightKeys.delete(inflightKey);
    return;
  }
  try {
    writeFavorites(scoped, [...readFavorites(scoped), { ...item, addedAt: Date.now() }]);
  } finally {
    inFlightKeys.delete(inflightKey);
  }
}

export async function removeFavorite(
  id: number | string,
  type: FavoriteItem['type'] = 'travel',
  { userId }: Auth,
): Promise<void> {
  const inflightKey = getInFlightKey(userId, type, id);
  if (inFlightKeys.has(inflightKey)) return;
  inFlightKeys.add(inflightKey);

  if (userId) {
    const before = readFavorites(userId);
    writeFavorites(userId, before.filter((f) => !(f.id === id && f.type === type)));

    if (type === 'travel') {
      try {
        await unmarkTravelAsFavorite(id);
      } catch (error) {
        writeFavorites(userId, before);
        inFlightKeys.delete(inflightKey);
        throw error;
      }

      // Best-effort sync: удаление уже прошло на сервере, сбой рефетча не откатывает.
      try {
        await refreshFavoritesFromServer(userId);
      } catch {
        // ignore — оптимистичное состояние уже отражает удаление
      }
    }
    inFlightKeys.delete(inflightKey);
    return;
  }

  if (!isValidFavoriteId(id)) {
    console.warn(`Suspicious favorite ID detected on remove: ${id} (looks like HTTP error code), продолжим удаление`);
  }
  try {
    writeFavorites(null, readFavorites(null).filter((f) => !(f.id === id && f.type === type)));
  } finally {
    inFlightKeys.delete(inflightKey);
  }
}

export async function clearFavorites({ isAuthenticated, userId }: Auth): Promise<void> {
  if (isAuthenticated && userId) {
    await clearUserFavorites(userId);
    writeFavorites(userId, []);
    return;
  }
  writeFavorites(userId ?? null, []);
}
