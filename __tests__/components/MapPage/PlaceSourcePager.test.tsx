/**
 * #1572 — source-pager карточки места: счётчик «Материал 1 из N», previous/next,
 * разделение place-owned и source-owned полей, media discipline и негативный
 * контроль «один источник — pager'а нет».
 */
import React from 'react';
import { Platform } from 'react-native';

const renderer = require('react-test-renderer');

const mockImageCardMedia = jest.fn((props: any) =>
  React.createElement('mock-image-card-media', props),
);

jest.mock('react-dom', () => ({
  createPortal: (node: any) => node,
}));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  isIOSSafariUserAgent: () => false,
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

jest.mock('@/components/travel/RelatedTravelActionStack', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => React.createElement('related-travel-action-stack', props),
  };
});

const PlacePopupCard = require('@/components/MapPage/Map/PlacePopupCard').default;

const mockColors = {
  text: '#111',
  textMuted: '#666',
  textOnDark: '#fff',
  primary: '#2f6f62',
  primaryDark: '#1f4f45',
  backgroundSecondary: '#f3f4f6',
  surface: '#fff',
  borderLight: '#ddd',
} as any;

const findByTestID = (tree: any, testID: string) =>
  tree.root.findAll((node: any) => node.props?.testID === testID);

// RN пробрасывает testID сквозь Pressable в host-узлы, поэтому один контрол
// встречается в дереве несколько раз. Для «сколько их на экране» считаем только
// host-элементы, а props читаем с первого совпадения.
const countRenderedByTestID = (tree: any, testID: string) =>
  tree.root.findAll(
    (node: any) => node.props?.testID === testID && typeof node.type === 'string',
  ).length;

const readCounterText = (tree: any): string | null => {
  const nodes = findByTestID(tree, 'place-source-pager-counter');
  if (!nodes.length) return null;
  const children = nodes[0].props?.children;
  return Array.isArray(children) ? children.join('') : String(children ?? '');
};

/** Место с двумя материалами: канонические поля места + активный источник. */
const renderCard = (props: Record<string, unknown>) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(
      <PlacePopupCard
        colors={mockColors}
        title="Национальная библиотека Беларуси"
        coord="53.93129,27.6459"
        width={560}
        {...props}
      />,
    );
  });
  return tree;
};

