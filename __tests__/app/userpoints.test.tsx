import { render, screen, fireEvent } from '@testing-library/react-native';
import UserPointsScreen from '@/app/(tabs)/userpoints';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/components/UserPoints/PointsList', () => ({
  PointsList: ({ onImportPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    return (
      <View>
        <TouchableOpacity onPress={onImportPress} accessibilityLabel="Добавить">
          <View testID="icon-add" />
        </TouchableOpacity>
      </View>
    );
  }
}));
jest.mock('@/components/UserPoints/ImportWizard', () => ({
  ImportWizard: ({ onCancel }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View>
        <Text>Выберите источник данных</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text>Отмена</Text>
        </TouchableOpacity>
      </View>
    );
  }
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('UserPointsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not show auth required message while auth is not ready', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: '',
      userId: null,
      isSuperuser: false,
      userAvatar: null,
      authReady: false,
      profileRefreshToken: 0,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn()
    });

    render(<UserPointsScreen />);

    expect(await screen.findByTestId('userpoints-auth-loading')).toBeTruthy();
    expect(screen.queryByText('Требуется авторизация')).toBeNull();
  });

  it('should show auth required message when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: '',
      userId: null,
      isSuperuser: false,
      userAvatar: null,
      authReady: true,
      profileRefreshToken: 0,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn()
    });

    render(<UserPointsScreen />);

    expect(await screen.findByText('Требуется авторизация')).toBeTruthy();
    expect(screen.getByText('Для использования этой функции необходимо войти в систему')).toBeTruthy();
    expect(screen.getByText('Войти')).toBeTruthy();
  });

  it('should redirect to login when login button is pressed', async () => {
    const { router } = require('expo-router');
    
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: '',
      userId: null,
      isSuperuser: false,
      userAvatar: null,
      authReady: true,
      profileRefreshToken: 0,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn()
    });

    render(<UserPointsScreen />);

    const loginButton = await screen.findByText('Войти');
    fireEvent.press(loginButton);

    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/login'));
    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('intent=userpoints'));
  });

  it('should render PointsList when user is authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      userId: '1',
      isSuperuser: false,
      userAvatar: null,
      authReady: true,
      profileRefreshToken: 0,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn()
    });

    render(<UserPointsScreen />);
    
    expect(() => screen.getByText('Требуется авторизация')).toThrow();

    expect(await screen.findByLabelText('Добавить')).toBeTruthy();
    expect(screen.getByTestId('icon-add')).toBeTruthy();
    expect(screen.queryByText('Добавить')).toBeNull();
  });
});
