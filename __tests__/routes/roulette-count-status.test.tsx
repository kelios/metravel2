import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RouletteScreen from '@/components/screens/roulette/RouletteScreen';
import { ThemeProvider } from '@/hooks/useTheme';
import { fetchAllFiltersOptimized } from '@/api/miscOptimized';
import { fetchTravelFacets, type TravelFacetsResponse } from '@/api/travelListQueries';
import { queryKeys } from '@/api/queryKeys';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 390, isPhone: true, isLargePhone: false }),
  useResponsiveWidth: () => 390,
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/roulette',
  useIsFocused: () => true,
}));
jest.mock('@/components/layout/ScreenHeaderContext', () => ({ useScreenHeader: jest.fn() }));
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/listTravel/RenderTravelItem', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({ useListTravelFilters: jest.fn() }));
jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useRandomTravelData: () => ({
    data: [], isLoading: false, isFetching: false, isEmpty: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/api/miscOptimized', () => ({ fetchAllFiltersOptimized: jest.fn() }));
jest.mock('@/api/travelListQueries', () => ({ fetchTravelFacets: jest.fn() }));

const fetchOptions = jest.mocked(fetchAllFiltersOptimized);
const fetchFacets = jest.mocked(fetchTravelFacets);
const filters = jest.mocked(useListTravelFilters);
const originalOS = Platform.OS;

function deferredFacets() {
  let resolve!: (value: TravelFacetsResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<TravelFacetsResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderRoulette() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <ThemeProvider><RouletteScreen /></ThemeProvider>
    </QueryClientProvider>
  );
  return { client, tree, ...render(tree()) };
}

describe('roulette count in the real mobile filters panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    fetchOptions.mockResolvedValue({ countries: [{ id: 3, name: 'Италия' }] } as never);
    filters.mockReturnValue({
      filter: { countries: ['3'] }, queryParams: { countries: [3] },
      resetFilters: jest.fn(), onSelect: jest.fn(),
    } as ReturnType<typeof useListTravelFilters>);
  });
  afterEach(() => { Platform.OS = originalOS; });

  it('keeps ready reference filters while pending/error counts remain unknown, then shows a true zero', async () => {
    const pending = deferredFacets();
    fetchFacets.mockReturnValueOnce(pending.promise);
    const panel = renderRoulette();

    await waitFor(() => expect(fetchFacets).toHaveBeenCalledTimes(1));
    expect(panel.client.getQueryData(queryKeys.filterOptions())).toBeDefined();
    fireEvent.press(panel.getByTestId('mobile-filters-button'));
    expect(panel.getByText('Страны')).toBeTruthy();
    expect(panel.getByText('Загружаем…')).toBeTruthy();
    expect(panel.queryByText('0 путешествий')).toBeNull();

    await act(async () => pending.reject(new Error('facets offline')));
    await waitFor(() => expect(panel.getByText('Не удалось выполнить действие')).toBeTruthy());
    expect(panel.queryByText('0 путешествий')).toBeNull();
    expect(panel.getByText('Страны')).toBeTruthy();
    fireEvent.press(panel.getByText('Страны'));
    fireEvent.press(panel.getByRole('checkbox', { name: 'Италия' }));
    expect(filters.mock.results[0].value.onSelect).toHaveBeenCalledWith('countries', []);

    fetchFacets.mockResolvedValueOnce({ total: 0, facets: {} });
    await act(async () => {
      await panel.client.invalidateQueries({ queryKey: queryKeys.rouletteTravelFacets({ countries: [3] }) });
    });
    await waitFor(() => expect(panel.getByText('0 путешествий')).toBeTruthy());
    expect(panel.queryByText('Не удалось выполнить действие')).toBeNull();
    panel.unmount();
    panel.client.clear();
  });

  it('retains the confirmed count during same-key refetch failure and drops it when filters change', async () => {
    fetchFacets.mockResolvedValueOnce({ total: 7, facets: {} });
    const panel = renderRoulette();
    fireEvent.press(panel.getByTestId('mobile-filters-button'));
    await waitFor(() => expect(panel.getByText('7 путешествий')).toBeTruthy());

    const refetch = deferredFacets();
    fetchFacets.mockReturnValueOnce(refetch.promise);
    act(() => {
      void panel.client.invalidateQueries({ queryKey: queryKeys.rouletteTravelFacets({ countries: [3] }) });
    });
    await waitFor(() => expect(panel.getByText('Загружаем…')).toBeTruthy());
    expect(panel.getByText('7 путешествий')).toBeTruthy();
    await act(async () => refetch.reject(new Error('refetch offline')));
    await waitFor(() => expect(panel.getByText('Не удалось выполнить действие')).toBeTruthy());
    expect(panel.getByText('7 путешествий')).toBeTruthy();

    const changed = deferredFacets();
    fetchFacets.mockReturnValueOnce(changed.promise);
    filters.mockReturnValue({
      filter: { countries: ['4'] }, queryParams: { countries: [4] },
      resetFilters: jest.fn(), onSelect: jest.fn(),
    } as ReturnType<typeof useListTravelFilters>);
    panel.rerender(panel.tree());
    await waitFor(() => expect(panel.getByText('Загружаем…')).toBeTruthy());
    expect(panel.queryByText('7 путешествий')).toBeNull();
    expect(panel.queryByText('0 путешествий')).toBeNull();
    expect(panel.queryByText('Не удалось выполнить действие')).toBeNull();
    await act(async () => changed.resolve({ total: 3, facets: {} }));
    await waitFor(() => expect(panel.getByText('3 путешествия')).toBeTruthy());
    panel.unmount();
    panel.client.clear();
  });
});
