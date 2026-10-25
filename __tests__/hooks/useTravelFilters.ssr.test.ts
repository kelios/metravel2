/**
 * @jest-environment node
 *
 * SSR-контроль `useTravelFilters` для шага точек: слушатели возврата в окно
 * (focus/blur/visibilitychange/pageshow) не обязаны существовать вне браузера.
 * Под jsdom 26 (jest-environment-jsdom 30, Expo SDK 58) `window` стал
 * non-configurable, и прежний приём «переопределить globalThis.window = undefined»
 * внутри основного набора больше невозможен — поэтому случай живёт в node-среде,
 * где `document` отсутствует, а `window`-алиас RN jest-preset снимается штатно.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useTravelFilters } from '@/hooks/useTravelFilters';
import { fetchAllCountriesOptimized, fetchFiltersOptimized } from '@/api/miscOptimized';

jest.mock('@/api/miscOptimized', () => ({
  fetchFiltersOptimized: jest.fn(),
  fetchAllCountriesOptimized: jest.fn(),
  captureFiltersRefreshBoundary: jest.fn(() => 0),
}));

const mockFetchFilters = fetchFiltersOptimized as jest.Mock;
const mockFetchAllCountries = fetchAllCountriesOptimized as jest.Mock;

describe('useTravelFilters browser return freshness without a browser (SSR)', () => {
  const platform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    mockFetchFilters.mockResolvedValue({
      categories: [{ id: 1, name: 'Горы' }],
      categoryTravelAddress: [{ id: 4, name: 'Парк' }],
    });
    mockFetchAllCountries.mockResolvedValue([{ country_id: 112, title_ru: 'Беларусь' }]);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: platform, configurable: true });
    jest.clearAllMocks();
  });

  it.each(['window', 'document'] as const)('does not require a browser %s', async (globalName) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, globalName);
    Object.defineProperty(globalThis, globalName, { configurable: true, value: undefined });
    try {
      expect(typeof (globalThis as Record<string, unknown>)[globalName]).toBe('undefined');
      const hook = renderHook(
        ({ step }: { step: number }) => useTravelFilters({ currentStep: step }),
        { initialProps: { step: 1 } },
      );
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      await act(async () => { hook.rerender({ step: 2 }); });
      // Точечный шаг открылся без браузерных глобалов: ни исключения, ни подписок на окно.
      expect(hook.result.current.isLoading).toBe(false);
      expect(mockFetchFilters).toHaveBeenCalled();
      hook.unmount();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, globalName, descriptor);
      else delete (globalThis as Record<string, unknown>)[globalName];
    }
  });
});
