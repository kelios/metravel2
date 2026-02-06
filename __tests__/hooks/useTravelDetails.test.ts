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
}));

const useLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock;
const { useQuery } = jest.requireMock('@tanstack/react-query');
const { fetchTravel, fetchTravelBySlug } = jest.requireMock('@/api/travelsApi');

describe('useTravelDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // По умолчанию useQuery вызывает свой queryFn и возвращает его результат как data
    (useQuery as jest.Mock).mockImplementation(({ queryFn }: any) => {
      const data = queryFn();
      return {
        data,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      };
    });
  });

  it('treats numeric param as id and calls fetchTravel', () => {
    useLocalSearchParams.mockReturnValue({ param: '123' });
    (fetchTravel as jest.Mock).mockImplementation((id: number) => ({ id }));
    (fetchTravelBySlug as jest.Mock).mockImplementation(() => {
      throw new Error('should not be called for numeric id');
    });

    const { result } = renderHook(() => useTravelDetails());

    expect(result.current.isId).toBe(true);
    expect(fetchTravel).toHaveBeenCalledWith(123, { signal: undefined });
    expect(result.current.travel).toEqual({ id: 123 });
  });

  it('treats non-numeric param as slug and calls fetchTravelBySlug', () => {
    useLocalSearchParams.mockReturnValue({ param: 'awesome-trip' });
    (fetchTravelBySlug as jest.Mock).mockImplementation((slug: string) => ({ slug }));
    (fetchTravel as jest.Mock).mockImplementation(() => {
      throw new Error('should not be called for slug');
    });

    const { result } = renderHook(() => useTravelDetails());

    expect(result.current.isId).toBe(false);
    expect(fetchTravelBySlug).toHaveBeenCalledWith('awesome-trip', { signal: undefined });
    expect(result.current.slug).toBe('awesome-trip');
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
