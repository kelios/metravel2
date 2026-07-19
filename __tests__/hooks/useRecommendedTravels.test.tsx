// FE-ARCH D1 #994 — рекомендации на React Query (замена recommendationsStore).
// Инварианты миграции: identity-isolation (кэш scoped по userId), guest-fallback
// (запрос выключен без auth → []), и «не затирать непустое пустым ответом сервера»
// (сохранён из старого стора).

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
  fetchUserRecommendedTravels: jest.fn(),
}));

const authRef = { isAuthenticated: true, userId: 'user-1' as string | null };
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => authRef,
}));

import { useRecommendedTravels } from '@/hooks/useRecommendedTravels';
import { fetchUserRecommendedTravels } from '@/api/user';
import { queryKeys } from '@/api/queryKeys';
import { setActiveQueryClient } from '@/api/activeQueryClient';
import type { FavoriteItem } from '@/hooks/useFavoritesData';

const mockFetch = fetchUserRecommendedTravels as jest.MockedFunction<
  typeof fetchUserRecommendedTravels
>;

const dto = (id: number) => ({
  id,
  name: `Travel ${id}`,
  url: `/travels/${id}`,
  slug: `t-${id}`,
  countryName: 'BY',
  travel_image_thumb_small_url: '',
  travel_image_thumb_url: `img-${id}`,
  updated_at: '2024-01-01T00:00:00Z',
});

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setActiveQueryClient(qc);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
};

describe('useRecommendedTravels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authRef.isAuthenticated = true;
    authRef.userId = 'user-1';
  });

  afterEach(() => {
    setActiveQueryClient(null);
  });

  it('normalizes server DTO into FavoriteItem[] for the authenticated user', async () => {
    mockFetch.mockResolvedValue([dto(1), dto(2)] as any);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useRecommendedTravels(), { wrapper });

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(mockFetch).toHaveBeenCalledWith('user-1');
    expect(result.current[0]).toMatchObject({
      id: 1,
      type: 'travel',
      url: '/travels/t-1',
      imageUrl: 'img-1',
      country: 'BY',
    });
  });

  it('is disabled for guests: no fetch, returns []', () => {
    authRef.isAuthenticated = false;
    authRef.userId = null;
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useRecommendedTravels(), { wrapper });

    expect(result.current).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('scopes cache by userId — switching user does not leak another user cache', async () => {
    mockFetch.mockResolvedValueOnce([dto(1)] as any);
    const { qc, wrapper } = makeWrapper();

    const { result, rerender } = renderHook(() => useRecommendedTravels(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));

    authRef.userId = 'user-2';
    mockFetch.mockResolvedValueOnce([dto(9), dto(10)] as any);
    rerender({});
    await waitFor(() => expect(result.current).toHaveLength(2));

    expect(qc.getQueryData(queryKeys.recommendations('user-1'))).toHaveLength(1);
    expect(qc.getQueryData(queryKeys.recommendations('user-2'))).toHaveLength(2);
  });

  it('does not clobber existing recommendations with an empty server response', async () => {
    const { qc, wrapper } = makeWrapper();
    const seeded: FavoriteItem[] = [
      { id: 5, type: 'travel', title: 'Kept', url: '/travels/5', addedAt: 1 },
    ];
    qc.setQueryData(queryKeys.recommendations('user-1'), seeded);
    mockFetch.mockResolvedValue([] as any);

    const { result } = renderHook(() => useRecommendedTravels(), { wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe(5);
  });
});
