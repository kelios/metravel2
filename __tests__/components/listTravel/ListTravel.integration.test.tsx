import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthContext, createAuthFallbackValue } from '@/context/authContextBase';
import { useAuthStore } from '@/stores/authStore';
import ListTravel from '@/components/listTravel/ListTravelBase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { fetchAllFiltersOptimized } from '@/api/miscOptimized';
import * as travelListQueries from '@/api/travelListQueries';
import { RECOMMENDATIONS_VISIBLE_KEY } from '@/components/listTravel/utils/listTravelConstants';

// Mock all necessary dependencies
jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsiveWidth: () => (global as any).__mockResponsive?.width ?? 1440,
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1440,
      height: 800,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    },
}));

jest.mock('@/hooks/useHydrationReady', () => ({
  useHydrationReady: () => true,
  markSsgFirstScreenReady: jest.fn(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favorites: [],
    viewHistory: [],
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(() => false),
    addToHistory: jest.fn(),
    clearHistory: jest.fn(),
    getRecommendations: jest.fn(() => []),
  }),
}));

jest.mock('@/components/ui/SkeletonLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    SkeletonLoader: () => React.createElement(Text, { testID: 'skeleton-loader-mock' }, 'SkeletonLoader'),
    TravelListSkeleton: () =>
      React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'TravelListSkeleton'),
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ((global as any).__mockLocalSearchParams ?? {}),
  usePathname: () => ((global as any).__mockPathname ?? '/travels'),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useRoute: () => ({
    name: (global as any).__mockRouteName ?? 'travels',
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return function MockRenderTravelItem({
    item,
    selectable,
    onDeletePress,
    onToggle,
    authorFeedbackSlots,
  }: any) {
    return (
      <View>
        <Text>{item?.name ?? 'Travel'}</Text>
        <Text testID={`mock-feedback-slots-${String(item?.id)}`}>{String(authorFeedbackSlots)}</Text>
        <Pressable
          testID={`mock-delete-${String(item?.id)}`}
          onPress={() => onDeletePress?.(item?.id)}
        >
          <Text>delete</Text>
        </Pressable>
        {selectable && (
          <Pressable testID={`mock-toggle-${String(item?.id)}`} onPress={() => onToggle?.()}>
            <Text>toggle</Text>
          </Pressable>
        )}
      </View>
    );
  };
});

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(() => Promise.resolve({
    countries: [
      { country_id: '1', title_ru: 'Россия', name: 'Russia' },
    ],
    categories: [
      { id: '1', name: 'Горы' },
      { id: '2', name: 'Море' },
    ],
    transports: [],
    categoryTravelAddress: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
  })),
}));


const mockUseListTravelFilters = jest.fn();
const mockUseListTravelData = jest.fn();
const mockUseListTravelExport = jest.fn();

jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  __esModule: true,
  useListTravelFilters: (...args: any[]) => mockUseListTravelFilters(...args),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  __esModule: true,
  useListTravelData: (...args: any[]) => mockUseListTravelData(...args),
}));

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  __esModule: true,
  useListTravelExport: (...args: any[]) => mockUseListTravelExport(...args),
}));

const authContext = createAuthFallbackValue();

