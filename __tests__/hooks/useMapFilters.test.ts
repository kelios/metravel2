import { renderHook, waitFor } from '@testing-library/react-native';

import { useMapFilters } from '@/hooks/map/useMapFilters';
import { fetchFiltersMap } from '@/api/map';

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
});
