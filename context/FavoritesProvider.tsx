import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import {
  FavoritesContext,
  type FavoriteItem,
  type FavoritesActionsContextType,
  type ViewHistoryItem,
} from '@/context/FavoritesContext';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { useViewHistoryStore } from '@/stores/viewHistoryStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { consumeGuestFavoriteIntent } from '@/utils/guestFavoriteIntent';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userId } = useAuth();
  const auth = useMemo(() => ({ isAuthenticated, userId }), [isAuthenticated, userId]);

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

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'addedAt'>) => {
      queueAnalyticsEvent('favorite_add', {
        item_type: item.type,
        item_id: String(item.id),
        auth_state: auth.isAuthenticated ? 'authenticated' : 'guest',
      });
      return useFavoritesStore.getState().addFavorite(item, auth);
    },
    [auth]
  );

  // Deferred first value action: a guest tapped "save" before the auth wall
  // (utils/guestFavoriteIntent). Complete it once after login/registration so
  // the guest CTA is not a dead end. consumeGuestFavoriteIntent removes the
  // stored intent before returning it, so the favorite is added (and
  // `favorite_add` fires) at most once.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;

    void consumeGuestFavoriteIntent().then((intent) => {
      if (!intent || cancelled) return;
      if (useFavoritesStore.getState().isFavorite(intent.id, intent.type)) return;
      void addFavorite({
        id: intent.id,
        type: intent.type,
        title: intent.title,
        url: intent.url,
        imageUrl: intent.imageUrl,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [addFavorite, isAuthenticated, userId]);

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

  const value = useMemo<FavoritesActionsContextType>(
    () => ({
      addFavorite,
      removeFavorite,
      addToHistory,
      clearHistory,
      clearFavorites,
      getRecommendations,
      ensureServerData,
    }),
    [
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
