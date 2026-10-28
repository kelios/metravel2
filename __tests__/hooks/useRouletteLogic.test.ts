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

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(),
}));

jest.mock('@/api/travelListQueries', () => ({
  fetchTravelFacets: jest.fn(),
}));

const useQuery = jest.requireMock('@tanstack/react-query').useQuery as jest.Mock;
const { useListTravelFilters } = jest.requireMock('@/components/listTravel/hooks/useListTravelFilters') as {
  useListTravelFilters: jest.Mock;
};
const { useRandomTravelData } = jest.requireMock('@/components/listTravel/hooks/useListTravelData') as {
  useRandomTravelData: jest.Mock;
};
const { fetchAllFiltersOptimized } = jest.requireMock('@/api/miscOptimized') as {
  fetchAllFiltersOptimized: jest.Mock;
};
const { fetchTravelFacets } = jest.requireMock('@/api/travelListQueries') as {
  fetchTravelFacets: jest.Mock;
};

describe('useRouletteLogic', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // react-query useQuery: immediately call queryFn and return data
    useQuery.mockImplementation(({ queryFn }: any) => {
      const data = queryFn({ signal: undefined });
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

    fetchTravelFacets.mockReturnValue({
      total: 2,
      facets: {
        countries: [{ id: 1, count: 3 }, { id: 2, count: 2 }],
      },
    });

    useListTravelFilters.mockReturnValue({
      filter: { countries: [], year: undefined },
      queryParams: {},
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
    });

    // A real refetch updates the guarded query subscription too: selected IDs
    // now resolve against that live data instead of a copied result payload.
    useRandomTravelData.mockImplementation(function useMockRandomData() {
      const React = require('react');
      const [data, setData] = React.useState([{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }]);
      return {
        data,
        isLoading: false,
        isFetching: false,
        isEmpty: false,
        refetch: jest.fn(async () => {
          const next = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
          setData(next);
          return { data: { pages: [{ data: next }] } };
        }),
      };
    });
  });

  it('builds filter groups and summary with default countries when none selected', async () => {
    const { result } = await renderHook(() => useRouletteLogic());

    await waitFor(() => expect(result.current.filtersSummary).toBe('Беларусь и ещё 1'));

    expect(fetchTravelFacets).toHaveBeenCalledWith(
      '',
      expect.any(Object),
      expect.objectContaining({ suppressErrors: true })
    );
    expect(result.current.filterGroups.length).toBeGreaterThan(0);
    // #2431: подставленные страны по умолчанию — не выбор пользователя.
    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.filterGroups[0]?.options[0]).toMatchObject({
      id: '1',
      name: 'Беларусь',
      count: 3,
    });
    // Полный справочник `/countries/` рулетке не нужен: дефолтные страны
    // берутся из словаря фильтра, который она грузит в любом случае.
    expect(fetchAllFiltersOptimized).toHaveBeenCalledTimes(1);
  });

  // #2431: mobile-счётчик и общий сброс считают только отклонение от умолчания.
  it('counts only the deviation from default countries and returns to 0 after reset', async () => {
    const filtersState = {
      filter: { countries: [] as number[], year: undefined },
      queryParams: {} as Record<string, unknown>,
    };
    const resetFilters = jest.fn(() => {
      filtersState.filter = { countries: [], year: undefined };
      filtersState.queryParams = {};
    });
    useListTravelFilters.mockImplementation(() => ({ ...filtersState, resetFilters, onSelect: jest.fn() }));

    const { result, rerender } = await renderHook(() => useRouletteLogic());
    await waitFor(() => expect(result.current.filter.countries).toEqual([1, 2]));
    expect(result.current.activeFiltersCount).toBe(0);
    expect(result.current.filtersSummary).toBe('Беларусь и ещё 1');

    filtersState.filter = { countries: [2], year: undefined };
    filtersState.queryParams = { countries: [2] };
    await rerender({});
    expect(result.current.activeFiltersCount).toBe(1);
    expect(result.current.filtersSummary).toBe('Польша');

    await act(() => {
      result.current.handleClearAll();
    });
    await rerender({});
    expect(resetFilters).toHaveBeenCalledTimes(1);
    expect(result.current.filter.countries).toEqual([1, 2]);
    expect(result.current.activeFiltersCount).toBe(0);
  });

  // Словарь `/countriesforsearch/` на проде приходит как { country_id, title_ru }.
  it('names countries from the production dictionary shape', async () => {
    fetchAllFiltersOptimized.mockReturnValue({
      countries: [
        { country_id: 3, title_ru: 'Беларусь' },
        { country_id: 160, title_ru: 'Польша' },
      ],
    });

    const { result } = await renderHook(() => useRouletteLogic());

    await waitFor(() => expect(result.current.filtersSummary).toBe('Беларусь и ещё 1'));
    expect(result.current.activeFiltersCount).toBe(0);
  });

  it('counts a selected year while keeping default countries inactive', async () => {
    useListTravelFilters.mockReturnValue({
      filter: { countries: [], year: '2026' },
      queryParams: { year: '2026' },
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
    });

    const { result } = await renderHook(() => useRouletteLogic());

    expect(result.current.activeFiltersCount).toBe(1);
    expect(result.current.filter.countries).toEqual([1, 2]);
  });

  // #2375: страны по умолчанию видны в панели как выбранные и снимаются чипом.
  it('exposes default countries as the selected filter and toggles them off', async () => {
    const { result } = await renderHook(() => useRouletteLogic());

    await waitFor(() => expect(result.current.filter.countries).toEqual([1, 2]));

    const { onSelect } = useListTravelFilters.mock.results[0].value as { onSelect: jest.Mock };
    await act(() => {
      result.current.handleFilterChange('countries', '1');
    });
    expect(onSelect).toHaveBeenCalledWith('countries', ['2']);
  });

  it('resets one group with one array update and preserves other active filters', async () => {
    const onSelect = jest.fn();
    const resetFilters = jest.fn();
    useListTravelFilters.mockReturnValue({ filter: { countries: [2], categories: ['hike'] },
      queryParams: { countries: [2], categories: ['hike'] }, onSelect, resetFilters });
    const { result } = await renderHook(() => useRouletteLogic());
    await act(() => result.current.handleResetGroup('countries', ['1', '2']));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('countries', ['1', '2']);
    expect(resetFilters).not.toHaveBeenCalled();
    expect(result.current.filter.categories).toEqual(['hike']);
  });

  it('hides facet options with zero count unless they are selected', async () => {
    fetchAllFiltersOptimized.mockReturnValueOnce({
      countries: [{ id: 1, name: 'Беларусь', title_ru: 'Беларусь' }],
      categories: [
        { id: 'food', name: 'Еда' },
        { id: 'hike', name: 'Поход' },
      ],
    });
    fetchTravelFacets.mockReturnValueOnce({
      total: 1,
      facets: {
        categories: [
          { id: 'food', count: 0 },
          { id: 'hike', count: 4 },
        ],
      },
    });

    const { result } = await renderHook(() => useRouletteLogic());

    const categories = result.current.filterGroups.find((group) => group.key === 'categories');
    expect(categories?.options).toEqual([
      expect.objectContaining({ id: 'hike', count: 4 }),
    ]);
  });

  it('spins and returns up to 3 shuffled travels', async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useRouletteLogic());

    await act(async () => {
      await result.current.handleSpin();
    });

    await act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(result.current.result.length).toBe(3);
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

    const { result } = await renderHook(() => useRouletteLogic());

    await act(async () => {
      await result.current.handleSpin();
      result.current.handleClearAll();
    });

    expect(resetFilters).toHaveBeenCalled();
    expect(result.current.result).toEqual([]);
  });

  it('toggles filter values through handleFilterChange', async () => {
    const onSelect = jest.fn();
    useListTravelFilters.mockReturnValueOnce({
      filter: { transports: ['bus'] },
      queryParams: {},
      resetFilters: jest.fn(),
      onSelect,
    });

    const { result } = await renderHook(() => useRouletteLogic());

    await act(() => {
      result.current.handleFilterChange('transports', 'bus');
    });

    expect(onSelect).toHaveBeenCalledWith('transports', []);
  });
});
