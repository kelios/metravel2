import React, { act } from 'react';
import type { TestInstance } from 'test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthContext, createAuthFallbackValue } from '@/context/authContextBase';
import { createRootRegistry } from '../../helpers/rawRootLifecycle';
import { getOnlyHost, queryHost } from '../../helpers/hostQueries';

/**
 * #3335 (дефект приёмки): поиск, фильтры и сортировка каталога живут в состоянии
 * списка и пишутся в адрес через `history.replaceState` мимо роутера — параметры
 * маршрута не меняются. Указатель `/search?page=N` и canonical страницы снимает
 * сам список. Цепочка настоящая: граница из серверного DOM → экран /search
 * (canonical) → ListTravelBase → подвал RightColumn.
 */
jest.mock('@/hooks/useDebouncedValue', () => ({ useDebouncedValue: (value: unknown) => value }));
jest.mock('@/hooks/useHydrationReady', () => ({ useHydrationReady: () => true, markSsgFirstScreenReady: jest.fn() }));
jest.mock('@/hooks/useResponsive', () => {
  const responsive = {
    width: 390, height: 800, isSmallPhone: false, isPhone: true, isLargePhone: false, isTablet: false,
    isLargeTablet: false, isDesktop: false, isMobile: true, isPortrait: true, isLandscape: false,
    orientation: 'portrait', breakpoints: {}, isAtLeast: () => false, isAtMost: () => true, isBetween: () => false,
  };
  return { useResponsiveWidth: () => 390, useResponsive: () => responsive };
});
jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favorites: [], viewHistory: [], addFavorite: jest.fn(), removeFavorite: jest.fn(),
    isFavorite: jest.fn(() => false), addToHistory: jest.fn(), clearHistory: jest.fn(), getRecommendations: jest.fn(() => []),
  }),
}));
jest.mock('expo-router', () => ({
  useLoaderData: () => {
    throw new Error('loader must not be read on the client');
  },
  useLocalSearchParams: () => ({ page: '2' }),
  usePathname: () => '/search',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ name: 'search' }),
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));
const mockCanonicals: string[] = [];
jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: ({ canonical }: { canonical: string }) => {
    mockCanonicals.push(canonical);
    return null;
  },
}));
jest.mock('@/components/listTravel/SearchListTravelRoute', () => ({
  __esModule: true,
  default: (props: object) => {
    const ListTravelBase = jest.requireActual('@/components/listTravel/ListTravelBase').default;
    return require('react').createElement(ListTravelBase, props);
  },
}));
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const { Text } = require('react-native');
  return function MockRenderTravelItem({ item }: { item: { name: string } }) {
    return require('react').createElement(Text, null, item.name);
  };
});
jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(() => Promise.resolve({
    countries: [], categories: [], transports: [], categoryTravelAddress: [], companions: [],
    complexity: [], month: [], over_nights_stay: [],
  })),
  fetchAllCountries: jest.fn(() => Promise.resolve([])),
}));

// Настоящий хук фильтров: тест берёт его `onSelect`/`resetFilters` — те же
// колбэки, что зовут панель фильтров, чипы и переключатель сортировки.
let mockOnSelect: (field: string, value: unknown) => void = () => undefined;
let mockResetFilters: () => void = () => undefined;
jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => {
  const actual = jest.requireActual('@/components/listTravel/hooks/useListTravelFilters');
  return {
    __esModule: true,
    useListTravelFilters: (args: unknown) => {
      const result = actual.useListTravelFilters(args);
      mockOnSelect = result.onSelect;
      mockResetFilters = result.resetFilters;
      return result;
    },
  };
});
jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  __esModule: true,
  useListTravelData: () => ({
    data: [{ id: 1, slug: 'a', name: 'Mountain Trip' }], total: 1, isFetching: false, isError: false,
    isInitialLoading: false, isNextPageLoading: false, isEmpty: false, refetch: jest.fn(), handleEndReached: jest.fn(),
  }),
}));

// Серверный HTML указателя страницы 2 (как его отдаёт SSR-рантайм).
const SERVER_NAV =
  '<nav data-search-catalog-links="2"><h2>2</h2><ul><li><a href="/travels/statya-13">Статья 13</a></li></ul>' +
  '<div data-pager=""><a href="/search" rel="prev">prev</a><a href="/search?page=3" rel="next">next</a></div></nav>';

// Экран web рисует настоящие <h1>/<nav>; RNTL пускает текст только в Text,
// поэтому — общий рендерер, как в home-screen.h1.web.
const roots = createRootRegistry();
let container: TestInstance;

const renderSearchPage = async () => {
  const Boundary = require('@/components/listTravel/SearchCatalogLinks.web').default;
  const SearchScreen = require('../../../app/(tabs)/search').default;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = roots.createRoot();
  container = root.container;
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={createAuthFallbackValue()}>
          <ThemeProvider>
            <Boundary><SearchScreen /></Boundary>
          </ThemeProvider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  });
};

const pointer = () => queryHost(container, (node) => node.type === 'nav');
const pointerLinks = () =>
  (pointer()?.queryAll((node) => node.type === 'a') ?? []).map((node) => node.props.href);
const lastCanonical = () => mockCanonicals.at(-1);
const typeSearch = async (text: string) => {
  const input = getOnlyHost(container, (node) => node.props.placeholder === 'Найти маршрут…' && typeof node.props.onChangeText === 'function');
  await act(async () => input.props.onChangeText(text));
};

beforeEach(() => {
  Platform.OS = 'web';
  mockCanonicals.length = 0;
  document.body.innerHTML = SERVER_NAV;
  window.history.replaceState(null, '', '/search?page=2');
});

afterEach(async () => {
  await roots.cleanup();
  document.body.innerHTML = '';
});

it('keeps the server pointer and the page canonical while the catalogue is untouched', async () => {
  await renderSearchPage();
  expect(pointerLinks()).toEqual(['/travels/statya-13', '/search', '/search?page=3']);
  expect(lastCanonical()).toBe('https://metravel.by/search?page=2');
});

it('drops the pointer and the page canonical after a search typed into the catalogue', async () => {
  await renderSearchPage();
  expect(pointer()).not.toBeNull();

  await typeSearch('Минск');

  expect(pointer()).toBeNull();
  expect(lastCanonical()).toBe('https://metravel.by/search');
  // Сброс поиска не возвращает указатель: данные страницы клиент не перечитывает.
  await typeSearch('');
  expect(pointer()).toBeNull();
  expect(lastCanonical()).toBe('https://metravel.by/search');
});

it.each([
  ['countries', [3]],
  ['categories', [1]],
  ['sort', 'new'],
  ['year', '2024'],
  ['moderation', 0],
])('drops the pointer and the page canonical after the %s filter changes', async (field, value) => {
  await renderSearchPage();
  expect(pointer()).not.toBeNull();

  await act(async () => mockOnSelect(field, value));

  expect(pointer()).toBeNull();
  expect(lastCanonical()).toBe('https://metravel.by/search');
  await act(async () => mockResetFilters());
  expect(pointer()).toBeNull();
  expect(lastCanonical()).toBe('https://metravel.by/search');
});
