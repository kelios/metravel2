/**
 * Стартовый idle-префетч словарей и его единственный потребитель делят один
 * ключ React Query — `queryKeys.filters()`.
 *
 * Регресс, который ловит этот тест: префетч клал под ключ сырой
 * `FilterDictionaries` (объект), а `usePointListCategoryDictionaryModel` читает
 * оттуда нормализованный СПИСОК категорий точек и через `select` отбрасывает
 * всё, что не массив. Выигранная префетчем гонка означала пустой словарь
 * категорий на все 30 минут staleTime.
 */

import { QueryClient } from '@tanstack/react-query';

import { fetchFiltersOptimized } from '@/api/miscOptimized';
import { queryKeys } from '@/queryKeys';
import { runStaticQueryClientPrefetch } from '@/utils/queryClientStaticPrefetch';

jest.mock('@/api/miscOptimized', () => ({
  fetchFiltersOptimized: jest.fn(),
}));

const mockFetchFilters = fetchFiltersOptimized as jest.Mock;

describe('runStaticQueryClientPrefetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('warms filters() with the same shape the point-category consumer reads', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [
        { id: 4, name: 'Достопримечательность' },
        { id: 227, name: 'Индустриальное наследие' },
      ],
    });

    const client = new QueryClient();
    await runStaticQueryClientPrefetch(client);

    const cached = client.getQueryData(queryKeys.filters());

    expect(Array.isArray(cached)).toBe(true);
    expect(cached).toEqual([
      { id: '4', name: 'Достопримечательность' },
      { id: '227', name: 'Индустриальное наследие' },
    ]);
  });
});
