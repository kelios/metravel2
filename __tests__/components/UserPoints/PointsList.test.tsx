import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PointsList } from '@/components/UserPoints/PointsList';

jest.mock('@/src/api/userPoints', () => ({
  userPointsApi: {
    getPoints: jest.fn(),
    createPoint: jest.fn(),
    updatePoint: jest.fn(),
    deletePoint: jest.fn(),
    bulkUpdatePoints: jest.fn(),
  },
}));

jest.mock('@/src/api/map', () => ({
  fetchFiltersMap: jest.fn(),
}));

describe('PointsList (manual create)', () => {
  const mockGetPoints = require('@/src/api/userPoints').userPointsApi.getPoints as jest.Mock;
  const mockCreatePoint = require('@/src/api/userPoints').userPointsApi.createPoint as jest.Mock;
  const mockFetchFiltersMap = require('@/src/api/map').fetchFiltersMap as jest.Mock;

  const renderWithClient = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

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
      source: 'osm',
      imported_at: new Date(0).toISOString(),
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
    mockFetchFiltersMap.mockResolvedValue({ categories: ['Food', 'Hike'] });
  });

  const openManualAdd = async () => {
    // open actions from header
    fireEvent.press(screen.getByLabelText('Добавить'));
    // choose manual add
    fireEvent.press(screen.getByText('Добавить вручную'));
    await screen.findByText('Добавить точку вручную');
  };

  const fillBasics = () => {
    fireEvent.changeText(screen.getByPlaceholderText('Например: Любимое кафе'), 'Место');
    fireEvent.changeText(screen.getByPlaceholderText('55.755800'), '55.7558');
    fireEvent.changeText(screen.getByPlaceholderText('37.617300'), '37.6173');
  };

  const selectCategory = async (name: string) => {
    const triggers = screen.getAllByLabelText('Открыть выбор');
    // order: Color, Category, Status
    fireEvent.press(triggers[0]);

    const item = await screen.findByTestId(`simple-multiselect.item.${name}`);
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

  it('should create point with category (string) and source', async () => {
    renderWithClient();
    await openManualAdd();

    fillBasics();
    await selectCategory('Food');

    fireEvent.press(screen.getByText('Сохранить'));

    await waitFor(() => {
      expect(mockCreatePoint).toHaveBeenCalled();
    });

    const payload = mockCreatePoint.mock.calls[0][0];
    expect(payload.category).toBe('Food');
    expect(payload.source).toBe('osm');
  });
});
