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

import {
  useTravelFilters,
  initFilters,
  normalizeTravelCategories,
  normalizeCategoryTravelAddress,
} from '@/hooks/useTravelFilters';
import { captureFiltersRefreshBoundary, fetchAllCountriesOptimized, fetchFiltersOptimized } from '@/api/miscOptimized';

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
  it('returns stable default dictionaries', () => {
    const f = initFilters();
    expect(f.countries).toEqual([]);
    expect(f.categories.length).toBeGreaterThan(0);
    expect(f.month).toHaveLength(12);
    expect(f.complexity.map((c) => c.name)).toEqual(['Легко', 'Средне', 'Сложно']);
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
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      transports: [{ id: 1, name: 'Авто' }],
    });
    mockFetchAllCountries.mockResolvedValue([
      { country_id: 112, title_ru: 'Беларусь' },
    ]);

    const { result } = renderHook(() => useTravelFilters());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.filters.categories).toEqual([{ id: '1', name: 'Горы' }]);
    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '112',
      title_ru: 'Беларусь',
    });
    expect(mockFetchAllCountries).toHaveBeenCalledTimes(1);
  });

  it('uses the dedicated countries endpoint instead of legacy inline countries', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [],
      countries: [{ country_id: 1, title_ru: 'Устаревшая страна' }],
    });
    mockFetchAllCountries.mockResolvedValue([
      { country_id: 2, title_ru: 'Грузия' },
    ]);

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filters.countries[0]).toMatchObject({
      country_id: '2',
      title_ru: 'Грузия',
    });
    expect(result.current.filters.countries).toHaveLength(1);
  });

  it('captures error and keeps default filters when API fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFilters.mockRejectedValue(new Error('Network down'));
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(new Error('Network down'));
    expect(result.current.filters.categories.length).toBeGreaterThan(0);
    consoleErrorSpy.mockRestore();
  });

  it('does not auto-load when loadOnMount is false', async () => {
    const { result } = renderHook(() => useTravelFilters({ loadOnMount: false }));

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

    const { result } = renderHook(() => useTravelFilters());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadFilters();
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
  });

  // Регресс: догрузка категорий точек стояла под условием «список пуст», а
  // стартовый `initFilters()` уже содержит фолбэк-категории — условие не
  // выполнялось никогда, и категория, заведённая в админке, не появлялась в
  // редакторе точки, пока не истечёт HTTP-кэш браузера (до 30 минут).
  it('refreshes point categories past the caches on every entry to the point step', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchFilters).toHaveBeenCalledTimes(1);
    expect(mockFetchFilters).toHaveBeenLastCalledWith();

    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [
        { id: 4, name: 'Достопримечательность' },
        { id: 227, name: 'Индустриальное наследие' },
      ],
    });

    await act(async () => {
      rerender({ step: 2 });
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(2);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ force: true });
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

    const { result, rerender } = renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh: (value: unknown) => void = () => {};
    mockFetchFilters.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefresh = resolve; }),
    );

    await act(async () => {
      rerender({ step: 2 });
    });

    // Список уже показан — обновление молчаливое, скелет поля стран не мигает.
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveRefresh({ categories: [], categoryTravelAddress: [{ id: 4, name: 'Достопримечательность' }] });
    });

    expect(mockFetchFilters).toHaveBeenCalledTimes(2);

    // Переход 2 → 3 внутри минуты не выпускает второй запрос.
    await act(async () => {
      rerender({ step: 3 });
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
      const { result, rerender } = renderHook(
        ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
        { initialProps: { step: 1 } },
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { rerender({ step: 2 }); });
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

    const { result } = renderHook(() => useTravelFilters({ currentStep: 2 }));

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

    const { result, rerender } = renderHook(
      ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
      { initialProps: { step: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsAfterLoad = mockFetchFilters.mock.calls.length;

    await act(async () => { rerender({ step: 2 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 1);

    now += 10_000;
    await act(async () => { rerender({ step: 3 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 1);

    now += 120_000;
    await act(async () => { rerender({ step: 2 }); });
    expect(mockFetchFilters).toHaveBeenCalledTimes(callsAfterLoad + 2);
    expect(mockFetchFilters).toHaveBeenLastCalledWith({ force: true });

    nowSpy.mockRestore();
  });

  it('refetchCountries refreshes only the countries slice', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      countries: [{ country_id: 1, title_ru: 'Old' }],
    });
    mockFetchAllCountries.mockResolvedValue([]);

    const { result } = renderHook(() => useTravelFilters());
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
    const openPointStep = async (step = 2) => {
      const hook = renderHook(
        ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
        { initialProps: { step: 1 } },
      );
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      await act(async () => { hook.rerender({ step }); });
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
      act(() => { older = result.current.refetchPointCategories({ force: true, silent: true }); });
      mockFetchFilters.mockImplementationOnce(() => new Promise((resolve) => { resolveReturn = resolve; }));
      await act(async () => { blur(); focus(); });
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => {
        resolveOlder({ ...existing, categoryTravelAddress: [{ id: 9, name: 'Старый ответ' }] });
        await older;
      });
      expect(result.current.filters.categoryTravelAddress).toEqual([{ id: '4', name: 'Парк' }]);
      now += 120_000;
      await act(async () => { rerender({ step: 3 }); });
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
        else if (reason === 'other-step') rerender({ step: 4 });
        else unmount();
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
      await act(async () => { rerender({ step: 3 }); });
      await act(async () => { rerender({ step: 2 }); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      now += 60_000;
      await act(async () => { rerender({ step: 3 }); });
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
      await act(async () => { rerender({ step }); });
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { blur(); focus(); visibilityChange(); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
    });

    it.each(['android', 'ios'] as const)('does not add browser listeners on %s', async (os) => {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
      const addListener = jest.spyOn(window, 'addEventListener');
      await openPointStep();
      const count = mockFetchFilters.mock.calls.length;
      await act(async () => { blur(); focus(); visibilityChange(); });
      expect(mockFetchFilters).toHaveBeenCalledTimes(count);
      expect(addListener.mock.calls.filter(([name]) => name === 'focus' || name === 'blur')).toEqual([]);
    });

    it.each(['window', 'document'] as const)('does not require a browser %s', async (globalName) => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, globalName);
      const addListener = jest.spyOn(window, 'addEventListener');
      Object.defineProperty(globalThis, globalName, { configurable: true, value: undefined });
      try {
        await openPointStep();
        expect(addListener.mock.calls.filter(([name]) => name === 'focus' || name === 'blur')).toEqual([]);
      } finally {
        if (descriptor) Object.defineProperty(globalThis, globalName, descriptor);
      }
    });
  });
});
