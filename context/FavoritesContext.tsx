import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/context/AuthContext';
import {
    clearUserFavorites,
    clearUserHistory,
    fetchUserFavoriteTravels,
    fetchUserHistory,
    fetchUserRecommendedTravels,
} from '@/src/api/user';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/src/api/travelsFavorites';
import { safeJsonParseString } from '@/src/utils/safeJsonParse';
import { devError } from '@/src/utils/logger';
import { getStorageBatch } from '@/src/utils/storageBatch';
import { cleanupInvalidFavorites, isValidFavoriteId } from '@/src/utils/favoritesCleanup';

const FAVORITES_KEY = 'metravel_favorites';
const VIEW_HISTORY_KEY = 'metravel_view_history';
const MAX_HISTORY_ITEMS = 50;
const SERVER_FAVORITES_CACHE_KEY = 'metravel_favorites_server';
const SERVER_HISTORY_CACHE_KEY = 'metravel_view_history_server';
const SERVER_RECOMMENDATIONS_CACHE_KEY = 'metravel_recommendations_server';

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

interface FavoritesContextType {
    favorites: FavoriteItem[];
    viewHistory: ViewHistoryItem[];
    addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
    removeFavorite: (id: string | number, type: 'travel' | 'article') => Promise<void>;
    isFavorite: (id: string | number, type: 'travel' | 'article') => boolean;
    addToHistory: (item: Omit<ViewHistoryItem, 'viewedAt'>) => Promise<void>;
    clearFavorites: () => Promise<void>;
    clearHistory: () => Promise<void>;
    getRecommendations: () => FavoriteItem[];
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { userId, isAuthenticated } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [recommended, setRecommended] = useState<FavoriteItem[]>([]);

    const saveFavorites = useCallback(
        async (newFavorites: FavoriteItem[]) => {
            try {
                const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
                await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
                setFavorites(newFavorites);
            } catch (error) {
                devError('Ошибка сохранения избранного:', error);
            }
        },
        [userId]
    );

    const saveViewHistory = useCallback(
        async (newHistory: ViewHistoryItem[]) => {
            try {
                const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
                await AsyncStorage.setItem(key, JSON.stringify(newHistory));
                setViewHistory(newHistory);
            } catch (error) {
                devError('Ошибка сохранения истории:', error);
            }
        },
        [userId]
    );

