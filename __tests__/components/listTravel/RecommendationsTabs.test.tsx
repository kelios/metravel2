import React from 'react';
import { Animated } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import RecommendationsTabs from '@/components/listTravel/RecommendationsTabs';

const mockPush = jest.fn();

const mockUseAuth: jest.Mock<any, any> = jest.fn(() => ({ isAuthenticated: false }));
const mockUseFavorites: jest.Mock<any, any> = jest.fn(() => ({
  favorites: [] as any[],
  viewHistory: [] as any[],
  clearFavorites: jest.fn(),
  clearHistory: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}));

jest.mock('@/components/WeeklyHighlights', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'WeeklyHighlights');
  },
}));

jest.mock('@/components/PersonalizedRecommendations', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'PersonalizedRecommendations');
  },
}));

jest.mock('@/components/listTravel/TabTravelCard', () => ({
  __esModule: true,
  default: ({ item, onPress }: any) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', onPress },
      React.createElement(Text, null, String(item?.title ?? 'card'))
    );
  },
}));

describe('RecommendationsTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseFavorites.mockReturnValue({
      favorites: [] as any[],
      viewHistory: [] as any[],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    jest.spyOn(Animated, 'spring').mockReturnValue({
      start: (cb?: any) => cb?.(),
    } as any);

    if (typeof window !== 'undefined') {
      (window as any).confirm = jest.fn(() => true);
    } else {
      (global as any).window = { confirm: jest.fn(() => true) };
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders default tab (highlights) content', async () => {
    render(<RecommendationsTabs forceVisible={true} />);

    expect(await screen.findByText('WeeklyHighlights')).toBeTruthy();
  });

  it('shows auth gate for favorites when user is not authenticated and navigates to login', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(<RecommendationsTabs forceVisible={true} />);

    fireEvent.press(screen.getByText('Избранное'));

    expect(
      await screen.findByText(/Избранное будет доступно после регистрации или авторизации/i)
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Войти'));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows empty favorites state when authenticated but favorites are empty', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      favorites: [],
      viewHistory: [],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    render(<RecommendationsTabs forceVisible={true} />);

    fireEvent.press(screen.getByText('Избранное'));

    expect(await screen.findByText('Избранное пусто')).toBeTruthy();
  });

  it('renders favorites list and clears favorites after confirmation', async () => {
    const clearFavorites = jest.fn(async () => undefined);

    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      favorites: [
        {
          id: 1,
          type: 'travel',
          title: 'Fav 1',
          url: '/travels/1',
          imageUrl: 'https://example.com/1.jpg',
        },
      ],
      viewHistory: [],
      clearFavorites,
      clearHistory: jest.fn(),
    });

    const confirmSpy = jest.fn(() => true);
    (window as any).confirm = confirmSpy;

    render(<RecommendationsTabs forceVisible={true} />);

    fireEvent.press(screen.getByText('Избранное'));

    expect(await screen.findByText('Fav 1')).toBeTruthy();
    expect(screen.getByText('Смотреть все')).toBeTruthy();
    expect(screen.getByText('Очистить')).toBeTruthy();

    fireEvent.press(screen.getByText('Очистить'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Очистить избранное?');
      expect(clearFavorites).toHaveBeenCalledTimes(1);
    });
  });

  it('collapses and expands and calls onVisibilityChange', async () => {
    const onVisibilityChange = jest.fn();

    const RN = require('react-native');
    const { UNSAFE_getAllByType } = render(
      <RecommendationsTabs forceVisible={false} onVisibilityChange={onVisibilityChange} />
    );
    const pressables = UNSAFE_getAllByType(RN.Pressable);
    const collapseTrigger = pressables[pressables.length - 1];
    fireEvent.press(collapseTrigger);

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText('Показать рекомендации')).toBeTruthy();

    fireEvent.press(screen.getByText('Показать рекомендации'));

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith(true);
    });
  });
});
