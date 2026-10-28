import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@/i18n';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useListTravelFilterOptions } from '@/components/listTravel/hooks/useListTravelFilterData';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';
import { fetchAllFiltersOptimized } from '@/api/miscOptimized';
import { queryKeys } from '@/api/queryKeys';

jest.mock('@/api/miscOptimized', () => ({ fetchAllFiltersOptimized: jest.fn() }));
const fetchOptions = jest.mocked(fetchAllFiltersOptimized);
const dictionary = (name: string) => ({
  countries: [], categories: [{ id: 25, name }], categoryTravelAddress: [],
  companions: [], complexity: [], month: [], over_nights_stay: [], transports: [], sortings: [],
});
let client: QueryClient;
beforeEach(async () => {
  fetchOptions.mockReset();
  await i18n.changeLanguage('ru');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  client.clear();
  await act(async () => { await i18n.changeLanguage('ru'); });
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

it('deduplicates concurrent consumers per locale and preserves selected IDs after language switching', async () => {
  fetchOptions.mockImplementation(async ({ lang } = {}) => dictionary(lang === 'en' ? 'Mountains' : 'Горы'));
  const { result } = await renderHook(() => {
    const shared = useFilterOptions();
    const catalog = useListTravelFilterOptions(true);
    const selection = useListTravelFilters({
      options: catalog.options, isMeTravel: false, isExport: false, isTravelBy: false,
      userId: null, user_id: undefined,
    });
    return { shared, catalog, selection };
  }, { wrapper });
  await waitFor(() => expect(result.current.catalog.options?.categories?.[0].name).toBe('Горы'));
  await act(() => result.current.selection.onSelect('categories', ['25']));
  await act(async () => { await i18n.changeLanguage('en'); });
  await waitFor(() => expect(result.current.catalog.options?.categories?.[0].name).toBe('Mountains'));
  expect(result.current.shared.data?.categories[0]).toEqual({ id: 25, name: 'Mountains' });
  expect(result.current.selection.queryParams.categories).toEqual([25]);
  expect(fetchOptions).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(queryKeys.filterOptions('ru'))).toEqual(dictionary('Горы'));
  expect(client.getQueryData(queryKeys.filterOptions('en'))).toEqual(dictionary('Mountains'));
});

it('does not render a late Russian response under an English query', async () => {
  let resolveRu: (data: ReturnType<typeof dictionary>) => void = () => {};
  fetchOptions.mockImplementation(({ lang } = {}) => lang === 'ru'
    ? new Promise(resolve => { resolveRu = resolve; }) : Promise.resolve(dictionary('Mountains')));
  const { result } = await renderHook(() => useFilterOptions(), { wrapper });
  await act(async () => { await i18n.changeLanguage('en'); });
  await waitFor(() => expect(result.current.data?.categories[0].name).toBe('Mountains'));
  await act(async () => { resolveRu(dictionary('Горы')); });
  expect(result.current.data?.categories[0].name).toBe('Mountains');
});
