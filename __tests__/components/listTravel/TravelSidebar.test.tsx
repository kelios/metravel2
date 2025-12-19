import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import TravelSidebar from '@/components/listTravel/TravelSidebar';
import type { FilterState } from '@/components/listTravel/ModernFilters';

type MockFilterGroup = {
  key: string;
  title: string;
  options: Array<{ id: string; name: string }>;
  multiSelect?: boolean;
  icon?: string;
};

// Mock the ModernFilters component
jest.mock('@/components/listTravel/ModernFilters', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');

  return function MockModernFilters({ onFilterChange, onClearAll, onYearChange, onToggleModeration }: any) {
    return React.createElement(
      View,
      null,
      React.createElement(
        Pressable,
        {
          testID: 'filter-change',
          onPress: () => onFilterChange('categories', '1'),
        },
        'Change Filter'
      ),
      React.createElement(
        Pressable,
        {
          testID: 'clear-all',
          onPress: onClearAll,
        },
        'Clear All'
      ),
      React.createElement(
        Pressable,
        {
          testID: 'year-change',
          onPress: () => onYearChange('2023'),
        },
        'Change Year'
      ),
      React.createElement(
        Pressable,
        {
          testID: 'toggle-moderation',
          onPress: onToggleModeration,
        },
        'Toggle Moderation'
      )
    );
  };
});

const mockFilterGroups: MockFilterGroup[] = [
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