    const loadFavorites = useCallback(async () => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const parsed = safeJsonParseString(data, []);
                const cleaned = cleanupInvalidFavorites(parsed);
                setFavorites(cleaned);
            }
        } catch (error) {
            devError('Ошибка загрузки избранного:', error);
        }
    }, [userId]);

    const loadViewHistory = useCallback(async () => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                setViewHistory(safeJsonParseString(data, []));
            }
        } catch (error) {
            devError('Ошибка загрузки истории:', error);
        }
    }, [userId]);

    const loadFavoritesAndHistory = useCallback(async () => {
        try {
            const favoritesKey = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const historyKey = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;

            const storageData = await getStorageBatch([favoritesKey, historyKey]);

            const favoritesRaw =
                storageData[favoritesKey] != null
                    ? storageData[favoritesKey]
                    : await AsyncStorage.getItem(favoritesKey);
            const historyRaw =
                storageData[historyKey] != null ? storageData[historyKey] : await AsyncStorage.getItem(historyKey);

            if (favoritesRaw) {
                const parsed = safeJsonParseString(favoritesRaw, []);
                const cleaned = cleanupInvalidFavorites(parsed);
                setFavorites(cleaned);
            } else {
                setFavorites((prev) => (prev.length > 0 ? prev : []));
            }

            if (historyRaw) {
                setViewHistory(safeJsonParseString(historyRaw, []));
            } else {
                setViewHistory((prev) => (prev.length > 0 ? prev : []));
            }
        } catch (error) {
            devError('Ошибка загрузки избранного и истории:', error);
            loadFavorites();
            loadViewHistory();
        }
    }, [userId, loadFavorites, loadViewHistory]);

    const loadServerCached = useCallback(async () => {
        if (!isAuthenticated || !userId) {
            return;
        }

        try {
            const favoritesKey = userId ? `${SERVER_FAVORITES_CACHE_KEY}_${userId}` : SERVER_FAVORITES_CACHE_KEY;
            const historyKey = userId ? `${SERVER_HISTORY_CACHE_KEY}_${userId}` : SERVER_HISTORY_CACHE_KEY;
            const recommendationsKey = userId ? `${SERVER_RECOMMENDATIONS_CACHE_KEY}_${userId}` : SERVER_RECOMMENDATIONS_CACHE_KEY;

            const storageData = await getStorageBatch([favoritesKey, historyKey, recommendationsKey]);

            const favoritesRaw =
                storageData[favoritesKey] != null
                    ? storageData[favoritesKey]
                    : await AsyncStorage.getItem(favoritesKey);
            const historyRaw =
                storageData[historyKey] != null ? storageData[historyKey] : await AsyncStorage.getItem(historyKey);
            const recommendationsRaw =
                storageData[recommendationsKey] != null
                    ? storageData[recommendationsKey]
                    : await AsyncStorage.getItem(recommendationsKey);

            if (favoritesRaw) {
                setFavorites(safeJsonParseString(favoritesRaw, []));
            }
            if (historyRaw) {
                setViewHistory(safeJsonParseString(historyRaw, []));
            }
            if (recommendationsRaw) {
                setRecommended(safeJsonParseString(recommendationsRaw, []));
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша:', error);
        }
    }, [isAuthenticated, userId]);

    const refreshFromServer = useCallback(async () => {
        if (!isAuthenticated || !userId) {
            return;
        }

        try {
            const [favDto, historyDto, recDto] = await Promise.all([
                fetchUserFavoriteTravels(userId),
                fetchUserHistory(userId),
                fetchUserRecommendedTravels(userId),
            ]);

            const favArr = Array.isArray(favDto) ? favDto : [];
            const historyArr = Array.isArray(historyDto) ? historyDto : [];
            const recArr = Array.isArray(recDto) ? recDto : [];

            const userFavorites: FavoriteItem[] = favArr.map((t) => ({
                id: t.id,
                type: 'travel',
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName,
            }));

            const userHistory: ViewHistoryItem[] = historyArr.map((t) => ({
                id: t.id,
                type: 'travel',
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                viewedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName,
            }));

            const userRecommended: FavoriteItem[] = recArr.map((t) => ({
                id: t.id,
                type: 'travel',
                title: t.name || 'Без названия',
                url: t.url || `/travels/${t.slug || t.id}`,
                imageUrl: t.travel_image_thumb_url,
                addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                country: t.countryName,
            }));

            setFavorites((prev) => {
                if (userFavorites.length === 0 && prev.length > 0) return prev;
                return userFavorites;
            });
            setViewHistory((prev) => {
                if (userHistory.length === 0 && prev.length > 0) return prev;
                return userHistory;
            });
            setRecommended((prev) => {
                if (userRecommended.length === 0 && prev.length > 0) return prev;
                return userRecommended;
            });

            const favoritesKey = userId ? `${SERVER_FAVORITES_CACHE_KEY}_${userId}` : SERVER_FAVORITES_CACHE_KEY;
            const historyKey = userId ? `${SERVER_HISTORY_CACHE_KEY}_${userId}` : SERVER_HISTORY_CACHE_KEY;
            const recommendationsKey = userId ? `${SERVER_RECOMMENDATIONS_CACHE_KEY}_${userId}` : SERVER_RECOMMENDATIONS_CACHE_KEY;

            await AsyncStorage.setItem(favoritesKey, JSON.stringify(userFavorites));
            await AsyncStorage.setItem(historyKey, JSON.stringify(userHistory));
            await AsyncStorage.setItem(recommendationsKey, JSON.stringify(userRecommended));
        } catch (error) {
            devError('Ошибка обновления данных с сервера:', error);
        }
    }, [isAuthenticated, userId]);

    useEffect(() => {
        if (isAuthenticated && userId) {
            loadServerCached();
            const timeout = setTimeout(() => {
                refreshFromServer();
            }, 0);
            return () => clearTimeout(timeout);
        }

        loadFavoritesAndHistory();
    }, [isAuthenticated, userId, loadFavoritesAndHistory, loadServerCached, refreshFromServer]);

    const addFavorite = useCallback(async (item: Omit<FavoriteItem, 'addedAt'>) => {
        if (isAuthenticated && userId && item.type === 'travel') {
            const existing = favorites.find((f) => f.id === item.id && f.type === item.type);
            if (existing) {
                return;
            }

            const optimistic: FavoriteItem = {
                ...item,
                addedAt: Date.now(),
            };

            setFavorites((prev) => [...prev, optimistic]);
            try {
                await markTravelAsFavorite(item.id);
                await refreshFromServer();
            } catch (error) {
                setFavorites((prev) => prev.filter((f) => !(f.id === item.id && f.type === item.type)));
                throw error;
            }

            return;
        }

        if (!isValidFavoriteId(item.id)) {
            console.warn(`Suspicious favorite ID detected: ${item.id} (looks like HTTP error code), продолжим сохранение`);
        }

        const existingFavorite = favorites.find(f => f.id === item.id && f.type === item.type);

        if (existingFavorite) {
            return; // Уже в избранном
        }

        const newFavorite: FavoriteItem = {
            ...item,
            addedAt: Date.now(),
        };

        const newFavorites = [...favorites, newFavorite];

        try {
            await saveFavorites(newFavorites);

            if (Platform.OS === 'web') {
                Toast.show({
                    type: 'success',
                    text1: 'Добавлено в избранное',
                    text2: 'Сохранено на этом устройстве',
                });
            }
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            if (Platform.OS === 'web') {
                Toast.show({
                    type: 'error',
                    text1: 'Ошибка',
                    text2: 'Не удалось добавить в избранное',
                });
            }
            throw error;
        }
    }, [favorites, userId, isAuthenticated, refreshFromServer]);

    const removeFavorite = useCallback(async (id: string | number, type: 'travel' | 'article') => {
        if (isAuthenticated && userId && type === 'travel') {
            const before = favorites;
            setFavorites((prev) => prev.filter((f) => !(f.id === id && f.type === type)));
            try {
                await unmarkTravelAsFavorite(id);
                await refreshFromServer();
            } catch (error) {
                setFavorites(before);
                throw error;
            }

            return;
        }

        if (!isValidFavoriteId(id)) {
            console.warn(`Suspicious favorite ID detected on remove: ${id} (looks like HTTP error code), продолжим удаление`);
        }

        const newFavorites = favorites.filter(
            f => !(f.id === id && f.type === type)
        );

        try {
            await saveFavorites(newFavorites);
            
            // Показываем уведомление об успешном удалении
            if (Platform.OS === 'web') {
                Toast.show({
                    type: 'info',
                    text1: 'Удалено из избранного',
                    text2: 'Удалено с этого устройства',
                });
            }
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            throw error;
        }
    }, [favorites, userId, isAuthenticated, refreshFromServer]);

    const isFavorite = useCallback((id: string | number, type: 'travel' | 'article') => {
        return favorites.some(f => f.id === id && f.type === type);
    }, [favorites]);

    const addToHistory = useCallback(async (item: Omit<ViewHistoryItem, 'viewedAt'>) => {
        if (isAuthenticated && userId) {
            return;
        }

        const historyItem: ViewHistoryItem = {
            ...item,
            viewedAt: Date.now(),
        };

        // Удаляем дубликаты и добавляем в начало
        let newHistory = viewHistory.filter(
            h => !(h.id === historyItem.id && h.type === historyItem.type)
        );
        newHistory = [historyItem, ...newHistory].slice(0, MAX_HISTORY_ITEMS);
        
        await saveViewHistory(newHistory);
    }, [viewHistory, userId, isAuthenticated]);

    const clearHistory = useCallback(async () => {
        if (isAuthenticated && userId) {
            await clearUserHistory(userId);
            setViewHistory([]);
            await AsyncStorage.setItem(`${SERVER_HISTORY_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }

        await saveViewHistory([]);
    }, [userId, isAuthenticated]);

    const clearFavorites = useCallback(async () => {
        if (isAuthenticated && userId) {
            await clearUserFavorites(userId);
            setFavorites([]);
            await AsyncStorage.setItem(`${SERVER_FAVORITES_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }

        await saveFavorites([]);
    }, [userId, isAuthenticated, saveFavorites]);

    const getRecommendations = useCallback(() => {
        if (isAuthenticated && userId) {
            return recommended;
        }

        // Рекомендации на основе избранного и истории
        const countries = new Set<string>();
        const cities = new Set<string>();

        favorites.forEach(f => {
            if (f.country) countries.add(f.country);
            if (f.city) cities.add(f.city);
        });

        viewHistory.slice(0, 10).forEach(h => {
            if (h.country) countries.add(h.country);
            if (h.city) cities.add(h.city);
        });

        // Возвращаем избранное, отсортированное по дате добавления
        return [...favorites].sort((a, b) => b.addedAt - a.addedAt);
    }, [favorites, viewHistory, isAuthenticated, userId, recommended]);

    return (
        <FavoritesContext.Provider
            value={{
                favorites,
                viewHistory,
                addFavorite,
                removeFavorite,
                isFavorite,
                addToHistory,
                clearFavorites,
                clearHistory,
                getRecommendations,
            }}
        >
            {children}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = (): FavoritesContextType => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};


