/**
 * Unit tests for useTravelFilters — the filter dictionary loader powering the
 * list filter UI and the create/edit wizard.
 *
 * High value because the exported normalizers absorb many backend payload
 * shapes (id/value/pk/category_id, name/name_ru/title_ru, {results|data|items}
 * envelopes). A regression here silently breaks every filter dropdown.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import {
  useTravelFilters,
  initFilters,
  normalizeTravelCategories,
  normalizeCategoryTravelAddress,
} from '@/hooks/useTravelFilters';
import { fetchAllCountries } from '@/api/misc';
import { fetchFiltersOptimized } from '@/api/miscOptimized';

jest.mock('@/api/misc', () => ({
  fetchAllCountries: jest.fn(),
}));

jest.mock('@/api/miscOptimized', () => ({
  fetchFiltersOptimized: jest.fn(),
}));

const mockFetchFilters = fetchFiltersOptimized as jest.Mock;
const mockFetchAllCountries = fetchAllCountries as jest.Mock;

describe('initFilters', () => {
  it('returns stable default dictionaries', () => {
    const f = initFilters();
    expect(f.countries).toEqual([]);
    expect(f.categories.length).toBeGreaterThan(0);
    expect(f.month).toHaveLength(12);
    expect(f.complexity.map((c) => c.name)).toEqual(['Легко', 'Средне', 'Сложно']);
  });
});

describe('normalizeTravelCategories', () => {
  it('returns [] for non-array input', () => {
    expect(normalizeTravelCategories(null)).toEqual([]);
    expect(normalizeTravelCategories({})).toEqual([]);
    expect(normalizeTravelCategories('x')).toEqual([]);
  });

  it('resolves id via fallback chain (id → value → category_id → pk → idx)', () => {
    const out = normalizeTravelCategories([
      { id: 7, name: 'A' },
      { value: 8, name: 'B' },
      { category_id: 9, name: 'C' },
      { pk: 10, name: 'D' },
      { name: 'E' },
    ]);
    expect(out.map((c) => c.id)).toEqual(['7', '8', '9', '10', '4']);
  });

  it('resolves name via fallback chain and stringifies', () => {
    const out = normalizeTravelCategories([
      { id: 1, name_ru: 'Горы' },
      { id: 2, title_ru: 'Море' },
      { id: 3, title: 'Города' },
      { id: 4, text: 'Лес' },
      { id: 5 },
    ]);
    expect(out.map((c) => c.name)).toEqual(['Горы', 'Море', 'Города', 'Лес', '5']);
  });

  it('handles primitive string items', () => {
    expect(normalizeTravelCategories(['solo', 'pair'])).toEqual([
      { id: '0', name: 'solo' },
      { id: '1', name: 'pair' },
    ]);
  });
});

describe('normalizeCategoryTravelAddress', () => {
  it('unwraps {results|data|items} envelopes', () => {
    expect(normalizeCategoryTravelAddress({ results: [{ id: 1, name: 'Парковка' }] })).toEqual([
      { id: '1', name: 'Парковка' },
    ]);
    expect(normalizeCategoryTravelAddress({ data: [{ id: 2, name: 'Отель' }] })).toEqual([
      { id: '2', name: 'Отель' },
    ]);
    expect(normalizeCategoryTravelAddress({ items: [{ id: 3, name: 'Кафе' }] })).toEqual([
      { id: '3', name: 'Кафе' },
    ]);
  });

  it('returns [] for unknown envelope shapes', () => {
    expect(normalizeCategoryTravelAddress({ foo: 'bar' })).toEqual([]);
    expect(normalizeCategoryTravelAddress(null)).toEqual([]);
  });

  it('normalizes a plain array', () => {
    expect(
      normalizeCategoryTravelAddress([{ category_id: 5, title_ru: 'Смотровая' }])
    ).toEqual([{ id: '5', name: 'Смотровая' }]);
  });
});

describe('useTravelFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and normalizes filters on mount', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      transports: [{ id: 1, name: 'Авто' }],
    });
    mockFetchAllCountries.mockResolvedValue([
      { country_id: 112, title_ru: 'Беларусь' },
    ]);

    const { result } = renderHook(() => useTravelFilters());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Горы' }]);
    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '112',
      title_ru: 'Беларусь',
    });
    expect(mockFetchAllCountries).toHaveBeenCalledTimes(1);
  });

  it('uses the dedicated countries endpoint instead of legacy inline countries', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [],
      countries: [{ country_id: 1, title_ru: 'Устаревшая страна' }],
    });
    mockFetchAllCountries.mockResolvedValue([
      { country_id: 2, title_ru: 'Грузия' },
    ]);

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '2',
      title_ru: 'Грузия',
    });
    expect(result.current.filters.countries).toHaveLength(1);
  });

  it('captures error and keeps default filters when API fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFilters.mockRejectedValue(new Error('Network down'));
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(new Error('Network down'));
    expect(result.current.filters.categories.length).toBeGreaterThan(0);
    consoleErrorSpy.mockRestore();
  });

  it('does not auto-load when loadOnMount is false', async () => {
    const { result } = renderHook(() => useTravelFilters({ loadOnMount: false }));

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchFilters).not.toHaveBeenCalled();

    mockFetchFilters.mockResolvedValue({ categories: [{ id: 9, name: 'X' }] });
    mockFetchAllCountries.mockResolvedValue([]);

    await act(async () => {
      await result.current.loadFilters();
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
    expect(result.current.filters.categories).toEqual([{ id: '9', name: 'X' }]);
  });

  it('loadFilters runs only once (guarded by loadedRef)', async () => {
    mockFetchFilters.mockResolvedValue({ categories: [] });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadFilters();
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
  });

  it('refetchCountries refreshes only the countries slice', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      countries: [{ country_id: 1, title_ru: 'Old' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = renderHook(() => useTravelFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFetchAllCountries.mockResolvedValue([{ country_id: 2, title_ru: 'Польша' }]);

    await act(async () => {
      await result.current.refetchCountries();
    });

    expect(result.current.filters.countries).toEqual([
      expect.objectContaining({ country_id: '2', title_ru: 'Польша' }),
    ]);
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Горы' }]);
  });
});
