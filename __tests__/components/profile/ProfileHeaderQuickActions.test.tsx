import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';

const mockImageCardMedia = jest.fn((_props: any) => {
  const { View } = require('react-native');
  return <View testID="mock-image-card-media" />;
});

let mockViewportWidth = 1280;

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: mockViewportWidth < 768,
    isHydrated: true,
    width: mockViewportWidth,
    height: 900,
  }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));

jest.mock('@/components/ui/ImageCardMedia', () => {
  return (props: any) => mockImageCardMedia(props);
});

jest.mock('@/components/profile/ProfileMenu', () => ({ ProfileMenu: () => null }));
jest.mock('@/components/profile/CoverTopoTexture', () => ({ CoverTopoTexture: () => null }));

const baseProps = {
  user: { name: 'Julia I', email: 'julia@tut.by', avatar: null },
  onEdit: jest.fn(),
  onLogout: jest.fn(),
  onAvatarUpload: jest.fn(),
  onQuickAction: jest.fn(),
};

describe('ProfileHeader quick actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockViewportWidth = 1280;
  });

  it('moves quick actions to the top band of a compact cover below 360 (#2141)', () => {
    mockViewportWidth = 320;
    const { getByTestId, getAllByTestId } = render(<ProfileHeader {...baseProps} />);

    expect(getAllByTestId('profile-header-quick-actions')).toHaveLength(1);
    const bandStyle = StyleSheet.flatten(getByTestId('profile-header-quick-actions').props.style) ?? {};
    expect(bandStyle).toMatchObject({ position: 'absolute', top: 4 });
    expect(mockImageCardMedia).toHaveBeenCalledWith(expect.objectContaining({ height: 88 }));
  });

  it('keeps quick actions at the bottom edge of the regular cover from 360 up', () => {
    mockViewportWidth = 390;
    const { getByTestId } = render(<ProfileHeader {...baseProps} />);

    const overlayStyle = StyleSheet.flatten(getByTestId('profile-header-quick-actions').props.style) ?? {};
    expect(overlayStyle).toMatchObject({ position: 'absolute', bottom: 8 });
    expect(mockImageCardMedia).toHaveBeenCalledWith(expect.objectContaining({ height: 132 }));
  });

  it('renders the profile cover as a sharp image without blur backdrop', () => {
    render(<ProfileHeader {...baseProps} />);

    expect(mockImageCardMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        alt: 'Обложка профиля',
        fit: 'cover',
        blurBackground: false,
        priority: 'high',
      })
    );
  });

  it('renders uploaded profile cover without blur backdrop', () => {
    render(
      <ProfileHeader
        {...baseProps}
        profile={{ cover_photo: 'https://metravel.by/media/profile-cover.jpg' } as any}
      />
    );

    expect(mockImageCardMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        src: expect.stringContaining('profile-cover.jpg'),
        fit: 'cover',
        blurBackground: false,
        priority: 'high',
      })
    );
  });

  it('keeps cover media decorative so web quick actions receive clicks', () => {
    const { getByTestId } = render(<ProfileHeader {...baseProps} />);

    const coverMedia = getByTestId('profile-header-cover-media');
    const quickActions = getByTestId('profile-header-quick-actions');
    const identityRow = getByTestId('profile-header-identity-row');
    const infoColumn = getByTestId('profile-header-info-column');
    const coverStyle = StyleSheet.flatten(coverMedia.props.style) ?? {};
    const quickActionsStyle = StyleSheet.flatten(quickActions.props.style) ?? {};

    expect(coverMedia.props.pointerEvents).toBe('none');
    expect(identityRow.props.pointerEvents).toBe('box-none');
    expect(infoColumn.props.pointerEvents).toBe('box-none');
    expect(quickActionsStyle.zIndex).toBeGreaterThan(coverStyle.zIndex);
  });

  it('passes calendar press to the profile screen action handler', () => {
    const onQuickAction = jest.fn();
    const { getByLabelText } = render(
      <ProfileHeader {...baseProps} onQuickAction={onQuickAction} />
    );

    fireEvent.press(getByLabelText('Календарь'));

    expect(onQuickAction).toHaveBeenCalledWith('calendar');
  });

  it('passes trips press to the profile screen action handler', () => {
    const onQuickAction = jest.fn();
    const { getByLabelText } = render(
      <ProfileHeader {...baseProps} onQuickAction={onQuickAction} />
    );

    fireEvent.press(getByLabelText('Поездки'));

    expect(onQuickAction).toHaveBeenCalledWith('trips');
  });
});
