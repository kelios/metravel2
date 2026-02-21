import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/context/ThemeContext';
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
    expect(screen.getByText('Найдено 10 путешествий')).toBeTruthy();
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

    expect(screen.getByText('Найдено 1 путешествие')).toBeTruthy();

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

    expect(screen.getByText('Найдено 5 путешествий')).toBeTruthy();
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

    const clearButton = screen.getByText('Очистить (1)');
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
