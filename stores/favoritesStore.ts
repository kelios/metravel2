import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';
import { cleanupInvalidFavorites, isValidFavoriteId } from '@/utils/favoritesCleanup';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';
import { clearUserFavorites, fetchUserFavoriteTravels } from '@/api/user';
import { getGuestFavoritesStorageKey } from '@/utils/guestTrialState';
import { translate as i18nT } from '@/i18n';

const SERVER_FAVORITES_CACHE_KEY = 'metravel_favorites_server';

const inFlightKeys = new Set<string>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeCachedFavoriteItem = (item: unknown): FavoriteItem | null => {
    if (!isRecord(item)) return null;

    const id = item.id;
    const type = item.type;
    const title = item.title;
    const url = item.url;
    const addedAt = Number(item.addedAt);

    if ((typeof id !== 'string' && typeof id !== 'number') || (type !== 'travel' && type !== 'article')) {
        return null;
    }

    if (typeof title !== 'string' || typeof url !== 'string' || !Number.isFinite(addedAt)) {
        return null;
    }

    return {
        id,
        type,
        title,
        url,
        addedAt,
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
        country:
            typeof item.country === 'string'
                ? item.country
                : typeof item.countryName === 'string'
                  ? item.countryName
                  : undefined,
        city: typeof item.city === 'string' ? item.city : undefined,
    };
};

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

interface FavoritesState {
    favorites: FavoriteItem[];
    _inFlight: Set<string>;
    _fetched: boolean;
    _userId: string | null;

    isFavorite: (id: number | string, type: FavoriteItem['type']) => boolean;
    addFavorite: (item: Omit<FavoriteItem, 'addedAt'>, auth: { isAuthenticated: boolean; userId: string | null }) => Promise<void>;
    removeFavorite: (id: number | string, type: FavoriteItem['type'] | undefined, auth: { isAuthenticated: boolean; userId: string | null }) => Promise<void>;
    clearFavorites: (auth: { isAuthenticated: boolean; userId: string | null }) => Promise<void>;
    loadLocal: (userId: string | null) => Promise<void>;
    loadServerCached: (userId: string | null) => Promise<void>;
    refreshFromServer: (userId: string | null) => Promise<boolean>;
    ensureServerData: (userId: string | null) => Promise<void>;
    resetFetchState: (userId: string | null) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
    favorites: [],
    _inFlight: new Set(),
    _fetched: false,
    _userId: null,

    isFavorite: (id, type) => {
        return get().favorites.some((f) => f.id === id && f.type === type);
    },

