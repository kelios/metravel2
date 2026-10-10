import { renderHook, waitFor } from '@testing-library/react-native';

import { useMapFilters } from '@/hooks/map/useMapFilters';
import { fetchFiltersMap } from '@/api/map';
import { mapCategoryNamesToIds } from '@/utils/filterQuery';

jest.mock('@/api/map', () => ({
  fetchFiltersMap: jest.fn(),
}));

const mockedFetchFiltersMap = fetchFiltersMap as jest.MockedFunction<typeof fetchFiltersMap>;

describe('useMapFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes sightseeing categories from localized API fields', async () => {
    mockedFetchFiltersMap.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [
        { id: 84, name_ru: 'Замки' } as any,
        { value: 26, title: 'Болота' } as any,
        { pk: 11, text: 'Музеи' } as any,
      ],
      companions: [],
      complexity: [],
      countries: [],
      month: [],
      over_nights_stay: [],
      transports: [],
      year: '',
    });

    const { result } = renderHook(() => useMapFilters());

    await waitFor(() => {
      expect(result.current.filters.categoryTravelAddress).toEqual([
        { id: '84', name: 'Замки' },
        { id: '26', name: 'Болота' },
        { id: '11', name: 'Музеи' },
      ]);
    });
  });
  // #2374 (MAP-FILTER-DICTIONARY-KEY-001): живой `GET /api/filterformap/` отдаёт
  // словарь типов мест под ключом `categories` (TravelCategoryAddress), ключа
  // `categoryTravelAddress` в ответе нет. Словарь чипов обязан собираться из него,
  // иначе имя чипа не превращается в ID и фильтр уходит на клиент по первой странице.
  it('builds the point-type chip dictionary from the `categories` key of /api/filterformap/', async () => {
    mockedFetchFiltersMap.mockResolvedValue({
      categories: [
        { id: '205', name: 'автобус' },
        { id: '43', name: 'Замок' },
        { id: '115', name: 'Руины замка' },
      ],
      radius: [{ id: '60', name: '60' }],
    } as any);

    const { result } = renderHook(() => useMapFilters());

    await waitFor(() => {
      expect(result.current.filters.categoryTravelAddress).toHaveLength(3);
    });
    expect(
      mapCategoryNamesToIds(['Замок', 'Руины замка'], result.current.filters.categoryTravelAddress),
    ).toEqual([43, 115]);
  });

  it('routes URL `?categories=` names into the point-type chip channel', async () => {
    mockedFetchFiltersMap.mockResolvedValue({
      categories: [{ id: '43', name: 'Замок' }],
      radius: [],
    } as any);

    const { result } = renderHook(() => useMapFilters({ initialCategories: ['Замок'] }));

    expect(result.current.filterValues.categoryTravelAddress).toEqual(['Замок']);
    expect(result.current.filterValues.categories).toEqual([]);
    await waitFor(() => {
      expect(
        mapCategoryNamesToIds(
          result.current.filterValues.categoryTravelAddress,
          result.current.filters.categoryTravelAddress,
        ),
      ).toEqual([43]);
    });
  });
});
