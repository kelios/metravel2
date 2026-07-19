// FE-ARCH D1 #994 — избранное на React Query (замена favoritesStore).
// Портирует серверное/гостевое поведение + оптимистичные мутации на RQ-кэш и
// добавляет инварианты миграции: identity-isolation, in-flight дедуп, откат.

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => ({})),
  unmarkTravelAsFavorite: jest.fn(async () => ({})),
}));

jest.mock('@/api/user', () => ({
  clearUserFavorites: jest.fn(async () => null),
  fetchUserFavoriteTravels: jest.fn(async () => []),
}));

const authRef = { isAuthenticated: true, userId: 'user-1' as string | null };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => authRef }));

import {
  useFavoritesData,
  addFavorite,
  removeFavorite,
  clearFavorites,
  isFavoriteInCache,
  ensureFavoritesServerData,
  type FavoriteItem,
} from '@/hooks/useFavoritesData';
import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';
import { fetchUserFavoriteTravels, clearUserFavorites } from '@/api/user';
import { queryKeys } from '@/api/queryKeys';
import { setActiveQueryClient } from '@/api/activeQueryClient';

const mockMark = markTravelAsFavorite as jest.MockedFunction<typeof markTravelAsFavorite>;
const mockUnmark = unmarkTravelAsFavorite as jest.MockedFunction<typeof unmarkTravelAsFavorite>;
const mockFetch = fetchUserFavoriteTravels as jest.MockedFunction<typeof fetchUserFavoriteTravels>;
const mockClear = clearUserFavorites as jest.MockedFunction<typeof clearUserFavorites>;

const serverDto = (id: number) => ({
  id, name: `Travel ${id}`, url: `/travels/${id}`, slug: `t-${id}`, countryName: 'BY',
  travel_image_thumb_small_url: '', travel_image_thumb_url: `img-${id}`, updated_at: '2026-01-01T00:00:00Z',
});

let qc: QueryClient;
const read = (userId: string | null) =>
  qc.getQueryData<FavoriteItem[]>(queryKeys.favorites(userId)) ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  authRef.isAuthenticated = true;
  authRef.userId = 'user-1';
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setActiveQueryClient(qc);
});

afterEach(() => setActiveQueryClient(null));

