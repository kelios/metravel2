import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ReactNative from 'react-native';

import NearTravelList from '@/components/travel/NearTravelList';
import { AuthProvider } from '@/context/AuthContext';
import type { Travel } from '@/types/types';

jest.mock('@/api/map', () => ({
  fetchTravelsNear: jest.fn().mockResolvedValue([]),
  fetchNearbyTravelMapPoints: jest.fn().mockResolvedValue([]),
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
  const { fetchNearbyTravelMapPoints } = jest.requireMock('@/api/map') as {
    fetchNearbyTravelMapPoints: jest.Mock;
  };
  let queryClient: QueryClient;

  beforeEach(() => {
    fetchTravelsNear.mockClear();
    fetchNearbyTravelMapPoints.mockClear();
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

  it('loads map points on demand when compact nearby cards omit coordinates', async () => {
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 301,
        name: 'Compact nearby route',
        slug: 'compact-nearby-route',
      },
    ]);
    fetchNearbyTravelMapPoints.mockResolvedValueOnce([
      {
        id: '301-0',
        coord: '50.061,19.938',
        address: 'Krakow',
        travelImageThumbUrl: '',
        categoryName: 'Poland',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList
            travel={{
              id: 1,
              travelAddress: [{ id: 1, name: 'Origin', coords: '50.05,19.94' }],
            }}
            embedded
          />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Карта')).toBeTruthy());
    fireEvent.press(screen.getByText('Карта'));

    await waitFor(() => expect(fetchNearbyTravelMapPoints).toHaveBeenCalledWith(
      { lat: 50.05, lng: 19.94 },
      expect.arrayContaining([expect.objectContaining({ id: 301, slug: 'compact-nearby-route' })]),
      expect.any(Object),
    ));
    await waitFor(() => expect(mockTravelMap).toHaveBeenCalled());

    const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
    expect(lastCall?.travelData).toEqual([
      expect.objectContaining({ id: '301-0', coord: '50.061,19.938' }),
    ]);
    expect(lastCall?.showRouteLine).toBe(false);
  });

  it('merges direct coordinates with on-demand points for compact nearby cards', async () => {
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 201,
        name: 'Rich nearby route',
        slug: 'rich-nearby-route',
        lat: 50.06,
        lng: 19.93,
      },
      {
        id: 301,
        name: 'Compact nearby route',
        slug: 'compact-nearby-route',
      },
    ]);
    fetchNearbyTravelMapPoints.mockResolvedValueOnce([
      {
        id: '301-0',
        coord: '50.061,19.938',
        address: 'Compact point',
        travelImageThumbUrl: '',
        categoryName: 'Poland',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList
            travel={{
              id: 1,
              travelAddress: [{ id: 1, name: 'Origin', coords: '50.05,19.94' }],
            }}
            embedded
          />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Карта')).toBeTruthy());
    fireEvent.press(screen.getByText('Карта'));

    await waitFor(() => expect(fetchNearbyTravelMapPoints).toHaveBeenCalledWith(
      { lat: 50.05, lng: 19.94 },
      [expect.objectContaining({ id: 301, slug: 'compact-nearby-route' })],
      expect.any(Object),
    ));
    await waitFor(() => {
      const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
      expect(lastCall?.travelData).toEqual([
        expect.objectContaining({ id: '201-0', coord: '50.06,19.93' }),
        expect.objectContaining({ id: '301-0', coord: '50.061,19.938' }),
      ]);
    });
  });

  it('distinguishes a failed map request from an empty map and allows retry', async () => {
    fetchTravelsNear.mockResolvedValueOnce([
      {
        id: 301,
        name: 'Compact nearby route',
        slug: 'compact-nearby-route',
      },
    ]);
    fetchNearbyTravelMapPoints
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce([
        {
          id: '301-0',
          coord: '50.061,19.938',
          address: 'Recovered point',
          travelImageThumbUrl: '',
          categoryName: 'Poland',
        },
      ]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NearTravelList
            travel={{
              id: 1,
              travelAddress: [{ id: 1, name: 'Origin', coords: '50.05,19.94' }],
            }}
            embedded
          />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Карта')).toBeTruthy());
    fireEvent.press(screen.getByText('Карта'));

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить маршруты. Попробуйте позже.')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Повторить попытку'));

    await waitFor(() => {
      const lastCall = mockTravelMap.mock.calls[mockTravelMap.mock.calls.length - 1]?.[0];
      expect(lastCall?.travelData).toEqual([
        expect.objectContaining({ id: '301-0', coord: '50.061,19.938' }),
      ]);
    });
    expect(fetchNearbyTravelMapPoints).toHaveBeenCalledTimes(2);
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
