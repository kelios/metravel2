import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ProfileTabs } from '@/components/profile/ProfileTabs';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: true,
    isLargePhone: false,
    isTablet: false,
    isDesktop: false,
    isMobile: true,
    isHydrated: true,
    width: 390,
    height: 844,
  }),
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
    expect(getByText('Подписчики')).toBeTruthy();
    expect(getByText('Подписки')).toBeTruthy();

    const firstTabStyle = StyleSheet.flatten(getByLabelText('Мои маршруты: 3').props.style);
    expect(firstTabStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(firstTabStyle.flex).toBe(1);
    expect(firstTabStyle.minWidth).toBe(0);

    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });
});
