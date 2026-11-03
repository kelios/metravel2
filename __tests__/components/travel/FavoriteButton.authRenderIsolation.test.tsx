jest.unmock('@/context/FavoritesContext');

import { Profiler } from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import FavoriteButton from '@/components/travel/FavoriteButton';
import { AuthContext, createAuthFallbackValue } from '@/context/authContextBase';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import { resetAuthStoreForTests, useAuthStore } from '@/stores/authStore';

it('keeps 20 favorite buttons stable for profile updates and refreshes them on account change', async () => {
  const client = new QueryClient();
  const onCommit = jest.fn();
  const ids = Array.from({ length: 20 }, (_, id) => id);
  useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: 'viewer-1' });
  client.setQueryData(queryKeys.favorites('viewer-2'), [
    { id: 5, type: 'travel', title: 'Trip 5', url: '/travels/5', addedAt: 1 },
  ]);

  try {
    const view = await render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={createAuthFallbackValue()}>
          <FavoritesProvider>
            {ids.map((id) => (
              <Profiler key={id} id={String(id)} onRender={onCommit}>
                <FavoriteButton id={id} type="travel" title={`Trip ${id}`} url={`/travels/${id}`} />
              </Profiler>
            ))}
          </FavoritesProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    expect(new Set(onCommit.mock.calls.map(([id]) => id))).toEqual(new Set(ids.map(String)));
    expect(view.getByLabelText(/Добавить "Trip 5" в «Хочу поехать»/)).toBeTruthy();
    onCommit.mockClear();

    await act(async () => { useAuthStore.getState().setUserAvatar('https://example.test/avatar.png'); });
    await act(async () => { useAuthStore.getState().triggerProfileRefresh(); });
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => { useAuthStore.setState({ userId: 'viewer-2' }); });
    expect(new Set(onCommit.mock.calls.map(([id]) => id))).toEqual(new Set(ids.map(String)));
    expect(view.getByLabelText(/Удалить "Trip 5" из «Хочу поехать»/)).toBeTruthy();

    await act(async () => { useAuthStore.setState({ userId: null, isAuthenticated: false }); });
    expect(view.getByLabelText(/Добавить "Trip 5" в «Хочу поехать»/)).toBeTruthy();
    await view.unmount();
  } finally {
    client.clear();
    resetAuthStoreForTests();
  }
});