    addFavorite: async (item, { userId }) => {
        const inflightKey = `${item.type}:${String(item.id)}`;
        if (inFlightKeys.has(inflightKey)) return;

        inFlightKeys.add(inflightKey);

        if (userId && item.type === 'travel') {
            const existing = get().favorites.find((f) => f.id === item.id && f.type === item.type);
            if (existing) {
                inFlightKeys.delete(inflightKey);
                return;
            }

            const optimistic: FavoriteItem = { ...item, addedAt: Date.now() };
            set((s) => ({ favorites: [...s.favorites, optimistic] }));

            try {
                await markTravelAsFavorite(item.id);
            } catch (error) {
                set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === item.id && f.type === item.type)) }));
                inFlightKeys.delete(inflightKey);
                throw error;
            }

            // Best-effort sync: the add already succeeded server-side, so a failing
            // refresh must not roll back or surface an error to the user.
            try {
                await get().refreshFromServer(userId);
            } catch {
                // ignore — optimistic state already reflects the addition
            }

            inFlightKeys.delete(inflightKey);
            return;
        }

        if (!isValidFavoriteId(item.id)) {
            console.warn(`Suspicious favorite ID detected: ${item.id} (looks like HTTP error code), продолжим сохранение`);
        }

        const existingFavorite = get().favorites.find((f) => f.id === item.id && f.type === item.type);
        if (existingFavorite) {
            inFlightKeys.delete(inflightKey);
            return;
        }

        const newFavorite: FavoriteItem = { ...item, addedAt: Date.now() };
        const newFavorites = [...get().favorites, newFavorite];

        try {
            const key = getGuestFavoritesStorageKey(userId);
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            set({ favorites: newFavorites });
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            throw error;
        } finally {
            inFlightKeys.delete(inflightKey);
        }
    },

    removeFavorite: async (id, type = 'travel', { userId }) => {
        const inflightKey = `${type}:${String(id)}`;
        if (inFlightKeys.has(inflightKey)) return;

        inFlightKeys.add(inflightKey);

        if (userId) {
            const before = get().favorites;
            set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === id && f.type === type)) }));

            try {
                if (type === 'travel') {
                    await unmarkTravelAsFavorite(id);
                }
            } catch (error) {
                set({ favorites: before });
                inFlightKeys.delete(inflightKey);
                throw error;
            }

            // Best-effort sync: the removal already succeeded server-side, so a
            // failing refresh must NOT roll back or surface an error to the user
            // (was the cause of «не могу убрать из избранного, пишет ошибку»).
            try {
                await get().refreshFromServer(userId);
            } catch {
                // ignore — optimistic state already reflects the removal
            }

            inFlightKeys.delete(inflightKey);
            return;
        }

        if (!isValidFavoriteId(id)) {
            console.warn(`Suspicious favorite ID detected on remove: ${id} (looks like HTTP error code), продолжим удаление`);
        }

        try {
            const key = getGuestFavoritesStorageKey(userId);
            const newFavorites = get().favorites.filter((f) => !(f.id === id && f.type === type));
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === id && f.type === type)) }));
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            throw error;
        } finally {
            inFlightKeys.delete(inflightKey);
        }
    },

    clearFavorites: async ({ isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            await clearUserFavorites(userId);
            set({ favorites: [] });
            await AsyncStorage.setItem(`${SERVER_FAVORITES_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }
        const key = getGuestFavoritesStorageKey(userId);
        await AsyncStorage.setItem(key, JSON.stringify([]));
        set({ favorites: [] });
    },

    loadLocal: async (userId) => {
        try {
            const key = getGuestFavoritesStorageKey(userId);
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const parsed = safeJsonParseString(data, []);
                set({ favorites: cleanupInvalidFavorites(Array.isArray(parsed) ? parsed : []) });
            }
        } catch (error) {
            devError('Ошибка загрузки избранного:', error);
        }
    },

    loadServerCached: async (userId) => {
        if (!userId) return;
        try {
            const key = `${SERVER_FAVORITES_CACHE_KEY}_${userId}`;
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const parsed = safeJsonParseString(raw, []);
                const normalized = (Array.isArray(parsed) ? parsed : [])
                    .map(normalizeCachedFavoriteItem)
                    .filter((item): item is FavoriteItem => item !== null);
                set({ favorites: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша избранного:', error);
        }
    },

    refreshFromServer: async (userId) => {
        if (!userId) return false;
        try {
            const favDto = await fetchUserFavoriteTravels(userId);
            const favArr = Array.isArray(favDto) ? favDto : [];
            const userFavorites: FavoriteItem[] = favArr.map((t) => ({
                id: t.id,
                type: 'travel' as const,
                title: t.name || i18nT('errorsStatic:stores.content.untitled'),
                url: t.slug ? `/travels/${t.slug}` : (t.url ? String(t.url).split('?')[0].split('#')[0] : `/travels/${t.id}`),
                imageUrl: t.travel_image_thumb_url,
                addedAt: (() => {
                    const t0 = t.updated_at ? new Date(t.updated_at).getTime() : NaN;
                    return Number.isFinite(t0) ? t0 : Date.now();
                })(),
                country: t.countryName ?? undefined,
            }));

            set({ favorites: userFavorites });
            await AsyncStorage.setItem(`${SERVER_FAVORITES_CACHE_KEY}_${userId}`, JSON.stringify(userFavorites));
            return true;
        } catch (error) {
            devError('Ошибка обновления избранного с сервера:', error);
            return false;
        }
    },

    ensureServerData: async (userId) => {
        if (!userId) return;
        const state = get();
        if (state._userId !== userId) {
            set({ _fetched: false, _userId: userId });
        }
        if (get()._fetched) return;
        // Mark as fetched only after a successful refresh, otherwise a failed
        // network call (common on native cold start) would permanently block
        // retries and leave shelves/collections empty despite real data.
        const ok = await get().refreshFromServer(userId);
        if (ok) set({ _fetched: true, _userId: userId });
    },

    resetFetchState: (userId) => {
        set({ _fetched: false, _userId: userId });
    },
}));
