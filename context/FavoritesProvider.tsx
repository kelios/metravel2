import React, { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  FavoritesContext,
  type FavoriteItem,
  type FavoritesActionsContextType,
  type ViewHistoryItem,
} from '@/context/FavoritesContext';
import { queueAnalyticsEvent } from '@/utils/analytics';
import {
  addFavorite as addFavoriteToCache,
  removeFavorite as removeFavoriteFromCache,
  clearFavorites as clearFavoritesInCache,
  ensureFavoritesServerData,
  isFavoriteInCache,
} from '@/hooks/useFavoritesData';
import {
  addViewHistoryItem,
  clearViewHistory,
  ensureViewHistoryServerData,
} from '@/hooks/useViewHistory';
import { consumeGuestFavoriteIntent } from '@/utils/guestFavoriteIntent';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userId } = useAuth();
  const auth = useMemo(() => ({ isAuthenticated, userId }), [isAuthenticated, userId]);

  // Boot-загрузка favorites/history/recommendations удалена: серверный стейт
  // и офлайн держат React Query + persistQueryClient (#994/#1015), список
  // восстанавливается из persist без ручного loadServerCached/loadLocal.

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'addedAt'>) => {
      queueAnalyticsEvent('favorite_add', {
        item_type: item.type,
        item_id: String(item.id),
        auth_state: auth.isAuthenticated ? 'authenticated' : 'guest',
      });
      return addFavoriteToCache(item, auth);
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
      if (isFavoriteInCache(userId, intent.id, intent.type)) return;
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
      removeFavoriteFromCache(id, type, auth),
    [auth]
  );

  const addToHistory = useCallback(
    (item: Omit<ViewHistoryItem, 'viewedAt'>) => addViewHistoryItem(userId, item),
    [userId]
  );

  const clearHistory = useCallback(() => clearViewHistory(userId), [userId]);
  const clearFavorites = useCallback(() => clearFavoritesInCache(auth), [auth]);

  const ensureServerData = useCallback(
    async (kind: 'favorites' | 'history' | 'all') => {
      if (!isAuthenticated || !userId) return;
      const promises: Promise<void>[] = [];
      const needAll = kind === 'all';
      if (needAll || kind === 'favorites') promises.push(ensureFavoritesServerData(userId));
      if (needAll || kind === 'history') promises.push(ensureViewHistoryServerData(userId));
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
      ensureServerData,
    }),
    [
      addFavorite,
      removeFavorite,
      addToHistory,
      clearHistory,
      clearFavorites,
      ensureServerData,
    ]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
