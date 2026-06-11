import { render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravelBase';

const mockRouterPush = jest.fn();

// Базовый мок для AuthContext и маршрута, который можно перенастраивать в тестах
const mockUseAuth: jest.Mock<any, any> = jest.fn(() => ({
  isAuthenticated: false,
  authReady: true,
  username: '',
  isSuperuser: false,
  userId: null,
  setIsAuthenticated: jest.fn(),
  setUsername: jest.fn(),
  setIsSuperuser: jest.fn(),
  setUserId: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  sendPassword: jest.fn(),
  setNewPassword: jest.fn(),
}));

const mockUseRoute = jest.fn(() => ({ name: 'travels' }));

// Mock AuthContext, чтобы не требовать реальный AuthProvider
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock dependencies
jest.mock('@/components/listTravel/RecommendationsTabs', () => ({
  __esModule: true,
  default: () => null,
}));


jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  __esModule: true,
  useKeyboardShortcuts: () => {
    // no-op в тестах
  },
}));

jest.mock('@/components/ui/ConfirmDialog', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const ConfirmDialogMock = ({ visible, onConfirm, title, message }: any) => {
    const confirmedRef = React.useRef(false);

    React.useEffect(() => {
      if (visible && onConfirm && !confirmedRef.current) {
        confirmedRef.current = true;
        onConfirm();
      }
      if (!visible) {
        confirmedRef.current = false;
      }
    }, [visible, onConfirm]);

    if (!visible) {
      return null;
    }

    return (
      <View testID="confirm-dialog-mock">
        {typeof title === 'string' ? <Text>{title}</Text> : null}
        {typeof message === 'string' ? <Text>{message}</Text> : null}
      </View>
    );
  };

  return {
    __esModule: true,
    default: ConfirmDialogMock,
  };
});

jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const React = require('react');
  const RenderTravelItemMock = ({ item, onDeletePress }: any) => {
    React.useEffect(() => {
      if (item && onDeletePress) {
        onDeletePress(item.id);
      }
    }, [item, onDeletePress]);

    return null;
  };

  return {
    __esModule: true,
    default: RenderTravelItemMock,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/api/travelsApi', () => ({
  deleteTravel: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/api/travelListQueries', () => ({
  fetchTravels: jest.fn(() => Promise.resolve({ data: [], total: 0, hasMore: false })),
  fetchRandomTravels: jest.fn(() => Promise.resolve({ data: [], total: 0, hasMore: false })),
  fetchTravelFacets: jest.fn(() => Promise.resolve({ total: 0, facets: {} })),
}));

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(() => Promise.resolve({
    countries: [],
    categories: [],
    transports: [],
    categoryTravelAddress: [],
    companions: [],
    complexity: [],
    month: [],
    over_nights_stay: [],
    sortings: [],
  })),
  fetchAllCountries: jest.fn(() => Promise.resolve([])),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('ListTravel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();

    // Mock window methods for web environment
    if (typeof window !== 'undefined') {
      window.addEventListener = jest.fn();
      window.removeEventListener = jest.fn();
    } else {
      (global as any).window = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
    }

    // Reset global mocks for delete flow
    (global as any).fetch = jest.fn();

    // значения по умолчанию для большинства тестов
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authReady: true,
      username: '',
      isSuperuser: false,
      userId: null,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    mockUseRoute.mockReset();
    mockUseRoute.mockReturnValue({ name: 'travels' });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

  it('renders the search input', async () => {
    renderComponent();
    expect(await screen.findByPlaceholderText('Найти путешествия...')).toBeTruthy();
  });

  it('renders an empty state message when there are no items', async () => {
    renderComponent();
    expect(await screen.findByText(/Пока нет путешествий/i)).toBeTruthy();
  });

  it('for "Мои путешествия" (metravel) shows empty state only after userId is available', async () => {
    // Этап 1: пока userId нет, используем маршрут metravel и убеждаемся, что текст пустого состояния не показывается
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authReady: true,
      username: 'User',
      isSuperuser: false,
      userId: null,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    const firstRender = renderComponent();

    await waitFor(() => {
      expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
    });
    firstRender.unmount();

    // Этап 2: когда userId появляется, снова рендерим список и ожидаем стандартное пустое состояние
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authReady: true,
      username: 'User',
      isSuperuser: false,
      userId: '123',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    renderComponent();

    expect(await screen.findByText(/Пока нет путешествий/i)).toBeTruthy();
  });

  it('for "Мои путешествия" (metravel) shows login CTA to guests', async () => {
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValueOnce({
      isAuthenticated: false,
      authReady: true,
      username: '',
      isSuperuser: false,
      userId: null,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    renderComponent();

    expect(await screen.findByText('Войдите в аккаунт')).toBeTruthy();
    expect(screen.getByText(/видеть свои путешествия/i)).toBeTruthy();
    expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
  });

  it('shows timeout error message when deleteTravel fails with timeout on web', async () => {
    const travelsApi: any = require('@/api/travelsApi');
    const travelListQueries: any = require('@/api/travelListQueries');
    travelListQueries.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 1, title: 'Test travel' }],
      total: 1,
      hasMore: false,
    });

    travelsApi.deleteTravel.mockRejectedValueOnce(new Error('timeout: request timeout'));

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    renderComponent();

    await waitFor(() => {
      expect(travelsApi.deleteTravel).toHaveBeenCalledWith('1');
    });

    await waitFor(() => {
      expect(screen.getByText(/Превышено время ожидания/i)).toBeTruthy();
    });

    (Platform as any).OS = originalOS;
  });

  it('shows access denied error message when deleteTravel fails with 403 on web', async () => {
    const travelsApi: any = require('@/api/travelsApi');
    const travelListQueries: any = require('@/api/travelListQueries');
    travelListQueries.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 2, title: 'Another travel' }],
      total: 1,
      hasMore: false,
    });

    travelsApi.deleteTravel.mockRejectedValueOnce(new Error('403: access denied'));

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    renderComponent();

    await waitFor(() => {
      expect(travelsApi.deleteTravel).toHaveBeenCalledWith('2');
    });

    await waitFor(() => {
      expect(screen.getByText(/Нет доступа/i)).toBeTruthy();
    });

    (Platform as any).OS = originalOS;
  });

  it('treats 404 on delete as already removed and does not show alert on web', async () => {
    const travelsApi: any = require('@/api/travelsApi');
    const travelListQueries: any = require('@/api/travelListQueries');
    travelListQueries.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 2977, title: 'Already deleted' }],
      total: 1,
      hasMore: false,
    });

    const notFoundError = new Error('Not found.');
    (notFoundError as any).status = 404;
    travelsApi.deleteTravel.mockRejectedValueOnce(notFoundError);

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    renderComponent();

    await waitFor(() => {
      expect(travelsApi.deleteTravel).toHaveBeenCalledWith('2977');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog-mock')).toBeNull();
    });

    (Platform as any).OS = originalOS;
  });

  it('calls DELETE endpoint after confirming deletion on web', async () => {
    const travelsApi: any = require('@/api/travelsApi');
    const travelListQueries: any = require('@/api/travelListQueries');
    travelListQueries.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 10, title: 'Delete me' }],
      total: 1,
      hasMore: false,
    });

    travelsApi.deleteTravel.mockResolvedValueOnce(null);

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    renderComponent();


    await waitFor(() => {
      expect(travelsApi.deleteTravel).toHaveBeenCalledTimes(1);
      expect(travelsApi.deleteTravel).toHaveBeenCalledWith('10');
    });

    (Platform as any).OS = originalOS;
  });
});
