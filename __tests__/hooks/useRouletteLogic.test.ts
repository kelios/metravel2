import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { useRouletteLogic } from '@/components/roulette/useRoulette';

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  useListTravelFilters: jest.fn(),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useRandomTravelData: jest.fn(),
}));

jest.mock('@/src/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(),
  fetchAllCountries: jest.fn(),
}));

const useQuery = jest.requireMock('@tanstack/react-query').useQuery as jest.Mock;
const { useListTravelFilters } = jest.requireMock('@/components/listTravel/hooks/useListTravelFilters') as {
  useListTravelFilters: jest.Mock;
};
const { useRandomTravelData } = jest.requireMock('@/components/listTravel/hooks/useListTravelData') as {
  useRandomTravelData: jest.Mock;
};
const { fetchAllFiltersOptimized, fetchAllCountries } = jest.requireMock('@/src/api/miscOptimized') as {
  fetchAllFiltersOptimized: jest.Mock;
  fetchAllCountries: jest.Mock;
};

describe('useRouletteLogic', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // react-query useQuery: immediately call queryFn and return data
    useQuery.mockImplementation(({ queryFn }: any) => {
      const data = queryFn();
      return {
        data,
        isLoading: false,
        isFetching: false,
      };
    });

    // Animated timing: immediately set value and invoke callback
    jest.spyOn(Animated, 'timing').mockImplementation(((value: any, config: any) => ({
      start: (cb?: () => void) => {
        value.setValue(config.toValue);
        cb?.();
      },
    })) as any);

    fetchAllFiltersOptimized.mockReturnValue({
      countries: [
        { id: 1, name: 'Беларусь', title_ru: 'Беларусь' },
        { id: 2, name: 'Польша', title_ru: 'Польша' },
      ],
    });

    fetchAllCountries.mockResolvedValue([
      { id: 1, name: 'Беларусь' },
      { id: 2, name: 'Польша' },
    ]);

    useListTravelFilters.mockReturnValue({
      filter: { countries: [], year: undefined },
      queryParams: {},
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
    });

    useRandomTravelData.mockReturnValue({
      data: [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }],
      isLoading: false,
      isFetching: false,
      isEmpty: false,
      refetch: jest.fn().mockResolvedValue({
        data: {
          pages: [{ data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }],
        },
      }),
    });
  });

  it('builds filter groups and summary with default countries when none selected', async () => {
    const { result } = renderHook(() => useRouletteLogic());

    await waitFor(() => expect(result.current.filtersSummary).toBe('Беларусь и ещё 1'));

    expect(result.current.filterGroups.length).toBeGreaterThan(0);
    expect(result.current.activeFiltersCount).toBeGreaterThan(0);
  });

  it('spins and returns up to 3 shuffled travels', async () => {
    const { result } = renderHook(() => useRouletteLogic());

    await act(async () => {
      await result.current.handleSpin();
    });

    await waitFor(() => expect(result.current.result.length).toBe(3));
    expect(result.current.spinning).toBe(false);
  });

  it('clears filters and results via handleClearAll', async () => {
    const resetFilters = jest.fn();
    useListTravelFilters.mockReturnValueOnce({
      filter: { countries: [], year: undefined },
      queryParams: {},
      resetFilters,
      onSelect: jest.fn(),
    });

    const { result } = renderHook(() => useRouletteLogic());

    await act(async () => {
      await result.current.handleSpin();
      result.current.handleClearAll();
    });

    expect(resetFilters).toHaveBeenCalled();
    expect(result.current.result).toEqual([]);
  });

  it('toggles filter values through handleFilterChange', () => {
    const onSelect = jest.fn();
    useListTravelFilters.mockReturnValueOnce({
      filter: { transports: ['bus'] },
      queryParams: {},
      resetFilters: jest.fn(),
      onSelect,
    });

    const { result } = renderHook(() => useRouletteLogic());

    act(() => {
      result.current.handleFilterChange('transports', 'bus');
    });

    expect(onSelect).toHaveBeenCalledWith('transports', []);
  });
});
