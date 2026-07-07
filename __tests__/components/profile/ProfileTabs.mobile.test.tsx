import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ProfileTabs } from '@/components/profile/ProfileTabs';

let mockResponsiveValue = {
  isPhone: true,
  isLargePhone: false,
  isTablet: false,
  isDesktop: false,
  isMobile: true,
  isHydrated: true,
  width: 390,
  height: 844,
};

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsiveValue,
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    borderLight: '#ddd',
    primarySoft: '#eef',
    primary: '#36f',
    primaryText: '#123',
    textMuted: '#667',
    textOnPrimary: '#fff',
  }),
}));

describe('ProfileTabs mobile layout', () => {
  beforeEach(() => {
    mockResponsiveValue = {
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isDesktop: false,
      isMobile: true,
      isHydrated: true,
      width: 390,
      height: 844,
    };
  });

  it('keeps profile tabs readable and mobile-safe inside the horizontal row', () => {
    const { getByLabelText, getByText, UNSAFE_queryByType } = render(
      <ProfileTabs
        activeTab="travels"
        onChangeTab={jest.fn()}
        counts={{ travels: 3, subscriptions: 1 }}
        tabKeys={['travels', 'subscribers', 'subscriptions']}
      />
    );

    expect(getByText('Маршруты')).toBeTruthy();
    const subscribersLabel = getByText('Подписчики');
    expect(subscribersLabel).toBeTruthy();
    expect(getByText('Подписки')).toBeTruthy();
    expect(subscribersLabel.props.numberOfLines).toBe(2);

    const firstTabStyle = StyleSheet.flatten(getByLabelText('Мои маршруты: 3').props.style);
    expect(firstTabStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(firstTabStyle.flex).toBe(1);
    expect(firstTabStyle.minWidth).toBe(0);

    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it('lets the full desktop tab set wrap instead of shortening labels', () => {
    mockResponsiveValue = {
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isDesktop: true,
      isMobile: false,
      isHydrated: true,
      width: 1280,
      height: 900,
    };

    const { getByLabelText, getByText, UNSAFE_queryByType } = render(
      <ProfileTabs
        activeTab="worldmap"
        onChangeTab={jest.fn()}
        counts={{ travels: 301, subscribers: 2, subscriptions: 15, countries: 13, favorites: 1 }}
      />
    );

    const countriesLabel = getByText('Страны');
    expect(countriesLabel.props.numberOfLines).toBe(2);
    expect(getByText('Избранное')).toBeTruthy();
    expect(getByText('История')).toBeTruthy();

    const worldMapTabStyle = StyleSheet.flatten(getByLabelText('Карта мира').props.style);
    expect(worldMapTabStyle.minWidth).toBeGreaterThanOrEqual(144);
    expect(worldMapTabStyle.flexBasis).toBeGreaterThanOrEqual(144);
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });
});
