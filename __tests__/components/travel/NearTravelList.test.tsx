import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NearTravelList from '@/components/travel/NearTravelList';
import type { Travel } from '@/types/types';

jest.mock('@/api/map', () => ({
  fetchTravelsNear: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/components/map/Map', () => () => null);

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: true,
    isMobile: false,
    width: 1280,
  }),
}));

describe('NearTravelList', () => {
  jest.setTimeout(15000);
  const { fetchTravelsNear } = jest.requireMock('@/api/map') as {
    fetchTravelsNear: jest.Mock;
  };
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchTravelsNear.mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    queryClient.clear();
  });

  const flush = async () => {
    await act(async () => {
      jest.advanceTimersByTime(350); // wait for debounce (300ms) + buffer
      jest.runOnlyPendingTimers();
      // flush promises
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('fetches near travels only once per travel id', async () => {
    const travel: Pick<Travel, 'id'> = { id: 1 };
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <NearTravelList travel={travel} />
      </QueryClientProvider>
    );

    await flush();
    expect(fetchTravelsNear).toHaveBeenCalledTimes(1);

    // rerender with the same id should not trigger another fetch
    rerender(
      <QueryClientProvider client={queryClient}>
        <NearTravelList travel={travel} />
      </QueryClientProvider>
    );
    await flush();
    expect(fetchTravelsNear).toHaveBeenCalledTimes(1);

    // change id -> should fetch again
    rerender(
      <QueryClientProvider client={queryClient}>
        <NearTravelList travel={{ id: 2 }} />
      </QueryClientProvider>
    );
    await flush();
    expect(fetchTravelsNear).toHaveBeenCalledTimes(2);
  });
});
