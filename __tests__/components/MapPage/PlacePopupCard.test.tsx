import React from 'react';
import { Platform } from 'react-native';

const renderer = require('react-test-renderer');

const mockImageCardMedia = jest.fn((props: any) => React.createElement('mock-image-card-media', props));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  isIOSSafariUserAgent: (userAgent: string, maxTouchPoints = 0) => {
    const normalizedUserAgent = String(userAgent || '');
    const isIOSDevice = /iPad|iPhone|iPod/i.test(normalizedUserAgent) || (
      /Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1
    );
    const isSafari = /Safari/i.test(normalizedUserAgent) && !/(Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Chromium|Firefox)/i.test(normalizedUserAgent);
    return isIOSDevice && isSafari;
  },
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
  const originalUserAgent = window.navigator.userAgent;
  const originalMaxTouchPoints = window.navigator.maxTouchPoints;

  beforeEach(() => {
    (Platform as any).OS = 'web';
    mockImageCardMedia.mockClear();
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }));
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    require('react-native').useWindowDimensions = originalWindowDimensions;
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
  });

  it('passes actual popup hero dimensions to ImageCardMedia on web with contain fit and blur backdrop', () => {
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
    expect(props.height).toBe(320);
    expect(props.blurBackground).toBe(true);
    expect(props.allowCriticalWebBlur).toBe(true);
  });

  it('switches popup hero to compact layout on narrow viewport to keep it inside the screen', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 360, height: 740, scale: 1, fontScale: 1 }));

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
    expect(props.width).toBe(228);
    expect(props.height).toBe(118);
  });

  it('uses a compact hero on travel details popup layout', () => {
    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
          compactLayout
        />
      );
    });

    expect(mockImageCardMedia).toHaveBeenCalled();
    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.width).toBe(288);
    expect(props.height).toBe(156);
  });

  it('reveals popup hero only after onLoad on iPhone Safari', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });

    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.revealOnLoadOnly).toBe(true);
  });

  it('keeps popup hero on the existing immediate path outside iPhone Safari', () => {
    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.revealOnLoadOnly).toBe(false);
  });
});
