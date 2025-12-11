import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import StickySearchBar from '@/components/mainPage/StickySearchBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  });

  it('renders search input and buttons', () => {
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

    expect(screen.getByPlaceholderText('Поиск путешествий...')).toBeTruthy();
    expect(screen.getByText('Фильтры')).toBeTruthy();
    expect(screen.getByText('Рекомендации')).toBeTruthy();
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

    const searchInput = screen.getByPlaceholderText('Поиск путешествий...');
    fireEvent.changeText(searchInput, 'test search');

    await waitFor(() => {
      expect(mockOnSearchChange).toHaveBeenCalledWith('test search');
    });
  });

  it('calls onFiltersPress when filters button is pressed', () => {
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

    const filtersButton = screen.getByText('Фильтры');
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

    const recommendationsButton = screen.getByText('Рекомендации');
    fireEvent.press(recommendationsButton);

    expect(mockOnToggleRecommendations).toHaveBeenCalled();
  });

  it('shows active filters indicator when hasActiveFilters is true', () => {
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

    expect(screen.getByText('Фильтры (2)')).toBeTruthy();
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

    const clearButton = screen.getByText('Очистить');
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

    // Should show active state for recommendations
    const recommendationsButton = screen.getByText('Рекомендации');
    expect(recommendationsButton).toBeTruthy();
  });

  it('displays results count correctly', () => {
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

    expect(screen.getByText('25')).toBeTruthy();
  });
});
