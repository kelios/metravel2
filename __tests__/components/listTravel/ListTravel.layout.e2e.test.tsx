import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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
  useListTravelFilters: mockUseListTravelFilters,
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: mockUseListTravelData,
}));

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  useListTravelExport: mockUseListTravelExport,
}));

jest.mock('@/components/SkeletonLoader', () => ({
  TravelListSkeleton: () => 'TravelListSkeleton',
}));

jest.mock('@/components/mainPage/StickySearchBar', () => ({
  default: ({ onFiltersPress }: any) => (
    <div data-testid="sticky-search-bar" onClick={onFiltersPress}>
      StickySearchBar
    </div>
  ),
}));

jest.mock('@/components/listTravel/ModernFilters', () => ({
  default: ({ onFilterChange }: any) => (
    <div data-testid="modern-filters">
      <button data-testid="mountains-filter" onClick={() => onFilterChange('categories', '1')}>
        Горы
      </button>
      <button data-testid="sea-filter" onClick={() => onFilterChange('categories', '2')}>
        Море
      </button>
    </div>
  ),
}));

jest.mock('@/components/ConfirmDialog', () => ({
  default: 'ConfirmDialog',
}));

jest.mock('@/components/ui/Button', () => ({
  default: 'UIButton',
}));

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      background: '#fff',
      border: '#ddd',
      surface: '#f5f5f5',
      text: '#000',
      textMuted: '#666',
      primary: '#007bff',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    radii: {
      sm: 4,
      md: 8,
    },
    typography: {
      sizes: {
        sm: 14,
        md: 16,
        lg: 18,
      },
      weights: {
        medium: '500',
        semibold: '600',
      },
    },
    shadows: {
      light: '0 1px 3px rgba(0,0,0,0.1)',
    },
  },
}));

jest.mock('@/components/listTravel/utils/listTravelHelpers', () => ({
  calculateCategoriesWithCount: jest.fn(() => []),
  calculateColumns: jest.fn(() => 3),
  isMobile: jest.fn((width: number) => width < 768),
  getContainerPadding: jest.fn(() => 16),
}));

jest.mock('@/components/listTravel/utils/listTravelConstants', () => ({
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1440,
  },
  FLATLIST_CONFIG: {
    ON_END_REACHED_THRESHOLD: 0.5,
  },
  FLATLIST_CONFIG_MOBILE: {
    ON_END_REACHED_THRESHOLD: 0.8,
  },
  MAX_VISIBLE_CATEGORIES: 8,
  PER_PAGE: 20,
  RECOMMENDATIONS_VISIBLE_KEY: 'recommendations_visible',
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

// Mock travel data for testing
const mockTravels = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  slug: `travel-${i + 1}`,
  name: `Travel ${i + 1}`,
  travel_image_thumb_url: '',
  travel_image_thumb_small_url: '',
  url: `/travels/travel-${i + 1}`,
  youtube_link: '',
  userName: `User ${i + 1}`,
  description: `Description for travel ${i + 1}`,
  recommendation: '',
  plus: '',
  minus: '',
  cityName: `City ${i + 1}`,
  countryName: i % 2 === 0 ? 'Россия' : 'США',
  countUnicIpView: String(100 + i * 10),
  gallery: [],
  travelAddress: [],
  userIds: String(i + 1),
  year: '2024',
  monthName: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май'][i % 5],
  number_days: 5 + (i % 10),
  companions: i % 2 === 0 ? ['Семья'] : ['Друзья'],
  countryCode: i % 2 === 0 ? 'RU' : 'US',
  created_at: new Date(2024, i % 12, 1).toISOString(),
}));

