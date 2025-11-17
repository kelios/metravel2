import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const FAVORITES_KEY = 'metravel_favorites';
const VIEW_HISTORY_KEY = 'metravel_view_history';
const MAX_HISTORY_ITEMS = 50;

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
    clearHistory: () => Promise<void>;
    getRecommendations: () => FavoriteItem[];
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isAuthenticated, userId } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);

    // Загрузка избранного при монтировании
    useEffect(() => {
        loadFavorites();
        loadViewHistory();
    }, [isAuthenticated, userId]);

    const loadFavorites = async () => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                setFavorites(JSON.parse(data));
            }
        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
        }
    };

    const loadViewHistory = async () => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                setViewHistory(JSON.parse(data));
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    };

    const saveFavorites = async (newFavorites: FavoriteItem[]) => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            setFavorites(newFavorites);
        } catch (error) {
            console.error('Ошибка сохранения избранного:', error);
        }
    };

    const saveViewHistory = async (newHistory: ViewHistoryItem[]) => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newHistory));
            setViewHistory(newHistory);
        } catch (error) {
            console.error('Ошибка сохранения истории:', error);
        }
    };

    const addFavorite = useCallback(async (item: Omit<FavoriteItem, 'addedAt'>) => {
        const newFavorite: FavoriteItem = {
            ...item,
            addedAt: Date.now(),
        };

        const newFavorites = [...favorites, newFavorite];
        await saveFavorites(newFavorites);
    }, [favorites, userId]);

    const removeFavorite = useCallback(async (id: string | number, type: 'travel' | 'article') => {
        const newFavorites = favorites.filter(
            f => !(f.id === id && f.type === type)
        );
        await saveFavorites(newFavorites);
    }, [favorites, userId]);

    const isFavorite = useCallback((id: string | number, type: 'travel' | 'article') => {
        return favorites.some(f => f.id === id && f.type === type);
    }, [favorites]);

    const addToHistory = useCallback(async (item: Omit<ViewHistoryItem, 'viewedAt'>) => {
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
    }, [viewHistory, userId]);

    const clearHistory = useCallback(async () => {
        await saveViewHistory([]);
    }, [userId]);

    const getRecommendations = useCallback(() => {
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
    }, [favorites, viewHistory]);

    return (
        <FavoritesContext.Provider
            value={{
                favorites,
                viewHistory,
                addFavorite,
                removeFavorite,
                isFavorite,
                addToHistory,
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

