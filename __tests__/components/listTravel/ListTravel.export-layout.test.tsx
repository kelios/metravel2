import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import ListTravel from '@/components/listTravel/ListTravel';

const mockRightColumnSpy = jest.fn();

jest.mock('@/components/listTravel/RightColumn', () => {
  const React = require('react');
  return function RightColumnMock(props: any) {
    mockRightColumnSpy(props);
    return React.createElement(React.Fragment, null);
  };
});

jest.mock('@/components/listTravel/SidebarFilters', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/export/BookSettingsModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userId: '123',
    isSuperuser: false,
  }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  usePathname: () => '/export',
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'export' }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 1280,
    isPhone: false,
    isLargePhone: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelVisibility', () => ({
  useListTravelVisibility: () => undefined,
}));

jest.mock('@/components/listTravel/hooks/useListTravelFilters', () => ({
  useListTravelFilters: () => ({
    filter: {
      categories: [],
      transports: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      year: null,
      moderation: undefined,
    },
    queryParams: {},
    resetFilters: jest.fn(),
    onSelect: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: () => ({
    data: [],
    total: 0,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    status: 'success',
    isInitialLoading: false,
    isNextPageLoading: false,
    isEmpty: true,
    refetch: jest.fn(),
    handleEndReached: jest.fn(),
    handleRefresh: jest.fn(),
    isRefreshing: false,
  }),
}));

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  useListTravelExport: () => ({
    selectionCount: 0,
    hasSelection: false,
    toggleSelectAll: jest.fn(),
    clearSelection: jest.fn(),
    pdfExport: {
      isGenerating: false,
      progress: 0,
    },
    settingsSummary: null,
    handleOpenSettings: jest.fn(),
    handleCloseSettings: jest.fn(),
    handleSaveWithSettings: jest.fn(),
    handlePreviewWithSettings: jest.fn(),
    lastSettings: null,
    baseSettings: null,
  }),
}));

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(() =>
    Promise.resolve({
      countries: [],
      categories: [],
      transports: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
    })
  ),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe('ListTravel export layout', () => {
  beforeEach(() => {
    mockRightColumnSpy.mockClear();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  it('forces a single column on export route', () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

    expect(mockRightColumnSpy).toHaveBeenCalled();
    const props = mockRightColumnSpy.mock.calls[0][0];
    expect(props.isMobile).toBe(false);
    expect(props.gridColumns).toBeGreaterThan(1);
    const containerStyle = Array.isArray(props.containerStyle)
      ? Object.assign({}, ...props.containerStyle)
      : props.containerStyle;
    expect(containerStyle.flex).toBe(1);
  });
});
