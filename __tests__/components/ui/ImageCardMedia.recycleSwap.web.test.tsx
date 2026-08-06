/**
 * @jest-environment jsdom
 *
 * Рециклинг ячейки списка на web: узел `<img>` переиспользуется, меняется только
 * `src`. Браузер при этом продолжает рисовать ПРЕДЫДУЩИЙ декодированный кадр,
 * пока не готов новый, — карточка успевает показать фото чужого путешествия.
 *
 * Замер прода 2026-08-06 (`/travelsby`, desktop 1280×900, 1.6 Мбит): из 54 подмен
 * `src` 51 пришлась на карточку, уже видимую во вьюпорте, чужой кадр держался
 * p50 1041 мс.
 *
 * Здесь закреплён гейт: слой гасится ровно на окно между сменой картинки и
 * загрузкой новой — и только для узла, который уже показывал другую картинку
 * (первый показ и кэш-хит проходят без гейта, см.
 * `ImageCardMedia.singleLayer.web.test.tsx`).
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
      /**
       * Смена картинки в том же узле. Браузер на новый `src` сбрасывает
       * `complete`/`naturalWidth` — без этого мок утверждал бы, что пиксели новой
       * картинки уже готовы, и гейт снимался бы сразу.
       */
      rerender: (src: string) => {
        nodes.forEach((node) => {
          node.complete = false;
          node.naturalWidth = 0;
          node.naturalHeight = 0;
        });
        renderer.act(() => tree.update(element(src)));
      },
    };
  };

  it('гасит слой на время подмены и возвращает после загрузки новой картинки', () => {
    const { tree, nodes, rerender } = renderMedia();

    fireLoad(tree, nodes[0]);
    expect(findMainImage(tree).props.style.opacity).toBe(1);

    // Рециклинг: тот же смонтированный узел получает другую картинку.
    rerender(SRC_B);
    expect(nodes).toHaveLength(1); // узел переиспользован, а не пересоздан
    expect(findMainImage(tree).props.src).toContain('bbb.webp');
    expect(findMainImage(tree).props.style.opacity).toBe(0);

    fireLoad(tree, nodes[0]);
    expect(findMainImage(tree).props.style.opacity).toBe(1);
  });

  it('оставляет заливку из данных под погашенным слоем, а не пустой бокс', () => {
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
