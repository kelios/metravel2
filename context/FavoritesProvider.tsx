import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import {
  FavoritesContext,
  type FavoriteItem,
  type FavoritesContextType,
  type ViewHistoryItem,
} from '@/context/FavoritesContext';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useViewHistoryStore } from '@/stores/viewHistoryStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
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

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(doLoad, { timeout: 2000 });
      return () => {
        try {
          (window as any).cancelIdleCallback(id);
        } catch {
          // noop
        }
      };
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
    (id: number | string, type?: FavoriteItem['type']) =>
      useFavoritesStore.getState().removeFavorite(id, type, auth),
    [auth]
  );

  const addToHistory = useCallback(
    (item: Omit<ViewHistoryItem, 'viewedAt'>) => useViewHistoryStore.getState().addToHistory(item, auth),
    [auth]
  );

  const clearHistory = useCallback(() => useViewHistoryStore.getState().clearHistory(auth), [auth]);
  const clearFavorites = useCallback(() => useFavoritesStore.getState().clearFavorites(auth), [auth]);

  const getRecommendations = useCallback(
    () =>
      useRecommendationsStore.getState().getRecommendations(
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
      if (needAll || kind === 'recommendations') {
        promises.push(useRecommendationsStore.getState().ensureServerData(userId));
      }
      await Promise.all(promises);
    },
    [isAuthenticated, userId]
  );

  const value = useMemo<FavoritesContextType>(
    () => ({
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
    }),
    [
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
    ]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
