import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { CompactSocialProfile } from '@/api/user';
import SubscriberCard from '@/components/subscriptions/SubscriberCard';

const mockSubscribeButton = jest.fn(() => null);

jest.mock('@/components/ui/SubscribeButton', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSubscribeButton(props);
    return null;
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: true, width: 390 }),
}));

const profile: CompactSocialProfile = {
  user: 42,
  display_name: 'Александра-Мария Путешественникова',
  avatar_url: null,
};

describe('SubscriberCard mobile layout', () => {
  beforeEach(() => {
    mockSubscribeButton.mockClear();
  });

  it('keeps the full name visible and renders the remaining actions as icons', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(
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
      expect.objectContaining({ iconOnly: true, deferStatus: true, targetUserId: 42 }),
    );
    expect(queryByTestId('subscriber-social-instagram')).toBeNull();
  });
});
