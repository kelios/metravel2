import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { CoverScrim } from '@/components/profile/CoverScrim';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PublicProfileHeader } from '@/components/screens/profile/PublicProfileHeader';
import type { UserProfileDto } from '@/api/user';

// Общий __mocks__/expo-linear-gradient срезает colors/locations/start/end, а
// именно они и есть контракт этой правки — поэтому здесь свой мок с захватом.
const mockGradientProps: Array<Record<string, any>> = [];
jest.mock('expo-linear-gradient', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    LinearGradient: (props: Record<string, any>) => {
      const { colors, locations, start, end, ...viewProps } = props;
      mockGradientProps.push({ colors, locations, start, end, style: props.style });
      return ReactModule.createElement(View, viewProps);
    },
  };
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, isPhone: true, isHydrated: true, width: 390, height: 844 }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));
jest.mock('@/components/ui/ImageCardMedia', () => () => null);
jest.mock('@/components/profile/ProfileMenu', () => ({ ProfileMenu: () => null }));
jest.mock('@/components/profile/CoverTopoTexture', () => ({ CoverTopoTexture: () => null }));
jest.mock('@/components/profile/ProfileHeaderQuickActions', () => ({
  ProfileHeaderQuickActions: () => null,
}));
jest.mock('@/components/profile/ProfileStatPills', () => ({ ProfileStatPills: () => null }));
jest.mock('@/components/profile/ProfileTabs', () => ({ ProfileTabs: () => null }));
jest.mock('@/components/ui/SubscribeButton', () => () => null);
jest.mock('@/components/ui/StarRating', () => () => null);
jest.mock('@/components/profile/UserSafetyMenu', () => () => null);
jest.mock('@/components/profile/ProtectedContacts', () => () => null);
jest.mock('@/components/ui/SafetyNotice', () => () => null);
jest.mock('@/components/achievements/PeerBadgeGiveButton', () => () => null);

const profile = { is_verified: true, participant_rating: null } as unknown as UserProfileDto;

const parseAlpha = (color: string) => {
  const match = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/.exec(color);
  return match ? Number(match[1] ?? 1) : NaN;
};

/**
 * Альфа scrim'а в точке (x, y) бокса. Повторяет ту же модель, по которой рампу
 * считают Android-шейдер, iOS CAGradientLayer и CSS-обёртка web: проекция на
 * ось start→end в пикселях. Если хоть на одной внутренней кромке результат
 * больше нуля — на телефоне это видимый шов, ровно дефект #1670.
 */
const alphaAt = (gradient: Record<string, any>, x: number, y: number) => {
  const { width, height } = StyleSheet.flatten(gradient.style);
  const start = { x: gradient.start.x * width, y: gradient.start.y * height };
  const end = { x: gradient.end.x * width, y: gradient.end.y * height };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy);

  const locations: number[] = gradient.locations;
  const alphas: number[] = gradient.colors.map(parseAlpha);
  if (t <= locations[0]) return alphas[0];
  for (let i = 1; i < locations.length; i += 1) {
    if (t <= locations[i]) {
      const span = locations[i] - locations[i - 1];
      if (span === 0) return alphas[i];
      return alphas[i - 1] + ((alphas[i] - alphas[i - 1]) * (t - locations[i - 1])) / span;
    }
  }
  return alphas[alphas.length - 1];
};

