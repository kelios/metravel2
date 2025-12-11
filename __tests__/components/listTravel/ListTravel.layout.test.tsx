import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import ListTravel from '@/components/listTravel/ListTravel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all necessary hooks and dependencies
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
    countries: [],
    categories: [],
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

jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  useListTravelFilters: () => ({
    filter: {},
    queryParams: {},
    resetFilters: jest.fn(),
    onSelect: jest.fn(),
    applyFilter: jest.fn(),
    handleToggleCategory: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: () => ({
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
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  useListTravelExport: () => ({
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
  }),
}));

jest.mock('@/components/SkeletonLoader', () => ({
  TravelListSkeleton: () => 'TravelListSkeleton',
}));

jest.mock('@/components/mainPage/StickySearchBar', () => ({
  default: 'StickySearchBar',
}));

jest.mock('@/components/listTravel/ModernFilters', () => ({
  default: 'ModernFilters',
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
  calculateCategoriesWithCount: () => [],
  calculateColumns: () => 3,
  isMobile: false,
  getContainerPadding: () => 16,
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

describe('ListTravel Layout - Snapshot Tests', () => {
  it('renders desktop layout correctly', () => {
    const tree = renderWithProviders(<ListTravel />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders mobile layout correctly', () => {
    // Mock mobile dimensions
    jest.mocked(require('react-native')).useWindowDimensions.mockReturnValue({
      width: 375,
      height: 667,
      scale: 1,
      fontScale: 1,
    });

    const tree = renderWithProviders(<ListTravel />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders with search results correctly', () => {
    // Mock data with results
    jest.mocked(require('@/components/listTravel/hooks/useListTravelData')).mockReturnValue({
      data: [
        {
          id: 1,
          slug: 'test-travel',
          name: 'Test Travel',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
          url: '/travels/test-travel',
          youtube_link: '',
          userName: 'Test User',
          description: 'Test description',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: 'Test City',
          countryName: 'Россия',
          countUnicIpView: '100',
          gallery: [],
          travelAddress: [],
          userIds: '1',
          year: '2024',
          monthName: 'Январь',
          number_days: 7,
          companions: ['Семья'],
          countryCode: 'RU',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
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

    const tree = renderWithProviders(<ListTravel />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders loading state correctly', () => {
    // Mock loading state
    jest.mocked(require('@/components/listTravel/hooks/useListTravelData')).mockReturnValue({
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

    const tree = renderWithProviders(<ListTravel />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders error state correctly', () => {
    // Mock error state
    jest.mocked(require('@/components/listTravel/hooks/useListTravelData')).mockReturnValue({
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

    const tree = renderWithProviders(<ListTravel />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
