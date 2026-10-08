import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';

import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers } from '@/api/user';
import { fetchMyTravels } from '@/api/travelUserQueries';
import { createAuthValue } from '../helpers/mockContextValues';
import { createQueryWrapper } from '../helpers/testQueryClient';
import { queryKeys } from '@/api/queryKeys';

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => '1' }));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/api/user', () => ({
  fetchMySubscriptions: jest.fn(),
  fetchMySubscribers: jest.fn(),
  unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/api/travelUserQueries', () => ({
  fetchMyTravels: jest.fn(),
  unwrapMyTravelsPayload: jest.fn(() => ({ items: [], total: 0 })),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(() => Promise.resolve(true)),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedFetchMySubscriptions = fetchMySubscriptions as jest.Mock;
const mockedFetchMySubscribers = fetchMySubscribers as jest.Mock;
const mockedFetchMyTravels = fetchMyTravels as jest.Mock;

const makeAuthor = (id: number) => ({
  id,
  user: id,
  first_name: `Author ${id}`,
  last_name: 'Tester',
});

function SubscriptionsProbe() {
  const { authors } = useSubscriptionsData({ includeAuthorTravels: true });
  return <Text testID="authors-count">{authors.length}</Text>;
}

describe('useSubscriptionsData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isAuthenticated: true,
        authReady: true,
        userId: '1',
      })
    );
    mockedFetchMySubscribers.mockResolvedValue([]);
  });

  it('distinguishes pending lists from a confirmed empty list', async () => {
    let resolveSubscriptions!: (profiles: unknown[]) => void;
    mockedFetchMySubscriptions.mockImplementation(() => new Promise((resolve) => { resolveSubscriptions = resolve; }));
    const { result } = renderHook(() => useSubscriptionsData(), { wrapper: createQueryWrapper().Wrapper });

    expect(result.current.subscriptionsCount).toBeUndefined();
    expect(result.current.subscribersCount).toBeUndefined();
    await waitFor(() => expect(result.current.subscribersCount).toBe(0));
    await act(async () => resolveSubscriptions([]));
    await waitFor(() => expect(result.current.subscriptionsCount).toBe(0));
  });

  it('preserves cached counts when a background refetch fails', async () => {
    const { Wrapper, queryClient } = createQueryWrapper();
    queryClient.setQueryData(queryKeys.mySubscriptions('1'), [makeAuthor(2)]);
    mockedFetchMySubscriptions.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useSubscriptionsData(), { wrapper: Wrapper });

    expect(result.current.subscriptionsCount).toBe(1);
    const dataUpdatedAt = result.current.subscriptionsDataUpdatedAt;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.mySubscriptions('1') });
    });
    expect(queryClient.getQueryState(queryKeys.mySubscriptions('1'))?.status).toBe('error');
    expect(result.current.subscriptionsCount).toBe(1);
    expect(result.current.subscriptionsDataUpdatedAt).toBe(dataUpdatedAt);
    act(() => {
      queryClient.setQueryData(queryKeys.mySubscriptions('1'), [], { updatedAt: dataUpdatedAt + 1 });
    });
    await waitFor(() => expect(result.current.subscriptionsCount).toBe(0));
    expect(result.current.subscriptionsDataUpdatedAt).toBe(dataUpdatedAt + 1);
  });

  it('limits author travel preview requests to four concurrent fetches', async () => {
    const authors = Array.from({ length: 8 }, (_, index) => makeAuthor(index + 1));
    let activeFetches = 0;
    let maxConcurrentFetches = 0;

    mockedFetchMySubscriptions.mockResolvedValue(authors);
    mockedFetchMyTravels.mockImplementation(
      () =>
        new Promise((resolve) => {
          activeFetches += 1;
          maxConcurrentFetches = Math.max(maxConcurrentFetches, activeFetches);
          setTimeout(() => {
            activeFetches -= 1;
            resolve([]);
          }, 20);
        })
    );

    render(<SubscriptionsProbe />, {
      wrapper: createQueryWrapper().Wrapper,
    });

    await waitFor(() => {
      expect(mockedFetchMyTravels).toHaveBeenCalledTimes(authors.length);
    });

    expect(maxConcurrentFetches).toBeLessThanOrEqual(4);
    expect(mockedFetchMyTravels).toHaveBeenCalledWith({ user_id: 1, perPage: 10 });
  });
});
