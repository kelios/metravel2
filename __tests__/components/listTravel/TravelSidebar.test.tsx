import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import TravelSidebar from '@/components/listTravel/TravelSidebar';
import type { FilterGroup, FilterState } from '@/components/listTravel/utils/listTravelTypes';

// Mock the ModernFilters component
jest.mock('@/components/ui/ModernFilters', () => {
  return function MockModernFilters({ onFilterChange, onClearAll, onYearChange, onToggleModeration }: any) {
    return (
      <View>
        <View
          testID="filter-change"
          onTouchEnd={() => onFilterChange('categories', '1')}
        >
          Change Filter
        </View>
        <View
          testID="clear-all"
          onTouchEnd={onClearAll}
        >
          Clear All
        </View>
        <View
          testID="year-change"
          onTouchEnd={() => onYearChange('2023')}
        >
          Change Year
        </View>
        <View
          testID="toggle-moderation"
          onTouchEnd={onToggleModeration}
        >
          Toggle Moderation
        </View>
      </View>
    );
  };
});

const mockFilterGroups: FilterGroup[] = [
  {
    key: 'categories',
    title: 'Categories',
    options: [{ id: '1', name: 'Test Category' }],
    multiSelect: true,
    icon: 'tag',
  },
];

const mockFilter: FilterState = {
  categories: [],
};

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};

describe('TravelSidebar', () => {
  const defaultProps = {
    filterGroups: mockFilterGroups,
    filter: mockFilter,
    total: 10,
    isSuper: false,
    onFilterChange: jest.fn(),
    onClearAll: jest.fn(),
    onYearChange: jest.fn(),
    onToggleModeration: jest.fn(),
  };

  it('renders correctly', () => {
    const { getByTestId } = render(<TravelSidebar {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(getByTestId('filter-change')).toBeTruthy();
    expect(getByTestId('clear-all')).toBeTruthy();
  });

  it('calls onFilterChange when filter is changed', () => {
    const { getByTestId } = render(<TravelSidebar {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.press(getByTestId('filter-change'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('categories', '1');
  });

  it('calls onClearAll when clear all is pressed', () => {
    const { getByTestId } = render(<TravelSidebar {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.press(getByTestId('clear-all'));
    expect(defaultProps.onClearAll).toHaveBeenCalled();
  });

  it('calls onYearChange when year is changed', () => {
    const { getByTestId } = render(<TravelSidebar {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.press(getByTestId('year-change'));
    expect(defaultProps.onYearChange).toHaveBeenCalledWith('2023');
  });

  it('calls onToggleModeration when moderation is toggled', () => {
    const { getByTestId } = render(<TravelSidebar {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.press(getByTestId('toggle-moderation'));
    expect(defaultProps.onToggleModeration).toHaveBeenCalled();
  });
});
