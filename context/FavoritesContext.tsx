import { createContext, useContext, useMemo } from 'react';
import { useFavoritesData, type FavoriteItem } from '@/hooks/useFavoritesData';
import { useViewHistory, type ViewHistoryItem } from '@/hooks/useViewHistory';

export type { FavoriteItem } from '@/hooks/useFavoritesData';
export type { ViewHistoryItem } from '@/hooks/useViewHistory';

export interface FavoritesContextType {
  favorites: FavoriteItem[];
  viewHistory: ViewHistoryItem[];
  isFavorite: (id: number | string, type: FavoriteItem['type']) => boolean;
  addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
  removeFavorite: (id: number | string, type?: FavoriteItem['type']) => Promise<void>;
  addToHistory: (item: Omit<ViewHistoryItem, 'viewedAt'>) => Promise<void>;
  clearHistory?: () => Promise<void>;
  clearFavorites?: () => Promise<void>;
  // 'recommendations' больше не серверный стор: рекомендации на React Query
  // (hooks/useRecommendedTravels). ensureServerData оставлен для favorites/history
  // как совместимый фасад ленивого серверного обновления.
  ensureServerData?: (kind: 'favorites' | 'history' | 'all') => Promise<void>;
}

// Actions/bootstrap supplied by the provider. Data slices (favorites/viewHistory/
// isFavorite) are read directly from the React Query cache inside useFavorites().
export type FavoritesActionsContextType = Pick<
  FavoritesContextType,
  | 'addFavorite'
  | 'removeFavorite'
  | 'addToHistory'
  | 'clearHistory'
  | 'clearFavorites'
  | 'ensureServerData'
>;

const noopAsync = async () => {};

export const createFavoritesActionsFallbackValue = (): FavoritesActionsContextType => ({
  addFavorite: noopAsync,
  removeFavorite: noopAsync,
  addToHistory: noopAsync,
  clearHistory: noopAsync,
  clearFavorites: noopAsync,
  ensureServerData: noopAsync,
});

export const createFavoritesFallbackValue = (): FavoritesActionsContextType =>
  createFavoritesActionsFallbackValue();

const globalForFavoritesContext = globalThis as any;
export const FavoritesContext: ReturnType<
  typeof createContext<FavoritesActionsContextType | undefined>
> =
  globalForFavoritesContext.__metravelFavoritesContext ??
  createContext<FavoritesActionsContextType | undefined>(undefined);
globalForFavoritesContext.__metravelFavoritesContext = FavoritesContext;

// Data is read straight from React Query, so consumers reflect live cache updates
// regardless of provider re-render timing or duplicated-bundle context identity.
// The provider only supplies auth-bound action callbacks + bootstrap.
export const useFavorites = (): FavoritesContextType => {
  const actions = useContext(FavoritesContext);
  if (!actions) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }

  const favorites = useFavoritesData();
  const viewHistory = useViewHistory();

  return useMemo<FavoritesContextType>(
    () => ({
      favorites,
      viewHistory,
      isFavorite: (id, type) => favorites.some((f) => f.id === id && f.type === type),
      ...actions,
    }),
    [favorites, viewHistory, actions]
  );
};
