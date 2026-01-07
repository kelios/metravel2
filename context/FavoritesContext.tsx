import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import {
    clearUserFavorites,
    clearUserHistory,
    fetchUserFavoriteTravels,
    fetchUserHistory,
    fetchUserRecommendedTravels,
} from '@/src/api/user';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/src/api/travelsFavorites';
import { devError } from '@/src/utils/logger';
import { getStorageBatch } from '@/src/utils/storageBatch';
import { safeJsonParseString } from '@/src/utils/safeJsonParse';
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
    recommended: FavoriteItem[];
    isFavorite: (id: number | string, type: FavoriteItem['type']) => boolean;
    addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
    removeFavorite: (id: number | string, type?: FavoriteItem['type']) => Promise<void>;
    addToHistory: (item: Omit<ViewHistoryItem, 'viewedAt'>) => Promise<void>;
    clearHistory?: () => Promise<void>;
    clearFavorites?: () => Promise<void>;
    getRecommendations: () => FavoriteItem[];
    ensureServerData?: (kind: 'favorites' | 'history' | 'recommendations' | 'all') => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const AUTH_REQUIRED_ERROR = 'AUTH_REQUIRED';

let toastModulePromise: Promise<any> | null = null;
async function showToast(payload: any) {
    try {
        if (!toastModulePromise) {
            toastModulePromise = import('react-native-toast-message');
        }
        const mod = await toastModulePromise;
        const Toast = (mod as any)?.default ?? mod;
        if (Toast && typeof Toast.show === 'function') {
            Toast.show(payload);
        }
    } catch {
        // ignore
    }
}

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, userId } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [recommended, setRecommended] = useState<FavoriteItem[]>([]);

    const inFlightRef = useRef(new Set<string>());

    const fetchedRef = useRef({
        favorites: false,
        history: false,
        recommendations: false,
        all: false,
        userId: null as string | null,
    });

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
                const parsed = safeJsonParseString(favoritesRaw, []);
                const normalized = parsed.map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
                setFavorites(normalized);
            }
            if (historyRaw) {
                const parsed = safeJsonParseString(historyRaw, []);
                const normalized = parsed.map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
                setViewHistory(normalized);
            }
            if (recommendationsRaw) {
                const parsed = safeJsonParseString(recommendationsRaw, []);
                const normalized = parsed.map((item: any) => ({
                    ...item,
                    country: item.country ?? item.countryName ?? undefined,
                }));
                setRecommended(normalized);
            }
        } catch (error) {
            devError('Ошибка загрузки серверного кеша:', error);
        }
    }, [isAuthenticated, userId]);

    const refreshFromServer = useCallback(
        async (kind: 'favorites' | 'history' | 'recommendations' | 'all' = 'all') => {
            if (!isAuthenticated || !userId) {
                return;
            }

            try {
                const needAll = kind === 'all';
                const needFavorites = needAll || kind === 'favorites';
                const needHistory = needAll || kind === 'history';
                const needRecommendations = needAll || kind === 'recommendations';

                const [favDto, historyDto, recDto] = await Promise.all([
                    needFavorites ? fetchUserFavoriteTravels(userId) : Promise.resolve(null),
                    needHistory ? fetchUserHistory(userId) : Promise.resolve(null),
                    needRecommendations ? fetchUserRecommendedTravels(userId) : Promise.resolve(null),
                ]);

                const favoritesKey = userId ? `${SERVER_FAVORITES_CACHE_KEY}_${userId}` : SERVER_FAVORITES_CACHE_KEY;
                const historyKey = userId ? `${SERVER_HISTORY_CACHE_KEY}_${userId}` : SERVER_HISTORY_CACHE_KEY;
                const recommendationsKey =
                    userId ? `${SERVER_RECOMMENDATIONS_CACHE_KEY}_${userId}` : SERVER_RECOMMENDATIONS_CACHE_KEY;

                if (needFavorites) {
                    const favArr = Array.isArray(favDto) ? favDto : [];
                    const userFavorites: FavoriteItem[] = favArr.map((t) => ({
                        id: t.id,
                        type: 'travel',
                        title: t.name || 'Без названия',
                        url: t.url || `/travels/${t.slug || t.id}`,
                        imageUrl: t.travel_image_thumb_url,
                        addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                        country: t.countryName ?? undefined,
                    }));

                    setFavorites((prev) => {
                        if (userFavorites.length === 0 && prev.length > 0) return prev;
                        return userFavorites;
                    });
                    await AsyncStorage.setItem(favoritesKey, JSON.stringify(userFavorites));
                }

                if (needHistory) {
                    const historyArr = Array.isArray(historyDto) ? historyDto : [];
                    const userHistory: ViewHistoryItem[] = historyArr.map((t) => ({
                        id: t.id,
                        type: 'travel',
                        title: t.name || 'Без названия',
                        url: t.url || `/travels/${t.slug || t.id}`,
                        imageUrl: t.travel_image_thumb_url,
                        viewedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                        country: t.countryName ?? undefined,
                    }));

                    setViewHistory((prev) => {
                        if (userHistory.length === 0 && prev.length > 0) return prev;
                        return userHistory;
                    });
                    await AsyncStorage.setItem(historyKey, JSON.stringify(userHistory));
                }

                if (needRecommendations) {
                    const recArr = Array.isArray(recDto) ? recDto : [];
                    const userRecommended: FavoriteItem[] = recArr.map((t) => ({
                        id: t.id,
                        type: 'travel',
                        title: t.name || 'Без названия',
                        url: t.url || `/travels/${t.slug || t.id}`,
                        imageUrl: t.travel_image_thumb_url,
                        addedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now(),
                        country: t.countryName ?? undefined,
                    }));

                    setRecommended((prev) => {
                        if (userRecommended.length === 0 && prev.length > 0) return prev;
                        return userRecommended;
                    });
                    await AsyncStorage.setItem(recommendationsKey, JSON.stringify(userRecommended));
                }
            } catch (error) {
                devError('Ошибка обновления данных с сервера:', error);
            }
        },
        [isAuthenticated, userId]
    );

    const ensureServerData = useCallback(
        async (kind: 'favorites' | 'history' | 'recommendations' | 'all') => {
            if (!isAuthenticated || !userId) {
                return;
            }

            if (fetchedRef.current.userId !== userId) {
                fetchedRef.current = {
                    favorites: false,
                    history: false,
                    recommendations: false,
                    all: false,
                    userId,
                };
            }

            if (kind === 'all') {
                if (fetchedRef.current.all) return;
                fetchedRef.current.all = true;
                fetchedRef.current.favorites = true;
                fetchedRef.current.history = true;
                fetchedRef.current.recommendations = true;
                await refreshFromServer('all');
                return;
            }

            if (fetchedRef.current[kind]) return;
            fetchedRef.current[kind] = true;
            await refreshFromServer(kind);
        },
        [isAuthenticated, refreshFromServer, userId]
    );

    useEffect(() => {
        if (isAuthenticated && userId) {
            loadServerCached();
            fetchedRef.current.userId = userId;
            fetchedRef.current.all = false;
            fetchedRef.current.favorites = false;
            fetchedRef.current.history = false;
            fetchedRef.current.recommendations = false;
            return;
        }

        fetchedRef.current.userId = null;
        fetchedRef.current.all = false;
        fetchedRef.current.favorites = false;
        fetchedRef.current.history = false;
        fetchedRef.current.recommendations = false;
        loadFavoritesAndHistory();
    }, [isAuthenticated, loadFavoritesAndHistory, loadServerCached, userId]);

    const addFavorite = useCallback(async (item: Omit<FavoriteItem, 'addedAt'>) => {
        if (!isAuthenticated) {
            throw new Error(AUTH_REQUIRED_ERROR);
        }

        const inflightKey = `${item.type}:${String(item.id)}`;
        if (inFlightRef.current.has(inflightKey)) {
            return;
        }

        inFlightRef.current.add(inflightKey);

        if (isAuthenticated && userId && item.type === 'travel') {
            const existing = favorites.find((f) => f.id === item.id && f.type === item.type);
            if (existing) {
                inFlightRef.current.delete(inflightKey);
                return;
            }

            const optimistic: FavoriteItem = {
                ...item,
                addedAt: Date.now(),
            };

            setFavorites((prev) => [...prev, optimistic]);
            try {
                await markTravelAsFavorite(item.id);
                await refreshFromServer('favorites');
                fetchedRef.current.favorites = true;
            } catch (error) {
                setFavorites((prev) => prev.filter((f) => !(f.id === item.id && f.type === item.type)));
                inFlightRef.current.delete(inflightKey);
                throw error;
            }

            inFlightRef.current.delete(inflightKey);

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
                await showToast({
                    type: 'success',
                    text1: 'Добавлено в избранное',
                    text2: 'Сохранено на этом устройстве',
                });
            }
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            if (Platform.OS === 'web') {
                await showToast({
                    type: 'error',
                    text1: 'Ошибка',
                    text2: 'Не удалось добавить в избранное',
                });
            }
            throw error;
        } finally {
            inFlightRef.current.delete(inflightKey);
        }
    }, [favorites, isAuthenticated, refreshFromServer, saveFavorites, userId]);

    const removeFavorite = useCallback(async (id: number | string, type: FavoriteItem['type'] = 'travel') => {
        if (!isAuthenticated) {
            throw new Error(AUTH_REQUIRED_ERROR);
        }

        const inflightKey = `${type}:${String(id)}`;
        if (inFlightRef.current.has(inflightKey)) {
            return;
        }

        inFlightRef.current.add(inflightKey);

        if (isAuthenticated && userId) {
            const before = favorites;
            setFavorites((prev) => prev.filter((f) => !(f.id === id && f.type === type)));
            try {
                if (type === 'travel') {
                    await unmarkTravelAsFavorite(id);
                }
                await refreshFromServer('favorites');
                fetchedRef.current.favorites = true;
            } catch (error) {
                setFavorites(before);
                inFlightRef.current.delete(inflightKey);
                throw error;
            }

            inFlightRef.current.delete(inflightKey);

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
                await showToast({
                    type: 'info',
                    text1: 'Удалено из избранного',
                    text2: 'Удалено с этого устройства',
                });
            }
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            throw error;
        } finally {
            inFlightRef.current.delete(inflightKey);
        }
    }, [favorites, isAuthenticated, refreshFromServer, saveFavorites, userId]);

    const isFavorite = useCallback(
        (id: number | string, type: FavoriteItem['type']) => {
            return favorites.some((f) => f.id === id && f.type === type);
        },
        [favorites]
    );

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
    }, [viewHistory, userId, isAuthenticated, saveViewHistory]);

    const clearHistory = useCallback(async () => {
        if (isAuthenticated && userId) {
            await clearUserHistory(userId);
            setViewHistory([]);
            await AsyncStorage.setItem(`${SERVER_HISTORY_CACHE_KEY}_${userId}`, JSON.stringify([]));
            return;
        }

        await saveViewHistory([]);
    }, [userId, isAuthenticated, saveViewHistory]);

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
                recommended,
                isFavorite,
                addFavorite,
                removeFavorite,
                addToHistory,
                clearHistory,
                clearFavorites,
                getRecommendations,
                ensureServerData,
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


