import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravel';

// Базовый мок для AuthContext и маршрута, который можно перенастраивать в тестах
const mockUseAuth: jest.Mock<any, any> = jest.fn(() => ({
  isAuthenticated: false,
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

jest.mock('@/components/accessibility/KeyboardShortcutsHelp', () => ({
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
  const ConfirmDialogMock = ({ visible, onConfirm }: any) => {
    React.useEffect(() => {
      if (visible && onConfirm) {
        onConfirm();
      }
    }, [visible, onConfirm]);

    return null;
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
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(() => Promise.resolve({ data: [], total: 0, hasMore: false })),
}));

jest.mock('@/api/misc', () => ({
  fetchFilters: jest.fn(() => Promise.resolve({})),
  fetchFiltersCountry: jest.fn(() => Promise.resolve([])),
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
    ;(globalThis as any).confirm = jest.fn(() => true);

    // значения по умолчанию для большинства тестов
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
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
    mockUseRoute.mockReturnValueOnce({ name: 'metravel' });
    mockUseAuth.mockReturnValueOnce({
      isAuthenticated: true,
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

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText(/Пока нет путешествий/i)).toBeNull();
    });

    // Этап 2: когда userId появляется, снова рендерим список и ожидаем стандартное пустое состояние
    mockUseRoute.mockReturnValueOnce({ name: 'metravel' });
    mockUseAuth.mockReturnValueOnce({
      isAuthenticated: true,
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

  it('shows timeout error message when deleteTravel fails with timeout on web', async () => {
    // Test the delete functionality directly by mocking the component's internal state
    const travelsApi: any = require('@/api/travelsApi');
    travelsApi.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 1, title: 'Test travel' }],
      total: 1,
      hasMore: false,
    });

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockRejectedValueOnce(new Error('timeout: request timeout'));

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    const originalAlert = (global as any).alert;
    const alertSpy = jest.fn();
    (global as any).alert = alertSpy;

    renderComponent();

    const confirmSpy = (globalThis as any).confirm as jest.Mock;
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Превышено время ожидания'));
    });

    // Restore original values
    (Platform as any).OS = originalOS;
    (global as any).alert = originalAlert;
  });

  it('shows access denied error message when deleteTravel fails with 403 on web', async () => {
    // Test the delete functionality directly by mocking the component's internal state
    const travelsApi: any = require('@/api/travelsApi');
    travelsApi.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 2, title: 'Another travel' }],
      total: 1,
      hasMore: false,
    });

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockRejectedValueOnce(new Error('403: access denied'));

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    const originalAlert = (global as any).alert;
    const alertSpy = jest.fn();
    (global as any).alert = alertSpy;

    renderComponent();

    const confirmSpy = (globalThis as any).confirm as jest.Mock;
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Нет доступа'));
    });

    // Restore original values
    (Platform as any).OS = originalOS;
    (global as any).alert = originalAlert;
  });

  it('calls DELETE endpoint after confirming deletion on web', async () => {
    const travelsApi: any = require('@/api/travelsApi');
    travelsApi.fetchTravels.mockResolvedValueOnce({
      data: [{ id: 10, title: 'Delete me' }],
      total: 1,
      hasMore: false,
    });

    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({ ok: true, statusText: 'OK' });

    const confirmSpy = (globalThis as any).confirm as jest.Mock;
    confirmSpy.mockReturnValueOnce(true);

    renderComponent();

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/travels/10/'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    (Platform as any).OS = originalOS;
  });
});
