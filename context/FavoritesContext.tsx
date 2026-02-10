import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useFavoritesStore, type FavoriteItem } from '@/stores/favoritesStore';
import { useViewHistoryStore, type ViewHistoryItem } from '@/stores/viewHistoryStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';

export type { FavoriteItem } from '@/stores/favoritesStore';
export type { ViewHistoryItem } from '@/stores/viewHistoryStore';

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

const globalForFavoritesContext = globalThis as any;
const FavoritesContext: ReturnType<typeof createContext<FavoritesContextType | undefined>> =
    globalForFavoritesContext.__metravelFavoritesContext ??
    createContext<FavoritesContextType | undefined>(undefined);
globalForFavoritesContext.__metravelFavoritesContext = FavoritesContext;

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, userId } = useAuth();
    const auth = useMemo(() => ({ isAuthenticated, userId }), [isAuthenticated, userId]);

    const favorites = useFavoritesStore((s) => s.favorites);
    const viewHistory = useViewHistoryStore((s) => s.viewHistory);
    const recommended = useRecommendationsStore((s) => s.recommended);

    useEffect(() => {
        const doLoad = () => {
            const fav = useFavoritesStore.getState();
            const hist = useViewHistoryStore.getState();
            const rec = useRecommendationsStore.getState();

            if (isAuthenticated && userId) {
                fav.resetFetchState(userId);
                hist.resetFetchState(userId);
                rec.resetFetchState(userId);
                fav.loadServerCached(userId);
                hist.loadServerCached(userId);
                rec.loadServerCached(userId);
            } else {
                fav.loadLocal(userId);
                hist.loadLocal(userId);
            }
        };

        // Defer data loading on web to reduce TBT during initial render.
        // On native, load immediately (no TBT concern).
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const id = (window as any).requestIdleCallback(doLoad, { timeout: 2000 });
            return () => { try { (window as any).cancelIdleCallback(id); } catch { /* noop */ } };
        }
        doLoad();
        return undefined;
    }, [isAuthenticated, userId]);

    const isFavorite = useCallback(
        (id: number | string, type: FavoriteItem['type']) => useFavoritesStore.getState().isFavorite(id, type),
        []
    );

    const addFavorite = useCallback(
        (item: Omit<FavoriteItem, 'addedAt'>) => useFavoritesStore.getState().addFavorite(item, auth),
        [auth]
    );

    const removeFavorite = useCallback(
        (id: number | string, type?: FavoriteItem['type']) => useFavoritesStore.getState().removeFavorite(id, type, auth),
        [auth]
    );

    const addToHistory = useCallback(
        (item: Omit<ViewHistoryItem, 'viewedAt'>) => useViewHistoryStore.getState().addToHistory(item, auth),
        [auth]
    );

    const clearHistory = useCallback(
        () => useViewHistoryStore.getState().clearHistory(auth),
        [auth]
    );

    const clearFavorites = useCallback(
        () => useFavoritesStore.getState().clearFavorites(auth),
        [auth]
    );

    const getRecommendations = useCallback(
        () => useRecommendationsStore.getState().getRecommendations(
            useFavoritesStore.getState().favorites,
            useViewHistoryStore.getState().viewHistory,
            auth
        ),
        [auth]
    );

    const ensureServerData = useCallback(
        async (kind: 'favorites' | 'history' | 'recommendations' | 'all') => {
            if (!isAuthenticated || !userId) return;
            const promises: Promise<void>[] = [];
            const needAll = kind === 'all';
            if (needAll || kind === 'favorites') promises.push(useFavoritesStore.getState().ensureServerData(userId));
            if (needAll || kind === 'history') promises.push(useViewHistoryStore.getState().ensureServerData(userId));
            if (needAll || kind === 'recommendations') promises.push(useRecommendationsStore.getState().ensureServerData(userId));
            await Promise.all(promises);
        },
        [isAuthenticated, userId]
    );

    const value = useMemo<FavoritesContextType>(() => ({
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
    }), [favorites, viewHistory, recommended, isFavorite, addFavorite, removeFavorite, addToHistory, clearHistory, clearFavorites, getRecommendations, ensureServerData]);

    return (
        <FavoritesContext.Provider value={value}>
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
