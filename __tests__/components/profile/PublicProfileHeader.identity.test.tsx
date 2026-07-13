import React from 'react';
import { render } from '@testing-library/react-native';
import { PublicProfileHeader } from '@/components/screens/profile/PublicProfileHeader';
import type { UserProfileDto } from '@/api/user';
import type { UserRank } from '@/api/achievements';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));

jest.mock('@/components/profile/ProfileStatPills', () => ({ ProfileStatPills: () => null }));
const mockProfileTabs = jest.fn(() => null);
jest.mock('@/components/profile/ProfileTabs', () => ({
  ProfileTabs: (props: unknown) => mockProfileTabs(props),
}));
const mockImageCardMedia = jest.fn(() => null);
jest.mock('@/components/ui/SubscribeButton', () => () => null);
jest.mock('@/components/ui/StarRating', () => () => null);
jest.mock('@/components/profile/UserSafetyMenu', () => () => null);
jest.mock('@/components/profile/ProtectedContacts', () => () => null);
jest.mock('@/components/ui/SafetyNotice', () => () => null);
jest.mock('@/components/achievements/PeerBadgeGiveButton', () => () => null);
jest.mock('@/components/ui/ImageCardMedia', () => (props: any) => mockImageCardMedia(props));
jest.mock('@/components/profile/CoverTopoTexture', () => ({ CoverTopoTexture: () => null }));

const rank: UserRank = {
  level: 5,
  title: 'Эксперт',
  totalPoints: 1200,
  badgesCount: 8,
  currentLevelMinPoints: 1000,
  nextLevelMinPoints: 1500,
  nextLevelTitle: 'Мастер',
  isMaxLevel: false,
  progressRatio: 0.4,
  remainingPoints: 300,
  recomputedAt: null,
};

const baseProps = {
  userId: '2',
  fullName: 'Traveler',
  avatarError: false,
  onAvatarError: jest.fn(),
  isOwnProfile: false,
  socials: [],
  peerReceived: [],
  statPills: [],
  activeTab: 'travels' as const,
  onChangeTab: jest.fn(),
  tabCounts: {},
  onWriteMessage: jest.fn(),
};

const profile = { is_verified: true, participant_rating: null } as unknown as UserProfileDto;

describe('PublicProfileHeader identity (#847)', () => {
  beforeEach(() => {
    mockProfileTabs.mockClear();
    mockImageCardMedia.mockClear();
  });

  it('renders the public profile cover as a sharp image without blur backdrop', () => {
    render(<PublicProfileHeader {...baseProps} profile={profile} rank={rank} />);

    expect(mockImageCardMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        alt: 'Обложка профиля',
        fit: 'cover',
        blurBackground: false,
        priority: 'high',
      })
    );
  });

  it('renders the rank chip and hides the generic subtitle when rank is present', () => {
    const { getByText, queryByText } = render(
      <PublicProfileHeader {...baseProps} profile={profile} rank={rank} />
    );

    expect(getByText('Ур.5 · Эксперт')).toBeTruthy();
    expect(queryByText('Автор путешествий')).toBeNull();
    expect(queryByText('Проверенный')).toBeNull();
  });

  it('falls back to the generic subtitle when no rank is available', () => {
    const { queryByText } = render(
      <PublicProfileHeader {...baseProps} profile={profile} rank={null} />
    );

    expect(queryByText('Ур.5 · Эксперт')).toBeNull();
    expect(queryByText('Автор путешествий')).toBeTruthy();
  });

  it('keeps all own-profile sections under the shared header', () => {
    render(<PublicProfileHeader {...baseProps} isOwnProfile profile={profile} rank={rank} />);

    expect(mockProfileTabs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tabKeys: ['travels', 'subscribers', 'subscriptions', 'overview'],
      })
    );
  });

  it('does not expose private subscription sections on another user profile', () => {
    render(<PublicProfileHeader {...baseProps} profile={profile} rank={rank} />);

    expect(mockProfileTabs).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabKeys: ['travels', 'overview'] })
    );
  });
});
