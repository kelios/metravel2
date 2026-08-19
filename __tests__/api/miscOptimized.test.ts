import {
  fetchAllCountriesOptimized,
  fetchAllFiltersOptimized,
  fetchFiltersOptimized,
  clearFiltersCache,
} from '@/api/miscOptimized';

// Mock оригинальных функций
jest.mock('@/api/misc', () => ({
  fetchFilters: jest.fn(),
  fetchFiltersCountry: jest.fn(),
  fetchAllCountries: jest.fn(),
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
    // Signal вызывающего в сеть не уходит: запрос общий на всех потребителей.
    expect(fetchFilters).toHaveBeenCalledWith({ throwOnError: true });
    expect(fetchFiltersCountry).toHaveBeenCalledWith({ throwOnError: true });

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

  // Инвариант тикета: за загрузку страницы словарь уходит по сети один раз,
  // сколько бы путей его ни попросило. Раньше стартовый префетч ходил в api/misc
  // мимо этого кэша, и `/roulette` получал getFiltersTravel дважды.
  it('serves the idle prefetch and the screen from one network request', async () => {
    const { fetchFilters, fetchFiltersCountry } = require('@/api/misc');
    let resolveFilters: (value: unknown) => void = () => {};
    fetchFilters.mockImplementation(
      () => new Promise((resolve) => { resolveFilters = resolve; }),
    );
    fetchFiltersCountry.mockResolvedValue(countries);

    const fromPrefetch = fetchFiltersOptimized(); // runStaticQueryClientPrefetch
    const fromWizard = fetchFiltersOptimized(); // useTravelFilters
    const fromRoulette = fetchAllFiltersOptimized(); // useRoulette / каталог
    resolveFilters(filters);

    await expect(fromPrefetch).resolves.toEqual(filters);
    await expect(fromWizard).resolves.toEqual(filters);
    await expect(fromRoulette).resolves.toEqual({ ...filters, countries });
    expect(fetchFilters).toHaveBeenCalledTimes(1);
    expect(fetchFiltersCountry).toHaveBeenCalledTimes(1);
  });

  // Категории точек заводятся в админке во время работы автора, а прод отдаёт
  // словарю два Cache-Control (Django 1800 + nginx 60) — браузер берёт первый и
  // держит ответ 30 минут. Поэтому «обновить словарь» обязано пробивать оба
  // кэша: и TTL-кэш этого модуля, и HTTP-кэш браузера.
  it('force bypasses the TTL cache and asks the network layer for a fresh response', async () => {
    const { fetchFilters } = require('@/api/misc');
    fetchFilters.mockResolvedValue(filters);

    await fetchFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1);
    expect(fetchFilters).toHaveBeenLastCalledWith({ throwOnError: true });

    // Обычный вызов внутри TTL сети не касается.
    await fetchFiltersOptimized();
    expect(fetchFilters).toHaveBeenCalledTimes(1);

    const refreshed = { ...filters, categoryTravelAddress: [{ id: 227, name: 'Индустриальное наследие' }] };
    fetchFilters.mockResolvedValue(refreshed);

    await expect(fetchFiltersOptimized({ force: true })).resolves.toEqual(refreshed);
    expect(fetchFilters).toHaveBeenCalledTimes(2);
    expect(fetchFilters).toHaveBeenLastCalledWith({ throwOnError: true, forceRefresh: true });

    // Свежий ответ становится новым содержимым кэша.
    await expect(fetchFiltersOptimized()).resolves.toEqual(refreshed);
    expect(fetchFilters).toHaveBeenCalledTimes(2);
  });

  it('does not let a forced refresh join a plain in-flight request', async () => {
    const { fetchFilters } = require('@/api/misc');
    let resolvePlain: (value: unknown) => void = () => {};
    fetchFilters.mockImplementationOnce(
      () => new Promise((resolve) => { resolvePlain = resolve; }),
    );
    const refreshed = { ...filters, categoryTravelAddress: [{ id: 227, name: 'Индустриальное наследие' }] };
    fetchFilters.mockResolvedValue(refreshed);

    const plain = fetchFiltersOptimized();
    const forced = fetchFiltersOptimized({ force: true });

    resolvePlain(filters);

    await expect(plain).resolves.toEqual(filters);
    await expect(forced).resolves.toEqual(refreshed);
    expect(fetchFilters).toHaveBeenCalledTimes(2);
  });

  // Когда по одному ключу летят двое, TTL-кэш обязан остаться за тем, кто
  // стартовал позже: иначе обычный запрос, отданный из 30-минутного HTTP-кэша
  // браузера, ложится поверх свежего forced-ответа и живёт ещё 10 минут.
  it('keeps the newer forced response in the TTL cache when a stale plain request finishes last', async () => {
    const { fetchFilters } = require('@/api/misc');
    const refreshed = { ...filters, categoryTravelAddress: [{ id: 227, name: 'Индустриальное наследие' }] };

    let resolvePlain: (value: unknown) => void = () => {};
    fetchFilters.mockImplementationOnce(
      () => new Promise((resolve) => { resolvePlain = resolve; }),
    );
    fetchFilters.mockResolvedValueOnce(refreshed);

    const plain = fetchFiltersOptimized();
    const forced = fetchFiltersOptimized({ force: true });

    await expect(forced).resolves.toEqual(refreshed);
    resolvePlain(filters);
    await expect(plain).resolves.toEqual(filters);

    // Следующий обычный вызов читает кэш — там должен лежать forced-ответ.
    await expect(fetchFiltersOptimized()).resolves.toEqual(refreshed);
    expect(fetchFilters).toHaveBeenCalledTimes(2);
  });

  // Отмена одного потребителя не должна рвать общий запрос остальным: префетч и
  // экран делят один in-flight промис.
  it('detaches an aborted filters caller without cancelling the shared request', async () => {
    const { fetchFilters } = require('@/api/misc');
    let resolveFilters: (value: unknown) => void = () => {};
    fetchFilters.mockImplementation(
      () => new Promise((resolve) => { resolveFilters = resolve; }),
    );

    const controller = new AbortController();
    const aborted = fetchFiltersOptimized({ signal: controller.signal });
    const survivor = fetchFiltersOptimized();

    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

    resolveFilters(filters);
    await expect(survivor).resolves.toEqual(filters);
    expect(fetchFilters).toHaveBeenCalledTimes(1);
  });

  // Полный справочник стран просили сразу несколько путей (рулетка, визард,
  // профиль), и каждый уходил в сеть своим запросом — на /roulette он приезжал
  // дважды.
  describe('fetchAllCountriesOptimized', () => {
    const allCountries = [
      { country_id: 19, title_ru: 'Австралия' },
      { country_id: 20, title_ru: 'Австрия' },
    ];

    it('deduplicates parallel callers into a single request', async () => {
      const { fetchAllCountries } = require('@/api/misc');
      let resolveRequest: (value: unknown) => void = () => {};
      fetchAllCountries.mockImplementation(
        () => new Promise((resolve) => { resolveRequest = resolve; }),
      );

      const first = fetchAllCountriesOptimized();
      const second = fetchAllCountriesOptimized();
      resolveRequest(allCountries);

      await expect(first).resolves.toEqual(allCountries);
      await expect(second).resolves.toEqual(allCountries);
      expect(fetchAllCountries).toHaveBeenCalledTimes(1);
    });

    it('serves the next callers from cache', async () => {
      const { fetchAllCountries } = require('@/api/misc');
      fetchAllCountries.mockResolvedValue(allCountries);

      await fetchAllCountriesOptimized();
      await expect(fetchAllCountriesOptimized()).resolves.toEqual(allCountries);

      expect(fetchAllCountries).toHaveBeenCalledTimes(1);
    });

    // Раньше signal уходил прямо в сетевой вызов: экран, размонтированный на
    // полпути, отменял справочник и для всех остальных потребителей.
    it('detaches an aborted caller without cancelling the shared request', async () => {
      const { fetchAllCountries } = require('@/api/misc');
      let resolveRequest: (value: unknown) => void = () => {};
      fetchAllCountries.mockImplementation(
        () => new Promise((resolve) => { resolveRequest = resolve; }),
      );

      const controller = new AbortController();
      const aborted = fetchAllCountriesOptimized({ signal: controller.signal });
      const survivor = fetchAllCountriesOptimized();

      controller.abort();
      await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

      resolveRequest(allCountries);
      await expect(survivor).resolves.toEqual(allCountries);
      expect(fetchAllCountries).toHaveBeenCalledTimes(1);
      expect(fetchAllCountries).toHaveBeenCalledWith({ throwOnError: true });
    });

    it('rejects immediately when the caller signal is already aborted', async () => {
      const { fetchAllCountries } = require('@/api/misc');
      fetchAllCountries.mockResolvedValue(allCountries);

      const controller = new AbortController();
      controller.abort();

      await expect(
        fetchAllCountriesOptimized({ signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
