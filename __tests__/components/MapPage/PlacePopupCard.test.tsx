import React from 'react';
import { Platform } from 'react-native';

const renderer = require('react-test-renderer');

const mockImageCardMedia = jest.fn((props: any) => React.createElement('mock-image-card-media', props));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}));

jest.mock('@/components/ui/CardActionPressable', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => React.createElement(Pressable, props, children),
  };
});

jest.mock('@/hooks/useTheme', () => ({
  __esModule: true,
  useThemedColors: () => ({
    text: '#111',
    textMuted: '#666',
    textOnDark: '#fff',
    primary: '#2f6f62',
    backgroundSecondary: '#f3f4f6',
    surface: '#fff',
    borderLight: '#ddd',
  }),
}));

const PlacePopupCard = require('@/components/MapPage/Map/PlacePopupCard').default;

describe('PlacePopupCard', () => {
  const originalPlatform = Platform.OS;
  const originalWindowDimensions = require('react-native').useWindowDimensions;

  beforeEach(() => {
    (Platform as any).OS = 'web';
    mockImageCardMedia.mockClear();
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }));
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    require('react-native').useWindowDimensions = originalWindowDimensions;
  });

  it('passes actual popup hero dimensions to ImageCardMedia on web', () => {
    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    expect(mockImageCardMedia).toHaveBeenCalled();
    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.fit).toBe('contain');
    expect(props.width).toBe(436);
    expect(props.height).toBe(Math.round(436 / 1.35));
    expect(props.blurBackground).toBe(true);
    expect(props.allowCriticalWebBlur).toBe(true);
  });
});