describe('addFavorite (authenticated travel)', () => {
  it('marks via the server endpoint, optimistically adds, then syncs from server', async () => {
    mockFetch.mockResolvedValueOnce([serverDto(514)] as any);

    await addFavorite(
      { id: 514, type: 'travel', title: 'Random', url: '/travels/514' },
      { isAuthenticated: true, userId: '104' },
    );

    expect(mockMark).toHaveBeenCalledWith(514);
    expect(mockFetch).toHaveBeenCalledWith('104');
    expect(isFavoriteInCache('104', 514, 'travel')).toBe(true);
  });

  it('rolls back the optimistic add when the server mark fails', async () => {
    mockMark.mockRejectedValueOnce(new Error('boom'));

    await expect(
      addFavorite(
        { id: 7, type: 'travel', title: 'X', url: '/travels/7' },
        { isAuthenticated: true, userId: '104' },
      ),
    ).rejects.toThrow('boom');

    expect(isFavoriteInCache('104', 7, 'travel')).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('removeFavorite (authenticated travel)', () => {
  it('unmarks via the server endpoint and syncs', async () => {
    qc.setQueryData(queryKeys.favorites('104'), [
      { id: 514, type: 'travel', title: 'Random', url: '/travels/514', addedAt: 1 } as FavoriteItem,
    ]);
    mockFetch.mockResolvedValueOnce([] as any);

    await removeFavorite(514, 'travel', { isAuthenticated: true, userId: '104' });

    expect(mockUnmark).toHaveBeenCalledWith(514);
    expect(mockFetch).toHaveBeenCalledWith('104');
    expect(isFavoriteInCache('104', 514, 'travel')).toBe(false);
  });

  it('rolls back the optimistic remove when the server unmark fails', async () => {
    qc.setQueryData(queryKeys.favorites('104'), [
      { id: 8, type: 'travel', title: 'Keep', url: '/travels/8', addedAt: 1 } as FavoriteItem,
    ]);
    mockUnmark.mockRejectedValueOnce(new Error('net'));

    await expect(
      removeFavorite(8, 'travel', { isAuthenticated: true, userId: '104' }),
    ).rejects.toThrow('net');

    expect(isFavoriteInCache('104', 8, 'travel')).toBe(true);
  });
});

describe('guest favorites (no protected server calls)', () => {
  it('adds locally into the cache', async () => {
    await addFavorite(
      { id: 514, type: 'travel', title: 'Random', url: '/travels/514' },
      { isAuthenticated: false, userId: null },
    );
    expect(mockMark).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(isFavoriteInCache(null, 514, 'travel')).toBe(true);
  });

  it('removes locally from the cache', async () => {
    qc.setQueryData(queryKeys.favorites(null), [
      { id: 514, type: 'travel', title: 'Random', url: '/travels/514', addedAt: 1 } as FavoriteItem,
    ]);
    await removeFavorite(514, 'travel', { isAuthenticated: false, userId: null });
    expect(mockUnmark).not.toHaveBeenCalled();
    expect(isFavoriteInCache(null, 514, 'travel')).toBe(false);
  });

  it('stores article favorites locally even for an authenticated user', async () => {
    await addFavorite(
      { id: 'a-1', type: 'article', title: 'Guide', url: '/article/a-1' },
      { isAuthenticated: true, userId: '104' },
    );
    expect(mockMark).not.toHaveBeenCalled();
    expect(isFavoriteInCache('104', 'a-1', 'article')).toBe(true);
  });
});

describe('identity-isolation + clear', () => {
  it('scopes favorites by userId', async () => {
    qc.setQueryData(queryKeys.favorites('user-1'), [
      { id: 1, type: 'travel', title: 'A', url: '/travels/1', addedAt: 1 } as FavoriteItem,
    ]);
    expect(isFavoriteInCache('user-1', 1, 'travel')).toBe(true);
    expect(isFavoriteInCache(null, 1, 'travel')).toBe(false);
    expect(isFavoriteInCache('user-2', 1, 'travel')).toBe(false);
  });

  it('clearFavorites: auth calls server clear then empties cache', async () => {
    qc.setQueryData(queryKeys.favorites('104'), [
      { id: 1, type: 'travel', title: 'A', url: '/travels/1', addedAt: 1 } as FavoriteItem,
    ]);
    await clearFavorites({ isAuthenticated: true, userId: '104' });
    expect(mockClear).toHaveBeenCalledWith('104');
    expect(read('104')).toEqual([]);
  });

  it('clearFavorites: guest empties cache without server call', async () => {
    qc.setQueryData(queryKeys.favorites(null), [
      { id: 1, type: 'travel', title: 'A', url: '/travels/1', addedAt: 1 } as FavoriteItem,
    ]);
    await clearFavorites({ isAuthenticated: false, userId: null });
    expect(mockClear).not.toHaveBeenCalled();
    expect(read(null)).toEqual([]);
  });
});

describe('ensureFavoritesServerData', () => {
  it('fetches server favorites once within the stale window', async () => {
    mockFetch.mockResolvedValue([serverDto(1)] as any);
    await ensureFavoritesServerData('user-1');
    await ensureFavoritesServerData('user-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(isFavoriteInCache('user-1', 1, 'travel')).toBe(true);
  });

  it('is a no-op for guests', async () => {
    await ensureFavoritesServerData(null);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useFavoritesData (reactive read)', () => {
  it('reflects cache writes without auto-fetching the server', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useFavoritesData(), { wrapper });
    expect(result.current).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();

    await addFavorite(
      { id: 99, type: 'travel', title: 'Z', url: '/travels/99' },
      { isAuthenticated: false, userId: null },
    );
    // guest scope is null; hook reads userId 'user-1' by default — switch guest
    authRef.userId = null;
    const { result: guestResult } = renderHook(() => useFavoritesData(), { wrapper });
    await waitFor(() => expect(guestResult.current).toHaveLength(1));
    expect(guestResult.current[0].id).toBe(99);
  });
});
