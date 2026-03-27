// __tests__/components/listTravel/ListTravelExport.integration.test.tsx
// Regression test to surface current breakage of PDF export flow on /export
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ListTravel from '@/components/listTravel/ListTravelBase';

const mockExportSave = jest.fn();

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  usePathname: () => '/export',
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'export' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '1' }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 1200,
    isPhone: false,
    isLargePhone: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
  }),
}));

jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

jest.mock('@/components/listTravel/hooks/useListTravelVisibility', () => ({
  useListTravelVisibility: () => ({
    isPersonalizationVisible: false,
    isWeeklyHighlightsVisible: false,
    isInitialized: true,
    handleTogglePersonalization: jest.fn(),
    handleToggleWeeklyHighlights: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  useListTravelFilters: () => ({
    filter: {},
    filterForQuery: {},
    setFilter: jest.fn(),
    onSelect: jest.fn(),
    options: {},
    resetFilters: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: () => ({
    travels: [
      {
        id: 1,
        name: 'Travel 1',
        countryName: 'Country',
        userName: 'User',
        travel_image_thumb_url: '',
        slug: 'travel-1',
      },
    ],
    isInitialLoading: false,
    isNextPageLoading: false,
    isError: false,
    isEmpty: false,
    total: 1,
    refetch: jest.fn(),
    handleEndReached: jest.fn(),
    setShowFilters: jest.fn(),
    showFilters: false,
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: () => ({
    data: [
      {
        id: 1,
        name: 'Travel 1',
        countryName: 'Country',
        userName: 'User',
        travel_image_thumb_url: '',
        slug: 'travel-1',
      },
    ],
    total: 1,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    status: 'success',
    isInitialLoading: false,
    isNextPageLoading: false,
    isEmpty: false,
    refetch: jest.fn(),
    handleEndReached: jest.fn(),
    handleRefresh: jest.fn(),
    isRefreshing: false,
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  useListTravelExport: () => ({
    selected: [{ id: 1 }],
    toggleSelect: jest.fn(),
    toggleSelectAll: jest.fn(),
    clearSelection: jest.fn(),
    moveSelected: jest.fn(),
    isSelected: () => true,
    hasSelection: true,
    selectionCount: 1,
    baseSettings: {},
    lastSettings: {},
    setLastSettings: jest.fn(),
    settingsSummary: 'Шаблон по умолчанию',
    handleSaveWithSettings: jest.fn(),
    handlePreviewWithSettings: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/ListTravelExportControls', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockListTravelExportControls(props: any) {
    return (
      <Pressable onPress={() => mockExportSave(props.lastSettings)}>
        <Text>Сохранить PDF</Text>
      </Pressable>
    );
  };
});

jest.mock('@/components/listTravel/SidebarFilters', () => () => null);
jest.mock('@/components/listTravel/RightColumn', () => (props: any) => <>{props.topContent}</>);
jest.mock('@/components/listTravel/RenderTravelItem', () => () => null);

describe('ListTravel export flow (regression)', () => {
  beforeEach(() => {
    mockExportSave.mockClear();
  });

  it('should invoke export handler when clicking "Сохранить PDF" on /export', async () => {
    const client = createTestClient();
    const { findByText } = render(
      <QueryClientProvider client={client}>
        <ListTravel />
      </QueryClientProvider>
    );

    const saveButton = await findByText('Сохранить PDF');
    fireEvent.press(saveButton);

    expect(mockExportSave).toHaveBeenCalled();
  });
});
