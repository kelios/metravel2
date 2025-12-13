import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';
import { safeJsonParseString } from '@/src/utils/safeJsonParse';
import { devError } from '@/src/utils/logger';
import { getStorageBatch } from '@/src/utils/storageBatch';
import { cleanupInvalidFavorites, isValidFavoriteId } from '@/src/utils/favoritesCleanup';

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
    const { userId } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);

    const loadFavorites = useCallback(async () => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                // ✅ FIX-010: Используем безопасный парсинг JSON
                const parsed = safeJsonParseString(data, []);
                const cleaned = cleanupInvalidFavorites(parsed);
                setFavorites(cleaned);
            }
        } catch (error) {
            // ✅ FIX-007: Используем централизованный logger
            devError('Ошибка загрузки избранного:', error);
        }
    }, [userId]);

    const loadViewHistory = useCallback(async () => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            const data = await AsyncStorage.getItem(key);
            if (data) {
                // ✅ FIX-010: Используем безопасный парсинг JSON
                setViewHistory(safeJsonParseString(data, []));
            }
        } catch (error) {
            // ✅ FIX-007: Используем централизованный logger
            devError('Ошибка загрузки истории:', error);
        }
    }, [userId]);

    // ✅ FIX-004: Оптимизированная загрузка favorites и viewHistory за один запрос
    const loadFavoritesAndHistory = useCallback(async () => {
        try {
            const favoritesKey = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            const historyKey = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            
            const storageData = await getStorageBatch([favoritesKey, historyKey]);
            
            if (storageData[favoritesKey]) {
                // ✅ FIX-010: Используем безопасный парсинг JSON
                const parsed = safeJsonParseString(storageData[favoritesKey]!, []);
                const cleaned = cleanupInvalidFavorites(parsed);
                setFavorites(cleaned);
            }
            if (storageData[historyKey]) {
                // ✅ FIX-010: Используем безопасный парсинг JSON
                setViewHistory(safeJsonParseString(storageData[historyKey]!, []));
            }
        } catch (error) {
            // ✅ FIX-007: Используем централизованный logger
            devError('Ошибка загрузки избранного и истории:', error);
            // Fallback на отдельные загрузки при ошибке
            loadFavorites();
            loadViewHistory();
        }
    }, [userId, loadFavorites, loadViewHistory]);

    const saveFavorites = async (newFavorites: FavoriteItem[]) => {
        try {
            const key = userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newFavorites));
            setFavorites(newFavorites);
        } catch (error) {
            // ✅ FIX-007: Используем централизованный logger
            devError('Ошибка сохранения избранного:', error);
        }
    };

    const saveViewHistory = async (newHistory: ViewHistoryItem[]) => {
        try {
            const key = userId ? `${VIEW_HISTORY_KEY}_${userId}` : VIEW_HISTORY_KEY;
            await AsyncStorage.setItem(key, JSON.stringify(newHistory));
            setViewHistory(newHistory);
        } catch (error) {
            // ✅ FIX-007: Используем централизованный logger
            devError('Ошибка сохранения истории:', error);
        }
    };

    // ✅ FIX-004: Загрузка избранного и истории при монтировании (оптимизировано)
    useEffect(() => {
        loadFavoritesAndHistory();
    }, [userId, loadFavoritesAndHistory]);

        const addFavorite = useCallback(async (item: Omit<FavoriteItem, 'addedAt'>) => {
        // Валидация ID с использованием утилиты
        if (!isValidFavoriteId(item.id)) {
            // Раньше мы полностью блокировали такие ID, но это мешает реальным путешествиям
            // с id вроде 503. Теперь только логируем предупреждение и продолжаем.
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
    }, [favorites, userId]);

        const removeFavorite = useCallback(async (id: string | number, type: 'travel' | 'article') => {
        // Валидация ID с использованием утилиты
        if (!isValidFavoriteId(id)) {
            console.warn(`Suspicious favorite ID detected on remove: ${id} (looks like HTTP error code), продолжим удаление`);
        }
        
        const favoriteToRemove = favorites.find(f => f.id === id && f.type === type);
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


