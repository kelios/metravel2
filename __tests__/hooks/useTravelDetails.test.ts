import { renderHook, act } from '@testing-library/react-native';
import { useTravelDetails } from '@/hooks/useTravelDetails';

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
