import { createContext, useContext } from 'react';
import type { FavoriteItem } from '@/stores/favoritesStore';
import type { ViewHistoryItem } from '@/stores/viewHistoryStore';

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

const noopAsync = async () => {};
const noopRecommendations = () => [] as FavoriteItem[];

export const createFavoritesFallbackValue = (): FavoritesContextType => ({
  favorites: [],
  viewHistory: [],
  recommended: [],
  isFavorite: () => false,
  addFavorite: noopAsync,
  removeFavorite: noopAsync,
  addToHistory: noopAsync,
  clearHistory: noopAsync,
  clearFavorites: noopAsync,
  getRecommendations: noopRecommendations,
  ensureServerData: noopAsync,
});

const globalForFavoritesContext = globalThis as any;
export const FavoritesContext: ReturnType<typeof createContext<FavoritesContextType | undefined>> =
  globalForFavoritesContext.__metravelFavoritesContext ??
  createContext<FavoritesContextType | undefined>(undefined);
globalForFavoritesContext.__metravelFavoritesContext = FavoritesContext;

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
