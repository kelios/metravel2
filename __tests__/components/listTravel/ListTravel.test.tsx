import { createContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravelBase';
import { restoreWindowStubs, stubWindowProperties } from '../../helpers/windowStubs';

const mockRouterPush = jest.fn();
const mockUseHydrationReady = jest.fn(() => true);
const mockHydrationContext = createContext<boolean | undefined>(undefined);
const mockMarkSsgFirstScreenReady = jest.fn();

// Базовый мок для AuthContext и маршрута, который можно перенастраивать в тестах
const mockUseAuth: jest.Mock<any, any> = jest.fn(() => ({
  isAuthenticated: false,
  authReady: true,
  username: '',
  isSuperuser: false,
  userId: null,
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

jest.mock('@/hooks/useHydrationReady', () => {
  const React = require('react');
  return {
    useHydrationReady: () => React.useContext(mockHydrationContext) ?? mockUseHydrationReady(),
    markSsgFirstScreenReady: () => mockMarkSsgFirstScreenReady(),
  };
});

// Mock dependencies
jest.mock('@/components/listTravel/RecommendationsTabs', () => ({
  __esModule: true,
  default: () => null,
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

// #1406: маршрут каталога сообщает removal-скрипту SSG-шелла о готовности
// первого экрана. Здесь проверяется контракт маршрута (КОГДА сигналить);
// сам DOM-атрибут — зона hooks/useHydrationReady.

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

    // Подменяются только методы настоящего jsdom-окна: глобал window в jsdom 26 не заменить (#2735).
    stubWindowProperties({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    // Reset global mocks for delete flow
    (global as any).fetch = jest.fn();

    // значения по умолчанию для большинства тестов
    mockUseAuth.mockReset();
    mockUseHydrationReady.mockReset();
    mockUseHydrationReady.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authReady: true,
      username: '',
      isSuperuser: false,
      userId: null,
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    mockUseRoute.mockReset();
    mockUseRoute.mockReturnValue({ name: 'travels' });
  });

  afterEach(() => {
    restoreWindowStubs();
    queryClient.clear();
  });

  const renderComponent = async () =>
    await render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

  it('renders the search input', async () => {
    await renderComponent();
    expect(await screen.findByPlaceholderText('Найти маршрут…')).toBeTruthy();
  });

  it('renders an empty state message when there are no items', async () => {
    await renderComponent();
    expect(await screen.findByText(/Пока нет маршрутов/i)).toBeTruthy();
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
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    const firstRender = await renderComponent();

    await waitFor(() => {
      expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
    });
    await firstRender.unmount();

    // Этап 2: когда userId появляется, снова рендерим список и ожидаем стандартное пустое состояние
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authReady: true,
      username: 'User',
      isSuperuser: false,
      userId: '123',
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    await renderComponent();

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
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    });

    await renderComponent();

    expect(await screen.findByText('Войдите в аккаунт')).toBeTruthy();
    expect(screen.getByText(/видеть свои путешествия/i)).toBeTruthy();
    expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
  });

  it('keeps own-user routes neutral while auth is bootstrapping', async () => {
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authReady: false,
      username: '',
      isSuperuser: false,
      userId: null,
    });

    await renderComponent();

    expect(screen.getByTestId('list-travel-auth-bootstrap')).toBeTruthy();
    expect(screen.queryByText('Войдите в аккаунт')).toBeNull();
    expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
  });

  it('keeps personalized content neutral through the first hydration render', async () => {
    mockUseHydrationReady.mockReturnValue(false);
    mockUseRoute.mockReturnValue({ name: 'metravel' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authReady: true,
      username: 'User',
      isSuperuser: false,
      userId: '123',
    });

    // Hydration is a subscribed React update; changing a plain mock cannot
    // invalidate memo(ListTravelBase) when its props stay equal.
    const hydrationTree = (ready: boolean) => (
      <QueryClientProvider client={queryClient}>
        <mockHydrationContext.Provider value={ready}>
          <ListTravel />
        </mockHydrationContext.Provider>
      </QueryClientProvider>
    );
    const rendered = await render(hydrationTree(false));

    expect(screen.getByTestId('list-travel-auth-bootstrap')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Найти маршрут…')).toBeNull();

    mockUseHydrationReady.mockReturnValue(true);
    await rendered.rerender(hydrationTree(true));

    expect(await screen.findByPlaceholderText('Найти маршрут…')).toBeTruthy();
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

    await renderComponent();

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

    await renderComponent();

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

    await renderComponent();

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

    await renderComponent();


    await waitFor(() => {
      expect(travelsApi.deleteTravel).toHaveBeenCalledTimes(1);
      expect(travelsApi.deleteTravel).toHaveBeenCalledWith('10');
    });

    (Platform as any).OS = originalOS;
  });

  // #1406: SSG-шелл /search должен сниматься по готовности каталога, а не по
  // гидрации приложения. Маршрут сигналит через markSsgFirstScreenReady()
  // только в терминальном состоянии первого экрана: карточки, пусто, ошибка.
  describe('SSG first-screen-ready (#1406)', () => {
    const getMark = (): jest.Mock => mockMarkSsgFirstScreenReady;

    let cleanupSpy: jest.Mock;

    beforeEach(() => {
      cleanupSpy = jest.fn();
      getMark().mockReset();
      getMark().mockReturnValue(cleanupSpy);
    });

    it('сигналит готовность после прихода реальных карточек — ровно один раз', async () => {
      const travelListQueries: any = require('@/api/travelListQueries');
      travelListQueries.fetchTravels.mockResolvedValueOnce({
        data: [{ id: 42, title: 'Реальная карточка' }],
        total: 1,
        hasMore: false,
      });

      await renderComponent();

      await waitFor(() => {
        expect(getMark()).toHaveBeenCalledTimes(1);
      });
      // Состояние продолжает жить (рефетчи, фильтры) — повторных сигналов нет.
      expect(getMark()).toHaveBeenCalledTimes(1);
    });

    it('сигналит готовность и на честном пустом состоянии', async () => {
      await renderComponent();

      expect(await screen.findByText(/Пока нет маршрутов/i)).toBeTruthy();
      await waitFor(() => {
        expect(getMark()).toHaveBeenCalledTimes(1);
      });
    });

    it('молчит, пока первичная загрузка каталога не завершилась', async () => {
      const travelListQueries: any = require('@/api/travelListQueries');
      travelListQueries.fetchTravels.mockImplementationOnce(() => new Promise(() => {}));

      await renderComponent();

      expect(await screen.findByPlaceholderText('Найти маршрут…')).toBeTruthy();
      expect(getMark()).not.toHaveBeenCalled();
    });

    it('на анмаунте вызывает cleanup утилиты', async () => {
      const rendered = await renderComponent();

      await waitFor(() => {
        expect(getMark()).toHaveBeenCalledTimes(1);
      });

      await rendered.unmount();
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });
});
