import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import NearTravelList from '@/components/travel/NearTravelList';
import type { Travel } from '@/src/types/types';

jest.mock('@/src/api/map', () => ({
  fetchTravelsNear: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/components/Map', () => () => null);

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: true,
    isMobile: false,
  }),
}));

describe('NearTravelList', () => {
  const { fetchTravelsNear } = jest.requireMock('@/src/api/map') as {
    fetchTravelsNear: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    fetchTravelsNear.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const flush = async () => {
    act(() => {
      jest.advanceTimersByTime(350); // wait for debounce (300ms) + buffer
    });
    await act(async () => {
      // allow pending promises to resolve
    });
  };

  it('fetches near travels only once per travel id', async () => {
    const travel: Pick<Travel, 'id'> = { id: 1 };
    const { rerender } = render(<NearTravelList travel={travel} />);

    await flush();
    await waitFor(() => expect(fetchTravelsNear).toHaveBeenCalledTimes(1));

    // rerender with the same id should not trigger another fetch
    rerender(<NearTravelList travel={travel} />);
    await flush();
    expect(fetchTravelsNear).toHaveBeenCalledTimes(1);

    // change id -> should fetch again
    rerender(<NearTravelList travel={{ id: 2 }} />);
    await flush();
    await waitFor(() => expect(fetchTravelsNear).toHaveBeenCalledTimes(2));
  });
});
