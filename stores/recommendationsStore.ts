import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from '@/utils/logger';
import { safeJsonParseString } from '@/utils/safeJsonParse';
import type { FavoriteItem } from '@/stores/favoritesStore';

const SERVER_RECOMMENDATIONS_CACHE_KEY = 'metravel_recommendations_server';
const getUserApi = async () => import('@/api/user');

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
                const normalized = (Array.isArray(parsed) ? parsed : []).filter(Boolean).map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
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
