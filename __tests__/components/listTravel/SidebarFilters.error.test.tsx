import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SidebarFilters from '@/components/listTravel/SidebarFilters';

jest.mock('@/components/listTravel/ModernFilters', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="modern-filters">filters</Text>,
  };
});

jest.mock('@/components/ui/ErrorDisplay', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss?: () => void }) => (
      <>
        <Pressable testID="filters-error-retry" onPress={onRetry}>
          <Text>{message}</Text>
        </Pressable>
        {onDismiss ? (
          <Pressable testID="filters-error-dismiss" onPress={onDismiss}>
            <Text>close</Text>
          </Pressable>
        ) : null}
      </>
    ),
  };
});

const baseProps = {
  isMobile: false,
  filterGroups: [],
  filter: {},
  onSelect: jest.fn(),
  total: 0,
  isSuper: false,
  setSearch: jest.fn(),
  resetFilters: jest.fn(),
};

describe('SidebarFilters error state', () => {
  it('shows a readable filter error and retries the failed options query', () => {
    const onRetry = jest.fn();
    const screen = render(<SidebarFilters {...baseProps} isError onRetry={onRetry} />);

    expect(screen.queryByTestId('modern-filters')).toBeNull();
    expect(screen.getByText('Не удалось загрузить фильтры')).toBeTruthy();

    fireEvent.press(screen.getByTestId('filters-error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal filters UI when the query succeeds', () => {
    const screen = render(<SidebarFilters {...baseProps} />);

    expect(screen.getByTestId('modern-filters')).toBeTruthy();
    expect(screen.queryByTestId('filters-error-retry')).toBeNull();
  });

  it('lets mobile users close the full-screen error sheet', () => {
    const onClose = jest.fn();
    const screen = render(
      <SidebarFilters
        {...baseProps}
        isMobile
        isVisible
        isError
        onClose={onClose}
      />,
    );

    fireEvent.press(screen.getByTestId('filters-error-dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
