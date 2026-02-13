import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';

const VIEW_HISTORY_KEY = 'metravel_view_history';
const SERVER_HISTORY_CACHE_KEY = 'metravel_view_history_server';
const MAX_HISTORY_ITEMS = 50;
const getUserApi = async () => import('@/api/user');

export type ViewHistoryItem = {
    id: string | number;
    type: 'travel' | 'article';
    title: string;
    imageUrl?: string;
    url: string;
    viewedAt: number;
    country?: string;
    city?: string;
};

interface ViewHistoryState {
    viewHistory: ViewHistoryItem[];
    _fetched: boolean;
    _userId: string | null;

    addToHistory: (item: Omit<ViewHistoryItem, 'viewedAt'>, auth: { isAuthenticated: boolean; userId: string | null }) => Promise<void>;
    clearHistory: (auth: { isAuthenticated: boolean; userId: string | null }) => Promise<void>;
    loadLocal: (userId: string | null) => Promise<void>;
    loadServerCached: (userId: string | null) => Promise<void>;
    refreshFromServer: (userId: string | null) => Promise<void>;
    ensureServerData: (userId: string | null) => Promise<void>;
    resetFetchState: (userId: string | null) => void;
}

export const useViewHistoryStore = create<ViewHistoryState>((set, get) => ({
    viewHistory: [],
    _fetched: false,
    _userId: null,

    addToHistory: async (item, { isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            return;
        }

        const historyItem: ViewHistoryItem = {
            ...item,
            viewedAt: Date.now(),
        };

        let newHistory = get().viewHistory.filter(
            (h) => !(h.id === historyItem.id && h.type === historyItem.type)
        );
        newHistory = [historyItem, ...newHistory].slice(0, MAX_HISTORY_ITEMS);

        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newHistory));
            set({ viewHistory: newHistory });
        } catch (error) {
            devError('Ошибка сохранения истории:', error);
        }
    },

    clearHistory: async ({ isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            const { clearUserHistory } = await getUserApi();
            await clearUserHistory(userId);
            set({ viewHistory: [] });
            await AsyncStorage.setItem(`${SERVER_HISTORY_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }
        const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
        await AsyncStorage.setItem(key, JSON.stringify([]));
        set({ viewHistory: [] });
    },

    loadLocal: async (userId) => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const parsed = safeJsonParseString(data, []);
                set({ viewHistory: Array.isArray(parsed) ? parsed : [] });
            }
        } catch (error) {
            devError('Ошибка загрузки истории:', error);
        }
    },

    loadServerCached: async (userId) => {
        if (!userId) return;
        try {
            const key = `${SERVER_HISTORY_CACHE_KEY}_${userId}`;
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const parsed = safeJsonParseString(raw, []);
                const normalized = (Array.isArray(parsed) ? parsed : []).filter(Boolean).map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
                set({ viewHistory: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша истории:', error);
        }
    },

    refreshFromServer: async (userId) => {
        if (!userId) return;
        try {
            const { fetchUserHistory } = await getUserApi();
            const historyDto = await fetchUserHistory(userId);
            const historyArr = Array.isArray(historyDto) ? historyDto : [];
            const userHistory: ViewHistoryItem[] = historyArr.map((t) => ({
                id: t.id,
                type: 'travel' as const,
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                viewedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName ?? undefined,
            }));

            set((s) => {
                if (userHistory.length === 0 && s.viewHistory.length > 0) return s;
                return { viewHistory: userHistory };
            });
            await AsyncStorage.setItem(`${SERVER_HISTORY_CACHE_KEY}_${userId}`, JSON.stringify(userHistory));
        } catch (error) {
            devError('Ошибка обновления истории с сервера:', error);
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
