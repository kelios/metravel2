import { act, renderHook, waitFor } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { clearFiltersCache } from '@/api/miscOptimized';
import { usePointListCategoryDictionaryModel } from '@/components/travel/hooks/usePointListCategoryDictionaryModel';

const mockUseQuery = jest.fn();
const mockFetchFilters = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

jest.mock('@/api/misc', () => ({
  fetchFilters: (...args: any[]) => mockFetchFilters(...args),
}));

jest.mock('@/api/queryKeys', () => ({
  queryKeys: {
    filters: () => ['filters'],
  },
}));

jest.mock('@/utils/reactQueryConfig', () => ({
  queryConfigs: {
    static: {},
  },
}));

describe('usePointListCategoryDictionaryModel', () => {
  beforeEach(() => {
    clearFiltersCache();
    mockUseQuery.mockReset();
    mockFetchFilters.mockReset();
  });

  it('uses query data when available and builds derived maps', () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 1, name: 'Озёра' },
        { id: 2, name: 'Горы' },
      ],
    });

    const { result } = renderHook(() => usePointListCategoryDictionaryModel());

    expect(result.current.siteCategoryDictionary).toEqual([
      { id: 1, name: 'Озёра' },
      { id: 2, name: 'Горы' },
    ]);
    expect(result.current.categoryIdToName.get('1')).toBe('Озёра');
    expect(result.current.categoryNameToIds.get('озёра')).toEqual([1]);
    expect(mockFetchFilters).not.toHaveBeenCalled();
  });

  it('falls back to fetch when query data is unavailable', async () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    mockFetchFilters.mockResolvedValue({
      categoryTravelAddress: [{ id: 5, name: 'Замки' }],
    });

    const { result } = renderHook(() => usePointListCategoryDictionaryModel());

    await waitFor(() => {
      expect(result.current.siteCategoryDictionary).toEqual([{ id: '5', name: 'Замки' }]);
    });

    expect(result.current.categoryIdToName.get('5')).toBe('Замки');
    expect(result.current.categoryNameToIds.get('замки')).toEqual(['5']);
  });
  it('does not expose a previous-locale fallback while the new dictionary is loading', async () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    let resolveEn: (data: unknown) => void = () => {};
    mockFetchFilters.mockResolvedValueOnce({ categoryTravelAddress: [{ id: 84, name: 'Озеро' }] })
      .mockImplementationOnce(() => new Promise(resolve => { resolveEn = resolve; }));
    const { result } = renderHook(() => usePointListCategoryDictionaryModel());
    await waitFor(() => expect(result.current.categoryIdToName.get('84')).toBe('Озеро'));
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(result.current.siteCategoryDictionary).toEqual([]);
    await act(async () => { resolveEn({ categoryTravelAddress: [{ id: 84, name: 'Lake' }] }); });
    await waitFor(() => expect(result.current.categoryIdToName.get('84')).toBe('Lake'));
    await act(async () => { await i18n.changeLanguage('ru'); });
  });

});
