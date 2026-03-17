import { renderHook, act } from '@testing-library/react-native';
import { useTravelDetails } from '@/hooks/useTravelDetails';
import { Platform } from 'react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

jest.mock('@/api/travelDetailsQueries', () => ({
  fetchTravel: jest.fn(),
  fetchTravelBySlug: jest.fn(),
}));

jest.mock('@/api/travelsNormalize', () => ({
  normalizeTravelItem: jest.fn((d: any) => d),
}));

const useLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock;
const { useQuery } = jest.requireMock('@tanstack/react-query');
const { fetchTravel, fetchTravelBySlug } = jest.requireMock('@/api/travelDetailsQueries');

// Captures the queryFn passed to useQuery so tests can invoke it directly.
let capturedQueryFn: ((...args: any[]) => Promise<any>) | null = null;

describe('useTravelDetails', () => {
  const originalPlatform = Platform.OS;
  const originalWindow = (global as any).window;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedQueryFn = null;

    // Default mock: capture queryFn for assertions, return loading state.
    // We don't call queryFn inside the mock to avoid async complexity —
    // instead tests invoke it directly when they need to verify fetch routing.
    (useQuery as jest.Mock).mockImplementation(({ queryFn }: any) => {
      capturedQueryFn = queryFn;
      return {
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      };
    });
  });

  afterEach(() => {
    // Some tests override Platform.OS; reset to avoid cross-test leaks.
    (Platform.OS as any) = originalPlatform;
    jest.useRealTimers();
    // Restore window (tests may override it).
    (global as any).window = originalWindow;
  });

  it('treats numeric param as id and calls fetchTravel', async () => {
    useLocalSearchParams.mockReturnValue({ param: '123' });
    (fetchTravel as jest.Mock).mockImplementation((id: number) => ({ id }));
    (fetchTravelBySlug as jest.Mock).mockImplementation(() => {
      throw new Error('should not be called for numeric id');
    });

    const { result } = renderHook(() => useTravelDetails());

    expect(result.current.isId).toBe(true);

    // Invoke the captured queryFn to verify it routes to fetchTravel
    const data = await capturedQueryFn!();
    expect(fetchTravel).toHaveBeenCalledWith(123, { signal: undefined });
    expect(data).toEqual({ id: 123 });
  });

  it('treats non-numeric param as slug and calls fetchTravelBySlug', async () => {
    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });
    (fetchTravelBySlug as jest.Mock).mockImplementation((slug: string) => ({ slug }));
    (fetchTravel as jest.Mock).mockImplementation(() => {
      throw new Error('should not be called for slug');
    });

    const { result } = renderHook(() => useTravelDetails());

    expect(result.current.isId).toBe(false);
    expect(result.current.slug).toBe('awesome-trip');

    const data = await capturedQueryFn!();
    expect(fetchTravelBySlug).toHaveBeenCalledWith('awesome-trip', { signal: undefined });
    expect(data).toEqual({ slug: 'awesome-trip' });
  });

  it('uses preloaded travel as initialData on web (no extra await needed)', () => {
    (Platform.OS as any) = 'web';
    (global as any).window = {
      __metravelTravelPreload: {
        data: {
          id: 498,
          slug: 'awesome-trip',
          name: 'Trip',
          description: '',
          gallery: [],
          travelAddress: [],
          coordsMeTravel: [],
        },
        slug: 'awesome-trip',
        isId: false,
      },
    };

    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });

    (useQuery as jest.Mock).mockImplementation(({ queryFn, initialData }: any) => {
      capturedQueryFn = queryFn;
      return {
        data: initialData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      };
    });

    const { result } = renderHook(() => useTravelDetails());

    expect(result.current.isId).toBe(false);
    expect(result.current.slug).toBe('awesome-trip');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.travel).toEqual({
      id: 498,
      slug: 'awesome-trip',
      name: 'Trip',
      description: '',
      gallery: [],
      travelAddress: [],
      coordsMeTravel: [],
    });

    // Preload is consumed on first access to avoid stale data.
    expect((global as any).window.__metravelTravelPreload).toBeUndefined();
  });

  it('ignores sparse preloaded travel payloads and falls back to fetchTravelBySlug', async () => {
    (Platform.OS as any) = 'web';
    (global as any).window = {
      __metravelTravelPreload: {
        data: {
          description: '<p>Only detail payload</p>',
          gallery: [{ url: 'https://metravel.by/media/test.jpg' }],
        },
        slug: 'awesome-trip',
        isId: false,
      },
    };

    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });
    (fetchTravelBySlug as jest.Mock).mockResolvedValue({
      id: 498,
      slug: 'awesome-trip',
      name: 'Awesome Trip',
      userName: 'Julia',
    });

    renderHook(() => useTravelDetails());

    const data = await capturedQueryFn!();
    expect(fetchTravelBySlug).toHaveBeenCalledWith('awesome-trip', { signal: undefined });
    expect(data).toEqual({
      id: 498,
      slug: 'awesome-trip',
      name: 'Awesome Trip',
      userName: 'Julia',
    });
    // Sparse preload is still consumed so it cannot poison future navigations.
    expect((global as any).window.__metravelTravelPreload).toBeUndefined();
  });

  it('waits briefly for bootstrap preload and uses it when full detail fields arrive', async () => {
    jest.useFakeTimers();
    (Platform.OS as any) = 'web';
    let resolveBootstrap: (() => void) | null = null;

    (global as any).window = {
      __metravelTravelPreloadScriptLoaded: true,
      __metravelTravelPreloadPending: true,
      __metravelTravelPreloadPromise: new Promise<void>((resolve) => {
        resolveBootstrap = resolve;
      }),
      location: { pathname: '/travels/awesome-trip' },
    };

    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });
    (fetchTravelBySlug as jest.Mock).mockResolvedValue({ slug: 'awesome-trip', from: 'network' });

    renderHook(() => useTravelDetails());

    const queryPromise = capturedQueryFn!();

    setTimeout(() => {
      (global as any).window.__metravelTravelPreload = {
        data: {
          id: 503,
          slug: 'awesome-trip',
          name: 'Trip',
          description: '',
          gallery: [],
          travelAddress: [],
          coordsMeTravel: [],
        },
        slug: 'awesome-trip',
        isId: false,
      };
      (global as any).window.__metravelTravelPreloadPending = false;
      resolveBootstrap?.();
    }, 100);

    await act(async () => {
      jest.advanceTimersByTime(120);
      await Promise.resolve();
      await Promise.resolve();
    });

    const data = await queryPromise;
    expect(data).toEqual({
      id: 503,
      slug: 'awesome-trip',
      name: 'Trip',
      description: '',
      gallery: [],
      travelAddress: [],
      coordsMeTravel: [],
    });
    expect(fetchTravelBySlug).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('falls back to fetchTravelBySlug when preload has identity but misses detail fields', async () => {
    (Platform.OS as any) = 'web';
    (global as any).window = {
      __metravelTravelPreload: {
        data: {
          id: 498,
          slug: 'awesome-trip',
          name: 'Trip',
          travelAddress: [],
        },
        slug: 'awesome-trip',
        isId: false,
      },
    };

    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });
    (fetchTravelBySlug as jest.Mock).mockResolvedValue({
      id: 777,
      slug: 'awesome-trip',
      name: 'Fetched detail travel',
      description: '',
      gallery: [],
      travelAddress: [{ id: 1, name: 'Point' }],
    });

    renderHook(() => useTravelDetails());

    const data = await capturedQueryFn!();
    expect(fetchTravelBySlug).toHaveBeenCalledWith('awesome-trip', { signal: undefined });
    expect(data).toEqual({
      id: 777,
      slug: 'awesome-trip',
      name: 'Fetched detail travel',
      description: '',
      gallery: [],
      travelAddress: [{ id: 1, name: 'Point' }],
    });
  });

  it('falls back to fetchTravelBySlug when preload has description and gallery but misses map arrays', async () => {
    (Platform.OS as any) = 'web';
    (global as any).window = {
      __metravelTravelPreload: {
        data: {
          id: 362,
          slug: 'morskoe-oko-v-mae',
          name: 'Морское око в мае.',
          description: '<p>Full text</p>',
          gallery: [{ url: 'https://metravel.by/gallery/362/detail_hd.jpg' }],
        },
        slug: 'morskoe-oko-v-mae',
        isId: false,
      },
    };

    useLocalSearchParams.mockReturnValue({ param: 'morskoe-oko-v-mae' });
    (fetchTravelBySlug as jest.Mock).mockResolvedValue({
      id: 362,
      slug: 'morskoe-oko-v-mae',
      name: 'Морское око в мае.',
      description: '<p>Full text</p>',
      gallery: [{ url: 'https://metravel.by/gallery/362/detail_hd.jpg' }],
      travelAddress: [{ id: 1, name: 'Point' }],
      coordsMeTravel: [{ id: 1, lat: 49.25, lng: 20.1 }],
    });

    renderHook(() => useTravelDetails());

    const data = await capturedQueryFn!();
    expect(fetchTravelBySlug).toHaveBeenCalledWith('morskoe-oko-v-mae', { signal: undefined });
    expect(data).toEqual({
      id: 362,
      slug: 'morskoe-oko-v-mae',
      name: 'Морское око в мае.',
      description: '<p>Full text</p>',
      gallery: [{ url: 'https://metravel.by/gallery/362/detail_hd.jpg' }],
      travelAddress: [{ id: 1, name: 'Point' }],
      coordsMeTravel: [{ id: 1, lat: 49.25, lng: 20.1 }],
    });
  });

  it('exposes refetch function from react-query result', () => {
    const mockRefetch = jest.fn();
    useLocalSearchParams.mockReturnValue({ param: '456' });
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useTravelDetails());

    act(() => {
      result.current.refetch();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});
