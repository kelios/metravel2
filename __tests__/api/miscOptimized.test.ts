import { fetchAllFiltersOptimized, clearFiltersCache } from '@/src/api/miscOptimized';

// Mock оригинальных функций
jest.mock('@/src/api/misc', () => ({
  fetchFilters: jest.fn(),
  fetchFiltersCountry: jest.fn(),
}));

describe('miscOptimized', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFiltersCache();
  });

  it('should cache filters results', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/src/api/misc');
    fetchFilters.mockResolvedValue({ categories: ['test'] });
    fetchFiltersCountry.mockResolvedValue(['US', 'RU']);

    // Первый вызов
    const result1 = await fetchAllFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1);
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({
      categories: ['test'],
      countries: ['US', 'RU']
    });

    // Второй вызов должен использовать кэш
    const result2 = await fetchAllFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1); // Не вызывается снова
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(1); // Не вызывается снова
    expect(result2).toEqual(result1);
  });

  it('should handle errors gracefully', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/src/api/misc');
    fetchFilters.mockRejectedValue(new Error('Network error'));
    fetchFiltersCountry.mockResolvedValue(['US']);

    // Первый вызов с ошибкой
    await expect(fetchAllFiltersOptimized()).rejects.toThrow('Network error');

    // После ошибки кэш пуст, следующий вызов тоже должен fail
    await expect(fetchAllFiltersOptimized()).rejects.toThrow('Network error');
  });

  it('should serve cached data on error after successful fetch', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/src/api/misc');
    fetchFilters.mockResolvedValue({ categories: ['test'] });
    fetchFiltersCountry.mockResolvedValue(['US', 'RU']);

    // Успешный вызов
    const result1 = await fetchAllFiltersOptimized();
    expect(result1).toEqual({
      categories: ['test'],
      countries: ['US', 'RU']
    });

    // Следующий вызов с ошибкой
    fetchFilters.mockRejectedValue(new Error('Network error'));
    fetchFiltersCountry.mockRejectedValue(new Error('Network error'));

    // Должен вернуть закэшированные данные
    const result2 = await fetchAllFiltersOptimized();
    expect(result2).toEqual(result1);
  });
});
