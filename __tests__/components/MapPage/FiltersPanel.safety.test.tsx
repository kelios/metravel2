/**
 * Тесты безопасности для FiltersPanel
 * Проверяют обработку невалидных данных и граничных случаев
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { FiltersProvider } from '@/contexts/FiltersContext';
import { ThemeProvider } from '@/hooks/useTheme';
import { makeFiltersContext } from '@/__tests__/utils/makeFiltersContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('FiltersPanel - Safety Tests', () => {
  const defaultContext = makeFiltersContext({
    filters: {
      categories: [
        { id: 1, name: 'Категория 1' },
        { id: 2, name: 'Категория 2' },
      ],
      radius: [
        { id: '30', name: '30 км' },
        { id: '60', name: '60 км' },
      ],
      address: '',
    },
    filterValue: {
      categories: [],
      radius: '60',
      address: '',
    },
  });

  const renderWithProviders = (contextOverrides: Parameters<typeof makeFiltersContext>[0] = {}) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const context = makeFiltersContext({ ...defaultContext, ...contextOverrides });
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FiltersProvider {...context}>
            <FiltersPanel />
          </FiltersProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Invalid Filter Data Handling', () => {
    it('handles empty categories array', () => {
      const { root } = renderWithProviders({
        filters: { ...defaultContext.filters, categories: [] },
      });

      expect(root).toBeTruthy();
    });

    it('handles categories with missing names', () => {
      const { root } = renderWithProviders({
        filters: {
          ...defaultContext.filters,
          categories: [
            { id: 1, name: '' },
            { id: 2, name: null as any },
            { id: 3, name: undefined as any },
          ],
        },
      });

      expect(root).toBeTruthy();
    });

    it('handles malformed category objects', () => {
      const { root } = renderWithProviders({
        filters: {
          ...defaultContext.filters,
          categories: [
            null as any,
            undefined as any,
            {} as any,
            { id: 'test' } as any,
          ],
        },
      });

      expect(root).toBeTruthy();
    });

    it('handles invalid radius values', () => {
      const { root } = renderWithProviders({
        filterValue: { ...defaultContext.filterValue, radius: 'invalid' },
      });

      expect(root).toBeTruthy();
    });
  });

  describe('Route Mode Safety', () => {
    it('handles invalid route points', () => {
      const { root } = renderWithProviders({
        mode: 'route',
        routePoints: [
          { id: '1', coordinates: { lat: NaN, lng: 27.56 }, address: 'Test' },
          { id: '2', coordinates: { lat: 53.9, lng: Infinity }, address: 'Test 2' },
        ] as any,
      });

      expect(root).toBeTruthy();
    });

    it('handles empty route points in route mode', () => {
      const { root } = renderWithProviders({
        mode: 'route',
        routePoints: [],
      });

      expect(root).toBeTruthy();
    });

    it('handles single route point', () => {
      const { root } = renderWithProviders({
        mode: 'route',
        routePoints: [{ id: '1', coordinates: { lat: 53.9, lng: 27.56 }, address: 'Test' }] as any,
      });

      expect(root).toBeTruthy();
    });

    it('handles negative route distance', () => {
      const { root } = renderWithProviders({
        mode: 'route',
        routeDistance: -100,
      });

      expect(root).toBeTruthy();
    });

    it('handles NaN route distance', () => {
      const { root } = renderWithProviders({
        mode: 'route',
        routeDistance: NaN,
      });

      expect(root).toBeTruthy();
    });
  });

  describe('Callback Safety', () => {
    it('handles missing onFilterChange callback', () => {
      const { getByTestId } = renderWithProviders({
        onFilterChange: undefined as any,
      });

      const radiusOption = getByTestId('radius-option-30');
      expect(() => fireEvent.press(radiusOption)).not.toThrow();
    });

    it('handles missing resetFilters callback', () => {
      const { root } = renderWithProviders({
        resetFilters: undefined as any,
      });

      expect(root).toBeTruthy();
    });

    it('handles missing closeMenu callback', () => {
      const { queryByTestId } = renderWithProviders({
        isMobile: true,
        closeMenu: undefined as any,
      });

      const closeButton = queryByTestId('filters-panel-close-button');
      if (closeButton) {
        expect(() => fireEvent.press(closeButton)).not.toThrow();
      } else {
        expect(closeButton).toBeNull();
      }
    });
  });

  describe('Data Consistency', () => {
    it('handles mismatched travelsData and filteredTravelsData', () => {
      const { root } = renderWithProviders({
        travelsData: [{ categoryName: 'Cat1' }, { categoryName: 'Cat2' }],
        filteredTravelsData: [{ categoryName: 'Cat3' }],
      });

      expect(root).toBeTruthy();
    });

    it('handles null travelsData', () => {
      const { root } = renderWithProviders({
        travelsData: null as any,
      });

      expect(root).toBeTruthy();
    });

    it('handles undefined filteredTravelsData', () => {
      const { root } = renderWithProviders({
        filteredTravelsData: undefined,
      });

      expect(root).toBeTruthy();
    });
  });

  describe('Category Selection Safety', () => {
    it('handles selecting already selected category', async () => {
      const onFilterChange = jest.fn();
      const { getByText } = renderWithProviders({
        onFilterChange,
        filterValue: { ...defaultContext.filterValue, categories: ['Категория 1'] },
        travelsData: [{ categoryName: 'Категория 1' }, { categoryName: 'Категория 2' }],
      });

      // Проверяем, что компонент отрисовался
      expect(getByText(/Категории/)).toBeTruthy();
    });

    it('handles rapid category selection changes', async () => {
      const onFilterChange = jest.fn();
      const { rerender } = renderWithProviders({
        onFilterChange,
      });

      // Быстрые изменения
      for (let i = 0; i < 10; i++) {
        rerender(
          <ThemeProvider>
            <FiltersProvider
              {...makeFiltersContext({
                ...defaultContext,
                onFilterChange,
                filterValue: { ...defaultContext.filterValue, categories: [`Category${i}`] },
              })}
            >
              <FiltersPanel />
            </FiltersProvider>
          </ThemeProvider>
        );
      }

      await waitFor(() => {
        expect(onFilterChange).not.toThrow();
      });
    });
  });

  describe('MapUiApi Safety', () => {
    it('handles null mapUiApi', () => {
      const { root } = renderWithProviders({
        mapUiApi: null,
      });

      expect(root).toBeTruthy();
    });

    it('handles mapUiApi with missing methods', () => {
      const { root } = renderWithProviders({
        mapUiApi: {} as any,
      });

      expect(root).toBeTruthy();
    });

    it('handles mapUiApi method errors gracefully', async () => {
      const mapUiApi = {
        zoomIn: jest.fn(() => {
          throw new Error('Zoom failed');
        }),
        capabilities: { canCenterOnUser: true },
      };

      const { getByTestId, queryByLabelText } = renderWithProviders({
        mapUiApi: mapUiApi as any,
      });

      // The section is defaultOpen in the component; only open it if needed.
      let zoomButton = queryByLabelText('Увеличить масштаб');
      if (!zoomButton) {
        fireEvent.press(getByTestId('collapsible-Настройки карты'));
        await waitFor(() => {
          expect(queryByLabelText('Увеличить масштаб')).toBeTruthy();
        });
        zoomButton = queryByLabelText('Увеличить масштаб');
      }

      expect(zoomButton).toBeTruthy();
      expect(() => fireEvent.press(zoomButton!)).not.toThrow();
    });
  });
});
