import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { ThemeProvider } from '@/context/ThemeContext';
import TravelContent from '@/components/listTravel/TravelContent';
import type { Travel } from '@/src/types/types';
import type { EmptyStateMessage } from '@/components/listTravel/utils/listTravelTypes';

// Mock components
jest.mock('@/components/ui/StickySearchBar', () => {
  return function MockStickySearchBar({ onFiltersPress, onToggleRecommendations, onClearAll }: any) {
    return (
      <View>
        <View testID="filters-press" onTouchEnd={onFiltersPress}>Filters</View>
        <View testID="toggle-recommendations" onTouchEnd={onToggleRecommendations}>Recommendations</View>
        <View testID="clear-all" onTouchEnd={onClearAll}>Clear All</View>
      </View>
    );
  };
});

jest.mock('@/components/listTravel/TravelListSkeleton', () => {
  return function MockTravelListSkeleton() {
    return <View testID="skeleton">Loading...</View>;
  };
});

jest.mock('@/components/ui/EmptyState', () => {
  return function MockEmptyState({ action }: any) {
    return (
      <View testID="empty-state">
        <View testID="retry" onTouchEnd={action?.onPress}>Retry</View>
      </View>
    );
  };
});

jest.mock('@/components/listTravel/TravelListItem', () => {
  return function MockMemoizedTravelItem({ item }: any) {
    return <View testID={`travel-item-${item.id}`}>{item.name}</View>;
  };
});

const mockTravel: Travel = {
  id: 1,
  name: 'Test Travel',
  slug: 'test-travel',
  description: 'Test Description',
  images: [],
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
  user_id: 1,
  is_active: true,
  travel_image_thumb_url: '',
  travel_image_thumb_small_url: '',
  url: '',
  category_travel_id: null,
  category_travel_address_id: null,
  transport_id: null,
  companion_id: null,
  complexity_id: null,
  month_id: null,
  over_nights_stay_id: null,
  year: null,
  country_id: null,
  user: null,
  category_travel: null,
  category_travel_address: null,
  transport: null,
  companion: null,
  complexity: null,
  month: null,
  over_nights_stay: null,
  country: null,
} as Travel;

const mockEmptyStateMessage: EmptyStateMessage = {
  icon: 'inbox',
  title: 'No travels',
  description: 'No travels found',
  variant: 'empty',
};

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};

describe('TravelContent', () => {
  const defaultProps = {
    search: '',
    setSearch: jest.fn(),
    onFiltersPress: jest.fn(),
    onToggleRecommendations: jest.fn(),
    isRecommendationsVisible: false,
    hasActiveFilters: false,
    total: 1,
    activeFiltersCount: 0,
    onClearAll: jest.fn(),
    contentPadding: 16,
    showInitialLoading: false,
    isError: false,
    showEmptyState: false,
    getEmptyStateMessage: null as EmptyStateMessage | null,
    travels: [mockTravel],
    gridColumns: 1,
    showNextPageLoading: false,
    isMobile: false,
    isSuper: false,
    isMeTravel: false,
    isExport: false,
    setDelete: jest.fn(),
    isSelected: jest.fn(() => false),
    toggleSelect: jest.fn(),
    refetch: jest.fn(),
  };

  it('renders travel items when data is available', () => {
    const { getByTestId } = render(<TravelContent {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(getByTestId('travel-item-1')).toBeTruthy();
  });

  it('shows loading skeleton when showInitialLoading is true', () => {
    const { getByTestId } = render(
      <TravelContent {...defaultProps} showInitialLoading={true} travels={[]} />,
      { wrapper: createWrapper() }
    );

    expect(getByTestId('skeleton')).toBeTruthy();
  });

  it('shows error state when isError is true', () => {
    const { getByTestId } = render(
      <TravelContent {...defaultProps} isError={true} travels={[]} />,
      { wrapper: createWrapper() }
    );

    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('shows empty state when showEmptyState is true and message is provided', () => {
    const { getByTestId } = render(
      <TravelContent
        {...defaultProps}
        showEmptyState={true}
        getEmptyStateMessage={mockEmptyStateMessage}
        travels={[]}
      />,
      { wrapper: createWrapper() }
    );

    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('calls onFiltersPress when filters button is pressed', () => {
    const { getByTestId } = render(<TravelContent {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    fireEvent.press(getByTestId('filters-press'));
    expect(defaultProps.onFiltersPress).toHaveBeenCalled();
  });

  it('calls refetch when retry button is pressed in error state', () => {
    const { getByTestId } = render(
      <TravelContent {...defaultProps} isError={true} travels={[]} />,
      { wrapper: createWrapper() }
    );

    fireEvent.press(getByTestId('retry'));
    expect(defaultProps.refetch).toHaveBeenCalled();
  });
});
