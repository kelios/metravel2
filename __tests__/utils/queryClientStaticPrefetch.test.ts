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

import { i18n } from '@/i18n';
import { QueryClient } from '@tanstack/react-query';

import { fetchFiltersOptimized } from '@/api/miscOptimized';
import { queryKeys } from '@/api/queryKeys';
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
  it('captures the prefetch locale so a language switch cannot populate the other locale key', async () => {
    await i18n.changeLanguage('ru');
    let resolveRu: (data: unknown) => void = () => {};
    mockFetchFilters.mockImplementationOnce(() => new Promise(resolve => { resolveRu = resolve; }))
      .mockResolvedValueOnce({ categoryTravelAddress: [{ id: 84, name: 'Lake' }] });
    const client = new QueryClient();
    const ru = runStaticQueryClientPrefetch(client);
    await i18n.changeLanguage('en');
    await runStaticQueryClientPrefetch(client);
    resolveRu({ categoryTravelAddress: [{ id: 84, name: 'Озеро' }] });
    await ru;
    expect(client.getQueryData(queryKeys.filters('en'))).toEqual([{ id: '84', name: 'Lake' }]);
    expect(client.getQueryData(queryKeys.filters('ru'))).toEqual([{ id: '84', name: 'Озеро' }]);
    expect(mockFetchFilters).toHaveBeenNthCalledWith(1, { lang: 'ru' });
    expect(mockFetchFilters).toHaveBeenNthCalledWith(2, { lang: 'en' });
    client.clear();
    await i18n.changeLanguage('ru');
  });

});