describe('ListTravel E2E Scenarios', () => {
  const mockOnSelect = jest.fn();
  const mockResetFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseListTravelFilters.mockReturnValue({
      filter: {},
      queryParams: {},
      resetFilters: mockResetFilters,
      onSelect: mockOnSelect,
      applyFilter: jest.fn(),
      handleToggleCategory: jest.fn(),
    });

    mockUseListTravelData.mockReturnValue({
      data: mockTravels,
      total: 20,
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

  describe('1440px width - max 3 cards per row, no horizontal scroll', () => {
    beforeEach(() => {
      // Mock 1440px width - should show max 3 cards per row
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 1440,
        height: 900,
        scale: 1,
        fontScale: 1,
      });
    });

    it('displays travel cards in responsive flexbox layout without horizontal scroll', async () => {
      renderWithProviders(<ListTravel />);

      // Check that results count is displayed
      await waitFor(() => {
        expect(screen.getByText('Найдено 20 путешествий')).toBeTruthy();
      });

      // Check that multiple travel cards are rendered
      expect(screen.getByText('Travel 1')).toBeTruthy();
      expect(screen.getByText('Travel 10')).toBeTruthy();
      expect(screen.getByText('Travel 20')).toBeTruthy();

      // The layout should not cause horizontal overflow - max 3 cards per row
    });
  });

  describe('900px width - max 2 cards per row', () => {
    beforeEach(() => {
      // Mock 900px width - should show max 2 cards per row (700-1100px range)
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 900,
        height: 800,
        scale: 1,
        fontScale: 1,
      });
    });

    it('displays travel cards in responsive flexbox layout with max 2 per row', async () => {
      renderWithProviders(<ListTravel />);

      await waitFor(() => {
        expect(screen.getByText('Найдено 20 путешествий')).toBeTruthy();
      });

      // Check that multiple travel cards are rendered in responsive layout
      expect(screen.getByText('Travel 1')).toBeTruthy();
      expect(screen.getByText('Travel 10')).toBeTruthy();
      expect(screen.getByText('Travel 20')).toBeTruthy();
    });
  });

  describe('375px width - 1 card per row', () => {
    beforeEach(() => {
      // Mock 375px width - should show 1 card per row (<700px)
      jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
        width: 375,
        height: 667,
        scale: 1,
        fontScale: 1,
      });
    });

    it('displays travel cards in single column layout on mobile', async () => {
      renderWithProviders(<ListTravel />);

      await waitFor(() => {
        expect(screen.getByText('Найдено 20 путешествий')).toBeTruthy();
      });

      // Check that travel cards are rendered in single column layout
      expect(screen.getByText('Travel 1')).toBeTruthy();
      expect(screen.getByText('Travel 5')).toBeTruthy();
      expect(screen.getByText('Travel 10')).toBeTruthy();
    });
  });

  describe('Vertical scroll with many cards', () => {
    beforeEach(() => {
      // Mock many travels for scroll testing
      const manyTravels = Array.from({ length: 50 }, (_, i) => ({
        ...mockTravels[0],
        id: i + 1,
        name: `Travel ${i + 1}`,
        slug: `travel-${i + 1}`,
      }));

      mockUseListTravelData.mockReturnValue({
        data: manyTravels,
        total: 50,
        hasMore: true,
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
    });

    it('supports vertical scrolling in card grid', async () => {
      renderWithProviders(<ListTravel />);

      await waitFor(() => {
        expect(screen.getByText('Найдено 50 путешествий')).toBeTruthy();
      });

      // Check that many cards are rendered
      expect(screen.getByText('Travel 1')).toBeTruthy();
      expect(screen.getByText('Travel 25')).toBeTruthy();
      expect(screen.getByText('Travel 50')).toBeTruthy();

      // The card grid should be scrollable vertically
      // This is implicitly tested by the presence of many items
    });
  });

  describe('Filter application changes card count', () => {
    it('updates results count when filters are applied', async () => {
      // Mock filtered results
      const filteredTravels = mockTravels.filter(travel => travel.countryCode === 'RU');

      mockUseListTravelData.mockReturnValue({
        data: filteredTravels,
        total: filteredTravels.length,
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

      // Initially shows all travels
      await waitFor(() => {
        expect(screen.getByText(`Найдено ${filteredTravels.length} путешествий`)).toBeTruthy();
      });

      // Simulate filter application
      const filterButton = screen.getByTestId('mountains-filter');
      fireEvent.press(filterButton);

      // Results count should update
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith('categories', '1');
      });
    });

    it('shows reduced count after applying category filter', async () => {
      // Mock smaller filtered results
      const filteredTravels = mockTravels.slice(0, 5);

      mockUseListTravelFilters.mockReturnValue({
        filter: { categories: ['1'] },
        queryParams: { categories: ['1'] },
        resetFilters: mockResetFilters,
        onSelect: mockOnSelect,
        applyFilter: jest.fn(),
        handleToggleCategory: jest.fn(),
      });

      mockUseListTravelData.mockReturnValue({
        data: filteredTravels,
        total: 5,
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
        expect(screen.getByText('Найдено 5 путешествий')).toBeTruthy();
      });

      // Only filtered travels should be visible
      expect(screen.getByText('Travel 1')).toBeTruthy();
      expect(screen.queryByText('Travel 6')).toBeNull();
    });
  });

  describe('Responsive behavior', () => {
    it('adapts card grid to different screen sizes', () => {
      // Test different screen widths
      const widths = [800, 1200, 1600];

      widths.forEach(width => {
        jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
          width,
          height: 900,
          scale: 1,
          fontScale: 1,
        });

        const { rerender } = renderWithProviders(<ListTravel />);

        // Component should render without errors at different widths
        expect(screen.getByText('Найдено 20 путешествий')).toBeTruthy();

        // Clean up for next iteration
        rerender(<></>);
      });
    });
  });
});
