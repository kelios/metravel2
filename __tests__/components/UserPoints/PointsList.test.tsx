import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  const { View } = require('react-native');
  return {
    PointsListGrid: ({ renderHeader }: any) => {
      return <View>{typeof renderHeader === 'function' ? renderHeader() : null}</View>;
    },
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
}));

jest.mock('@/src/api/userPoints', () => ({
  userPointsApi: {
    getPoints: jest.fn(),
    createPoint: jest.fn(),
    updatePoint: jest.fn(),
    deletePoint: jest.fn(),
    bulkUpdatePoints: jest.fn(),
  },
}));

jest.mock('@/src/api/misc', () => ({
  fetchFilters: jest.fn(),
}));

describe('PointsList (manual create)', () => {
  const mockGetPoints = require('@/src/api/userPoints').userPointsApi.getPoints as jest.Mock;
  const mockCreatePoint = require('@/src/api/userPoints').userPointsApi.createPoint as jest.Mock;
  const mockFetchFilters = require('@/src/api/misc').fetchFilters as jest.Mock;

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
    jest.clearAllMocks();
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
    // order: Color, Category, Status
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
});
