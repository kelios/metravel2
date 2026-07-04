import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers } from '@/api/user';
import { fetchMyTravels } from '@/api/travelUserQueries';
import { createAuthValue } from '../helpers/mockContextValues';
import { createQueryWrapper } from '../helpers/testQueryClient';

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
