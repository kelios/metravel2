import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';
import { fetchUserFavoriteTravels, clearUserFavorites } from '@/api/user';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';
import { cleanupInvalidFavorites, isValidFavoriteId } from '@/utils/favoritesCleanup';
import { showToast } from '@/utils/toast';

const FAVORITES_KEY = 'metravel_favorites';
const SERVER_FAVORITES_CACHE_KEY = 'metravel_favorites_server';

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
    refreshFromServer: (userId: string | null) => Promise<void>;
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

    addFavorite: async (item, { isAuthenticated, userId }) => {
        if (!isAuthenticated) {
            throw new Error('AUTH_REQUIRED');
        }

        const inflightKey = `${item.type}:${String(item.id)}`;
        const inFlight = get()._inFlight;
        if (inFlight.has(inflightKey)) return;

        inFlight.add(inflightKey);

        if (userId && item.type === 'travel') {
            const existing = get().favorites.find((f) => f.id === item.id && f.type === item.type);
            if (existing) {
                inFlight.delete(inflightKey);
                return;
            }

            const optimistic: FavoriteItem = { ...item, addedAt: Date.now() };
            set((s) => ({ favorites: [...s.favorites, optimistic] }));

            try {
                await markTravelAsFavorite(item.id);
                await get().refreshFromServer(userId);
            } catch (error) {
                set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === item.id && f.type === item.type)) }));
                inFlight.delete(inflightKey);
                throw error;
            }

            inFlight.delete(inflightKey);
            return;
        }

        if (!isValidFavoriteId(item.id)) {
            console.warn(`Suspicious favorite ID detected: ${item.id} (looks like HTTP error code), продолжим сохранение`);
        }

        const existingFavorite = get().favorites.find((f) => f.id === item.id && f.type === item.type);
        if (existingFavorite) return;

        const newFavorite: FavoriteItem = { ...item, addedAt: Date.now() };
        const newFavorites = [...get().favorites, newFavorite];

        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            set({ favorites: newFavorites });

            if (Platform.OS === 'web') {
                await showToast({ type: 'success', text1: 'Добавлено в избранное', text2: 'Сохранено на этом устройстве' });
            }
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            if (Platform.OS === 'web') {
                await showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось добавить в избранное' });
            }
            throw error;
        } finally {
            inFlight.delete(inflightKey);
        }
    },

    removeFavorite: async (id, type = 'travel', { isAuthenticated, userId }) => {
        if (!isAuthenticated) {
            throw new Error('AUTH_REQUIRED');
        }

        const inflightKey = `${type}:${String(id)}`;
        const inFlight = get()._inFlight;
        if (inFlight.has(inflightKey)) return;

        inFlight.add(inflightKey);

        if (userId) {
            const before = get().favorites;
            set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === id && f.type === type)) }));

            try {
                if (type === 'travel') {
                    await unmarkTravelAsFavorite(id);
                }
                await get().refreshFromServer(userId);
            } catch (error) {
                set({ favorites: before });
                inFlight.delete(inflightKey);
                throw error;
            }

            inFlight.delete(inflightKey);
            return;
        }

        if (!isValidFavoriteId(id)) {
            console.warn(`Suspicious favorite ID detected on remove: ${id} (looks like HTTP error code), продолжим удаление`);
        }

        const newFavorites = get().favorites.filter((f) => !(f.id === id && f.type === type));

        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            set({ favorites: newFavorites });

            if (Platform.OS === 'web') {
                await showToast({ type: 'info', text1: 'Удалено из избранного', text2: 'Удалено с этого устройства' });
            }
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            throw error;
        } finally {
            inFlight.delete(inflightKey);
        }
    },

    clearFavorites: async ({ isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            await clearUserFavorites(userId);
            set({ favorites: [] });
            await AsyncStorage.setItem(`${SERVER_FAVORITES_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }
        const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
        await AsyncStorage.setItem(key, JSON.stringify([]));
        set({ favorites: [] });
    },

    loadLocal: async (userId) => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const parsed = safeJsonParseString(data, []);
                set({ favorites: cleanupInvalidFavorites(parsed) });
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
                const normalized = parsed.map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
                set({ favorites: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша избранного:', error);
        }
    },

    refreshFromServer: async (userId) => {
        if (!userId) return;
        try {
            const favDto = await fetchUserFavoriteTravels(userId);
            const favArr = Array.isArray(favDto) ? favDto : [];
            const userFavorites: FavoriteItem[] = favArr.map((t) => ({
                id: t.id,
                type: 'travel' as const,
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName ?? undefined,
            }));

            set((s) => {
                if (userFavorites.length === 0 && s.favorites.length > 0) return s;
                return { favorites: userFavorites };
            });
            await AsyncStorage.setItem(`${SERVER_FAVORITES_CACHE_KEY}_${userId}`, JSON.stringify(userFavorites));
        } catch (error) {
            devError('Ошибка обновления избранного с сервера:', error);
        }
    },

    ensureServerData: async (userId) => {
        if (!userId) return;
        const state = get();
        if (state._fetched && state._userId === userId) return;
        set({ _fetched: true, _userId: userId });
        await get().refreshFromServer(userId);
    },

    resetFetchState: (userId) => {
        set({ _fetched: false, _userId: userId });
    },
}));