describe('CoverScrim (#1670)', () => {
  beforeEach(() => {
    mockGradientProps.length = 0;
  });

  it('спадает выпукло — на конце рампы нет излома, который глаз читает границей', () => {
    render(<CoverScrim coverHeight={132} />);

    const gradient = mockGradientProps[0];
    expect(gradient.locations.length).toBeGreaterThanOrEqual(3);

    // Наклон последнего участка должен быть положе первого: линейная рампа
    // (равные наклоны) даёт видимую полосу Маха там, где альфа обнуляется.
    const alphas: number[] = gradient.colors.map(parseAlpha);
    const locs: number[] = gradient.locations;
    const slope = (i: number) =>
      Math.abs(alphas[i] - alphas[i + 1]) / (locs[i + 1] - locs[i]);
    expect(slope(locs.length - 2)).toBeLessThan(slope(0));
  });

  it('затемняет угол градиентом, а не плоской заливкой', () => {
    render(<CoverScrim coverHeight={132} />);

    expect(mockGradientProps).toHaveLength(1);
    const gradient = mockGradientProps[0];
    const style = StyleSheet.flatten(gradient.style);

    expect(style.backgroundColor).toBeUndefined();
    expect(style.opacity).toBeUndefined();
    expect(parseAlpha(gradient.colors[0])).toBeGreaterThan(0);
    expect(parseAlpha(gradient.colors[gradient.colors.length - 1])).toBe(0);
  });

  it('гаснет до нуля на внутренней (левой) и нижней кромке — шва нет', () => {
    render(<CoverScrim coverHeight={132} />);

    const gradient = mockGradientProps[0];
    const { width, height } = StyleSheet.flatten(gradient.style);

    // Ось обязана оставаться угловой. Web-обёртка expo-linear-gradient берёт из
    // start/end только УГОЛ, а длину градиентной линии CSS считает сам по
    // проекции бокса; с |end − start| она совпадает ровно для оси «угол в угол».
    // Любая другая ось оставит native чистым, а на web стопы уедут и шов
    // вернётся мимо проверок ниже — они считают ту же проекцию, что и native.
    expect(gradient.start).toEqual({ x: 1, y: 0 });
    expect(gradient.end).toEqual({ x: 0, y: 1 });

    // Правый верхний угол — единственное место, где scrim реально тёмный.
    expect(alphaAt(gradient, width, 0)).toBeGreaterThan(0.2);

    for (let i = 0; i <= 10; i += 1) {
      // Левая кромка: единственная граница внутри кадра.
      expect(alphaAt(gradient, 0, (height * i) / 10)).toBe(0);
      // Нижняя кромка: совпадает с нижним краем обложки.
      expect(alphaAt(gradient, (width * i) / 10, height)).toBe(0);
    }
  });

  it('держит инвариант и при другой высоте обложки', () => {
    render(<CoverScrim coverHeight={220} />);

    const gradient = mockGradientProps[0];
    const { width, height } = StyleSheet.flatten(gradient.style);

    expect(height).toBe(220);
    for (let i = 0; i <= 10; i += 1) {
      expect(alphaAt(gradient, 0, (height * i) / 10)).toBe(0);
      expect(alphaAt(gradient, (width * i) / 10, height)).toBe(0);
    }
  });

  it('свой профиль рисует scrim одним общим источником во всю высоту обложки', () => {
    render(
      <ProfileHeader
        user={{ name: 'Julia I', email: 'julia@tut.by', avatar: null }}
        profile={profile}
        onEdit={jest.fn()}
        onLogout={jest.fn()}
        onAvatarUpload={jest.fn()}
        onQuickAction={jest.fn()}
      />
    );

    expect(mockGradientProps).toHaveLength(1);
    expect(StyleSheet.flatten(mockGradientProps[0].style).height).toBe(132);
  });

  it('чужой профиль рисует тот же scrim, а не свою копию', () => {
    const { getByTestId } = render(
      <PublicProfileHeader
        userId="2"
        fullName="Traveler"
        profile={profile}
        rank={null}
        avatarError={false}
        onAvatarError={jest.fn()}
        isOwnProfile={false}
        socials={[]}
        peerReceived={[]}
        statPills={[]}
        activeTab="travels"
        onChangeTab={jest.fn()}
        tabCounts={{}}
        onWriteMessage={jest.fn()}
      />
    );

    expect(mockGradientProps).toHaveLength(1);
    const gradient = mockGradientProps[0];
    const { width, height } = StyleSheet.flatten(gradient.style);
    expect(height).toBe(132);
    expect(alphaAt(gradient, 0, height / 2)).toBe(0);
    expect(alphaAt(gradient, width / 2, height)).toBe(0);

    // Чип «ещё» стоит ровно в тёмном углу и держит читаемость своей подложкой,
    // но только если лежит ВЫШЕ scrim'а. Без zIndex он остаётся в auto-слое,
    // и затемнение рисуется прямо по иконке.
    const menuWrapStyle = StyleSheet.flatten(getByTestId('public-profile-menu-wrap').props.style);
    expect(menuWrapStyle.zIndex).toBeGreaterThan(StyleSheet.flatten(gradient.style).zIndex);
  });
});
