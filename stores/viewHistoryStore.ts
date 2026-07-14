import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';

const VIEW_HISTORY_KEY = 'metravel_view_history';
const SERVER_HISTORY_CACHE_KEY = 'metravel_view_history_server';
const MAX_HISTORY_ITEMS = 50;
const getUserApi = async () => import('@/api/user');

const getLocalHistoryKey = (userId: string | null): string =>
    userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;

const getServerHistoryCacheKey = (userId: string): string => `${SERVER_HISTORY_CACHE_KEY}_${userId}`;

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

const normalizeCachedHistoryItems = (data: string | null): ViewHistoryItem[] => {
    if (!data) return [];
    const parsed = safeJsonParseString(data, []);
    return (Array.isArray(parsed) ? parsed : [])
        .map(normalizeCachedHistoryItem)
        .filter((item): item is ViewHistoryItem => item !== null);
};

const getHistoryIdentity = (item: Pick<ViewHistoryItem, 'id' | 'type'>): string =>
    `${item.type}:${String(item.id)}`;

const mergeHistoryItems = (items: ViewHistoryItem[]): ViewHistoryItem[] => {
    const byIdentity = new Map<string, ViewHistoryItem>();

    for (const item of items) {
        const key = getHistoryIdentity(item);
        const existing = byIdentity.get(key);
        if (!existing || item.viewedAt >= existing.viewedAt) {
            byIdentity.set(key, item);
        }
    }

    return Array.from(byIdentity.values())
        .sort((a, b) => b.viewedAt - a.viewedAt)
        .slice(0, MAX_HISTORY_ITEMS);
};

const persistHistoryCache = async (
    history: ViewHistoryItem[],
    { isAuthenticated, userId }: { isAuthenticated: boolean; userId: string | null }
) => {
    await AsyncStorage.setItem(getLocalHistoryKey(userId), JSON.stringify(history));
    if (isAuthenticated && userId) {
        await AsyncStorage.setItem(getServerHistoryCacheKey(userId), JSON.stringify(history));
    }
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
    refreshFromServer: (userId: string | null) => Promise<boolean>;
    ensureServerData: (userId: string | null) => Promise<void>;
    resetFetchState: (userId: string | null) => void;
}

export const useViewHistoryStore = create<ViewHistoryState>((set, get) => ({
    viewHistory: [],
    _fetched: false,
    _userId: null,

    addToHistory: async (item, { isAuthenticated, userId }) => {
        const historyItem: ViewHistoryItem = {
            ...item,
            viewedAt: Date.now(),
        };

        let newHistory: ViewHistoryItem[] = [];
        set((s) => {
            newHistory = mergeHistoryItems([historyItem, ...s.viewHistory]);
            return { viewHistory: newHistory };
        });

        try {
            await persistHistoryCache(newHistory, { isAuthenticated, userId });
        } catch (error) {
            devError('Ошибка сохранения истории:', error);
        }
    },

    clearHistory: async ({ isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            const { clearUserHistory } = await getUserApi();
            await clearUserHistory(userId);
            set({ viewHistory: [] });
            await AsyncStorage.setItem(getLocalHistoryKey(userId), JSON.stringify([]));
            await AsyncStorage.setItem(getServerHistoryCacheKey(userId), JSON.stringify([]));
            return;
        }
        await AsyncStorage.setItem(getLocalHistoryKey(userId), JSON.stringify([]));
        set({ viewHistory: [] });
    },

    loadLocal: async (userId) => {
        try {
            const data = await AsyncStorage.getItem(getLocalHistoryKey(userId));
            const normalized = normalizeCachedHistoryItems(data);
            if (normalized.length > 0) {
                set({ viewHistory: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки истории:', error);
        }
    },

    loadServerCached: async (userId) => {
        if (!userId) return;
        try {
            const [serverRaw, localRaw] = await Promise.all([
                AsyncStorage.getItem(getServerHistoryCacheKey(userId)),
                AsyncStorage.getItem(getLocalHistoryKey(userId)),
            ]);
            const normalized = mergeHistoryItems([
                ...normalizeCachedHistoryItems(serverRaw),
                ...normalizeCachedHistoryItems(localRaw),
            ]);
            if (normalized.length > 0) {
                set({ viewHistory: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша истории:', error);
        }
    },

    refreshFromServer: async (userId) => {
        if (!userId) return false;
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

            const currentHistory = get().viewHistory;
            // Сервер сейчас отдаёт только travel-историю, а локально могут быть
            // статьи и свежий просмотр до синка. Мержим вместо replace.
            const adopted = userHistory.length === 0 && currentHistory.length > 0
                ? currentHistory
                : mergeHistoryItems([...userHistory, ...currentHistory]);
            set({ viewHistory: adopted });
            await persistHistoryCache(adopted, { isAuthenticated: true, userId });
            return true;
        } catch (error) {
            devError('Ошибка обновления истории с сервера:', error);
            return false;
        }
    },

    ensureServerData: async (userId) => {
        if (!userId) return;
        const state = get();
        if (state._fetched && state._userId === userId) return;
        // Mark as fetched only after a successful refresh, otherwise a failed
        // network call (common on native cold start) would permanently block
        // retries and leave the history shelf empty despite real data.
        const ok = await get().refreshFromServer(userId);
        if (ok) set({ _fetched: true, _userId: userId });
    },

    resetFetchState: (userId) => {
        set({ _fetched: false, _userId: userId });
    },
}));
