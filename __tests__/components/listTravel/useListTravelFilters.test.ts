import { renderHook, act } from '@testing-library/react-native';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

const makeOptions = () => ({
  categories: [
    { id: '1', name: 'Горы' },
    { id: '2', name: 'Море' },
  ],
  transports: [
    { id: '10', name: 'Авто' },
  ],
  categoryTravelAddress: [] as { id: string; name: string }[],
  companions: [] as { id: string; name: string }[],
  complexity: [] as { id: string; name: string }[],
  month: [] as { id: string; name: string }[],
  over_nights_stay: [] as { id: string; name: string }[],
  countries: [] as { country_id: number; title_ru: string }[],
});

const setup = (overrides: Partial<Parameters<typeof useListTravelFilters>[0]> = {}) => {
  const options = overrides.options ?? makeOptions();
  const result = renderHook(() =>
    useListTravelFilters({
      options,
      isMeTravel: false,
      isExport: false,
      isTravelBy: false,
      userId: null,
      user_id: undefined,
      ...overrides,
    }),
  );
  return { ...result, options };
};

describe('useListTravelFilters', () => {
  it('builds stable, cleaned queryParams without empty values', () => {
    const { result } = setup();

    act(() => {
      result.current.onSelect('countries', [3, null, undefined, '']);
      result.current.onSelect('year', '');
    });

    const first = result.current.queryParams;

    act(() => {
      // тот же набор значений в другом порядке не должен менять строку
      result.current.onSelect('countries', ['3', 3]);
    });

    const second = result.current.queryParams;

    // '' нормализуется в 0, поэтому первый объект может содержать [0, 3]
    expect(first).toEqual({
      countries: [0, 3],
      publish: 1,
      moderation: 1,
    });

    // После повторного onSelect с "чистыми" значениями массив стран нормализуется до [3]
    expect(second).toEqual({
      countries: [3],
      publish: 1,
      moderation: 1,
    });
  });

  it('maps textual categories to numeric ids for queryParams', () => {
    const { result } = setup();

    act(() => {
      result.current.onSelect('categories', ['Горы', '2']);
    });

    // В filter должны остаться исходные значения
    expect(result.current.filter.categories).toEqual(['Горы', '2']);

    // В queryParams категории должны быть приведены к числам по id
    expect(result.current.queryParams.categories).toEqual([1, 2]);
  });

  it('keeps year as non-empty trimmed string and drops empty year', () => {
    const { result } = setup();

    act(() => {
      result.current.applyFilter({ year: ' 2024 ' } as any);
    });

    expect(result.current.filter.year).toBe('2024');
    expect(result.current.queryParams.year).toBe('2024');

    act(() => {
      result.current.applyFilter({ year: '' } as any);
    });

    expect(result.current.filter.year).toBeUndefined();
    expect(result.current.queryParams.year).toBeUndefined();
  });

  it('removes field from filter when onSelect gets empty value', () => {
    const { result } = setup();

    act(() => {
      result.current.onSelect('transports', [10]);
    });
    expect(result.current.filter.transports).toEqual([10]);

    act(() => {
      result.current.onSelect('transports', []);
    });

    expect(result.current.filter.transports).toBeUndefined();
    expect(result.current.queryParams.transports).toBeUndefined();
  });

  it('adds and removes category names via handleToggleCategory', () => {
    const { result } = setup();

    act(() => {
      result.current.handleToggleCategory('Горы');
    });
    expect(result.current.filter.categories).toEqual(['Горы']);

    act(() => {
      result.current.handleToggleCategory('Горы');
    });
    // При пустом массиве onSelect удаляет поле из фильтра
    expect(result.current.filter.categories).toBeUndefined();
  });

  it('uses context flags isMeTravel / isTravelBy for queryParams', () => {
    const { result: resultTravelBy } = setup({ isTravelBy: true });

    // Для travelsby должен проставляться countries = [BELARUS_ID] (3 по умолчанию)
    expect(resultTravelBy.current.queryParams.countries).toEqual([3]);

    const { result: resultMeTravel } = setup({ isMeTravel: true, userId: '42' });
    expect(resultMeTravel.current.queryParams.user_id).toBe('42');
    // Для metravel не должны форситься publish/moderation
    expect(resultMeTravel.current.queryParams.publish).toBeUndefined();
    expect(resultMeTravel.current.queryParams.moderation).toBeUndefined();
  });

  describe('initialFilter', () => {
    it('uses INITIAL_FILTER (empty) when initialFilter is not provided', () => {
      const { result } = setup();
      expect(result.current.filter).toEqual({});
    });

    it('initialises filter state from initialFilter when provided', () => {
      const { result } = setup({
        initialFilter: { categories: [2, 21], over_nights_stay: [1] },
      });
      expect(result.current.filter.categories).toEqual([2, 21]);
      expect(result.current.filter.over_nights_stay).toEqual([1]);
    });

    it('reflects initialFilter in queryParams immediately', () => {
      const { result } = setup({
        initialFilter: { month: [6, 7, 8] },
      });
      expect(result.current.queryParams.month).toEqual([6, 7, 8]);
    });

    it('allows overriding initialFilter values via onSelect', () => {
      const { result } = setup({
        initialFilter: { categories: [2, 21] },
      });

      act(() => {
        result.current.onSelect('categories', [22]);
      });

      expect(result.current.filter.categories).toEqual([22]);
      expect(result.current.queryParams.categories).toEqual([22]);
    });

    it('allows resetting to empty state via resetFilters even when initialFilter was set', () => {
      const { result } = setup({
        initialFilter: { categories: [2], month: [6, 7, 8] },
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filter).toEqual({});
    });

    it('handles initialFilter with multiple filter types simultaneously', () => {
      const { result } = setup({
        initialFilter: {
          categories: [22, 2],
          over_nights_stay: [1, 8],
          month: [9, 10, 11],
        },
      });

      expect(result.current.filter.categories).toEqual([22, 2]);
      expect(result.current.filter.over_nights_stay).toEqual([1, 8]);
      expect(result.current.filter.month).toEqual([9, 10, 11]);
      expect(result.current.queryParams.over_nights_stay).toEqual([1, 8]);
      expect(result.current.queryParams.month).toEqual([9, 10, 11]);
    });

    it('ignores undefined initialFilter (falls back to empty filter)', () => {
      const { result } = setup({ initialFilter: undefined });
      expect(result.current.filter).toEqual({});
    });
  });
});
