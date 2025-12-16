import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RouletteScreen from '@/app/(tabs)/roulette';
import { useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

jest.mock('@/components/listTravel/hooks/useListTravelFilters');
jest.mock('@/components/listTravel/hooks/useListTravelData');

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: jest.fn(() => ({ data: {}, isLoading: false })),
  }
})

jest.mock('expo-router', () => ({
  usePathname: () => '/roulette',
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useIsFocused: () => true,
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const useWindowDimensions = jest.fn(() => ({
    width: 1024,
    height: 800,
    scale: 1,
    fontScale: 1,
  }));

  return {
    ...RN,
    useWindowDimensions,
  };
});

jest.mock('@/components/listTravel/ModernFilters', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'ModernFilters'),
  }
});
jest.mock('@/components/listTravel/SearchAndFilterBar', () => 'SearchAndFilterBar');
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ index }: any) => (
      <View testID="roulette-card">
        <Text>{`card-${index}`}</Text>
      </View>
    ),
  };
});
jest.mock('@/components/seo/InstantSEO', () => 'InstantSEO');

jest.mock('@/src/api/miscOptimized', () => ({
  fetchAllCountries: jest.fn().mockResolvedValue([]),
  fetchAllFiltersOptimized: jest.fn().mockResolvedValue({
    countries: [],
    categories: [],
    categoryTravelAddress: [],
    transports: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
  }),
}));

const mockedUseRandomTravelData = useRandomTravelData as jest.MockedFunction<typeof useRandomTravelData>;
const mockedUseListTravelFilters = useListTravelFilters as jest.MockedFunction<typeof useListTravelFilters>;

const createTravel = (id: number) => ({
  id,
  name: `Travel ${id}`,
} as any);

function setupWeb() {
  (Platform as any).OS = 'web';

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  mockedUseListTravelFilters.mockReturnValue({
    filter: {},
    queryParams: {},
    setFilter: jest.fn(),
    resetFilters: jest.fn(),
    onSelect: jest.fn(),
    applyFilter: jest.fn(),
    handleToggleCategory: jest.fn(),
  } as any);

  const refetch = jest.fn().mockResolvedValue({ data: { pages: [{ data: [createTravel(1), createTravel(2), createTravel(3)], total: 3 }] } });

  mockedUseRandomTravelData.mockReturnValue({
    data: [createTravel(1), createTravel(2), createTravel(3)],
    total: 3,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    status: 'success',
    isInitialLoading: false,
    isNextPageLoading: false,
    isEmpty: false,
    refetch,
    handleEndReached: jest.fn(),
    handleRefresh: jest.fn(),
    isRefreshing: false,
  } as any);

  const utils = render(
    <QueryClientProvider client={client}>
      <RouletteScreen />
    </QueryClientProvider>,
  );

  return { ...utils, refetch };
}

function setupMobileWeb() {
  (Platform as any).OS = 'web';

  // Эмулируем мобильную ширину экрана
  const RN = require('react-native');
  if (RN && RN.useWindowDimensions && typeof RN.useWindowDimensions.mockReturnValue === 'function') {
    RN.useWindowDimensions.mockReturnValue({
      width: 375,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const resetFilters = jest.fn();

  mockedUseListTravelFilters.mockReturnValue({
    filter: {},
    // эмулируем наличие одного пользовательского фильтра
    queryParams: { countries: [1] },
    setFilter: jest.fn(),
    resetFilters,
    onSelect: jest.fn(),
    applyFilter: jest.fn(),
    handleToggleCategory: jest.fn(),
  } as any);

  const refetch = jest.fn().mockResolvedValue({ data: { pages: [{ data: [createTravel(1)], total: 1 }] } });

  mockedUseRandomTravelData.mockReturnValue({
    data: [createTravel(1)],
    total: 1,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    status: 'success',
    isInitialLoading: false,
    isNextPageLoading: false,
    isEmpty: false,
    refetch,
    handleEndReached: jest.fn(),
    handleRefresh: jest.fn(),
    isRefreshing: false,
  } as any);

  const utils = render(
    <QueryClientProvider client={client}>
      <RouletteScreen />
    </QueryClientProvider>,
  );

  return { ...utils, resetFilters };
}

describe('RouletteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls refetch when roulette center is pressed on desktop web', async () => {
    const { getByText, refetch, unmount } = setupWeb();

    fireEvent.press(getByText('Случайный маршрут'));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });

    unmount();
  });

  it('shows hint when there are travels but no selection yet', async () => {
    const { getByText, unmount } = setupWeb();

    await waitFor(() => {
      expect(getByText('Готов к случайному путешествию?')).toBeTruthy();
    });

    unmount();
  });

  it('clears filters via reset button on mobile web when there are active filters', async () => {
    const { getByTestId, resetFilters, unmount } = setupMobileWeb();

    fireEvent.press(getByTestId('mobile-reset-filters'));

    await waitFor(() => {
      expect(resetFilters).toHaveBeenCalledTimes(1);
    });

    unmount();
  });

  it('toggles filters modal on mobile web', async () => {
    const { getByTestId, queryByText, unmount } = setupMobileWeb();

    expect(queryByText('ModernFilters')).toBeNull();
    fireEvent.press(getByTestId('mobile-filters-button'));

    await waitFor(() => {
      expect(queryByText('ModernFilters')).toBeTruthy();
    });

    unmount();
  });
});
