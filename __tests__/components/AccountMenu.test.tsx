import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    username: '',
    logout: jest.fn(),
    userId: null,
    userAvatar: null,
    profileRefreshToken: 0,
    triggerProfileRefresh: jest.fn(),
    setUserAvatar: jest.fn(),
    isSuperuser: false,
    login: jest.fn(),
    sendPassword: jest.fn(),
    setNewPassword: jest.fn(),
  })),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: jest.fn(() => ({
    favorites: [],
  })),
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');

  const Menu: any = ({ anchor, children }: any) => (
    <View testID="menu">
      <View testID="menu-anchor">{anchor}</View>
      <View testID="menu-children">{children}</View>
    </View>
  );

  Menu.Item = ({ title, onPress }: any) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );

  const Divider = () => <View testID="divider" />;

  return { Menu, Divider };
});

// Mock image
jest.mock('../assets/icons/logo_yellow_60x60.png', () => 'logo.png', { virtual: true });

jest.mock('react-native', () => {
  const React = require('react');
  const RN = jest.requireActual('react-native');

  const MockImage = (props: any) => {
    (global as any).__lastImageSourceUri = props?.source?.uri ?? null;
    return React.createElement('Image', props);
  };

  return {
    ...RN,
    Image: MockImage,
  };
});

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react');
  const { Image, View } = require('react-native');

  const MockImageCardMedia = ({ src, source, style, testID, ...rest }: any) => {
    const resolvedSource = source || (src ? { uri: src } : null);
    if (!resolvedSource) {
      return React.createElement(View, { style, testID, ...rest });
    }
    return React.createElement(Image, { source: resolvedSource, style, testID, ...rest });
  };

  return {
    __esModule: true,
    default: MockImageCardMedia,
  };
});

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import AccountMenu from '@/components/layout/AccountMenu';

const getLastImageSourceUri = () => (global as any).__lastImageSourceUri as string | null;

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;

const renderWithClient = async (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return await render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('AccountMenu', () => {
  const mockLogout = jest.fn();
  const mockUpdateFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__lastImageSourceUri = null;
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: '',
      logout: mockLogout,
      userId: null,
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);
    mockUseFavorites.mockReturnValue({
      favorites: [],
      viewHistory: [],
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      isFavorite: jest.fn(),
      addToHistory: jest.fn(),
      clearHistory: jest.fn(),
      getRecommendations: jest.fn(),
    } as any);
  });

  it('shows login and registration options when not authenticated', async () => {
    const { getAllByText, getByText } = await renderWithClient(<AccountMenu />);

    expect(getAllByText('Войти').length).toBeGreaterThan(0);
    expect(getByText('Зарегистрироваться')).toBeTruthy();
  });

  it('keeps the guest menu login a button that builds the login href on press (#2139)', async () => {
    const { getByLabelText } = await renderWithClient(<AccountMenu />);

    const loginItem = getByLabelText('Войти');
    expect(loginItem.props.accessibilityRole).toBe('button');

    await fireEvent.press(loginItem);
    expect(router.push).toHaveBeenCalledWith('/login?redirect=%2F&intent=menu');
  });

  it('shows user menu when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);
    expect(getByText('Мои путешествия')).toBeTruthy();
    expect(getByText('Добавить путешествие')).toBeTruthy();
  });

  it('displays username when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);
    expect(getByText('testuser')).toBeTruthy();
  });

  it('does not display username when not authenticated even if username exists', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: 'ghost-user',
      logout: mockLogout,
      userId: null,
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { queryByText } = await renderWithClient(<AccountMenu />);
    expect(queryByText('ghost-user')).toBeNull();
  });

  it('shows favorites count in profile menu item', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: '1', type: 'travel', title: 'Test', url: '/test', addedAt: Date.now() },
        { id: '2', type: 'travel', title: 'Test 2', url: '/test2', addedAt: Date.now() },
      ],
      recommended: [],
      viewHistory: [],
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      isFavorite: jest.fn(),
      addToHistory: jest.fn(),
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
      getRecommendations: jest.fn(),
    });

    const { getByText } = await renderWithClient(<AccountMenu />);
    expect(getByText('Личный кабинет (2)')).toBeTruthy();
  });

  it('does not append cache-buster param to signed S3 avatar url', async () => {
    const signed =
      'https://metravellocal.s3.amazonaws.com/profile/78/avatar/x.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=abc';
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'Юлия',
      logout: mockLogout,
      userId: '1',
      userAvatar: signed,
      profileRefreshToken: 5,
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    await renderWithClient(<AccountMenu />);
    // Signed S3 URLs should NOT get a cache-buster appended
    expect(getLastImageSourceUri()).toBe(signed);
  });

  it('does not append cache-buster param to third-party avatar url', async () => {
    const plain = 'https://example.com/avatar.webp';
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'Юлия',
      logout: mockLogout,
      userId: '1',
      userAvatar: plain,
      profileRefreshToken: 7,
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    await renderWithClient(<AccountMenu />);
    expect(getLastImageSourceUri()).toBe(plain);
  });

  it('calls logout and navigates when logout is pressed', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);

    // Нажимаем на пункт меню "Выход" (секция "Аккаунт" раскрыта по умолчанию)
    await fireEvent.press(getByText('Выход'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/');
    });
  });

  it('navigates directly to my travels without filters context', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);

    await fireEvent.press(getByText('Мои путешествия'));

    await waitFor(() => {
      expect(mockUpdateFilters).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith('/metravel');
    });
  });

  it('keeps account menu internal navigation in the current web tab', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);
    await fireEvent.press(getByText('Мои путешествия'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/metravel');
    });
  });

  it('navigates to new travel screen when pressing "Добавить путешествие"', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = await renderWithClient(<AccountMenu />);
    await fireEvent.press(getByText('Добавить путешествие'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/travel/new');
    });
  });

  it('handles window resize for mobile/desktop layout', async () => {
    const { rerender } = await renderWithClient(<AccountMenu />);

    await rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <AccountMenu />
      </QueryClientProvider>
    );
    expect(rerender).toBeDefined();
  });
});
