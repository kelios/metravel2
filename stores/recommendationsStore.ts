import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';
import type { FavoriteItem } from '@/stores/favoritesStore';

const SERVER_RECOMMENDATIONS_CACHE_KEY = 'metravel_recommendations_server';
const getUserApi = async () => import('@/api/user');

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeCachedRecommendation = (item: unknown): FavoriteItem | null => {
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

interface RecommendationsState {
    recommended: FavoriteItem[];
    _fetched: boolean;
    _userId: string | null;

    getRecommendations: (favorites: FavoriteItem[], viewHistory: { country?: string; city?: string }[], auth: { isAuthenticated: boolean; userId: string | null }) => FavoriteItem[];
    loadServerCached: (userId: string | null) => Promise<void>;
    refreshFromServer: (userId: string | null) => Promise<void>;
    ensureServerData: (userId: string | null) => Promise<void>;
    resetFetchState: (userId: string | null) => void;
}

export const useRecommendationsStore = create<RecommendationsState>((set, get) => ({
    recommended: [],
    _fetched: false,
    _userId: null,

    getRecommendations: (favorites, _viewHistory, { isAuthenticated, userId }) => {
        if (isAuthenticated && userId) {
            return get().recommended;
        }
        return [...(favorites || [])].sort((a, b) => b.addedAt - a.addedAt);
    },

    loadServerCached: async (userId) => {
        if (!userId) return;
        try {
            const key = `${SERVER_RECOMMENDATIONS_CACHE_KEY}_${userId}`;
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const parsed = safeJsonParseString(raw, []);
                const normalized = (Array.isArray(parsed) ? parsed : [])
                    .map(normalizeCachedRecommendation)
                    .filter((item): item is FavoriteItem => item !== null);
                set({ recommended: normalized });
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша рекомендаций:', error);
        }
    },

    refreshFromServer: async (userId) => {
        if (!userId) return;
        try {
            const { fetchUserRecommendedTravels } = await getUserApi();
            const recDto = await fetchUserRecommendedTravels(userId);
            const recArr = Array.isArray(recDto) ? recDto : [];
            const userRecommended: FavoriteItem[] = recArr.map((t) => ({
                id: t.id,
                type: 'travel' as const,
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName ?? undefined,
            }));

            set((s) => {
                if (userRecommended.length === 0 && s.recommended.length > 0) return s;
                return { recommended: userRecommended };
            });
            await AsyncStorage.setItem(`${SERVER_RECOMMENDATIONS_CACHE_KEY}_${userId}`, JSON.stringify(userRecommended));
        } catch (error) {
            devError('Ошибка обновления рекомендаций с сервера:', error);
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
