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

jest.mock('@/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
  fetchTravelBySlug: jest.fn(),
  normalizeTravelItem: jest.fn((d: any) => d),
}));

const useLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock;
const { useQuery } = jest.requireMock('@tanstack/react-query');
const { fetchTravel, fetchTravelBySlug } = jest.requireMock('@/api/travelsApi');

// Captures the queryFn passed to useQuery so tests can invoke it directly.
let capturedQueryFn: ((...args: any[]) => Promise<any>) | null = null;

describe('useTravelDetails', () => {
  const originalPlatform = Platform.OS;
  // @ts-expect-error - jest env may or may not define window
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
    // Restore window (tests may override it).
    // @ts-expect-error - test-only global
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
    // @ts-expect-error - test-only global
    (global as any).window = {
      __metravelTravelPreload: {
        data: { id: 498, slug: 'awesome-trip', name: 'Trip' },
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
    expect(result.current.travel).toEqual({ id: 498, slug: 'awesome-trip', name: 'Trip' });

    // Preload is consumed on first access to avoid stale data.
    // @ts-expect-error - test-only global
    expect((global as any).window.__metravelTravelPreload).toBeUndefined();
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
