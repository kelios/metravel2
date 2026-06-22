// Regression: useFavorites() must reflect the live Zustand stores, not a stale
// provider context value. On native cold start the store was populated (4/20)
// while the provider's memoized context value reported empty arrays, so the
// mobile Favorites/History shelves never rendered. The hook now reads slices
// straight from the stores (mirrors useAuth → useAuthStore).
jest.unmock('@/context/FavoritesContext');
jest.unmock('@/context/FavoritesProvider');

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { FavoritesProvider } from '@/context/FavoritesProvider';

jest.mock('@/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(async () => []),
  fetchUserHistory: jest.fn(async () => []),
  fetchUserRecommendedTravels: jest.fn(async () => []),
  clearUserHistory: jest.fn(async () => null),
  clearUserFavorites: jest.fn(async () => null),
}));

jest.mock('@/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => ({})),
  unmarkTravelAsFavorite: jest.fn(async () => ({})),
}));

const mockAuthContext = { isAuthenticated: true, userId: 'user-1' as string | null };
jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthContext,
}));

const { useFavorites } = jest.requireActual('@/context/FavoritesContext');

const Probe: React.FC<{ onContext: (ctx: any) => void }> = ({ onContext }) => {
  const ctx = useFavorites();
  React.useEffect(() => {
    onContext(ctx);
  }, [ctx, onContext]);
  return null;
};

describe('useFavorites store sync (native cold-start regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.userId = 'user-1';

    const { useFavoritesStore } = require('@/stores/favoritesStore');
    const { useViewHistoryStore } = require('@/stores/viewHistoryStore');
    const { useRecommendationsStore } = require('@/stores/recommendationsStore');
    useFavoritesStore.setState({ favorites: [], _inFlight: new Set(), _fetched: false, _userId: null });
    useViewHistoryStore.setState({ viewHistory: [], _fetched: false, _userId: null });
    useRecommendationsStore.setState({ recommended: [], _fetched: false, _userId: null });
  });

  it('reflects favorites/viewHistory populated in the store after mount', async () => {
    const { useFavoritesStore } = require('@/stores/favoritesStore');
    const { useViewHistoryStore } = require('@/stores/viewHistoryStore');

    let ctx: any;
    render(
      <FavoritesProvider>
        <Probe onContext={(c) => { ctx = c; }} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    expect(ctx.favorites).toHaveLength(0);
    expect(ctx.viewHistory).toHaveLength(0);

    // Simulate the store being filled by refreshFromServer/loadServerCached
    // AFTER the provider already rendered (the real cold-start sequence).
    await act(async () => {
      useFavoritesStore.setState({
        favorites: [
          { id: 1, type: 'travel', title: 'Fav 1', url: '/travels/1', addedAt: 1 },
          { id: 2, type: 'travel', title: 'Fav 2', url: '/travels/2', addedAt: 2 },
          { id: 3, type: 'travel', title: 'Fav 3', url: '/travels/3', addedAt: 3 },
          { id: 4, type: 'travel', title: 'Fav 4', url: '/travels/4', addedAt: 4 },
        ],
      });
      useViewHistoryStore.setState({
        viewHistory: Array.from({ length: 20 }, (_, i) => ({
          id: 100 + i,
          type: 'travel' as const,
          title: `Hist ${i}`,
          url: `/travels/${100 + i}`,
          viewedAt: i,
        })),
      });
    });

    await waitFor(() => {
      expect(ctx.favorites).toHaveLength(4);
      expect(ctx.viewHistory).toHaveLength(20);
    });

    // isFavorite resolves against the live store too.
    expect(ctx.isFavorite(1, 'travel')).toBe(true);
    expect(ctx.isFavorite(999, 'travel')).toBe(false);
  });
});
