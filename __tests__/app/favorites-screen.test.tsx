import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';

import FavoritesScreen from '@/app/(tabs)/favorites';

const mockUseAuth = jest.fn();
const mockUseFavorites = jest.fn();
const mockPush = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive ?? { width: 390 },
}));

jest.mock('@/utils/authNavigation', () => ({
  buildLoginHref: jest.fn(() => '/login'),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/components/seo/LazyInstantSEO', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment, null),
  };
});

jest.mock('@/components/listTravel/TabTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { testID: `tab-travel-card-${String(props?.item?.id ?? 'unknown')}` }),
  };
});

describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();

    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true });
    mockUseFavorites.mockReturnValue({
      favorites: [],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (global as any).__mockResponsive;
  });

  it('shows login prompt when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: true });

    const { getByText } = render(<FavoritesScreen />);

    expect(getByText('Войдите в аккаунт')).toBeTruthy();
  });

  it('shows empty state when favorites are empty', async () => {
    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(utils.getByText('Сохраняй маршруты, чтобы вернуться к ним позже')).toBeTruthy();
  });

  it('navigates to /profile when "В профиль" is pressed', async () => {
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    fireEvent.press(utils.getByText('В профиль'));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });
});

