jest.unmock('@/context/FavoritesContext');
jest.unmock('@/context/FavoritesProvider');

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import { isFavoriteInCache } from '@/hooks/useFavoritesData';
import { setActiveQueryClient } from '@/api/activeQueryClient';
import { GUEST_FAVORITE_INTENT_KEY } from '@/utils/guestFavoriteIntent';

const mockQueueAnalyticsEvent = jest.fn();

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

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: any[]) => mockQueueAnalyticsEvent(...args),
}));

const mockAuthContext: { isAuthenticated: boolean; userId: string | null } = {
  isAuthenticated: false,
  userId: null,
};

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthContext,
}));

const seedPendingIntent = async () => {
  await AsyncStorage.setItem(
    GUEST_FAVORITE_INTENT_KEY,
    JSON.stringify({
      id: '42',
      type: 'article',
      title: 'Гайд по Минску',
      url: '/article/minsk-guide',
      source: 'article_detail',
      createdAt: Date.now(),
    })
  );
};

describe('FavoritesProvider guest intent restore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.userId = null;

    // favorites живут в RQ-кэше (#994) — мутации ходят через активный клиент.
    setActiveQueryClient(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  });

  afterEach(() => setActiveQueryClient(null));

  it('completes the pending guest favorite after auth and fires favorite_add once', async () => {
    await seedPendingIntent();
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.userId = '104';

    render(
      <FavoritesProvider>
        <></>
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(isFavoriteInCache('104', '42', 'article')).toBe(true);
    });

    expect(await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)).toBeNull();

    const favoriteAddCalls = mockQueueAnalyticsEvent.mock.calls.filter(
      ([event]) => event === 'favorite_add'
    );
    expect(favoriteAddCalls).toHaveLength(1);
    expect(favoriteAddCalls[0][1]).toMatchObject({
      item_type: 'article',
      item_id: '42',
      auth_state: 'authenticated',
    });
  });

  it('does not consume the intent while the user is still a guest', async () => {
    await seedPendingIntent();

    render(
      <FavoritesProvider>
        <></>
      </FavoritesProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)).not.toBeNull();
    expect(
      mockQueueAnalyticsEvent.mock.calls.filter(([event]) => event === 'favorite_add')
    ).toHaveLength(0);
  });
});
