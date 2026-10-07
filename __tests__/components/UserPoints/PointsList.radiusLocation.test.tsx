// PERM-3: геолокация больше не запрашивается при загрузке, а радиус фильтрует
// только относительно неё. Выбор другого радиуса — действие пользователя, и
// именно оно должно запросить локацию; иначе чип радиуса молча ничего не делал.
import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';

jest.setTimeout(15000);

const mockHeaderParams: any[] = [];

jest.mock('@/hooks/useResponsive', () => ({
  ...jest.requireActual('@/hooks/useResponsive'),
  useBreakpoints: () => ({ width: 1200, isMobile: false }),
}));

jest.mock('@/components/UserPoints/PointsListGrid', () => ({
  PointsListGrid: () => null,
}));

jest.mock('@/components/UserPoints/usePointsHeaderRenderer', () => ({
  usePointsHeaderRenderer: (params: any) => {
    mockHeaderParams.push(params);
    return () => null;
  },
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getPoints: jest.fn(async () => []),
    getPointsPage: jest.fn(async () => ({ items: [], hasMore: false })),
    createPoint: jest.fn(),
    updatePoint: jest.fn(),
    deletePoint: jest.fn(),
    purgePoints: jest.fn(),
    bulkUpdatePoints: jest.fn(),
    exportKml: jest.fn(),
  },
}));

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}));

describe('PointsList radius filter → location on user action (PERM-3)', () => {
  const getCurrentPosition = jest.fn();
  const originalPlatformOS = Platform.OS;
  let originalNavigator: unknown;

  beforeEach(() => {
    jest.useRealTimers();
    // Web-ветка запроса геолокации (`navigator.geolocation`).
    Platform.OS = 'web';
    mockHeaderParams.length = 0;
    getCurrentPosition.mockReset();
    originalNavigator = (global as any).navigator;
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: { geolocation: { getCurrentPosition } },
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: originalNavigator,
    });
  });

  const renderList = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { PointsList } = require('@/components/UserPoints/PointsList');
    return render(
      <QueryClientProvider client={client}>
        <PointsList />
      </QueryClientProvider>,
    );
  };

  const latestHeader = () => mockHeaderParams[mockHeaderParams.length - 1];

  it('does not ask for location on mount, asks once a different radius is picked', async () => {
    getCurrentPosition.mockImplementation((resolve: any) =>
      resolve({ coords: { latitude: 53.9, longitude: 27.56 } }),
    );
    renderList();
    await waitFor(() => expect(mockHeaderParams.length).toBeGreaterThan(0));
    expect(getCurrentPosition).not.toHaveBeenCalled();

    const { filters, onFilterChange } = latestHeader();
    await act(async () => {
      onFilterChange({ ...filters, radiusKm: 200 });
    });

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });

  it('does not ask for location when the radius is cleared to "all points"', async () => {
    renderList();
    await waitFor(() => expect(mockHeaderParams.length).toBeGreaterThan(0));

    const { filters, onFilterChange } = latestHeader();
    await act(async () => {
      onFilterChange({ ...filters, radiusKm: null });
    });

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
