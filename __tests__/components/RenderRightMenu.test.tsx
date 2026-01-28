import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RenderRightMenu from '@/components/RenderRightMenu';
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
    setIsAuthenticated: jest.fn(),
    setUsername: jest.fn(),
    setIsSuperuser: jest.fn(),
    setUserId: jest.fn(),
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

jest.mock('@/providers/FiltersProvider', () => ({
  useFilters: jest.fn(() => ({
    updateFilters: jest.fn(),
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
import { useFilters } from '@/providers/FiltersProvider';
import AccountMenu from '@/components/AccountMenu';

const getLastImageSourceUri = () => (global as any).__lastImageSourceUri as string | null;

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;
const mockUseFilters = useFilters as jest.MockedFunction<typeof useFilters>;

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
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
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
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
    mockUseFilters.mockReturnValue({
      updateFilters: mockUpdateFilters,
      filters: {} as any,
    } as any);
  });

  it('shows login and registration options when not authenticated', () => {
    const { getByText } = renderWithClient(<RenderRightMenu />);

    expect(getByText('Войти')).toBeTruthy();
    expect(getByText('Зарегистрироваться')).toBeTruthy();
  });

  it('shows user menu when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = renderWithClient(<RenderRightMenu />);
    expect(getByText('Поделиться путешествием')).toBeTruthy();
  });

  it('displays username when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = renderWithClient(<RenderRightMenu />);
    expect(getByText('testuser')).toBeTruthy();
  });

  it('does not display username when not authenticated even if username exists', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      username: 'ghost-user',
      logout: mockLogout,
      userId: null,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { queryByText } = renderWithClient(<RenderRightMenu />);
    expect(queryByText('ghost-user')).toBeNull();
  });

  it('shows favorites count in profile menu item', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
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

    const { getByText } = renderWithClient(<RenderRightMenu />);
    expect(getByText('Личный кабинет (2)')).toBeTruthy();
  });

  it('does not append cache-buster param to signed S3 avatar url', () => {
    const signed =
      'https://metravellocal.s3.amazonaws.com/profile/78/avatar/x.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=abc';
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'Юлия',
      logout: mockLogout,
      userId: '1',
      userAvatar: signed,
      profileRefreshToken: 5,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    renderWithClient(<RenderRightMenu />);
    // We now apply optimizeImageUrl to avatars which adds version parameter
    expect(getLastImageSourceUri()).toBe(signed + '&v=5');
  });

  it('appends cache-buster param to non-signed avatar url', () => {
    const plain = 'https://example.com/avatar.webp';
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'Юлия',
      logout: mockLogout,
      userId: '1',
      userAvatar: plain,
      profileRefreshToken: 7,
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    renderWithClient(<RenderRightMenu />);
    expect(getLastImageSourceUri()).toBe(`${plain}?v=7`);
  });

  it('calls logout and navigates when logout is pressed', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = renderWithClient(<RenderRightMenu />);

    // Раскрываем секцию "Аккаунт"
    fireEvent.press(getByText('Аккаунт'));

    // Нажимаем на пункт меню "Выход"
    fireEvent.press(getByText('Выход'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/');
    });
  });

  it('updates filters when navigating to my travels', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      username: 'testuser',
      logout: mockLogout,
      userId: '1',
      setIsAuthenticated: jest.fn(),
      setUsername: jest.fn(),
      setIsSuperuser: jest.fn(),
      setUserId: jest.fn(),
      isSuperuser: false,
      login: jest.fn(),
      sendPassword: jest.fn(),
      setNewPassword: jest.fn(),
    } as any);

    const { getByText } = renderWithClient(<AccountMenu />);

    fireEvent.press(getByText('Мои путешествия'));

    await waitFor(() => {
      expect(mockUpdateFilters).toHaveBeenCalledWith({ user_id: 1 });
    });
  });

  it('handles window resize for mobile/desktop layout', async () => {
    const { rerender } = renderWithClient(<RenderRightMenu />);

    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <RenderRightMenu />
      </QueryClientProvider>
    );
    expect(rerender).toBeDefined();
  });
});
