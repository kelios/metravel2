import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ReactNative from 'react-native';

import NearTravelList from '@/components/travel/NearTravelList';
import { AuthProvider } from '@/context/AuthContext';
import type { Travel } from '@/types/types';

jest.mock('@/api/map', () => ({
  fetchTravelsNear: jest.fn().mockResolvedValue([]),
}));

const mockTravelMap = jest.fn(() => null);
jest.mock('@/components/MapPage/TravelMap', () => ({
  TravelMap: (props: any) => {
    mockTravelMap(props);
    return null;
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({
    isPhone: false,
    isLargePhone: false,
  }),
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
    jest.restoreAllMocks();
    queryClient.clear();
  });

  it('fetches near travels only once per travel id', async () => {
    const travel: Pick<Travel, 'id'> = { id: 1 };
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList travel={travel} />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(fetchTravelsNear).toHaveBeenCalledTimes(1));

    // rerender with the same id should not trigger another fetch
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList travel={travel} />
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(fetchTravelsNear).toHaveBeenCalledTimes(1);

    // change id -> should fetch again
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList travel={{ id: 2 }} />
        </AuthProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(fetchTravelsNear).toHaveBeenCalledTimes(2));
  });

  it('does not connect nearby travel points with lines on the map tab', async () => {
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 101,
        name: 'Nearby 1',
        lat: 50.061,
        lng: 19.938,
      },
      {
        id: 102,
        name: 'Nearby 2',
        lat: 49.822,
        lng: 19.044,
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList travel={{ id: 1 }} />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Карта')).toBeTruthy());

    fireEvent.press(screen.getByText('Карта'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTravelMap).toHaveBeenCalled();
    const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
    expect(lastCall?.showRouteLine).toBe(false);
  });

  it('keeps list/map switcher available in embedded mobile details section', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 201,
        name: 'Nearby mobile',
        lat: 53.9,
        lng: 27.56,
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList travel={{ id: 1 }} embedded />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Список')).toBeTruthy());
    fireEvent.press(screen.getByText('Карта'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockTravelMap).toHaveBeenCalled();
    const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
    expect(lastCall?.showRouteLine).toBe(false);
  });
});
