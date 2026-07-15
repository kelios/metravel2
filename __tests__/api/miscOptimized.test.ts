import { fetchAllFiltersOptimized, clearFiltersCache } from '@/api/miscOptimized';

// Mock оригинальных функций
jest.mock('@/api/misc', () => ({
  fetchFilters: jest.fn(),
  fetchFiltersCountry: jest.fn(),
}));

describe('miscOptimized', () => {
  const filters = {
    categories: [{ id: 1, name: 'test' }],
    categoryTravelAddress: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
    transports: [],
    sortings: [],
  };
  const countries = [
    { country_id: 1, title_ru: 'США' },
    { country_id: 2, title_ru: 'Россия' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clearFiltersCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should cache filters results', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/api/misc');
    fetchFilters.mockResolvedValue(filters);
    fetchFiltersCountry.mockResolvedValue(countries);

    // Первый вызов
    const result1 = await fetchAllFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1);
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({
      ...filters,
      countries,
    });
    expect(fetchFilters).toHaveBeenCalledWith({ signal: undefined, throwOnError: true });
    expect(fetchFiltersCountry).toHaveBeenCalledWith({ signal: undefined, throwOnError: true });

    // Второй вызов должен использовать кэш
    const result2 = await fetchAllFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1); // Не вызывается снова
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(1); // Не вызывается снова
    expect(result2).toEqual(result1);
  });

  it('should handle errors gracefully', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/api/misc');
    fetchFilters.mockRejectedValue(new Error('Network error'));
    fetchFiltersCountry.mockResolvedValue(countries);

    // Первый вызов с ошибкой
    await expect(fetchAllFiltersOptimized()).rejects.toThrow('Network error');

    // После ошибки кэш пуст, следующий вызов тоже должен fail
    await expect(fetchAllFiltersOptimized()).rejects.toThrow('Network error');
  });

  it('should serve cached data on error after successful fetch', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/api/misc');
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchFilters.mockResolvedValue(filters);
    fetchFiltersCountry.mockResolvedValue(countries);

    // Успешный вызов
    const result1 = await fetchAllFiltersOptimized();
    expect(result1).toEqual({
      ...filters,
      countries,
    });

    // Expire the fresh entry so the explicit stale-on-error branch is exercised.
    now += 11 * 60 * 1000;
    fetchFilters.mockRejectedValue(new Error('Network error'));
    fetchFiltersCountry.mockRejectedValue(new Error('Network error'));

    // Должен вернуть закэшированные данные
    const result2 = await fetchAllFiltersOptimized();
    expect(result2).toEqual(result1);
    expect(fetchFilters).toHaveBeenCalledTimes(2);
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(2);
  });

  it('does not cache a malformed or failed filters request', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/api/misc');
    fetchFilters
      .mockRejectedValueOnce(new Error('Invalid categories[0].name'))
      .mockResolvedValueOnce(filters);
    fetchFiltersCountry.mockResolvedValue(countries);

    await expect(fetchAllFiltersOptimized()).rejects.toThrow('Invalid categories[0].name');
    await expect(fetchAllFiltersOptimized()).resolves.toEqual({ ...filters, countries });

    expect(fetchFilters).toHaveBeenCalledTimes(2);
  });
});
