import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform, StyleSheet } from 'react-native';

import CustomHeader from '@/components/CustomHeader';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/map',
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    username: null,
    logout: jest.fn(),
    userAvatar: null,
    profileRefreshToken: '',
    userId: null,
  }),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ favorites: [] }),
}));

jest.mock('@/providers/FiltersProvider', () => ({
  useFilters: () => ({ updateFilters: jest.fn() }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isPhone: false, isLargePhone: false, isTablet: false }),
}));

jest.mock('react-native-vector-icons/Feather', () => 'Feather');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');
jest.mock('@/components/HeaderContextBar', () => {
  const React = require('react');
  const Stub = () => React.createElement(React.Fragment, null);
  return { __esModule: true, default: Stub };
});

describe('CustomHeader sticky behavior on web', () => {
  const originalOS = Platform.OS;

  beforeAll(() => {
    // Ensure StyleSheet.create returns plain objects
    jest.spyOn(StyleSheet, 'create').mockImplementation((styles) => styles as any);
  });

  afterAll(() => {
    (StyleSheet.create as jest.Mock).mockRestore?.();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('applies sticky positioning with high z-index on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<CustomHeader />);
    });
    const header = tree.root.findByProps({ testID: 'main-header' });
    const style = StyleSheet.flatten(header.props.style);

    expect(style.position).toBe('sticky');
    expect(style.top).toBe(0);
    expect(style.zIndex).toBeGreaterThanOrEqual(2000);
    expect(style.width).toBe('100%');
  });
});
