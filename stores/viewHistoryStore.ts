import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';

const VIEW_HISTORY_KEY = 'metravel_view_history';
const SERVER_HISTORY_CACHE_KEY = 'metravel_view_history_server';
const MAX_HISTORY_ITEMS = 50;
const getUserApi = async () => import('@/api/user');

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeCachedHistoryItem = (item: unknown): ViewHistoryItem | null => {
    if (!isRecord(item)) return null;

    const id = item.id;
    const type = item.type;
    const title = item.title;
    const url = item.url;
    const viewedAt = Number(item.viewedAt);

    if ((typeof id !== 'string' && typeof id !== 'number') || (type !== 'travel' && type !== 'article')) {
        return null;
    }

    if (typeof title !== 'string' || typeof url !== 'string' || !Number.isFinite(viewedAt)) {
        return null;
    }

    return {
        id,
        type,
        title,
        url,
        viewedAt,
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

        let newHistory: ViewHistoryItem[] = [];
        set((s) => {
            newHistory = [
                historyItem,
                ...s.viewHistory.filter(
                    (h) => !(h.id === historyItem.id && h.type === historyItem.type)
                ),
            ].slice(0, MAX_HISTORY_ITEMS);
            return { viewHistory: newHistory };
        });

        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newHistory));
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
                const normalized = (Array.isArray(parsed) ? parsed : [])
                    .map(normalizeCachedHistoryItem)
                    .filter((item): item is ViewHistoryItem => item !== null);
                set({ viewHistory: normalized });
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
                const normalized = (Array.isArray(parsed) ? parsed : [])
                    .map(normalizeCachedHistoryItem)
                    .filter((item): item is ViewHistoryItem => item !== null);
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
                url: t.slug ? `/travels/${t.slug}` : (t.url ? String(t.url).split('?')[0].split('#')[0] : `/travels/${t.id}`),
                imageUrl: t.travel_image_thumb_url,
                viewedAt: ((): number => {
                    const t0 = t.updated_at ? new Date(t.updated_at).getTime() : NaN;
                    return Number.isFinite(t0) ? t0 : Date.now();
                })(),
                country: t.countryName ?? undefined,
            }));

            // Пустой ответ сервера при непустой локальной истории трактуем как
            // ненадёжный и сохраняем текущие данные. Кеш должен совпадать с тем,
            // что реально приняли, иначе на следующем старте loadServerCached
            // прочитает [] и потеряет сохранённую гардом историю.
            let adopted = userHistory;
            set((s) => {
                if (userHistory.length === 0 && s.viewHistory.length > 0) {
                    adopted = s.viewHistory;
                    return s;
                }
                return { viewHistory: userHistory };
            });
            await AsyncStorage.setItem(`${SERVER_HISTORY_CACHE_KEY}_${userId}`, JSON.stringify(adopted));
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
