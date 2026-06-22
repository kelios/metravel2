import { createContext, useContext, useMemo } from 'react';
import { useFavoritesStore, type FavoriteItem } from '@/stores/favoritesStore';
import { useViewHistoryStore, type ViewHistoryItem } from '@/stores/viewHistoryStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';

export type { FavoriteItem } from '@/stores/favoritesStore';
export type { ViewHistoryItem } from '@/stores/viewHistoryStore';

export interface FavoritesContextType {
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

// Actions/bootstrap supplied by the provider. Data slices (favorites/viewHistory/
// recommended/isFavorite) are read directly from the Zustand stores inside
// useFavorites() — see below.
export type FavoritesActionsContextType = Pick<
  FavoritesContextType,
  | 'addFavorite'
  | 'removeFavorite'
  | 'addToHistory'
  | 'clearHistory'
  | 'clearFavorites'
  | 'getRecommendations'
  | 'ensureServerData'
>;

const noopAsync = async () => {};
const noopRecommendations = () => [] as FavoriteItem[];

export const createFavoritesActionsFallbackValue = (): FavoritesActionsContextType => ({
  addFavorite: noopAsync,
  removeFavorite: noopAsync,
  addToHistory: noopAsync,
  clearHistory: noopAsync,
  clearFavorites: noopAsync,
  getRecommendations: noopRecommendations,
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

// Data is read straight from the stores (mirrors useAuth → useAuthStore) so
// consumers always reflect the live store regardless of provider re-render
// timing or duplicated-bundle context identity. The provider only supplies
// auth-bound action callbacks + bootstrap.
export const useFavorites = (): FavoritesContextType => {
  const actions = useContext(FavoritesContext);
  if (!actions) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }

  const favorites = useFavoritesStore((s) => s.favorites);
  const viewHistory = useViewHistoryStore((s) => s.viewHistory);
  const recommended = useRecommendationsStore((s) => s.recommended);

  return useMemo<FavoritesContextType>(
    () => ({
      favorites,
      viewHistory,
      recommended,
      isFavorite: (id, type) => useFavoritesStore.getState().isFavorite(id, type),
      ...actions,
    }),
    [favorites, viewHistory, recommended, actions]
  );
};
