import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { ThemeProvider } from '@/hooks/useTheme';
import ModernFilters from '@/components/listTravel/ModernFilters';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock hooks and contexts
jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'test-user',
    isSuperuser: false,
  }),
}));

const mockFilterGroups = [
  {
    key: 'categories',
    title: 'Категории',
    options: [
      { id: '1', name: 'Горы', count: 5 },
      { id: '2', name: 'Море', count: 3 },
    ],
    multiSelect: true,
    icon: 'tag',
  },
  {
    key: 'transports',
    title: 'Транспорт',
    options: [
      { id: '1', name: 'Самолет', count: 2 },
      { id: '2', name: 'Поезд', count: 4 },
    ],
    multiSelect: true,
    icon: 'truck',
  },
];

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

describe('ModernFilters Component', () => {
  const mockOnFilterChange = jest.fn();
  const mockOnClearAll = jest.fn();
  const mockOnYearChange = jest.fn();
  const mockOnToggleModeration = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter groups correctly', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
      />
    );

    expect(screen.getByText('Категории')).toBeTruthy();
    expect(screen.getByText('Транспорт')).toBeTruthy();
    expect(screen.getByText('10 путешествий')).toBeTruthy();
  });

  it('calls onFilterChange when filter option is selected', async () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
      />
    );

    fireEvent.press(screen.getByText('Категории'));
    const categoryButton = screen.getByText('Горы');
    fireEvent.press(categoryButton);

    await waitFor(() => {
      expect(mockOnFilterChange).toHaveBeenCalledWith('categories', '1');
    });
  });

  it('shows correct pluralization for results count', () => {
    const { rerender } = renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={1}
      />
    );

    expect(screen.getByText('1 путешествие')).toBeTruthy();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <ModernFilters
            filterGroups={mockFilterGroups}
            selectedFilters={{}}
            onFilterChange={mockOnFilterChange}
            onClearAll={mockOnClearAll}
            resultsCount={5}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('5 путешествий')).toBeTruthy();
  });

  it('calls onClearAll when clear button is pressed', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{ categories: ['1'] }}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
      />
    );

    const clearButton = screen.getByRole('button', { name: 'Очистить все фильтры (1)' });
    fireEvent.press(clearButton);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('displays year filter when provided', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
        year={2023}
        onYearChange={mockOnYearChange}
      />
    );

    expect(screen.getByDisplayValue('2023')).toBeTruthy();
  });

  it('uses a mobile-safe font size for the year input', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
        year={2023}
        onYearChange={mockOnYearChange}
      />
    );

    const yearInput = screen.getByDisplayValue('2023');
    const styles = Array.isArray(yearInput.props.style) ? yearInput.props.style : [yearInput.props.style];
    const flattened = Object.assign({}, ...styles.filter(Boolean));

    expect(flattened.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('keeps mobile web filter chrome compact', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={330}
        year={2026}
        onYearChange={mockOnYearChange}
        onClose={jest.fn()}
      />
    );

    const toggleAll = screen.getByTestId('toggle-all-groups');
    const toggleStyle = StyleSheet.flatten(toggleAll.props.style);
    expect(toggleStyle.height).toBe(40);
    // Icon-only on native — fixed 40×40 square, not the wide text variant (F-39).
    expect(toggleStyle.width).toBe(40);

    expect(screen.getByText('330 путешествий')).toBeTruthy();
    const resultsChip = screen.getByTestId('filters-results-chip');
    const resultsChipStyle = StyleSheet.flatten(resultsChip.props.style);
    expect(resultsChipStyle.flexShrink).toBe(0);

    const footer = screen.getByTestId('filters-apply-footer');
    const footerStyle = StyleSheet.flatten(footer.props.style);
    expect(footerStyle.paddingTop).toBe(8);
    expect(footerStyle.marginTop).toBe(4);

    const applyButton = screen.getByTestId('filters-apply-button');
    const applyStyle = StyleSheet.flatten(applyButton.props.style);
    expect(applyStyle.paddingVertical).toBe(12);

    const yearInput = screen.getByDisplayValue('2026');
    const yearStyle = StyleSheet.flatten(yearInput.props.style);
    expect(yearStyle.maxWidth).toBe(112);
    expect(yearStyle.minHeight).toBe(38);
  });

  it('renders the expand/collapse toggle icon-only on native (F-39)', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    try {
      renderWithProviders(
        <ModernFilters
          filterGroups={mockFilterGroups}
          selectedFilters={{}}
          onFilterChange={mockOnFilterChange}
          onClearAll={mockOnClearAll}
          resultsCount={385}
          onClose={jest.fn()}
        />
      );

      // Toggle button still present, but icon-only — no «Развернуть/Свернуть» label
      // widening headerRight over the results chip.
      expect(screen.getByTestId('toggle-all-groups')).toBeTruthy();
      expect(screen.queryByText('Развернуть')).toBeNull();
      expect(screen.queryByText('Свернуть')).toBeNull();

      // Chip stays non-shrinking — the F-39 fix frees space via the toggle, not by
      // compressing the chip (contract preserved).
      const resultsChip = screen.getByTestId('filters-results-chip');
      const resultsChipStyle = StyleSheet.flatten(resultsChip.props.style);
      expect(resultsChipStyle.flexShrink).toBe(0);
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('shows moderation toggle for superuser', () => {
    // Mock superuser
    jest.spyOn(require('@/context/AuthContext'), 'useAuth').mockReturnValue({
      userId: 'test-user',
      isSuperuser: true,
    });

    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
        showModeration={true}
        moderationValue={0}
        onToggleModeration={mockOnToggleModeration}
      />
    );

    expect(screen.getByText('Только на модерации')).toBeTruthy();
  });

  it('shows drafts filter for author travels', () => {
    renderWithProviders(
      <ModernFilters
        filterGroups={mockFilterGroups}
        selectedFilters={{}}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
        showDraftsOnly={true}
        draftsOnlyValue={true}
        onToggleDraftsOnly={mockOnToggleModeration}
      />
    );

    expect(screen.getByText('Показать черновики')).toBeTruthy();
    expect(screen.getByLabelText('Показать черновики').props.accessibilityState).toEqual({ checked: true });
  });

  it('moves selected object option to top of the group list', () => {
    const objectGroup = [
      {
        key: 'categoryTravelAddress',
        title: 'ОБЪЕКТЫ',
        options: [
          { id: '1', name: 'Акведук' },
          { id: '2', name: 'Амфитеатр' },
          { id: '84', name: 'Озеро' },
        ],
        multiSelect: true,
        icon: 'map-pin',
      },
    ];

    renderWithProviders(
      <ModernFilters
        filterGroups={objectGroup as any}
        selectedFilters={{ categoryTravelAddress: [84] as any }}
        onFilterChange={mockOnFilterChange}
        onClearAll={mockOnClearAll}
        resultsCount={10}
      />
    );

    fireEvent.press(screen.getByText('ОБЪЕКТЫ'));

    const optionTexts = screen.getAllByText(/Акведук|Амфитеатр|Озеро/);
    expect(optionTexts[0].props.children).toBe('Озеро');
    expect(screen.getByText('Выбрано:')).toBeTruthy();
    expect(screen.getAllByText('Озеро').length).toBeGreaterThan(1);
  });
});
