/**
 * @jest-environment jsdom
 *
 * Ячейка FlashList остаётся смонтированной, но каждый новый источник получает
 * собственный `<img>`. Он не наследует чужие пиксели и показывает свои готовые
 * пиксели средствами браузера, без ожидания JS-гейта раскрытия (#2705).
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const SRC_A = 'https://metravel.by/travel-image/682/conversions/aaa.webp';
const SRC_B = 'https://metravel.by/travel-image/683/conversions/bbb.webp';
const COLOR = '#7b7e78';

type FakeImg = {
  style: Record<string, string>;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  currentSrc: string;
};

const createFakeImg = (): FakeImg => ({
  style: {},
  complete: false,
  naturalWidth: 0,
  naturalHeight: 0,
  currentSrc: '',
});

const findMainImage = (tree: any) =>
  tree.root.find(
    (node: any) => node.type === 'img' && typeof node.props?.src === 'string' && !node.props['aria-hidden'],
  );

/** Настоящее событие `load`: пиксели у узла появились. */
const fireLoad = (tree: any, node: FakeImg) => {
  const props = findMainImage(tree).props;
  node.currentSrc = props.srcSet?.split(',')[0].trim().split(/\s+/)[0] ?? props.src;
  node.complete = true;
  node.naturalWidth = 800;
  node.naturalHeight = 600;
  renderer.act(() => {
    findMainImage(tree).props.onLoad();
  });
};

describe('ImageCardMedia: подмена картинки в рециклируемой ячейке (web)', () => {
  const originalPlatform = Platform.OS;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    Platform.OS = 'web';
    // Разметку web-слоёв компонент рисует только вне jest-ветки.
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  const renderMedia = () => {
    const nodes: FakeImg[] = [];
    let tree: any;
    const element = (src: string) => (
      <ImageCardMedia
        testID="card-media"
        src={src}
        width={408}
        height={272}
        fit="contain"
        loading="eager"
        placeholderColor={COLOR}
        recyclingKey={src}
        revealOnLoadOnly
      />
    );

    renderer.act(() => {
      tree = renderer.create(element(SRC_A), {
        createNodeMock: (el: any) => {
          if (el?.type !== 'img') return null;
          const node = createFakeImg();
          nodes.push(node);
          return node;
        },
      });
    });

    return {
      tree,
      nodes,
      rerender: (src: string) => {
        renderer.act(() => tree.update(element(src)));
      },
    };
  };

  it('меняет native img при смене фото и оставляет показ собственных пикселей браузеру', () => {
    const { tree, nodes, rerender } = renderMedia();

    fireLoad(tree, nodes[0]);
    expect(findMainImage(tree).props.style.opacity).toBe(1);

    rerender(SRC_B);
    expect(nodes).toHaveLength(2);
    expect(findMainImage(tree).props.src).toContain('bbb.webp');
    expect(nodes[1].currentSrc).toBe('');
    expect(findMainImage(tree).props.style.opacity).toBe(1);

    fireLoad(tree, nodes[1]);
    expect(findMainImage(tree).props.style.opacity).toBe(1);
    rerender(SRC_A);
    expect(nodes).toHaveLength(3);
    expect(findMainImage(tree).props.style.opacity).toBe(1);
  });

  it('оставляет заливку из данных под ещё не загруженной картинкой', () => {
    const { tree, nodes, rerender } = renderMedia();

    fireLoad(tree, nodes[0]);
    rerender(SRC_B);

    const placeholder = tree.root.find(
      (node: any) => node.props?.testID === 'card-media-data-placeholder',
    );
    expect(placeholder).toBeTruthy();
  });

  it('не гасит слой, когда меняются только параметры оптимизации того же файла', () => {
    const { tree, nodes, rerender } = renderMedia();

    fireLoad(tree, nodes[0]);
    rerender(`${SRC_A}?w=640&q=60`);

    expect(nodes).toHaveLength(1);
    expect(findMainImage(tree).props.style.opacity).toBe(1);
  });
});
