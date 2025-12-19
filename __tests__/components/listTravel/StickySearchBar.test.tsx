import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import StickySearchBar from '@/components/mainPage/StickySearchBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1024,
      height: 768,
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

describe('StickySearchBar Component', () => {
  const mockOnSearchChange = jest.fn();
  const mockOnFiltersPress = jest.fn();
  const mockOnToggleRecommendations = jest.fn();
  const mockOnClearAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockResponsive = {
      width: 1024,
      height: 768,
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
  });

  it('renders search input and desktop actions', () => {
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={false}
        resultsCount={10}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByPlaceholderText('Найти путешествия...')).toBeTruthy();
    expect(screen.getByTestId('toggle-recommendations-button')).toBeTruthy();
    const results = screen.getByTestId('results-count-text');
    expect(String((results.props as any).children)).toContain('10');
  });

  it('calls onSearchChange when text is entered', async () => {
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={false}
        resultsCount={10}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    const searchInput = screen.getByPlaceholderText('Найти путешествия...');
    fireEvent.changeText(searchInput, 'test search');

    await waitFor(() => {
      expect(mockOnSearchChange).toHaveBeenCalledWith('test search');
    });
  });

  it('calls onFiltersPress when filters button is pressed (mobile)', () => {
    (global as any).__mockResponsive = {
      width: 375,
      height: 768,
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
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={false}
        resultsCount={10}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    const filtersButton = screen.getByTestId('filters-button');
    fireEvent.press(filtersButton);

    expect(mockOnFiltersPress).toHaveBeenCalled();
  });

  it('calls onToggleRecommendations when recommendations button is pressed', () => {
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={false}
        resultsCount={10}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    const recommendationsButton = screen.getByTestId('toggle-recommendations-button');
    fireEvent.press(recommendationsButton);

    expect(mockOnToggleRecommendations).toHaveBeenCalled();
  });

  it('shows active filters indicator on mobile when hasActiveFilters is true', () => {
    (global as any).__mockResponsive = {
      width: 375,
      height: 768,
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
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={true}
        resultsCount={10}
        activeFiltersCount={2}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByTestId('filters-badge')).toBeTruthy();
  });

  it('calls onClearAll when clear button is pressed', () => {
    renderWithProviders(
      <StickySearchBar
        search="test"
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={true}
        resultsCount={10}
        activeFiltersCount={1}
        onClearAll={mockOnClearAll}
      />
    );

    const clearButton = screen.getByTestId('clear-all-button');
    fireEvent.press(clearButton);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('shows recommendations as active when isRecommendationsVisible is true', () => {
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={true}
        hasActiveFilters={false}
        resultsCount={10}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    const recommendationsButton = screen.getByTestId('toggle-recommendations-button');
    expect(recommendationsButton.props.accessibilityState?.selected).toBe(true);
  });

  it('displays results count correctly on desktop', () => {
    renderWithProviders(
      <StickySearchBar
        search=""
        onSearchChange={mockOnSearchChange}
        onFiltersPress={mockOnFiltersPress}
        onToggleRecommendations={mockOnToggleRecommendations}
        isRecommendationsVisible={false}
        hasActiveFilters={false}
        resultsCount={25}
        activeFiltersCount={0}
        onClearAll={mockOnClearAll}
      />
    );

    const results = screen.getByTestId('results-count-text');
    expect(String((results.props as any).children)).toContain('25');
  });
});
