import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { UserProfileDto } from '@/api/user';
import SubscriberCard from '@/components/subscriptions/SubscriberCard';
import { openExternalUrl } from '@/utils/externalLinks';

const mockSubscribeButton = jest.fn(() => null);

jest.mock('@/components/ui/SubscribeButton', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSubscribeButton(props);
    return null;
  },
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: true, width: 390 }),
}));

const profile: UserProfileDto = {
  id: 42,
  user: 42,
  first_name: 'Александра-Мария',
  last_name: 'Путешественникова',
  avatar: null,
  youtube: 'https://youtube.com/@alexandra',
  instagram: 'https://instagram.com/alexandra',
  twitter: '',
  vk: '',
  email_notify_comments: false,
  email_notify_messages: false,
};

describe('SubscriberCard mobile layout', () => {
  beforeEach(() => {
    mockSubscribeButton.mockClear();
    jest.mocked(openExternalUrl).mockClear();
  });

  it('keeps the full name visible and renders the remaining actions as icons', () => {
    const { getByText, getByTestId } = render(
      <SubscriberCard
        profile={profile}
        onMessage={jest.fn()}
        onOpenProfile={jest.fn()}
      />,
    );

    const name = getByText('Александра-Мария Путешественникова');
    expect(name.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(getByTestId('subscriber-actions').props.style)).toEqual(
      expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' }),
    );
    expect(mockSubscribeButton).toHaveBeenCalledWith(
      expect.objectContaining({ iconOnly: true, targetUserId: 42 }),
    );
    expect(getByTestId('subscriber-social-instagram').props.accessibilityRole).toBe('link');

    fireEvent.press(getByTestId('subscriber-social-instagram'));
    expect(openExternalUrl).toHaveBeenCalledWith('https://instagram.com/alexandra');
  });

  it('does not expose social links while profile contacts are protected', () => {
    const { queryByTestId } = render(
      <SubscriberCard
        profile={{ ...profile, contacts_hidden: true, contact_access: 'none' }}
        onMessage={jest.fn()}
        onOpenProfile={jest.fn()}
      />,
    );

    expect(queryByTestId('subscriber-social-instagram')).toBeNull();
    expect(queryByTestId('subscriber-social-youtube')).toBeNull();
  });

  it('shows social links when access to protected contacts is granted', () => {
    const { getByTestId } = render(
      <SubscriberCard
        profile={{ ...profile, contacts_hidden: true, contact_access: 'granted' }}
        onMessage={jest.fn()}
        onOpenProfile={jest.fn()}
      />,
    );

    expect(getByTestId('subscriber-social-instagram')).toBeTruthy();
    expect(getByTestId('subscriber-social-youtube')).toBeTruthy();
  });
});
