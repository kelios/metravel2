import React from 'react';
import { Platform, StyleSheet } from 'react-native';

const renderer = require('react-test-renderer');

const mockImageCardMedia = jest.fn((props: any) => React.createElement('mock-image-card-media', props));

jest.mock('react-dom', () => ({
  createPortal: (node: any) => node,
}));

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

const findHeroPressable = (tree: any) => tree.root.findAll((node: any) => (
  node.props?.accessibilityLabel === 'Открыть фото на весь экран' &&
  typeof node.props?.onPress === 'function'
))[0];

const findHeroExpandButton = (tree: any) => tree.root.findAll((node: any) => (
  node.type === 'span' &&
  node.props?.['data-card-action'] === 'true' &&
  node.props?.['aria-hidden'] === 'true'
))[0];

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
    const heroPressable = findHeroPressable(tree);
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

    const heroPressable = findHeroPressable(tree);
    expect(heroPressable).toBeTruthy();
    expect(heroPressable.props['data-card-action']).toBe('true');
    expect(heroPressable.props.title).toBeTruthy();

    const stopPropagation = jest.fn();
    renderer.act(() => {
      heroPressable.props.onMouseDown({ stopPropagation });
      heroPressable.props.onPress({ stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('opens the fullscreen image viewer from the visible expand button capture handler', () => {
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

    const expandButton = findHeroExpandButton(tree);
    expect(expandButton).toBeTruthy();

    const stopPropagation = jest.fn();
    const preventDefault = jest.fn();
    renderer.act(() => {
      expandButton.props.onPointerDownCapture({ stopPropagation, preventDefault });
    });

    const lastCall = fullscreenSpy.mock.calls[fullscreenSpy.mock.calls.length - 1]?.[0];
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    expect(lastCall?.visible).toBe(true);
    fullscreenSpy.mockRestore();
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

  it('renders the fallback Google action and expands secondary navigation chips', () => {
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          coord="53.9, 27.56"
          onOpenGoogleMaps={jest.fn()}
          onOpenAppleMaps={jest.fn()}
          onOpenOrganicMaps={jest.fn()}
          onOpenWaze={jest.fn()}
          onOpenYandexMaps={jest.fn()}
          onOpenYandexNavi={jest.fn()}
          onOpenOpenStreetMap={jest.fn()}
          onAddPoint={jest.fn()}
        />
      );
    });

    const findLabel = (label: string) =>
      tree.root.findAll((node: any) => node.props?.children === label);

    expect(findLabel('Google Maps').length).toBeGreaterThan(0);
    expect(findLabel('Google').length).toBe(0);
    expect(findLabel('Organic').length).toBe(0);

    const googleAction = tree.root.findByProps({ accessibilityLabel: 'Открыть точку в Google Maps' });
    expect(googleAction).toBeTruthy();

    const moreAction = tree.root.findByProps({ accessibilityLabel: 'Показать способы навигации' });
    renderer.act(() => {
      moreAction.props.onPress();
    });

    expect(findLabel('Organic').length).toBeGreaterThan(0);
    expect(findLabel('Apple').length).toBeGreaterThan(0);
    expect(findLabel('Waze').length).toBeGreaterThan(0);
    expect(findLabel('Яндекс Карты').length).toBeGreaterThan(0);
    expect(findLabel('Яндекс Нави').length).toBeGreaterThan(0);
    expect(findLabel('OSM').length).toBeGreaterThan(0);
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
          onOpenGoogleMaps={onOpenGoogleMaps}
        />
      );
    });

    const googleAction = tree.root.findByProps({ accessibilityLabel: 'Открыть точку в Google Maps' });

    renderer.act(() => {
      googleAction.props.onPress();
    });

    expect(onOpenGoogleMaps).toHaveBeenCalledTimes(1);
  });

  it('runs the add-point handler when the save action is pressed', () => {
    const onAddPoint = jest.fn();
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          coord="53.9, 27.56"
          onAddPoint={onAddPoint}
        />
      );
    });

    const saveAction = tree.root.findByProps({ accessibilityLabel: 'Мои точки' });

    renderer.act(() => {
      saveAction.props.onPress();
    });

    expect(onAddPoint).toHaveBeenCalledTimes(1);
  });

  it('disables the save action when addDisabled is true', () => {
    const onAddPoint = jest.fn();
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          coord="53.9, 27.56"
          onAddPoint={onAddPoint}
          addDisabled
        />
      );
    });

    const saveAction = tree.root.findByProps({ accessibilityLabel: 'Мои точки' });

    expect(saveAction.props.disabled).toBe(true);
  });

  it('opens the page through the popup handler when the page action is pressed', () => {
    const onOpenArticle = jest.fn();
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

    const linkAction = tree.root.findByProps({ accessibilityLabel: 'Открыть статью' });

    renderer.act(() => {
      linkAction.props.onPress();
    });

    expect(onOpenArticle).toHaveBeenCalledTimes(1);
  });

  it('renders a page action for article routes', () => {
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          articleHref="/article/test-post"
          coord="53.9, 27.56"
          onBuildRoute={jest.fn()}
          onOpenArticle={jest.fn()}
        />
      );
    });

    const articleAction = tree.root.findByProps({ accessibilityLabel: 'Открыть статью' });
    expect(articleAction).toBeTruthy();
    expect(
      tree.root.findAll((node: any) => node.props?.children === 'Страница').length,
    ).toBeGreaterThan(0);
  });

  it('keeps mobile bottom-card actions labeled and preserves article accessibility', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }));

    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Test point"
          articleHref="/article/test-post"
          coord="53.9, 27.56"
          imageUrl="https://example.com/photo.jpg"
          onOpenArticle={jest.fn()}
          onAddPoint={jest.fn()}
          bottomSheetSplit
          compactLayout
        />
      );
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Открыть статью' })).toBeTruthy();
    expect(
      tree.root.findAll((node: any) => node.props?.children === 'Страница').length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll((node: any) => node.props?.children === 'Открыть страницу').length,
    ).toBe(0);
  });

  it('does not render an article primary action without a valid article href', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }));

    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title="Travel point"
          coord="53.9, 27.56"
          imageUrl="https://example.com/photo.jpg"
          onOpenArticle={jest.fn()}
          onOpenGoogleMaps={jest.fn()}
          bottomSheetSplit
          compactLayout
        />
      );
    });

    expect(tree.root.findAllByProps({ accessibilityLabel: 'Открыть статью о точке' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Открыть статью' })).toHaveLength(0);
  });

  it('keeps the mobile bottom-card photo compact enough for actions and exposes map/share actions', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }));

    let tree: any;
    const longTitle = 'Очень длинный адрес точки, который раньше занимал несколько строк и перекрывал действия';
    const longSubtitle = 'Podzamcze, Old Town, Stare Miasto, Краков, Малопольское воеводство, Польша';

    renderer.act(() => {
      tree = renderer.create(
        <PlacePopupCard
          colors={mockColors as any}
          title={longTitle}
          subtitle={longSubtitle}
          coord="53.9, 27.56"
          imageUrl="https://example.com/photo.jpg"
          onOpenGoogleMaps={jest.fn()}
          onOpenAppleMaps={jest.fn()}
          onOpenOrganicMaps={jest.fn()}
          onOpenWaze={jest.fn()}
          onOpenYandexMaps={jest.fn()}
          onOpenYandexNavi={jest.fn()}
          onOpenOpenStreetMap={jest.fn()}
          onShareTelegram={jest.fn()}
          onCopyCoord={jest.fn()}
          bottomSheetSplit
          compactLayout
        />
      );
    });

    const hero = tree.root.findAll((node: any) => {
      const style = StyleSheet.flatten(node.props?.style);
      return style?.flexBasis === '58%' && style?.maxHeight === '58%' && style?.minHeight === '46%';
    })[0];

    expect(hero).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Скопировать координаты' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Открыть точку в Google Maps' })).toBeTruthy();
    const navToggle = tree.root.findByProps({ accessibilityLabel: 'Открыть способы навигации' });
    expect(navToggle.props.accessibilityState).toEqual({ expanded: false });

    renderer.act(() => {
      navToggle.props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: 'Открыть способы навигации' }).props.accessibilityState).toEqual({ expanded: true });
    expect(tree.root.findByProps({ accessibilityLabel: 'Apple Maps' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Organic Maps' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Waze' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Яндекс Карты' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Яндекс Навигатор' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'OpenStreetMap' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Поделиться в Telegram' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Закрыть меню действий' })).toBeTruthy();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Показать способы навигации' })).toHaveLength(0);
    expect(tree.root.findAll((node: any) => node.props?.children === 'Навигация и действия').length).toBeGreaterThan(0);
    expect(tree.root.findAll((node: any) => node.props?.children === 'Apple').length).toBeGreaterThan(0);
    expect(tree.root.findAll((node: any) => node.props?.children === 'Organic').length).toBeGreaterThan(0);
    expect(tree.root.findAll((node: any) => node.props?.children === 'Яндекс Карты').length).toBeGreaterThan(0);
    expect(
      tree.root.findAll((node: any) => node.props?.children === longTitle && node.props?.numberOfLines === 2).length,
    ).toBeGreaterThan(0);
  });
});
