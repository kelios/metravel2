// Regression: useFavorites() must reflect live server-state, not a stale memoized
// provider value. On native cold start favorites were populated (4/20) while the
// provider reported empty arrays, so the mobile shelves never rendered. The hook
// reads favorites straight from the Zustand store and viewHistory from the React
// Query cache (#994) — both update the context live after mount.
jest.unmock('@/context/FavoritesContext');
jest.unmock('@/context/FavoritesProvider');

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import { queryKeys } from '@/api/queryKeys';
import { setActiveQueryClient } from '@/api/activeQueryClient';

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

let queryClient: QueryClient;

describe('useFavorites store sync (native cold-start regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.userId = 'user-1';

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    setActiveQueryClient(queryClient);
  });

  afterEach(() => setActiveQueryClient(null));

  it('reflects favorites + viewHistory (RQ cache) populated after mount', async () => {
    let ctx: any;
    render(
      <QueryClientProvider client={queryClient}>
        <FavoritesProvider>
          <Probe onContext={(c) => { ctx = c; }} />
        </FavoritesProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    expect(ctx.favorites).toHaveLength(0);
    expect(ctx.viewHistory).toHaveLength(0);

    // Fill both RQ caches AFTER the provider already rendered (the real
    // cold-start sequence): favorites + viewHistory both from persist/refetch.
    await act(async () => {
      queryClient.setQueryData(
        queryKeys.favorites('user-1'),
        [
          { id: 1, type: 'travel', title: 'Fav 1', url: '/travels/1', addedAt: 1 },
          { id: 2, type: 'travel', title: 'Fav 2', url: '/travels/2', addedAt: 2 },
          { id: 3, type: 'travel', title: 'Fav 3', url: '/travels/3', addedAt: 3 },
          { id: 4, type: 'travel', title: 'Fav 4', url: '/travels/4', addedAt: 4 },
        ],
      );
      queryClient.setQueryData(
        queryKeys.viewHistory('user-1'),
        Array.from({ length: 20 }, (_, i) => ({
          id: 100 + i,
          type: 'travel' as const,
          title: `Hist ${i}`,
          url: `/travels/${100 + i}`,
          viewedAt: i,
        })),
      );
    });

    await waitFor(() => {
      expect(ctx.favorites).toHaveLength(4);
      expect(ctx.viewHistory).toHaveLength(20);
    });

    expect(ctx.isFavorite(1, 'travel')).toBe(true);
    expect(ctx.isFavorite(999, 'travel')).toBe(false);
  });
});
