import React from 'react';
import { render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import type { UserProfileDto } from '@/api/user';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, isHydrated: true, width: 390, height: 844 }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));

jest.mock('@/components/ui/ImageCardMedia', () => () => null);
jest.mock('@/components/profile/ProfileMenu', () => ({ ProfileMenu: () => null }));
jest.mock('@/components/profile/CoverTopoTexture', () => ({ CoverTopoTexture: () => null }));
jest.mock('@/components/profile/ProfileHeaderQuickActions', () => {
  const { View: RNView } = require('react-native');
  return { ProfileHeaderQuickActions: () => <RNView /> };
});

const baseProps = {
  user: { name: 'Julia I', email: 'julia@tut.by', avatar: null },
  onEdit: jest.fn(),
  onLogout: jest.fn(),
  onAvatarUpload: jest.fn(),
  onQuickAction: jest.fn(),
};

describe('ProfileHeader identity (#847)', () => {
  it('does not render verified copy/badge for a verified profile', async () => {
    const profile = { is_verified: true, organizer_status: 'experienced' } as unknown as UserProfileDto;

    const { queryByText } = await render(
      <ProfileHeader {...baseProps} profile={profile} rank={{ level: 5, title: 'Эксперт' }} />
    );

    expect(queryByText('Проверенный')).toBeNull();
    expect(queryByText(/Аккаунт подтверждён/i)).toBeNull();
    expect(queryByText('Организатор с опытом')).toBeNull();
  });

  it('renders the compact rank chip under the name', async () => {
    const profile = { is_verified: true } as unknown as UserProfileDto;

    const { getByTestId } = await render(
      <ProfileHeader {...baseProps} profile={profile} rank={{ level: 5, title: 'Эксперт' }} />
    );

    const nameRow = getByTestId('profile-header-name-row');
    const metaRow = getByTestId('profile-header-meta-row');
    const hostsWithText = (root: TestInstance, text: string) =>
      root.queryAll((node) => node.props.children === text);

    expect(hostsWithText(nameRow, 'Julia I').length).toBeGreaterThan(0);
    expect(hostsWithText(nameRow, 'Ур.5 · Эксперт')).toHaveLength(0);
    expect(hostsWithText(metaRow, 'Ур.5 · Эксперт').length).toBeGreaterThan(0);
  });
});