describe('PlacePopupCard source pager', () => {
  const originalPlatform = Platform.OS;
  const originalWindowDimensions = require('react-native').useWindowDimensions;

  beforeEach(() => {
    (Platform as any).OS = 'web';
    mockImageCardMedia.mockClear();
    require('react-native').useWindowDimensions = jest.fn(() => ({
      width: 1024,
      height: 768,
      scale: 1,
      fontScale: 1,
    }));
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    require('react-native').useWindowDimensions = originalWindowDimensions;
  });

  it('shows the localized counter and both controls for a two-source place', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/library-1.jpg',
      sourceCount: 2,
      activeSourceIndex: 0,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    expect(readCounterText(tree)).toBe('Материал 1 из 2');
    expect(countRenderedByTestID(tree, 'place-source-pager-prev')).toBeGreaterThan(0);
    expect(countRenderedByTestID(tree, 'place-source-pager-next')).toBeGreaterThan(0);
  });

  it('reflects the active source index in the counter', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/library-2.jpg',
      sourceCount: 2,
      activeSourceIndex: 1,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    expect(readCounterText(tree)).toBe('Материал 2 из 2');
  });

  it('invokes previous/next callbacks from the controls', () => {
    const onPrevSource = jest.fn();
    const onNextSource = jest.fn();
    const tree = renderCard({
      imageUrl: 'https://example.com/library-1.jpg',
      sourceCount: 2,
      activeSourceIndex: 0,
      onPrevSource,
      onNextSource,
    });

    renderer.act(() => {
      findByTestID(tree, 'place-source-pager-next')[0].props.onPress();
    });
    renderer.act(() => {
      findByTestID(tree, 'place-source-pager-prev')[0].props.onPress();
    });

    expect(onNextSource).toHaveBeenCalledTimes(1);
    expect(onPrevSource).toHaveBeenCalledTimes(1);
  });

  it('keeps pager controls at a 44 dp touch target', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/library-1.jpg',
      sourceCount: 2,
      activeSourceIndex: 0,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    for (const testID of ['place-source-pager-prev', 'place-source-pager-next']) {
      const style = findByTestID(tree, testID)[0].props.style({ pressed: false });
      const flat = require('react-native').StyleSheet.flatten(style);
      expect(flat.width).toBeGreaterThanOrEqual(44);
      expect(flat.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('shows the active source title next to the counter and swaps it while paging', () => {
    const first = renderCard({
      imageUrl: 'https://example.com/library-1.jpg',
      sourceCount: 2,
      activeSourceIndex: 0,
      activeSourceTitle: 'Минск за выходные',
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });
    expect(findByTestID(first, 'place-source-pager-title')[0].props.children).toBe(
      'Минск за выходные',
    );

    const second = renderCard({
      imageUrl: 'https://example.com/library-2.jpg',
      sourceCount: 2,
      activeSourceIndex: 1,
      activeSourceTitle: 'Библиотеки Беларуси',
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });
    expect(readCounterText(second)).toBe('Материал 2 из 2');
    expect(findByTestID(second, 'place-source-pager-title')[0].props.children).toBe(
      'Библиотеки Беларуси',
    );
  });

  it('keeps the controls reachable on a source without a photo (inline pager)', () => {
    const tree = renderCard({
      sourceCount: 2,
      activeSourceIndex: 1,
      activeSourceTitle: 'Библиотеки Беларуси',
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    // Фото нет — pager не может быть оверлеем над hero, но вернуться к первому
    // материалу пользователь обязан.
    expect(countRenderedByTestID(tree, 'place-source-pager-prev')).toBeGreaterThan(0);
    expect(countRenderedByTestID(tree, 'place-source-pager-next')).toBeGreaterThan(0);
    expect(readCounterText(tree)).toBe('Материал 2 из 2');
    expect(tree.root.findAll((node: any) => node.type === 'mock-image-card-media')).toHaveLength(0);
  });

  it('renders no pager for a single-source place (negative control)', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/single.jpg',
      sourceCount: 1,
      activeSourceIndex: 0,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    expect(findByTestID(tree, 'place-source-pager')).toHaveLength(0);
    expect(readCounterText(tree)).toBeNull();
  });

  it('renders no pager when the owner passes no paging callbacks', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/single.jpg',
      sourceCount: 3,
    });

    expect(findByTestID(tree, 'place-source-pager')).toHaveLength(0);
  });

  it('mounts only the active source image (media discipline)', () => {
    const tree = renderCard({
      imageUrl: 'https://example.com/library-1.jpg',
      sourceCount: 2,
      activeSourceIndex: 0,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    });

    const mounted = tree.root.findAll((node: any) => node.type === 'mock-image-card-media');
    expect(mounted).toHaveLength(1);
    expect(mounted[0].props.src).toContain('library-1.jpg');
  });

  it('keeps place-owned fields identical across source paging', () => {
    const placeProps = {
      title: 'Национальная библиотека Беларуси',
      coord: '53.93129,27.6459',
      sourceCount: 2,
      onPrevSource: jest.fn(),
      onNextSource: jest.fn(),
    };

    const readPlaceFields = (tree: any) => {
      const texts = tree.root
        .findAll((node: any) => typeof node.type === 'string' && node.props?.selectable)
        .map((node: any) => String(node.props.children));
      return texts;
    };

    const first = renderCard({
      ...placeProps,
      imageUrl: 'https://example.com/library-1.jpg',
      activeSourceIndex: 0,
    });
    const second = renderCard({
      ...placeProps,
      imageUrl: 'https://example.com/library-2.jpg',
      activeSourceIndex: 1,
    });

    // Координаты места одинаковы на обоих материалах — перелистывание их не трогает.
    expect(readPlaceFields(second)).toEqual(readPlaceFields(first));
  });
});
