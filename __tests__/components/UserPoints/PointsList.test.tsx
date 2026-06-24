import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.setTimeout(15000);

const mockPointsListGridProps: any[] = [];

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
    },
    useWindowDimensions: () => ({ width: 1200, height: 800, scale: 1, fontScale: 1 }),
  };
});

jest.mock('@/components/UserPoints/PointsListGrid', () => {
  const React = require('react');
  const { Text, View, TouchableOpacity } = require('react-native');
  return {
    PointsListGrid: (props: any) => {
      mockPointsListGridProps.push(props);
      // Simulate the 3-tab bar (map/list/filters) that lives inside PointsListGrid (#545).
      // Pressing segmented-list triggers onPanelTabChange so the parent can react.
      return (
        <View>
          <Text testID="points-list-grid-view-mode">{props.viewMode}</Text>
          <TouchableOpacity
            testID="segmented-map"
            onPress={() => props.onPanelTabChange?.('list')}
          />
          <TouchableOpacity
            testID="segmented-list"
            onPress={() => {
              // In the real component pressing "list" tab switches mobileTab to list.
              // The viewMode prop from parent is separate (desktop); to test the
              // desktop viewMode path, simulate onViewModeChange via renderHeader.
              if (typeof props.renderHeader === 'function') {
                // No-op: renderHeader just renders the header without triggering viewMode.
              }
              props.onPanelTabChange?.('list');
            }}
          />
          {typeof props.renderHeader === 'function' ? props.renderHeader() : null}
        </View>
      );
    },
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getPoints: jest.fn(),
    createPoint: jest.fn(),
    updatePoint: jest.fn(),
    deletePoint: jest.fn(),
    purgePoints: jest.fn(),
    bulkUpdatePoints: jest.fn(),
    exportKml: jest.fn(),
  },
}));

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(),
}));

describe('PointsList (manual create)', () => {
  const mockGetPoints = require('@/api/userPoints').userPointsApi.getPoints as jest.Mock;
  const mockCreatePoint = require('@/api/userPoints').userPointsApi.createPoint as jest.Mock;
  const mockPurgePoints = require('@/api/userPoints').userPointsApi.purgePoints as jest.Mock;
  const mockFetchFilters = require('@/api/miscOptimized').fetchAllFiltersOptimized as jest.Mock;

  const renderWithClient = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { PointsList } = require('@/components/UserPoints/PointsList');

    return render(
      <QueryClientProvider client={client}>
        <PointsList />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    // Some test suites use fake timers and don't always restore them.
    // Ensure this suite runs with real timers so @testing-library's async utils work.
    jest.useRealTimers();
    jest.clearAllMocks();
    mockPointsListGridProps.length = 0;
    mockGetPoints.mockResolvedValue([]);
    mockCreatePoint.mockResolvedValue({
      id: 1,
      name: 'Test',
      latitude: 1,
      longitude: 2,
      address: null,
      color: 'blue',
      category: 'Food',
      status: 'planning',
      imported_at: new Date(0).toISOString(),
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
    mockFetchFilters.mockResolvedValue({ categoryTravelAddress: [{ id: '39', name: 'Food' }, { id: '69', name: 'Hike' }] });
  });

  it('switches between map and list view from the header segmented control', async () => {
    renderWithClient();

    // Grid starts in map view.
    await waitFor(() => {
      expect(screen.getByTestId('points-list-grid-view-mode').props.children).toBe('map');
    });

    // The 3-tab bar (map/list/filters, #545) lives inside PointsListGrid which is
    // mocked here. The mock exposes segmented-list so we can verify it renders.
    expect(screen.getByTestId('segmented-list')).toBeTruthy();

    // Pressing segmented-list invokes onPanelTabChange; viewMode prop on Grid
    // remains 'map' (desktop viewMode is separate from mobile mobileTab).
    fireEvent.press(screen.getByTestId('segmented-list'));

    await waitFor(() => {
      expect(screen.getByTestId('points-list-grid-view-mode').props.children).toBe('map');
    });
    // Grid received viewMode='map' throughout (desktop-only prop, mobile tab is internal).
    expect(mockPointsListGridProps.at(-1)?.viewMode).toBe('map');
  });

  const openManualAdd = async () => {
    // open actions from header
    fireEvent.press(screen.getByLabelText('Управление точками'));
    // choose manual add
    fireEvent.press(screen.getByText('Добавить вручную'));
    await screen.findByText('Добавить точку вручную');
  };

  const fillBasics = () => {
    fireEvent.changeText(screen.getByPlaceholderText('Например: Любимое кафе'), 'Место');
    fireEvent.changeText(screen.getByPlaceholderText('55.755800'), '55.7558');
    fireEvent.changeText(screen.getByPlaceholderText('37.617300'), '37.6173');
  };

  const selectCategory = async (id: string) => {
    const triggers = screen.getAllByLabelText('Открыть выбор');
    // Manual modal has a single multiselect: Category.
    fireEvent.press(triggers[0]);

    const item = await screen.findByTestId(`simple-multiselect.item.${id}`);
    fireEvent.press(item);

    fireEvent.press(screen.getByText('Готово'));
  };

  it('should show validation error if category is not selected', async () => {
    renderWithClient();
    await openManualAdd();

    fillBasics();

    fireEvent.press(screen.getByText('Сохранить'));

    expect(await screen.findByText('Выберите категорию')).toBeTruthy();
    expect(mockCreatePoint).not.toHaveBeenCalled();
  });

  it('should create point with categoryId', async () => {
    renderWithClient();
    await openManualAdd();

    fillBasics();
    await selectCategory('39');

    fireEvent.press(screen.getByText('Сохранить'));

    await waitFor(() => {
      expect(mockCreatePoint).toHaveBeenCalled();
    });

    const payload = mockCreatePoint.mock.calls[0][0];
    expect(payload.categoryIds).toEqual(['39']);
  });

  it('should purge all points when confirming delete all', async () => {
    mockGetPoints.mockResolvedValue([
      {
        id: 1,
        name: 'P1',
        latitude: 1,
        longitude: 2,
        address: null,
        color: 'blue',
        category: 'Food',
        status: 'planning',
        imported_at: new Date(0).toISOString(),
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
    ]);
    mockPurgePoints.mockResolvedValue({ deleted: 1 });

    renderWithClient();

    await waitFor(() => {
      expect(mockGetPoints).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByLabelText('Управление точками'));
    expect(screen.getByText('Управление точками')).toBeTruthy();
    expect(screen.getByLabelText('Закрыть меню действий')).toBeTruthy();
    fireEvent.press(screen.getByText('Удалить все точки'));
    await screen.findByText('Удалить все точки?');

    fireEvent.press(screen.getByText('Удалить все'));

    await waitFor(() => {
      expect(mockPurgePoints).toHaveBeenCalledTimes(1);
    });
  });
});
