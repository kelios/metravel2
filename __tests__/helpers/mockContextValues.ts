import type { AuthStore } from '@/stores/authStore';
import type { FavoriteItem, ViewHistoryItem } from '@/context/FavoritesContext';
import type { useFavorites } from '@/context/FavoritesContext';

type FavoritesContextValue = ReturnType<typeof useFavorites>;

export const createAuthValue = (overrides: Partial<AuthStore> = {}): AuthStore => ({
  isAuthenticated: true,
  username: 'Test User',
  isSuperuser: false,
  userId: '123',
  userAvatar: null,
  authReady: true,
  profileRefreshToken: 0,
  setIsAuthenticated: jest.fn(),
  setUsername: jest.fn(),
  setIsSuperuser: jest.fn(),
  setUserId: jest.fn(),
  setUserAvatar: jest.fn(),
  triggerProfileRefresh: jest.fn(),
  invalidateAuthState: jest.fn(),
  checkAuthentication: jest.fn().mockResolvedValue(undefined),
  login: jest.fn().mockResolvedValue(true),
  logout: jest.fn().mockResolvedValue(undefined),
  sendPassword: jest.fn().mockResolvedValue(''),
  setNewPassword: jest.fn().mockResolvedValue(true),
  ...overrides,
});

export const createFavoriteItem = (id: number): FavoriteItem => ({
  id,
  type: 'travel',
  title: `Fav ${id}`,
  url: `/travels/${id}`,
  addedAt: Date.now(),
});

export const createHistoryItem = (id: number): ViewHistoryItem => ({
  id,
  type: 'travel',
  title: `History ${id}`,
  url: `/travels/${id}`,
  viewedAt: Date.now(),
});

export const createFavoritesValue = ({
  favorites = [],
  viewHistory = [],
  overrides = {},
}: {
  favorites?: FavoriteItem[];
  viewHistory?: ViewHistoryItem[];
  overrides?: Partial<FavoritesContextValue>;
} = {}): FavoritesContextValue => ({
  favorites,
  viewHistory,
  recommended: [],
  isFavorite: jest.fn(),
  addFavorite: jest.fn().mockResolvedValue(undefined),
  removeFavorite: jest.fn().mockResolvedValue(undefined),
  addToHistory: jest.fn().mockResolvedValue(undefined),
  clearHistory: jest.fn().mockResolvedValue(undefined),
  clearFavorites: jest.fn().mockResolvedValue(undefined),
  getRecommendations: jest.fn(() => []),
  ensureServerData: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});
