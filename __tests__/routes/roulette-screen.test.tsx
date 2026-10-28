import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RouletteScreen from '@/app/(tabs)/roulette';
import { useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1400,
      height: 900,
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

jest.mock('@/components/listTravel/hooks/useListTravelFilters');
jest.mock('@/components/listTravel/hooks/useListTravelData');

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: jest.fn(() => ({ data: { total: 3, facets: {} }, isLoading: false })),
  }
})

jest.mock('expo-router', () => ({
  usePathname: () => '/roulette',
  useIsFocused: () => true,
  // Шапка экрана (`useScreenHeader`, #2099) регистрируется на фокусе.
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(effect, [effect]);
  },
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const useWindowDimensions = jest.fn(() => ({
    width: 1024,
    height: 800,
    scale: 1,
    fontScale: 1,
  }));
  const mockReactNative = {}
  Object.defineProperties(mockReactNative, Object.getOwnPropertyDescriptors(RN))
  Object.defineProperty(mockReactNative, 'useWindowDimensions', {
    value: useWindowDimensions,
    configurable: true,
    enumerable: true,
    writable: true,
  })

  return mockReactNative;
});

jest.mock('@/components/listTravel/ModernFilters', () => {
  const React = require('react')
  const { Text, Pressable, View } = require('react-native')
  return {
    __esModule: true,
    default: ({ onFilterChange, onYearChange }: {
      onFilterChange: (key: string, id: string) => void;
      onYearChange: (year: string) => void;
    }) => (
      <View>
        <Text>ModernFilters</Text>
        <Pressable testID="select-germany" onPress={() => onFilterChange('countries', '65')}>
          <Text>Германия</Text>
        </Pressable>
        <Pressable testID="select-year" onPress={() => onYearChange('2026')}>
          <Text>2026</Text>
        </Pressable>
      </View>
    ),
  }
});
jest.mock('@/components/listTravel/RenderTravelItem', () => {
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

jest.mock('@/api/miscOptimized', () => ({
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

const mockedUseQuery = jest.requireMock('@tanstack/react-query').useQuery as jest.Mock;
const mockedUseRandomTravelData = useRandomTravelData as jest.MockedFunction<typeof useRandomTravelData>;
const mockedUseListTravelFilters = useListTravelFilters as jest.MockedFunction<typeof useListTravelFilters>;

const createTravel = (id: number) => ({
  id,
  name: `Travel ${id}`,
} as any);

async function setupWeb(dataOverrides: Record<string, unknown> = {}) {
  (Platform as any).OS = 'web';
  mockedUseQuery.mockImplementation(() => ({ data: { total: 3, facets: {} }, isLoading: false }));

  (global as any).__mockResponsive = {
    width: 1400,
    height: 900,
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
    ...dataOverrides,
  } as any);

  const utils = await render(
    <QueryClientProvider client={client}>
      <RouletteScreen />
    </QueryClientProvider>,
  );

  return { ...utils, refetch };
}

// Словарь стран в форме `/countriesforsearch/`: из него рулетка берёт страны
// по умолчанию (Беларусь и Польша) и подпись строки фильтров.
const COUNTRY_DICTIONARY = [
  { country_id: 3, title_ru: 'Беларусь' },
  { country_id: 160, title_ru: 'Польша' },
  { country_id: 65, title_ru: 'Германия' },
];

async function setupMobile(platform: 'web' | 'android' | 'ios' = 'web') {
  (Platform as any).OS = platform;
  mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) =>
    queryKey[0] === 'filter-options'
      ? { data: { countries: COUNTRY_DICTIONARY }, isLoading: false }
      : { data: { total: 1, facets: {} }, isLoading: false },
  );

  (global as any).__mockResponsive = {
    width: 390,
    height: 844,
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

  mockedUseListTravelFilters.mockImplementation(
    jest.requireActual('@/components/listTravel/hooks/useListTravelFilters').useListTravelFilters,
  );

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

  const utils = await render(
    <QueryClientProvider client={client}>
      <RouletteScreen />
    </QueryClientProvider>,
  );

  return utils;
}

describe('RouletteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (Platform as any).OS = 'web';
  });

  it('calls refetch when roulette center is pressed on desktop web', async () => {
    const { getByLabelText, refetch, unmount } = await setupWeb();

    await fireEvent.press(getByLabelText('Крутить рулетку'));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });

    await unmount();
  });

  // #2375: пустая выдача под фильтрами — плитка «Ничего не нашли»; ошибка запроса
  // пустым состоянием не считается.
  it('shows roulette-empty when the completed request returned no travels', async () => {
    const { getByTestId, unmount } = await setupWeb({ data: [], total: 0, isEmpty: true });

    await waitFor(() => {
      expect(getByTestId('roulette-empty')).toBeTruthy();
    });

    await unmount();
  });

  it('does not show roulette-empty on a failed request', async () => {
    const { queryByTestId, unmount } = await setupWeb({ data: [], total: 0, isEmpty: false, isError: true, status: 'error' });

    await waitFor(() => {
      expect(queryByTestId('roulette-empty')).toBeNull();
    });

    await unmount();
  });

  it('shows hint when there are travels but no selection yet', async () => {
    const { getByText, unmount } = await setupWeb();

    await waitFor(() => {
      expect(getByText('Не знаешь, куда поехать?')).toBeTruthy();
    });

    await unmount();
  });

  // #2431: подставленные страны по умолчанию — не выбор пользователя.
  it('hides the mobile reset at default countries and names them in the summary', async () => {
    const { queryByTestId, getByText, unmount } = await setupMobile();

    await waitFor(() => {
      expect(getByText('Фильтры: Беларусь и ещё 1')).toBeTruthy();
    });
    expect(queryByTestId('mobile-reset-filters')).toBeNull();

    await unmount();
  });

  it.each(['web', 'android', 'ios'] as const)('restores default countries after selecting and resetting on %s', async (platform) => {
    const { getByTestId, getByText, queryByTestId, unmount } = await setupMobile(platform);

    await waitFor(() => {
      expect(getByText('Фильтры: Беларусь и ещё 1')).toBeTruthy();
    });
    expect(queryByTestId('mobile-reset-filters')).toBeNull();

    await fireEvent.press(getByTestId('mobile-filters-button'));
    await fireEvent.press(getByTestId('select-germany'));

    await waitFor(() => {
      expect(getByText('Фильтры: Беларусь и ещё 2')).toBeTruthy();
    });
    expect(mockedUseRandomTravelData).toHaveBeenLastCalledWith(expect.objectContaining({
      queryParams: expect.objectContaining({ countries: [3, 65, 160] }),
    }));
    await fireEvent.press(getByTestId('mobile-reset-filters'));

    await waitFor(() => {
      expect(getByText('Фильтры: Беларусь и ещё 1')).toBeTruthy();
      expect(queryByTestId('mobile-reset-filters')).toBeNull();
    });
    expect(mockedUseRandomTravelData).toHaveBeenLastCalledWith(expect.objectContaining({
      queryParams: expect.objectContaining({ countries: [3, 160] }),
    }));

    await unmount();
  });

  it('offers mobile reset for a year alone and removes it after clearing', async () => {
    const { getByTestId, queryByTestId, unmount } = await setupMobile();

    expect(queryByTestId('mobile-reset-filters')).toBeNull();
    await fireEvent.press(getByTestId('mobile-filters-button'));
    await fireEvent.press(getByTestId('select-year'));
    expect(mockedUseRandomTravelData).toHaveBeenLastCalledWith(expect.objectContaining({
      queryParams: expect.objectContaining({ countries: [3, 160], year: '2026' }),
    }));

    await fireEvent.press(getByTestId('mobile-reset-filters'));

    expect(queryByTestId('mobile-reset-filters')).toBeNull();
    const lastCall = mockedUseRandomTravelData.mock.calls.at(-1)![0];
    expect(lastCall.queryParams).not.toHaveProperty('year');
    expect(lastCall.queryParams.countries).toEqual([3, 160]);
    await unmount();
  });

  it('toggles filters modal on mobile web', async () => {
    const { getByTestId, queryByText, unmount } = await setupMobile();

    expect(queryByText('ModernFilters')).toBeNull();
    await fireEvent.press(getByTestId('mobile-filters-button'));

    await waitFor(() => {
      expect(queryByText('ModernFilters')).toBeTruthy();
    });

    await unmount();
  });
});
