import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import ListTravel from '@/components/listTravel/ListTravel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';

// Mock all necessary dependencies
jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1200,
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

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'test-user',
    isSuperuser: false,
  }),
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

jest.mock('@/components/SkeletonLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    SkeletonLoader: () => React.createElement(Text, { testID: 'skeleton-loader-mock' }, 'SkeletonLoader'),
    TravelListSkeleton: () =>
      React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'TravelListSkeleton'),
  };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    name: (global as any).__mockRouteName ?? 'travels',
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ((global as any).__mockLocalSearchParams ?? {}),
  usePathname: () => ((global as any).__mockPathname ?? '/travels'),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
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
  }: any) {
    return (
      <View>
        <Text>{item?.name ?? 'Travel'}</Text>
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

jest.mock('@/src/api/miscOptimized', () => ({
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

jest.mock('@/components/listTravel/hooks/useListTravelVisibility', () => ({
  useListTravelVisibility: () => ({
    isPersonalizationVisible: false,
    isWeeklyHighlightsVisible: false,
    isInitialized: true,
    handleTogglePersonalization: jest.fn(),
    handleToggleWeeklyHighlights: jest.fn(),
  }),
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

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {component}
      </ThemeProvider>
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

    (global as any).__mockRouteName = 'travels';
    (global as any).__mockPathname = '/travels';
    (global as any).__mockLocalSearchParams = {};

    Platform.OS = 'web';

    (global as any).__mockResponsive = {
      width: 1200,
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
      toggleSelect: jest.fn(),
      toggleSelectAll: jest.fn(),
      clearSelection: jest.fn(),
      isSelected: jest.fn(() => false),
      hasSelection: false,
      selectionCount: 0,
      pdfExport: null,
      lastSettings: null,
      handleSaveWithSettings: jest.fn(),
      handlePreviewWithSettings: jest.fn(),
      settingsSummary: '',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders export mode UI and allows selecting all items', async () => {
    (global as any).__mockRouteName = 'export';
    (global as any).__mockPathname = '/export';

    const toggleSelect = jest.fn();
    const isSelected = jest.fn(() => false);

    mockUseListTravelExport.mockReturnValue({
      toggleSelect,
      toggleSelectAll: jest.fn(),
      clearSelection: jest.fn(),
      isSelected,
      hasSelection: false,
      selectionCount: 0,
      pdfExport: { openPrintBook: jest.fn() },
      lastSettings: { template: 'minimal', colorTheme: 'blue' },
      handleSaveWithSettings: jest.fn(),
      handlePreviewWithSettings: jest.fn(),
      settingsSummary: 'minimal • тема: blue',
    });

    renderWithProviders(<ListTravel />);

    // In export mode, travel cards become selectable (RenderTravelItem receives selectable=true)
    const toggleButton = await screen.findByTestId('mock-toggle-1');
    fireEvent.press(toggleButton);
    expect(toggleSelect).toHaveBeenCalledTimes(1);
  });

  it('handles web delete confirm flow (confirm true calls DELETE, confirm false cancels)', async () => {
    const confirmSpy = jest
      .spyOn(globalThis as any, 'confirm')
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);

    if (!(globalThis as any).fetch) {
      (globalThis as any).fetch = jest.fn();
    }
    const fetchMock = jest
      .mocked((globalThis as any).fetch)
      .mockResolvedValue({ ok: true, statusText: 'OK' } as any);

    renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByText('Mountain Trip')).toBeTruthy();
    });

    // First: confirm true -> should call delete
    fireEvent.press(screen.getByTestId('mock-delete-1'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled();
    });

    // Second: confirm false -> should not call fetch again
    fireEvent.press(screen.getByTestId('mock-delete-2'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });
    // Depending on environment, other hooks may trigger additional fetches.
    // We only require that a DELETE request for travel was issued once.
    const deleteCalls = (fetchMock as jest.Mock).mock.calls.filter((call) => {
      const url = String(call[0] ?? '');
      const opts = call[1] as any;
      return url.includes('/api/travels/') && opts?.method === 'DELETE';
    });
    expect(deleteCalls).toHaveLength(1);

    confirmSpy.mockRestore();
  });

  it('displays search bar, filters, and travel cards correctly', async () => {
    renderWithProviders(<ListTravel />);

    // Check that main components are rendered
    await waitFor(() => {
      expect(screen.getByText('Найдено 2 путешествия')).toBeTruthy();
    });

    expect(screen.getByText('Mountain Trip')).toBeTruthy();
    expect(screen.getByText('Beach Vacation')).toBeTruthy();
  });

  it('shows filters in sidebar on desktop', async () => {
    renderWithProviders(<ListTravel />);

    // Wait for filters to load
    await waitFor(() => {
      expect(screen.getByText('Категории')).toBeTruthy();
    });

    // Expand all groups to render category options
    fireEvent.press(screen.getByTestId('toggle-all-groups'));

    await waitFor(() => {
      expect(screen.getByText('Горы')).toBeTruthy();
      expect(screen.getByText('Море')).toBeTruthy();
    });
  });

  it('hides sidebar filters on mobile', () => {
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

    renderWithProviders(<ListTravel />);

    // Sidebar should not be visible on mobile
    expect(screen.queryByText('Категории')).toBeNull();
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

    renderWithProviders(<ListTravel />);

    await waitFor(() => {
      expect(screen.getByText('Найдено 1 путешествие')).toBeTruthy();
    });

    expect(screen.getByText('Mountain Trip')).toBeTruthy();
    expect(screen.queryByText('Beach Vacation')).toBeNull();
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

    renderWithProviders(<ListTravel />);

    // Search input should be present
    const searchInput = screen.getByPlaceholderText('Найти путешествия...');
    expect(searchInput).toBeTruthy();

    // Type in search
    fireEvent.changeText(searchInput, 'mountain');

    // Should accept user input (search text is updated)
    expect((searchInput as any).props.value).toBe('mountain');
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

    renderWithProviders(<ListTravel />);

    // Clear button should be available when there are active filters
    const clearButton = await screen.findByTestId('clear-all-button');
    fireEvent.press(clearButton);

    expect(mockResetFilters).toHaveBeenCalled();
  });

  it('handles responsive layout changes', () => {
    const { rerender } = renderWithProviders(<ListTravel />);

    // Should show sidebar on desktop
    expect(screen.getByText('Категории')).toBeTruthy();

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
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <ListTravel />
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Sidebar should be hidden on mobile
    expect(screen.queryByText('Категории')).toBeNull();
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

      renderWithProviders(<ListTravel />);

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

  it('handles error states correctly', () => {
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

    renderWithProviders(<ListTravel />);

    // Should show error message
    expect(screen.getByText('Ошибка загрузки')).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить путешествия.')).toBeTruthy();
  });

  it('handles empty state correctly', () => {
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

    renderWithProviders(<ListTravel />);

    // Should show empty state: нет карточек путешествий
    expect(screen.queryByText('Mountain Trip')).toBeNull();
    expect(screen.queryByText('Beach Vacation')).toBeNull();
  });
});
