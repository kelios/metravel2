import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '@/app/(tabs)/profile';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';

jest.mock('@/context/AuthContext');
jest.mock('@/context/FavoritesContext');

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravels: jest.fn().mockResolvedValue({ data: [], total: 3 }),
}));

jest.mock('@/src/utils/storageBatch', () => ({
  getStorageBatch: jest.fn().mockResolvedValue({
    userName: 'Test User',
    userId: '123',
    userEmail: 'user@example.com',
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;

const setupAuth = (overrides?: Partial<ReturnType<typeof useAuth>>) => {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    logout: jest.fn().mockResolvedValue(undefined),
    userId: '123',
    username: 'Test User',
    isSuperuser: false,
    user: { id: '123', name: 'Test User', email: 'user@example.com' },
    setIsAuthenticated: jest.fn(),
    setUsername: jest.fn(),
    setIsSuperuser: jest.fn(),
    setUserId: jest.fn(),
    login: jest.fn(),
    sendPassword: jest.fn(),
    setNewPassword: jest.fn(),
    ...(overrides || {}),
  } as any);
};

const setupFavorites = (favoritesLen = 2, historyLen = 5) => {
  mockUseFavorites.mockReturnValue({
    favorites: new Array(favoritesLen).fill(null).map((_, i) => ({
      id: i + 1,
      type: 'travel',
      title: `Fav ${i + 1}`,
      url: `/travels/${i + 1}`,
      addedAt: Date.now(),
    })),
    viewHistory: new Array(historyLen).fill(null).map((_, i) => ({
      id: i + 1,
      type: 'travel',
      title: `History ${i + 1}`,
      url: `/travels/${i + 1}`,
      viewedAt: Date.now(),
    })),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(),
    addToHistory: jest.fn(),
    clearHistory: jest.fn(),
    getRecommendations: jest.fn(),
  } as any);
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows EmptyState when user is not authenticated', () => {
    setupAuth({ isAuthenticated: false });
    setupFavorites(0, 0);

    const { getByText } = render(<ProfileScreen />);

    expect(getByText('Войдите в аккаунт')).toBeTruthy();
    expect(
      getByText('Для доступа к профилю необходимо войти в систему')
    ).toBeTruthy();
  });

  it('shows loader while stats are loading and then renders profile info', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(2, 5);

    const { getByText, getAllByText, queryByText } = render(<ProfileScreen />);

    // Пока идёт загрузка, имени пользователя ещё может не быть, но мы проверим финальное состояние
    await waitFor(() => {
      expect(getByText('Test User')).toBeTruthy();
      expect(getByText('user@example.com')).toBeTruthy();

      // travelsCount из fetchTravels.total (3)
      expect(getAllByText('3').length).toBeGreaterThan(0);
      // favoritesCount (может отображаться несколько раз)
      expect(getAllByText('2').length).toBeGreaterThan(0);
      // viewsCount
      expect(getAllByText('5').length).toBeGreaterThan(0);
    });

    // Проверяем наличие основных пунктов меню (может быть несколько в иерархии, поэтому используем getAllByText)
    expect(getAllByText('Избранное').length).toBeGreaterThan(0);
    expect(getAllByText('Мои путешествия').length).toBeGreaterThan(0);
    expect(getAllByText('История просмотров').length).toBeGreaterThan(0);
    expect(getAllByText('Настройки').length).toBeGreaterThan(0);

    // Кнопка выхода
    expect(getByText('Выйти')).toBeTruthy();
    expect(queryByText('Войдите в аккаунт')).toBeNull();
  });

  it('navigates to login on EmptyState action when unauthenticated', () => {
    setupAuth({ isAuthenticated: false });
    setupFavorites(0, 0);

    const { getByText } = render(<ProfileScreen />);

    fireEvent.press(getByText('Войти'));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('calls logout and navigates to login on logout button press', async () => {
    const logoutMock = jest.fn().mockResolvedValue(undefined);
    setupAuth({ isAuthenticated: true, logout: logoutMock });
    setupFavorites(1, 1);

    const { getByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getByText('Выйти')).toBeTruthy();
    });

    fireEvent.press(getByText('Выйти'));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('navigates to correct screens from menu items', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(3, 4);

    const { getAllByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getAllByText('Избранное').length).toBeGreaterThan(0);
    });

    const favNodes = getAllByText('Избранное');
    fireEvent.press(favNodes[favNodes.length - 1]);
    expect(mockPush).toHaveBeenCalledWith('/favorites');

    const myTravelsNodes = getAllByText('Мои путешествия');
    fireEvent.press(myTravelsNodes[myTravelsNodes.length - 1]);
    expect(mockPush).toHaveBeenCalledWith('/metravel');

    const historyNodes = getAllByText('История просмотров');
    fireEvent.press(historyNodes[historyNodes.length - 1]);
    expect(mockPush).toHaveBeenCalledWith('/history');

    const settingsNodes = getAllByText('Настройки');
    fireEvent.press(settingsNodes[settingsNodes.length - 1]);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