const renderWithProviders = async (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return await render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContext}>
        <ThemeProvider>{component}</ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('ListTravel Integration Tests', () => {
  const mockTravels = [
    {
      id: 1,
      slug: 'travel-1',
      name: 'Mountain Trip',
      travel_image_thumb_url: '',
      travel_image_thumb_small_url: '',
      url: '/travels/travel-1',
      youtube_link: '',
      userName: 'User 1',
      description: 'Amazing mountains',
      recommendation: '',
      plus: '',
      minus: '',
      cityName: 'Alps',
      countryName: 'Швейцария',
      countUnicIpView: '150',
      gallery: [],
      travelAddress: [],
      userIds: '1',
      year: '2024',
      monthName: 'Июль',
      number_days: 5,
      companions: ['Друзья'],
      countryCode: 'CH',
      created_at: '2024-07-01T00:00:00Z',
    },
    {
      id: 2,
      slug: 'travel-2',
      name: 'Beach Vacation',
      travel_image_thumb_url: '',
      travel_image_thumb_small_url: '',
      url: '/travels/travel-2',
      youtube_link: '',
      userName: 'User 2',
      description: 'Beautiful beach',
      recommendation: '',
      plus: '',
      minus: '',
      cityName: 'Miami',
      countryName: 'США',
      countUnicIpView: '200',
      gallery: [],
      travelAddress: [],
      userIds: '2',
      year: '2024',
      monthName: 'Август',
      number_days: 7,
      companions: ['Семья'],
      countryCode: 'US',
      created_at: '2024-08-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      userId: 'test-user',
      isSuperuser: false,
      isAuthenticated: true,
      authReady: true,
      userAvatar: null,
    });

    (global as any).__mockRouteName = 'travels';
    (global as any).__mockPathname = '/travels';
    (global as any).__mockLocalSearchParams = {};

    Platform.OS = 'web';
    window.history.replaceState(null, '', '/');

    const store = new Map<string, string>();
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
      configurable: true,
    });

    (global as any).__mockResponsive = {
      width: 1440,
      height: 800,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    };

    // Setup default mocks
    mockUseListTravelFilters.mockReturnValue({
      filter: {},
      queryParams: {},
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });

    mockUseListTravelData.mockReturnValue({
      data: mockTravels,
      total: 2,
      hasMore: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      status: 'success',
      isInitialLoading: false,
      isNextPageLoading: false,
      isEmpty: false,
      refetch: jest.fn(),
      handleEndReached: jest.fn(),
      handleRefresh: jest.fn(),
      isRefreshing: false,
    });

    mockUseListTravelExport.mockReturnValue({
      selected: [],
      toggleSelect: jest.fn(),
      toggleSelectAll: jest.fn(),
      clearSelection: jest.fn(),
      moveSelected: jest.fn(),
      moveSelectedTo: jest.fn(),
      isSelected: jest.fn(() => false),
      hasSelection: false,
      selectionCount: 0,
      baseSettings: { sortOrder: 'manual', template: 'minimal' },
      lastSettings: null,
      handleSaveWithSettings: jest.fn(),
      handlePreviewWithSettings: jest.fn(),
      settingsSummary: '',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not show recommendations by default on web when no stored preference', async () => {
    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-recommendations-button')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Подборки', expanded: false })).toBeTruthy();
  });

  it('keeps recommendations hidden on web when stored preference is false', async () => {
    (window as any).sessionStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, 'false');

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-recommendations-button')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Подборки', expanded: false })).toBeTruthy();
  });

  it('renders export mode UI and allows selecting all items', async () => {
    (global as any).__mockRouteName = 'export';
    (global as any).__mockPathname = '/export';

    const toggleSelect = jest.fn();
    const isSelected = jest.fn(() => false);

    mockUseListTravelExport.mockReturnValue({
      selected: [],
      toggleSelect,
      toggleSelectAll: jest.fn(),
      clearSelection: jest.fn(),
      moveSelected: jest.fn(),
      moveSelectedTo: jest.fn(),
      isSelected,
      hasSelection: false,
      selectionCount: 0,
      baseSettings: { sortOrder: 'manual', template: 'minimal' },
      lastSettings: { template: 'minimal', colorTheme: 'blue' },
      handleSaveWithSettings: jest.fn(),
      handlePreviewWithSettings: jest.fn(),
      settingsSummary: 'minimal • тема: blue',
    });

    await renderWithProviders(<ListTravel />);

    // In export mode, travel cards become selectable (RenderTravelItem receives selectable=true)
    const toggleButton = await screen.findByTestId('mock-toggle-1');
    await fireEvent.press(toggleButton);
    expect(toggleSelect).toHaveBeenCalledTimes(1);
  });

  it('handles web delete confirm flow (confirm true calls DELETE, confirm false cancels)', async () => {
    if (!(globalThis as any).fetch) {
      (globalThis as any).fetch = jest.fn();
    }
    const fetchMock = jest
      .mocked((globalThis as any).fetch)
      .mockResolvedValue({ ok: true, statusText: 'OK' } as any);

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByText('Mountain Trip')).toBeTruthy();
    });

    // First: open dialog and confirm -> should call delete
    await fireEvent.press(screen.getByTestId('mock-delete-1'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-button')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('confirm-delete-button'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Second: open dialog and cancel -> should not call delete again
    await fireEvent.press(screen.getByTestId('mock-delete-2'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-delete-button')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('cancel-delete-button'));

    // Depending on environment, other hooks may trigger additional fetches.
    // We only require that a DELETE request for travel was issued once.
    const deleteCalls = (fetchMock as jest.Mock).mock.calls.filter((call) => {
      const url = String(call[0] ?? '');
      const opts = call[1] as any;
      return url.includes('/api/travels/') && opts?.method === 'DELETE';
    });
    expect(deleteCalls).toHaveLength(1);
  });

  it('displays search bar, filters, and travel cards correctly', async () => {
    await renderWithProviders(<ListTravel />);

    // Check that main components are rendered
    await waitFor(() => {
      expect(within(screen.getByTestId('results-count-wrapper')).getByText('2 маршрута')).toBeTruthy();
    });

    expect(screen.getByText('Mountain Trip')).toBeTruthy();
    expect(screen.getByText('Beach Vacation')).toBeTruthy();
  });

  it('shows filters in sidebar on desktop', async () => {
    await renderWithProviders(<ListTravel />);

    // Wait for filters to load
    await waitFor(() => {
      expect(screen.getByText('Категории')).toBeTruthy();
    });

    // Expand all groups to render category options
    await fireEvent.press(screen.getByTestId('toggle-all-groups'));

    await waitFor(() => {
      expect(screen.getByText('Горы')).toBeTruthy();
      expect(screen.getByText('Море')).toBeTruthy();
    });
  });

  it('uses the parent viewport hint on the first lazy web render', async () => {
    (global as any).__mockResponsive = {
      width: 0,
      height: 0,
      isSmallPhone: true,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    await renderWithProviders(<ListTravel initialViewportWidth={1440} />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-scrollview')).toBeTruthy();
    });
  });

  it('hides sidebar filters on mobile', async () => {
    (global as any).__mockResponsive = {
      width: 375,
      height: 667,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    await renderWithProviders(<ListTravel />);

    await fireEvent.press(screen.getByLabelText('Открыть фильтры'));
    expect(screen.getByLabelText('Закрыть фильтры')).toBeTruthy();
    expect(screen.getByText('Показать результаты')).toBeTruthy();
  });

  it('updates results count when filters change', async () => {
    const mockOnSelect = jest.fn();
    mockUseListTravelFilters.mockReturnValue({
      filter: { categories: ['1'] },
      queryParams: { categories: ['1'] },
      resetFilters: jest.fn(),
      onSelect: mockOnSelect,
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });

    mockUseListTravelData.mockReturnValue({
      data: [mockTravels[0]], // Only one travel after filtering
      total: 1,
      hasMore: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      status: 'success',
      isInitialLoading: false,
      isNextPageLoading: false,
      isEmpty: false,
      refetch: jest.fn(),
      handleEndReached: jest.fn(),
      handleRefresh: jest.fn(),
      isRefreshing: false,
    });

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(within(screen.getByTestId('results-count-wrapper')).getByText('1 маршрут')).toBeTruthy();
    });

    expect(screen.getByText('Mountain Trip')).toBeTruthy();
    expect(screen.queryByText('Beach Vacation')).toBeNull();
  });

  it('waits for named deep-link filters and requests the resolved catalog once', async () => {
    (global as any).__mockPathname = '/search';
    (global as any).__mockLocalSearchParams = { categoryTravelAddress: 'Озеро' };
    const filterOptions = jest.mocked(fetchAllFiltersOptimized);
    const defaultOptions = await fetchAllFiltersOptimized();
    let resolveOptions!: (options: typeof defaultOptions) => void;
    filterOptions.mockReturnValueOnce(new Promise((resolve) => { resolveOptions = resolve; }));
    const fetchCatalog = jest.spyOn(travelListQueries, 'fetchTravels').mockResolvedValue({
      data: [], total: 0, relaxation: { stage: 'none', strictCount: 0, removedFilterKeys: [] },
    });

    mockUseListTravelFilters.mockImplementation(
      jest.requireActual('@/components/listTravel/hooks/useListTravelFilters').useListTravelFilters,
    );
    mockUseListTravelData.mockImplementation(
      jest.requireActual('@/components/listTravel/hooks/useListTravelData').useListTravelData,
    );

    try {
      await renderWithProviders(<ListTravel />);
      expect(fetchCatalog).not.toHaveBeenCalled();

      await act(async () => resolveOptions({
        ...defaultOptions,
        categoryTravelAddress: [{ id: 84, name: 'Озеро' }],
      }));
      await screen.findByText('Ничего не найдено');

      expect(fetchCatalog).toHaveBeenCalledTimes(1);
      expect(fetchCatalog).toHaveBeenCalledWith(
        0, expect.any(Number), '',
        { publish: 1, moderation: 1, categoryTravelAddress: [84] },
        expect.objectContaining({ relaxCatalog: true }),
      );
    } finally {
      fetchCatalog.mockRestore();
    }
  });

  it('shows the server stage and the removed conditions while keeping the original query', async () => {
    (global as any).__mockPathname = '/search';
    (global as any).__mockLocalSearchParams = { search: 'Брест', month: '6' };
    window.history.replaceState(null, '', '/search?search=Брест&month=6');
    mockUseListTravelFilters.mockReturnValue({
      filter: { month: [6] },
      queryParams: { month: [6] },
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
    });
    mockUseListTravelData.mockReturnValue({
      data: [mockTravels[0]], total: 20, hasMore: true, isLoading: false, isFetching: false,
      isError: false, status: 'success', isInitialLoading: false, isNextPageLoading: false,
      isEmpty: false, refetch: jest.fn(), handleEndReached: jest.fn(), handleRefresh: jest.fn(),
      isRefreshing: false, relaxation: { stage: 'light', strictCount: 0, removedFilterKeys: ['month'] },
    });

    await renderWithProviders(<ListTravel />);

    const notice = await screen.findByTestId('travel-results-fallback-notice');
    expect(within(notice).getByText(/Ослабили часть уточняющих фильтров.*Месяц/i)).toBeTruthy();
    expect(within(screen.getByTestId('results-count-wrapper')).getByText('20 маршрутов')).toBeTruthy();
    expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('Брест');
    expect(new URLSearchParams(window.location.search).get('month')).toBe('6');
    expect(mockUseListTravelData.mock.calls.every(([props]) =>
      props.relaxCatalog && props.search === 'Брест' && props.queryParams.month?.[0] === 6,
    )).toBe(true);
  });

  it('keeps the /metravel scope and sizes moderation footers from the displayed list (#2815)', async () => {
    (global as any).__mockRouteName = 'metravel';
    (global as any).__mockPathname = '/metravel';
    mockUseListTravelFilters.mockReturnValue({
      filter: { year: '2026' },
      queryParams: { year: '2026' },
      resetFilters: jest.fn(),
      onSelect: jest.fn(),
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });
    const rejectedTravel = {
      ...mockTravels[0],
      id: 515,
      name: 'Rejected Owner Trip',
      publication_status: 'draft',
      moderation_decision: 'rejected',
      moderation_decision_reason: 'Fix photos.',
      moderation_decided_at: '2026-10-21T09:15:00Z',
    };
    const result = (data: unknown[]) => ({
      data, total: data.length, hasMore: false, isLoading: false, isFetching: false, isError: false,
      status: 'success', isInitialLoading: false, isNextPageLoading: false, isEmpty: data.length === 0,
      refetch: jest.fn(), handleEndReached: jest.fn(), handleRefresh: jest.fn(), isRefreshing: false,
    });
    mockUseListTravelData.mockImplementation(({ queryParams, isQueryEnabled, relaxCatalog }) =>
      isQueryEnabled && !relaxCatalog && queryParams.year === '2026' ? result([rejectedTravel]) : result([]),
    );

    await renderWithProviders(<ListTravel />);

    await waitFor(() => expect(screen.getByText('Rejected Owner Trip')).toBeTruthy());
    expect(screen.getByTestId('mock-feedback-slots-515').props.children).toBe('7');
  });

  it('passes categoryTravelAddress from URL params into initialFilter', async () => {
    (global as any).__mockLocalSearchParams = {
      categories: '2,21',
      over_nights_stay: '1',
      categoryTravelAddress: '84',
    };

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(mockUseListTravelFilters).toHaveBeenCalled();
    });

    const lastCallArgs = mockUseListTravelFilters.mock.calls.at(-1)?.[0];
    expect(lastCallArgs?.initialFilter).toEqual({
      categories: [2, 21],
      over_nights_stay: [1],
      categoryTravelAddress: [84],
    });
  });

  it('handles search input correctly', async () => {
    const mockOnSelect = jest.fn();
    const mockResetFilters = jest.fn();

    mockUseListTravelFilters.mockReturnValue({
      filter: {},
      queryParams: {},
      resetFilters: mockResetFilters,
      onSelect: mockOnSelect,
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });

    await renderWithProviders(<ListTravel />);

    // Search input should be present
    const searchInput = screen.getByPlaceholderText('Найти маршрут…');
    expect(searchInput).toBeTruthy();

    // Type in search
    await fireEvent.changeText(searchInput, 'mountain');

    // Should accept user input (search text is updated)
    expect((searchInput as any).props.value).toBe('mountain');
  });

  it('does not render the catalog for profile-only auth changes', async () => {
    const view = await renderWithProviders(<ListTravel />);
    await waitFor(() => expect(mockUseListTravelFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ categories: expect.any(Array) }),
      }),
    ));
    mockUseListTravelFilters.mockClear();

    await act(async () => {
      useAuthStore.getState().setUserAvatar('https://example.test/avatar.png');
      useAuthStore.getState().triggerProfileRefresh();
    });
    expect(mockUseListTravelFilters).not.toHaveBeenCalled();

    await act(async () => {
      useAuthStore.setState({ userId: 'another-user', isSuperuser: true });
    });
    expect(mockUseListTravelFilters).toHaveBeenLastCalledWith(expect.objectContaining({
      userId: 'another-user',
      isSuperuser: true,
    }));

    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, userId: null });
    });
    expect(mockUseListTravelFilters).toHaveBeenLastCalledWith(expect.objectContaining({
      userId: null,
      isSuperuser: false,
    }));
    await view.unmount();
  });

  it('syncs search input with updated URL search params without remount', async () => {
    (global as any).__mockLocalSearchParams = { search: 'mountain' };

    const view = await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Найти маршрут…')).toBeTruthy();
    });

    expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('mountain');
    expect(mockUseListTravelData).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'mountain',
      })
    );

    (global as any).__mockLocalSearchParams = { search: 'beach' };

    await view.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <AuthContext.Provider value={authContext}>
          <ThemeProvider><ListTravel /></ThemeProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('beach');
    });

    expect(mockUseListTravelData).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'beach',
      })
    );
  });

  it('uses q as a search alias and canonicalizes the URL without losing params or hash', async () => {
    (global as any).__mockPathname = '/search';
    (global as any).__mockLocalSearchParams = {
      q: '  Минск  ',
      categories: '2',
    };
    window.history.replaceState(
      { source: 'integration-test' },
      '',
      '/search?q=%20%20%D0%9C%D0%B8%D0%BD%D1%81%D0%BA%20%20&categories=2&utm_source=e2e#results',
    );

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('Минск');
    });
    expect(mockUseListTravelData).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Минск', isQueryEnabled: true }),
    );

    await waitFor(() => {
      expect(window.location.search).not.toContain('q=');
    });
    expect(window.location.pathname).toBe('/search');
    expect(window.location.search).toContain('search=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA');
    expect(window.location.search).toContain('categories=2');
    expect(window.location.search).toContain('utm_source=e2e');
    expect(window.location.hash).toBe('#results');
    expect(window.history.state).toEqual({ source: 'integration-test' });
  });

  it('prefers canonical search over q and removes only the alias', async () => {
    (global as any).__mockPathname = '/search';
    (global as any).__mockLocalSearchParams = {
      search: '  Брест  ',
      q: 'Минск',
    };
    window.history.replaceState(
      null,
      '',
      '/search?search=%20%20%D0%91%D1%80%D0%B5%D1%81%D1%82%20%20&q=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA&campaign=summer#catalog',
    );

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('Брест');
    });
    expect(mockUseListTravelData).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Брест', isQueryEnabled: true }),
    );

    await waitFor(() => {
      expect(window.location.search).toBe(
        '?search=%D0%91%D1%80%D0%B5%D1%81%D1%82&campaign=summer',
      );
    });
    expect(window.location.hash).toBe('#catalog');
  });

  it('keeps a text-only zero result empty instead of enabling a searchless fallback', async () => {
    (global as any).__mockPathname = '/search';
    (global as any).__mockLocalSearchParams = { search: 'no-match-query' };
    window.history.replaceState(null, '', '/search?search=no-match-query');
    mockUseListTravelData.mockReturnValue({
      data: [],
      total: 0,
      hasMore: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      status: 'success',
      isInitialLoading: false,
      isNextPageLoading: false,
      isEmpty: true,
      refetch: jest.fn(),
      handleEndReached: jest.fn(),
      handleRefresh: jest.fn(),
      isRefreshing: false,
    });

    await renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    });
    expect(screen.getByPlaceholderText('Найти маршрут…').props.value).toBe('no-match-query');

    const enabledCalls = mockUseListTravelData.mock.calls
      .map(([props]) => props)
      .filter((props) => props.isQueryEnabled);
    expect(enabledCalls.length).toBeGreaterThan(0);
    expect(enabledCalls.every((props) => props.search === 'no-match-query')).toBe(true);
  });

  it('handles filter clearing correctly', async () => {
    const mockResetFilters = jest.fn();

    mockUseListTravelFilters.mockReturnValue({
      filter: { categories: ['1'], search: 'test' },
      queryParams: { categories: ['1'] },
      resetFilters: mockResetFilters,
      onSelect: jest.fn(),
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });

    await renderWithProviders(<ListTravel />);

    // Clear button should be available when there are active filters
    const clearButton = await screen.findByTestId('clear-all-button');
    await fireEvent.press(clearButton);

    expect(mockResetFilters).toHaveBeenCalled();
  });

  it('handles responsive layout changes', async () => {
    const { rerender } = await renderWithProviders(<ListTravel />);

    // Should show sidebar on desktop. Filter groups mount once the first
    // catalog load completes (#2765), so wait for them instead of reading sync.
    expect(await screen.findByText('Категории')).toBeTruthy();

    (global as any).__mockResponsive = {
      width: 375,
      height: 667,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    };

    // Re-render component
    await rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authContext}>
          <ThemeProvider><ListTravel /></ThemeProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await fireEvent.press(screen.getByLabelText('Открыть фильтры'));
    expect(screen.getByLabelText('Закрыть фильтры')).toBeTruthy();
    expect(screen.getByText('Показать результаты')).toBeTruthy();
  });

  it('handles loading states correctly', async () => {
    jest.useFakeTimers();
    try {
      mockUseListTravelData.mockReturnValue({
        data: [],
        total: 0,
        hasMore: false,
        isLoading: true,
        isFetching: false,
        isError: false,
        status: 'loading',
        isInitialLoading: true,
        isNextPageLoading: false,
        isEmpty: false,
        refetch: jest.fn(),
        handleEndReached: jest.fn(),
        handleRefresh: jest.fn(),
        isRefreshing: false,
      });

      await renderWithProviders(<ListTravel />);

      // Skeleton is delayed to prevent flicker.
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Current implementation shows an ActivityIndicator container on web mobile during initial loading
      expect(screen.getByTestId('cards-scroll-container')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('handles error states correctly', async () => {
    mockUseListTravelData.mockReturnValue({
      data: [],
      total: 0,
      hasMore: false,
      isLoading: false,
      isFetching: false,
      isError: true,
      status: 'error',
      isInitialLoading: false,
      isNextPageLoading: false,
      isEmpty: false,
      refetch: jest.fn(),
      handleEndReached: jest.fn(),
      handleRefresh: jest.fn(),
      isRefreshing: false,
    });

    await renderWithProviders(<ListTravel />);

    // Should show error message
    expect(screen.getByText('Ошибка загрузки')).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить маршруты.')).toBeTruthy();
  });

  it('handles empty state correctly', async () => {
    mockUseListTravelData.mockReturnValue({
      data: [],
      total: 0,
      hasMore: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      status: 'success',
      isInitialLoading: false,
      isNextPageLoading: false,
      isEmpty: true,
      refetch: jest.fn(),
      handleEndReached: jest.fn(),
      handleRefresh: jest.fn(),
      isRefreshing: false,
    });

    await renderWithProviders(<ListTravel />);

    // Should show empty state: нет карточек путешествий
    expect(screen.queryByText('Mountain Trip')).toBeNull();
    expect(screen.queryByText('Beach Vacation')).toBeNull();
  });
});
