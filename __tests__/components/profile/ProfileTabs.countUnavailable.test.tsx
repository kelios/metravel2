// #1865: при сбое общего списка профиля счётчики вкладок обнулялись, бейдж
// пропадал, и «данных нет» выглядело как честный ноль. `null` в counts означает
// «счётчик недоступен» и рисует «—».

import React from 'react';
import { render } from '@testing-library/react-native';
import { ProfileTabs } from '@/components/profile/ProfileTabs';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
    isTablet: false,
    isDesktop: true,
    isMobile: false,
    isHydrated: true,
    width: 1440,
    height: 900,
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

const TAB_KEYS = ['travels', 'publishedTravels', 'draftTravels'] as const;

describe('ProfileTabs — недоступный счётчик', () => {
  it('показывает «—» вместо цифры и озвучивает недоступность', () => {
    const { getAllByText, getByLabelText } = render(
      <ProfileTabs
        activeTab="draftTravels"
        onChangeTab={jest.fn()}
        counts={{ travels: null, publishedTravels: null, draftTravels: null }}
        tabKeys={[...TAB_KEYS]}
      />
    );

    expect(getAllByText('—')).toHaveLength(3);
    expect(getByLabelText('Маршруты: количество недоступно')).toBeTruthy();
    expect(getByLabelText('Черновики маршрутов: количество недоступно')).toBeTruthy();
  });

  it('честный ноль по-прежнему остаётся без бейджа', () => {
    const { queryByText, getByLabelText } = render(
      <ProfileTabs
        activeTab="travels"
        onChangeTab={jest.fn()}
        counts={{ travels: 0, publishedTravels: 0, draftTravels: 0 }}
        tabKeys={[...TAB_KEYS]}
      />
    );

    expect(queryByText('—')).toBeNull();
    expect(queryByText('0')).toBeNull();
    expect(getByLabelText('Маршруты')).toBeTruthy();
  });

  it('обычный счётчик рисуется как раньше', () => {
    const { getByText, getByLabelText } = render(
      <ProfileTabs
        activeTab="travels"
        onChangeTab={jest.fn()}
        counts={{ travels: 365, publishedTravels: 300, draftTravels: 65 }}
        tabKeys={[...TAB_KEYS]}
      />
    );

    expect(getByText('365')).toBeTruthy();
    expect(getByLabelText('Маршруты: 365')).toBeTruthy();
  });
});
