import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeContext';
import RightColumn from '@/components/listTravel/RightColumn';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/components/mainPage/StickySearchBar', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockStickySearchBar(props: any) {
    return React.createElement(Text, { testID: 'sticky-search-bar-mock' }, props?.search ?? '');
  };
});

jest.mock('@/components/SkeletonLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    TravelListSkeleton: () => React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'skeleton'),
  };
});

jest.mock('@/components/EmptyState', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockEmptyState(props: any) {
    return React.createElement(Text, { testID: 'empty-state-mock' }, props?.title ?? 'empty');
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('RightColumn layout invariants', () => {
  const travels: any[] = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
    { id: 4, name: 'D' },
    { id: 5, name: 'E' },
  ];

  const renderItem = (t: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `travel-card-${String(t.id)}` }, t.name);
  };

  it('forces 1 column on mobile regardless of gridColumns prop', () => {
    renderWithProviders(
      <RightColumn
        search=""
        setSearch={jest.fn()}
        isRecommendationsVisible={false}
        handleRecommendationsVisibilityChange={jest.fn()}
        activeFiltersCount={0}
        total={travels.length}
        contentPadding={16}
        showInitialLoading={false}
        isError={false}
        showEmptyState={false}
        getEmptyStateMessage={null}
        travels={travels as any}
        gridColumns={3}
        isMobile={true}
        showNextPageLoading={false}
        refetch={jest.fn()}
        renderItem={renderItem as any}
      />
    );

    // Expect one item per row (5 rows)
    for (let i = 0; i < travels.length; i++) {
      expect(screen.getByTestId(`travel-row-${i}`)).toBeTruthy();
      expect(screen.getByTestId(`travel-row-${i}-item-0`)).toBeTruthy();
      expect(screen.queryByTestId(`travel-row-${i}-item-1`)).toBeNull();
    }
  });

  it('splits rows by gridColumns on non-mobile', () => {
    renderWithProviders(
      <RightColumn
        search=""
        setSearch={jest.fn()}
        isRecommendationsVisible={false}
        handleRecommendationsVisibilityChange={jest.fn()}
        activeFiltersCount={0}
        total={travels.length}
        contentPadding={16}
        showInitialLoading={false}
        isError={false}
        showEmptyState={false}
        getEmptyStateMessage={null}
        travels={travels as any}
        gridColumns={2}
        isMobile={false}
        showNextPageLoading={false}
        refetch={jest.fn()}
        renderItem={renderItem as any}
      />
    );

    // 5 items with 2 columns => 3 rows
    expect(screen.getByTestId('travel-row-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-0-item-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-0-item-1')).toBeTruthy();

    expect(screen.getByTestId('travel-row-1')).toBeTruthy();
    expect(screen.getByTestId('travel-row-1-item-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-1-item-1')).toBeTruthy();

    expect(screen.getByTestId('travel-row-2')).toBeTruthy();
    expect(screen.getByTestId('travel-row-2-item-0')).toBeTruthy();
    expect(screen.queryByTestId('travel-row-2-item-1')).toBeNull();

    expect(screen.queryByTestId('travel-row-3')).toBeNull();
  });
});
