jest.unmock('@/context/FavoritesContext');

import React, { memo, useLayoutEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setActiveQueryClient } from '@/api/activeQueryClient';
import { queryKeys } from '@/api/queryKeys';
import { markTravelAsFavorite } from '@/api/travelsFavorites';
import { fetchUserFavoriteTravels, fetchUserHistory } from '@/api/user';
import { FavoritesContext, useFavorites } from '@/context/FavoritesContext';
import { addFavorite, type FavoriteItem } from '@/hooks/useFavoritesData';
import { addViewHistoryItem } from '@/hooks/useViewHistory';

const mockAuth = { isAuthenticated: true, userId: 'viewer-1' };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/api/travelsFavorites', () => ({ markTravelAsFavorite: jest.fn() }));
jest.mock('@/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(),
  fetchUserHistory: jest.fn(),
}));

const item = (id: number, type: FavoriteItem['type'] = 'travel') => ({
  id,
  type,
  title: String(id),
  url: `/travels/${id}`,
});

it('limits commits to the changed favorite, including the first write and rollback', async () => {
  const client = new QueryClient();
  const onCardCommit = jest.fn();
  const onCollectionsCommit = jest.fn();
  const onActionsCommit = jest.fn();
  const Card = memo(function Card({ id }: { id: number; account: string }) {
    const { isFavorite } = useFavorites({ mode: 'lookup', target: { id, type: 'travel' } });
    useLayoutEffect(() => {
      onCardCommit(id, isFavorite(id, 'travel'));
    });
    return null;
  });
  const Collections = () => {
    const { favorites, viewHistory } = useFavorites();
    useLayoutEffect(() => {
      onCollectionsCommit(favorites.length, viewHistory.length);
    });
    return null;
  };
  const Actions = memo(function Actions() {
    const { addToHistory } = useFavorites({ mode: 'actions' });
    useLayoutEffect(() => {
      onActionsCommit(addToHistory);
    });
    return null;
  });
  const actions = {
    addFavorite: (value: Omit<FavoriteItem, 'addedAt'>) => addFavorite(value, mockAuth),
    removeFavorite: async () => {},
    addToHistory: (value: Omit<FavoriteItem, 'addedAt'>) => addViewHistoryItem(mockAuth.userId, value),
  };
  const tree = (account: string) => (
    <QueryClientProvider client={client}>
      <FavoritesContext.Provider value={actions}>
        <Collections />
        <Actions />
        {Array.from({ length: 24 }, (_, id) => <Card key={id} id={id} account={account} />)}
      </FavoritesContext.Provider>
    </QueryClientProvider>
  );
  let rejectSave!: (error: Error) => void;
  jest.mocked(markTravelAsFavorite).mockImplementationOnce(() => new Promise((_, reject) => {
    rejectSave = reject;
  }));

  setActiveQueryClient(client);
  try {
    const view = await render(tree(mockAuth.userId));
    expect(onCardCommit).toHaveBeenCalledTimes(24);
    onCardCommit.mockClear();
    onActionsCommit.mockClear();

    await act(async () => actions.addToHistory(item(100)));
    await waitFor(() => expect(onCollectionsCommit).toHaveBeenLastCalledWith(0, 1));
    expect(onCardCommit).not.toHaveBeenCalled();

    const failed = new Error('mutation rejected');
    let result!: Promise<unknown>;
    await act(async () => {
      result = actions.addFavorite(item(0)).catch((error: unknown) => error);
    });
    await waitFor(() => expect(onCollectionsCommit).toHaveBeenLastCalledWith(1, 1));
    expect(onCardCommit.mock.calls).toEqual([[0, true]]);
    onCardCommit.mockClear();

    await act(async () => {
      rejectSave(failed);
      expect(await result).toBe(failed);
    });
    await waitFor(() => expect(onCollectionsCommit).toHaveBeenLastCalledWith(0, 1));
    expect(onCardCommit.mock.calls).toEqual([[0, false]]);
    expect(onActionsCommit).not.toHaveBeenCalled();

    // Matching ids from the other type and a different owner stay isolated.
    await act(async () => actions.addFavorite(item(0, 'article')));
    await waitFor(() => expect(onCollectionsCommit).toHaveBeenLastCalledWith(1, 1));
    expect(onCardCommit.mock.calls).toEqual([[0, false]]);

    client.setQueryData(queryKeys.favorites('viewer-2'), [{ ...item(3), addedAt: 1 }]);
    mockAuth.userId = 'viewer-2';
    onCardCommit.mockClear();
    await view.rerender(tree(mockAuth.userId));
    expect(onCardCommit.mock.calls.filter(([, saved]) => saved)).toEqual([[3, true]]);
    expect(fetchUserFavoriteTravels).not.toHaveBeenCalled();
    expect(fetchUserHistory).not.toHaveBeenCalled();
    await view.unmount();
  } finally {
    mockAuth.userId = 'viewer-1';
    client.clear();
    setActiveQueryClient(null);
  }
});
