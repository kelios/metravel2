import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import ListTravel from '@/components/listTravel/ListTravel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all necessary dependencies
jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
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
    TravelListSkeleton: () =>
      React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'TravelListSkeleton'),
  };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    name: 'travels',
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  usePathname: () => '/travels',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

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

    // Desktop layout so that SidebarFilters (and ModernFilters with results badge) are visible
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1,
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
    // Mock desktop dimensions
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    renderWithProviders(<ListTravel />);

    // Wait for filters to load
    await waitFor(() => {
      expect(screen.getByText('Категории')).toBeTruthy();
    });

    expect(screen.getByText('Горы')).toBeTruthy();
    expect(screen.getByText('Море')).toBeTruthy();
  });

  it('hides sidebar filters on mobile', () => {
    // Mock mobile dimensions
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 375,
      height: 667,
      scale: 1,
      fontScale: 1,
    });

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

    // Ensure desktop layout so that SidebarFilters (and ModernFilters) are visible
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    renderWithProviders(<ListTravel />);

    // Clear button should be available when there are active filters
    const clearButton = await screen.findByText(/Очистить/);
    fireEvent.press(clearButton);

    expect(mockResetFilters).toHaveBeenCalled();
  });

  it('handles responsive layout changes', () => {
    // Start with desktop
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    const { rerender } = renderWithProviders(<ListTravel />);

    // Should show sidebar on desktop
    expect(screen.getByText('Категории')).toBeTruthy();

    // Change to mobile
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 375,
      height: 667,
      scale: 1,
      fontScale: 1,
    });

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

    // Should show skeleton loader
    await waitFor(() => {
      expect(screen.getByTestId('travel-list-skeleton-mock')).toBeTruthy();
    });
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
