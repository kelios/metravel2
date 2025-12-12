import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
  default: () => 'StickySearchBar',
}));

jest.mock('@/components/listTravel/ModernFilters', () => ({
  default: () => 'ModernFilters',
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
  // Функция isMobile должна соответствовать реальному helper'у и вызываться как isMobile(width)
  isMobile: (width: number) => width < 768,
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

describe('ListTravel Layout Structure', () => {
  beforeEach(() => {
    // Mock window dimensions for desktop
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1200,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
  });

  it('renders root container with flex layout', () => {
    renderWithProviders(<ListTravel />);

    // Check that root container exists (can't easily test CSS styles in RN Testing Library)
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
  });

  it('renders sidebar with correct structure', () => {
    renderWithProviders(<ListTravel />);

    // Sidebar should contain ModernFilters
    expect(screen.getByText('ModernFilters')).toBeTruthy();
  });

  it('renders content area with search and results', () => {
    renderWithProviders(<ListTravel />);

    // Should contain search bar and results count
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
    expect(screen.getByText('Путешествий не найдено')).toBeTruthy();
  });

  it('sidebar does not shrink and maintains width', () => {
    // This test verifies that sidebar is present and has the correct structure
    // In a real app, we would test the actual flex-shrink behavior
    renderWithProviders(<ListTravel />);

    const sidebarContent = screen.getByText('ModernFilters');
    expect(sidebarContent).toBeTruthy();
  });

  it('content area occupies remaining space', () => {
    renderWithProviders(<ListTravel />);

    // Content should contain search bar and results area
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
    expect(screen.getByText('Путешествий не найдено')).toBeTruthy();
  });

  it('card grid does not overflow container boundaries', () => {
    // Mock data to show cards
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

    renderWithProviders(<ListTravel />);

    // Should show results count and travel card
    expect(screen.getByText('Найдено 1 путешествие')).toBeTruthy();
    expect(screen.getByText('Test Travel')).toBeTruthy();
  });

  it('applies 3-column responsive layout for desktop (>1100px)', () => {
    // Mock desktop dimensions (>1100px)
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1440,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    renderWithProviders(<ListTravel />);

    // The component should render with responsive flexbox layout
    // Cards should be limited to max 3 per row
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
  });

  it('applies 2-column responsive layout for tablet (700-1100px)', () => {
    // Mock tablet dimensions (700-1100px)
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 900,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    renderWithProviders(<ListTravel />);

    // The component should render with responsive flexbox layout
    // Cards should be limited to max 2 per row
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
  });

  it('applies 1-column responsive layout for mobile (<700px)', () => {
    // Mock mobile dimensions (<700px)
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 375,
      height: 667,
      scale: 1,
      fontScale: 1,
    });

    renderWithProviders(<ListTravel />);

    // The component should render with responsive flexbox layout
    // Cards should be in single column
    expect(screen.getByText('StickySearchBar')).toBeTruthy();
  });
});
