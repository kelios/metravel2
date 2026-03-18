import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NearTravelList from '@/components/travel/NearTravelList';
import type { Travel } from '@/types/types';

jest.mock('@/api/map', () => ({
  fetchTravelsNear: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/components/map/Map', () => () => null);

const mockTravelMap = jest.fn(() => null);
jest.mock('@/components/MapPage/TravelMap', () => ({
  TravelMap: (props: any) => {
    mockTravelMap(props);
    return null;
  },
}));

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
    mockTravelMap.mockClear();
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

  it('does not connect nearby travel points with lines on the map tab', async () => {
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 101,
        name: 'Nearby 1',
        points: [{ coord: '50.061,19.938', address: 'Krakow' }],
      },
      {
        id: 102,
        name: 'Nearby 2',
        points: [{ coord: '49.822,19.044', address: 'Bielsko-Biala' }],
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <NearTravelList travel={{ id: 1 }} />
      </QueryClientProvider>
    );

    await flush();

    fireEvent.press(screen.getByText('Карта'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTravelMap).toHaveBeenCalled();
    const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
    expect(lastCall?.showRouteLine).toBe(false);
  });
});
