import React from 'react';
import { Platform, StyleSheet } from 'react-native';

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

const PlacePopupCard = require('@/components/MapPage/Map/PlacePopupCard').default;
const mockColors = {
  text: '#111',
  textMuted: '#666',
  textOnDark: '#fff',
  primary: '#2f6f62',
  backgroundSecondary: '#f3f4f6',
  surface: '#fff',
  borderLight: '#ddd',
};

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
          colors={mockColors as any}
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
    expect(props.style).toEqual(StyleSheet.absoluteFill);
    expect(props.blurBackground).toBe(true);
    expect(props.allowCriticalWebBlur).toBe(true);
  });

  it('switches popup hero to compact layout on narrow viewport to keep it inside the screen', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 360, height: 740, scale: 1, fontScale: 1 }));

    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    expect(mockImageCardMedia).toHaveBeenCalled();
    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.style).toEqual(StyleSheet.absoluteFill);
  });

  it('uses a compact hero on travel details popup layout', () => {
    renderer.act(() => {
      renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
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
    expect(props.style).toEqual(StyleSheet.absoluteFill);
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
          colors={mockColors as any}
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
          colors={mockColors as any}
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

  it('opens FullscreenImageViewer when hero image is pressed', () => {
    const FullscreenImageViewerModule = require('@/components/MapPage/Map/PlacePopupCard/FullscreenImageViewer');
    const fullscreenSpy = jest.spyOn(FullscreenImageViewerModule, 'default');

    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    // Initially fullscreen viewer is rendered with visible=false
    const initialCalls = fullscreenSpy.mock.calls.map((args: any[]) => args[0]?.visible);
    expect(initialCalls.some((v: any) => v === false)).toBe(true);

    // Find the hero Pressable by accessibilityLabel and fire onPress
    const heroPressable = tree.root.findByProps({ accessibilityLabel: 'Открыть фото на весь экран' });
    expect(heroPressable).toBeTruthy();
    renderer.act(() => {
      heroPressable.props.onPress();
    });

    // After press, viewer should have been called with visible=true
    const lastCall = fullscreenSpy.mock.calls[fullscreenSpy.mock.calls.length - 1]?.[0];
    expect(lastCall?.visible).toBe(true);
    fullscreenSpy.mockRestore();
  });

  it('stops web map events when opening the fullscreen image viewer', () => {
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    const heroPressable = tree.root.findByProps({ accessibilityLabel: 'Открыть фото на весь экран' });
    expect(heroPressable.props['data-card-action']).toBe('true');
    expect(heroPressable.props.title).toBeTruthy();

    const stopPropagation = jest.fn();
    renderer.act(() => {
      heroPressable.props.onMouseDown({ stopPropagation });
      heroPressable.props.onPress({ stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('opens the fullscreen image viewer from capture handlers before Leaflet popup event guards', () => {
    const FullscreenImageViewerModule = require('@/components/MapPage/Map/PlacePopupCard/FullscreenImageViewer');
    const fullscreenSpy = jest.spyOn(FullscreenImageViewerModule, 'default');

    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          imageUrl="https://example.com/photo.jpg"
          width={560}
        />
      );
    });

    const heroPressable = tree.root.findAll((node: any) => (
      node.props?.['data-card-action'] === 'true' &&
      typeof node.props?.onClickCapture === 'function' &&
      typeof node.props?.onTouchEndCapture === 'function'
    ))[0];
    expect(heroPressable).toBeTruthy();
    expect(typeof heroPressable.props.onClickCapture).toBe('function');
    expect(typeof heroPressable.props.onTouchEndCapture).toBe('function');

    const stopPropagation = jest.fn();
    renderer.act(() => {
      heroPressable.props.onClickCapture({ stopPropagation });
    });

    const lastCall = fullscreenSpy.mock.calls[fullscreenSpy.mock.calls.length - 1]?.[0];
    expect(stopPropagation).toHaveBeenCalled();
    expect(lastCall?.visible).toBe(true);
    fullscreenSpy.mockRestore();
  });

  it('renders permanent text labels alongside icons for web action chips', () => {
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          coord="53.9, 27.56"
          onOpenArticle={jest.fn()}
          onOpenGoogleMaps={jest.fn()}
          onOpenOrganicMaps={jest.fn()}
          onAddPoint={jest.fn()}
        />
      );
    });

    const findLabel = (label: string) =>
      tree.root.findAll((node: any) => node.props?.children === label);

    expect(findLabel('Google').length).toBeGreaterThan(0);
    expect(findLabel('Organic').length).toBeGreaterThan(0);

    const googleAction = tree.root.findByProps({ accessibilityLabel: 'Google Maps' });
    expect(googleAction).toBeTruthy();
  });

  it('runs the Google navigation handler when the popup action is pressed', () => {
    const onOpenGoogleMaps = jest.fn();
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          coord="53.9, 27.56"
          onOpenArticle={jest.fn()}
          onOpenGoogleMaps={onOpenGoogleMaps}
        />
      );
    });

    const googleAction = tree.root.findByProps({ accessibilityLabel: 'Google Maps' });

    renderer.act(() => {
      googleAction.props.onPress();
    });

    expect(onOpenGoogleMaps).toHaveBeenCalledTimes(1);
  });

  it('opens the page through the popup handler when the inline page link is clicked', () => {
    const onOpenArticle = jest.fn();
    const stopPropagation = jest.fn();
    const preventDefault = jest.fn();
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          articleHref="/travels/test-route"
          coord="53.9, 27.56"
          onBuildRoute={jest.fn()}
          onOpenArticle={onOpenArticle}
        />
      );
    });

    const link = tree.root.findByType('a');
    expect(link.props.href).toBe('/travels/test-route');

    renderer.act(() => {
      link.props.onClick({ preventDefault, stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpenArticle).toHaveBeenCalledTimes(1);
  });
});
