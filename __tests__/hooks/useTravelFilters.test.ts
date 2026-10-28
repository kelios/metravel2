/**
 * Unit tests for useTravelFilters — the filter dictionary loader powering the
 * list filter UI and the create/edit wizard.
 *
 * High value because the exported normalizers absorb many backend payload
 * shapes (id/value/pk/category_id, name/name_ru/title_ru, {results|data|items}
 * envelopes). A regression here silently breaks every filter dropdown.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { i18n } from '@/i18n';

import {
  useTravelFilters,
  initFilters,
  normalizeTravelCategories,
  normalizeCategoryTravelAddress,
} from '@/hooks/useTravelFilters';
import { captureFiltersRefreshBoundary, fetchAllCountriesOptimized, fetchFiltersOptimized } from '@/api/miscOptimized';
import { fetchAllCountries } from '@/api/misc';
import { POINT_CATEGORY_DICTIONARY_REFRESH_EVENT } from '@/utils/pointCategoryDictionaryQuery';
import { parseTravelArticleCreateIntent, resolveInitialPrefill } from '@/utils/travelArticleCreateIntent';

// Справочники берутся через дедуплицирующий слой miscOptimized: раньше прямые
// вызовы api/misc из разных путей давали по два одинаковых запроса на страницу.
jest.mock('@/api/miscOptimized', () => ({
  fetchFiltersOptimized: jest.fn(),
  fetchAllCountriesOptimized: jest.fn(),
  captureFiltersRefreshBoundary: jest.fn(() => 0),
}));

const mockFetchFilters = fetchFiltersOptimized as jest.Mock;
const mockFetchAllCountries = fetchAllCountriesOptimized as jest.Mock;

describe('initFilters', () => {
  it('does not invent selectable taxonomy entries before the server responds', () => {
    const f = initFilters();
    expect(f.countries).toEqual([]);
    for (const entries of Object.values(f)) expect(entries).toEqual([]);
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
    let resolveFilters!: (value: unknown) => void;
    let resolveCountries!: (value: unknown) => void;
    mockFetchFilters.mockImplementationOnce(() => new Promise(resolve => { resolveFilters = resolve; }));
    mockFetchAllCountries.mockImplementationOnce(() => new Promise(resolve => { resolveCountries = resolve; }));

    const { result } = await renderHook(() => useTravelFilters());

    expect(result.current.isLoading).toBe(true);
    for (const entries of Object.values(result.current.filters)) expect(entries).toEqual([]);
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
    expect(mockFetchAllCountries).toHaveBeenCalledTimes(1);

    await act(() => resolveFilters({
      categories: [{ id: 1, name: 'Горы' }],
      transports: [{ id: 1, name: 'Авто' }],
    }));
    expect(result.current.isLoading).toBe(true);
    for (const entries of Object.values(result.current.filters)) expect(entries).toEqual([]);

    await act(() => resolveCountries([{ country_id: 112, title_ru: 'Беларусь' }]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Горы' }]);
    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '112',
      title_ru: 'Беларусь',
    });
    expect(mockFetchAllCountries).toHaveBeenCalledTimes(1);
  });

  it.each([
    { countries: [{ country_id: 616, title_ru: 'Польша', country_code: ' pl ' }], selected: ['616'] },
    { countries: [{ country_id: 616, title_ru: 'Польша', iso2: 'PL' }], selected: ['616'] },
    { countries: [{ country_id: 616, title_ru: 'Польша' }], selected: [] },
    { countries: [{ country_id: 616, title_ru: 'Польша', country_code: 'PL,DE' }], selected: [] },
    { countries: [{ country_id: 616, title_ru: 'Польша', country_code: 'PL', iso2: 'DE' }], selected: [] },
    { countries: [
      { country_id: 616, title_ru: 'Польша', country_code: 'PL' },
      { country_id: 777, title_ru: 'Другая страна', country_code: 'PL' },
    ], selected: [] },
  ])('resolves article ISO2 prefill through the real countries API and hook: %j', async ({ countries, selected }) => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(countries),
    } as Response);
    mockFetchFilters.mockResolvedValue({ categories: [] });
    mockFetchAllCountries.mockImplementationOnce(() => fetchAllCountries({ throwOnError: true }));

    try {
      const { result } = await renderHook(() => useTravelFilters());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeNull();
      expect(result.current.filters.countries).toHaveLength(countries.length);
      const intent = parseTravelArticleCreateIntent('/travel/new?source_travel_id=42&country=PL&place=Краков');
      expect(intent).not.toBeNull();
      expect(resolveInitialPrefill(intent!, result.current.filters.countries)).toEqual({
        name: 'Краков', countries: selected,
      });
      expect(resolveInitialPrefill({ sourceTravelId: '42', country: '616' }, result.current.filters.countries).countries)
        .toEqual(['616']);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('uses the dedicated countries endpoint instead of legacy inline countries', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [],
      countries: [{ country_id: 1, title_ru: 'Устаревшая страна' }],
    });
    mockFetchAllCountries.mockResolvedValue([
      { country_id: 2, title_ru: 'Грузия' },
    ]);

    const { result } = await renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '2',
      title_ru: 'Грузия',
    });
    expect(result.current.filters.countries).toHaveLength(1);
  });

  it('captures error and keeps dictionaries empty when API fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFilters.mockRejectedValue(new Error('Network down'));
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = await renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(new Error('Network down'));
    for (const entries of Object.values(result.current.filters)) expect(entries).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it('does not auto-load when loadOnMount is false', async () => {
    const { result } = await renderHook(() => useTravelFilters({ loadOnMount: false }));

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

    const { result } = await renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadFilters();
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
  });

  // Регресс: догрузка категорий точек стояла под условием «список пуст», а
  // прежний `initFilters()` содержал фолбэк-категории — условие не
  // выполнялось никогда, и категория, заведённая в админке, не появлялась в
  // редакторе точки, пока не истечёт HTTP-кэш браузера (до 30 минут).
  it('refreshes point categories past the caches on every entry to the point step', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result, rerender } = await renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ lang: 'ru' });

    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [
        { id: 4, name: 'Достопримечательность' },
        { id: 227, name: 'Индустриальное наследие' },
      ],
    });

    await act(async () => {
      await rerender({ step: 2 });
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(2);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ lang: 'ru', force: true });
    await waitFor(() =>
      expect(result.current.filters.categoryTravelAddress).toEqual([
        { id: '4', name: 'Достопримечательность' },
        { id: '227', name: 'Индустриальное наследие' },
      ]),
    );
  });

  it('keeps the point-step refresh silent and throttled to one network call per minute', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result, rerender } = await renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh: (value: unknown) => void = () => {};
    mockFetchFilters.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefresh = resolve; }),
    );

    await act(async () => {
      await rerender({ step: 2 });
    });

    // Список уже показан — обновление молчаливое, скелет поля стран не мигает.
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveRefresh({ categories: [], categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }] });
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(2);

    // Переход 2 → 3 внутри минуты не выпускает второй запрос.
    await act(async () => {
      await rerender({ step: 3 });
    });
    expect(mockFetchFilters).toHaveBeenCalledTimes(2);
  });

  it('refreshes on returning to the same point step within the step throttle', async () => {
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [{ id: 4, name: 'Парк' }],
    });
    mockFetchAllCountries.mockResolvedValue([{ country_id: 112, title_ru: 'Беларусь' }]);

    try {
      const { result, rerender } = await renderHook(
        ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
        { initialProps: { step: 1 } },
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await rerender({ step: 2 }); });
      const countries = result.current.filters.countries;
      const callsBeforeReturn = mockFetchFilters.mock.calls.length;

      mockFetchFilters.mockResolvedValue({
        categories: [],
        categoryTravelAddress: [{ id: 4, name: 'Парк' }, { id: 228, name: 'Планетарий' }],
      });
      await act(async () => {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
      });

      expect(mockFetchFilters).toHaveBeenCalledTimes(callsBeforeReturn + 1);
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
      expect(result.current.filters.countries).toBe(countries);
      expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Горы' }]);
      expect(result.current.isLoading).toBe(false);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: platform, configurable: true });
    }
  });

  // Регресс: стартовая загрузка заканчивалась полной заменой стейта и могла
  // приехать ПОЗЖЕ принудительной догрузки (словарь фильтров отдаётся из
  // HTTP-кэша мгновенно, справочник стран идёт по сети), откатывая свежие
  // категории обратно к устаревшим.
  it('does not let the slower initial load overwrite freshly refetched point categories', async () => {
    // Стран за шаг просят двое: стартовый loadFilters и догрузка стран на шаге
    // 2, поэтому держим все резолверы и отпускаем их разом.
    const countryResolvers: Array<(value: unknown) => void> = [];
    mockFetchAllCountries.mockImplementation(
      () => new Promise((resolve) => { countryResolvers.push(resolve); }),
    );
    mockFetchFilters.mockImplementation((opts?: { force?: boolean }) =>
      Promise.resolve({
        categories: [{ id: 1, name: 'Горы' }],
        categoryTravelAddress: opts?.force
          ? [
              { id: 4, name: 'Достопримечательность' },
              { id: 227, name: 'Индустриальное наследие' },
            ]
          : [{ id: 4, name: 'Достопримечательность' }],
      }),
    );

    const { result } = await renderHook(() => useTravelFilters({ currentStep: 2 }));

    await waitFor(() =>
      expect(result.current.filters.categoryTravelAddress).toEqual([
        { id: '4', name: 'Достопримечательность' },
        { id: '227', name: 'Индустриальное наследие' },
      ]),
    );

    await act(async () => {
      countryResolvers.forEach((resolve) => resolve([{ country_id: 5, title_ru: 'Польша' }]));
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filters.countries).toEqual([
      expect.objectContaining({ country_id: '5', title_ru: 'Польша' }),
    ]);
    expect(result.current.filters.categoryTravelAddress).toEqual([
      { id: '4', name: 'Достопримечательность' },
      { id: '227', name: 'Индустриальное наследие' },
    ]);
  });

  // Регресс: шаг, пропущенный по окну троттлинга, оставался «непосещённым», и
  // возврат на него навсегда упирался в ранний выход — словарь переставал
  // обновляться вообще.
  it('refreshes again on returning to a point step once the throttle window has passed', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_000_000;
    nowSpy.mockImplementation(() => now);

    mockFetchFilters.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result, rerender } = await renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsAfterLoad = mockFetchFilters.mock.calls.length;

    await act(async () => { await rerender({ step: 2 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 1);

    now += 10_000;
    await act(async () => { await rerender({ step: 3 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 1);

    now += 120_000;
    await act(async () => { await rerender({ step: 2 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 2);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ lang: 'ru', force: true });

    nowSpy.mockRestore();
  });

  it('refetchCountries refreshes only the countries slice', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      countries: [{ country_id: 1, title_ru: 'Old' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = await renderHook(() => useTravelFilters());
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

  describe('browser return freshness', () => {
    const platform = Platform.OS;
    const existing = {
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [{ id: 4, name: 'Парк' }],
    };
    const refreshed = {
      ...existing,
      categoryTravelAddress: [...existing.categoryTravelAddress, { id: 228, name: 'Планетарий' }],
    };
    let visibility: DocumentVisibilityState;

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      visibility = 'visible';
      jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
      mockFetchFilters.mockResolvedValue(existing);
      mockFetchAllCountries.mockResolvedValue([{ country_id: 112, title_ru: 'Беларусь' }]);
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: platform, configurable: true });
      jest.restoreAllMocks();
    });

    const focus = () => window.dispatchEvent(new Event('focus'));
    const blur = () => window.dispatchEvent(new Event('blur'));
    const visibilityChange = () => document.dispatchEvent(new Event('visibilitychange'));
    const pickerOpen = () => window.dispatchEvent(new Event(POINT_CATEGORY_DICTIONARY_REFRESH_EVENT));
    const pageShow = (persisted: boolean) => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: persisted });
      window.dispatchEvent(event);
    };
    const openPointStep = async (step = 2) => {
      const hook = await renderHook(
        ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
        { initialProps: { step: 1 } },
      );
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      await act(async () => { await hook.rerender({ step }); });
      return hook;
    };

    it.each(['focus-first', 'visible-first'])('coalesces paired return events with a response between them (%s)', async (order) => {
      const { result } = await openPointStep(3);
      mockFetchFilters.mockResolvedValue(refreshed);
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => {
        blur();
        visibility = 'hidden';
        visibilityChange();
      });
      visibility = 'visible';
      await act(async () => { if (order === 'focus-first') focus(); else visibilityChange(); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });

      await act(async () => {
        if (order === 'focus-first') visibilityChange(); else focus();
        focus();
        visibilityChange();
      });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
      expect(captureFiltersRefreshBoundary).toHaveBeenCalledTimes(1);
    });

    it('ignores initial focus, field focus changes, and focus while the tab is hidden', async () => {
      await openPointStep();
      const count = mockFetchFilters.mock.calls.length;
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        await act(async () => {
          focus();
          input.dispatchEvent(new Event('blur', { bubbles: true }));
          input.dispatchEvent(new Event('focus', { bubbles: true }));
          focus();
        });
        expect(mockFetchFilters).toHaveBeenCalledTimes(count);
        await act(async () => {
          visibility = 'hidden';
          visibilityChange();
          focus();
        });
        expect(mockFetchFilters).toHaveBeenCalledTimes(count);
        await act(async () => {
          visibility = 'visible';
          visibilityChange();
        });
        expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
      } finally {
        input.remove();
      }
    });

    it('does not let an older hook response overwrite a return or clear its in-flight guard', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const { result, rerender } = await openPointStep();
      let resolveOlder: (value: unknown) => void = () => {};
      let resolveReturn: (value: unknown) => void = () => {};
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }));
      let older: Promise<void>;
      await act(() => { older = result.current.refetchPointCategories({ force: true, silent: true }); });
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveReturn = resolve; }));
      await act(async () => { blur(); focus(); });
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => {
        resolveOlder({ ...existing, categoryTravelAddress: [{ id: 9, name: 'Старый ответ' }] });
        await older;
      });
      expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '4', name: 'Парк' }]);
      now += 120_000;
      await act(async () => { await rerender({ step: 3 }); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      await act(async () => { resolveReturn(refreshed); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
      expect(result.current.isLoading).toBe(false);
    });

    it.each(['leave', 'other-step', 'unmount'])('cancels the return subscriber on %s', async (reason) => {
      const { result, rerender, unmount } = await openPointStep();
      let resolveReturn: (value: unknown) => void = () => {};
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveReturn = resolve; }));
      await act(async () => { blur(); focus(); });
      const options = mockFetchFilters.mock.calls.at(-1)?.[0] as { signal: AbortSignal };
      await act(async () => {
        if (reason === 'leave') blur();
        else if (reason === 'other-step') await rerender({ step: 4 });
        else await unmount();
      });
      expect(options.signal.aborted).toBe(true);
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { resolveReturn(refreshed); });
      if (reason !== 'unmount') {
        expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '4', name: 'Парк' }]);
      }
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
    });

    it('keeps only the latest return when the author leaves again before the response', async () => {
      const { result } = await openPointStep();
      let resolveOlder: (value: unknown) => void = () => {};
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve; }));
      await act(async () => { blur(); focus(); });
      const olderOptions = mockFetchFilters.mock.calls.at(-1)?.[0] as { signal: AbortSignal };
      mockFetchFilters.mockResolvedValueOnce(refreshed);
      await act(async () => { blur(); focus(); });
      expect(olderOptions.signal.aborted).toBe(true);
      await act(async () => { resolveOlder(existing); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
    });

    it('starts the ordinary step throttle when the deferred network request actually starts', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const { rerender } = await openPointStep();
      let resolveReturn: (value: unknown) => void = () => {};
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveReturn = resolve; }));
      await act(async () => { blur(); focus(); });
      const options = mockFetchFilters.mock.calls.at(-1)?.[0] as { onRequestStart: (startedAt: number) => void };
      now += 120_000;
      await act(async () => { options.onRequestStart(now); resolveReturn(refreshed); });
      const count = mockFetchFilters.mock.calls.length;
      now += 1_000;
      await act(async () => { await rerender({ step: 3 }); });
      await act(async () => { await rerender({ step: 2 }); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      now += 60_000;
      await act(async () => { await rerender({ step: 3 }); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
    });

    it.each(['Offline', 'Invalid filters response'])('preserves the last dictionary after %s and retries on the next return', async (message) => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = await openPointStep();
      const countries = result.current.filters.countries;
      mockFetchFilters.mockRejectedValueOnce(new Error(message));
      await act(async () => { blur(); focus(); });
      expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '4', name: 'Парк' }]);
      expect(result.current.filters.countries).toBe(countries);
      expect(result.current.isLoading).toBe(false);
      mockFetchFilters.mockResolvedValueOnce(refreshed);
      await act(async () => { blur(); focus(); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
    });

    it('accepts an empty dictionary without reloading or inventing options', async () => {
      const { result } = await openPointStep();
      mockFetchFilters.mockResolvedValue({ ...existing, categoryTravelAddress: [] });
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { blur(); focus(); });
      await act(async () => { focus(); visibilityChange(); });
      expect(result.current.filters.categoryTravelAddress).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
    });

    it.each([1, 4, 5, 6])('does not subscribe outside point steps (step %s)', async (step) => {
      const { rerender } = await openPointStep();
      await act(async () => { await rerender({ step }); });
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { blur(); focus(); visibilityChange(); pickerOpen(); pageShow(true); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
    });

    it('refreshes when the point category picker opens even inside the step throttle', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const { result, rerender } = await openPointStep();
      mockFetchFilters.mockResolvedValue(refreshed);
      const count = mockFetchFilters.mock.calls.length;
      now += 10_000;
      await act(async () => { await rerender({ step: 3 }); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      await act(async () => { pickerOpen(); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
    });

    it('refreshes after a persisted pageshow and ignores a non-persisted one', async () => {
      const { result } = await openPointStep();
      mockFetchFilters.mockResolvedValue(refreshed);
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { pageShow(false); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      await act(async () => { pageShow(true); });
      expect(result.current.filters.categoryTravelAddress).toContainEqual({ id: '228', name: 'Планетарий' });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count + 1);
    });

    it.each(['android', 'ios'] as const)('does not add browser listeners on %s', async (os) => {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
      const addListener = jest.spyOn(window, 'addEventListener');
      await openPointStep();
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { blur(); focus(); visibilityChange(); pickerOpen(); pageShow(true); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      expect(addListener.mock.calls.filter(([name]) => name === 'focus' || name === 'blur')).toEqual([]);
    });

    // Случай «без window/document» — в `useTravelFilters.ssr.test.ts`: настоящая
    // node-среда без браузерных глобалов, а не jsdom с подменёнными свойствами.
  });
});


describe('useTravelFilters locale transitions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('ru');
    mockFetchAllCountries.mockResolvedValue([]);
  });
  afterEach(async () => { await act(async () => { await i18n.changeLanguage('ru'); }); });

  it('keeps the first failed EN load empty and retries with actual server IDs and labels', async () => {
    await i18n.changeLanguage('en');
    const error = new Error('EN unavailable');
    mockFetchFilters.mockRejectedValueOnce(error).mockResolvedValueOnce({
      categories: [{ id: 1, name: 'Diving' }],
      categoryTravelAddress: [{ id: 1, name: 'Aqueduct' }],
    });
    const { result } = await renderHook(() => useTravelFilters());
    for (const entries of Object.values(result.current.filters)) expect(entries).toEqual([]);
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.isLoading).toBe(false);
    for (const entries of Object.values(result.current.filters)) expect(entries).toEqual([]);

    await act(async () => { await result.current.loadFilters(); });
    expect(result.current.error).toBeNull();
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Diving' }]);
    expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '1', name: 'Aqueduct' }]);
    expect(mockFetchFilters).toHaveBeenNthCalledWith(2, { lang: 'en' });
  });

  it('retains the last server dictionary when a same-locale point refresh fails', async () => {
    await i18n.changeLanguage('en');
    mockFetchFilters.mockResolvedValueOnce({
      categories: [{ id: 1, name: 'Diving' }],
      categoryTravelAddress: [{ id: 1, name: 'Aqueduct' }],
    }).mockRejectedValueOnce(new Error('Refresh unavailable'));
    const { result } = await renderHook(() => useTravelFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.refetchPointCategories({ force: true }); });
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Diving' }]);
    expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '1', name: 'Aqueduct' }]);
    expect(result.current.isLoading).toBe(false);
  });

  it('loads the selected locale and ignores a late previous-language initial response', async () => {
    let resolveRu: (data: unknown) => void = () => {};
    mockFetchFilters.mockImplementation(({ lang }: { lang: string }) => lang === 'ru'
      ? new Promise(resolve => { resolveRu = resolve; })
      : Promise.resolve({ categories: [{ id: 25, name: 'Mountains' }] }));
    const { result } = await renderHook(() => useTravelFilters());
    await act(async () => { await i18n.changeLanguage('en'); });
    await waitFor(() => expect(result.current.filters.categories).toEqual([{ id: '25', name: 'Mountains' }]));
    expect(result.current.isLoading).toBe(false);
    await act(async () => { resolveRu({ categories: [{ id: 25, name: 'Горы' }] }); });
    expect(result.current.filters.categories).toEqual([{ id: '25', name: 'Mountains' }]);
  });

  it('refreshes point categories in the new locale even while an old-locale refresh is pending', async () => {
    let resolveRu: (data: unknown) => void = () => {};
    mockFetchFilters.mockImplementation(({ lang }: { lang: string }) => lang === 'ru'
      ? new Promise(resolve => { resolveRu = resolve; })
      : Promise.resolve({ categoryTravelAddress: [{ id: 84, name: 'Lake' }] }));
    const { result } = await renderHook(() => useTravelFilters({ loadOnMount: false, currentStep: 2 }));
    await act(async () => { await i18n.changeLanguage('en'); });
    await waitFor(() => expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '84', name: 'Lake' }]));
    await act(async () => { resolveRu({ categoryTravelAddress: [{ id: 84, name: 'Озеро' }] }); });
    expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '84', name: 'Lake' }]);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ lang: 'en', force: true });
  });
  it('rejects a stale RU callback and response after RU→EN→RU without changing current data', async () => {
    let resolveOldRu: (data: unknown) => void = () => {};
    mockFetchFilters.mockImplementationOnce(() => new Promise(resolve => { resolveOldRu = resolve; }))
      .mockResolvedValueOnce({ categories: [{ id: 25, name: 'Mountains' }] })
      .mockResolvedValueOnce({ categories: [{ id: 25, name: 'Свежие горы' }] });
    const { result } = await renderHook(() => useTravelFilters());
    const oldPointRefresh = result.current.refetchPointCategories;
    await act(async () => { await i18n.changeLanguage('en'); });
    await waitFor(() => expect(result.current.filters.categories[0]?.name).toBe('Mountains'));
    await act(async () => { await oldPointRefresh({ force: true }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(2);
    await act(async () => { await i18n.changeLanguage('ru'); });
    await waitFor(() => expect(result.current.filters.categories[0]?.name).toBe('Свежие горы'));
    await act(async () => { resolveOldRu({ categories: [{ id: 25, name: 'Старые горы' }] }); });
    expect(result.current.filters.categories[0]?.name).toBe('Свежие горы');
    expect(result.current.isLoading).toBe(false);
  });

});
