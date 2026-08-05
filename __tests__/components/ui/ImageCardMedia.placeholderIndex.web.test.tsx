/**
 * @jest-environment jsdom
 *
 * #1208: заливка полей letterbox приходит из общего индекса, а не из пропа.
 *
 * До этого цвет раздавался только пропом `placeholderColor`, и его передавали
 * шесть экранов из тридцати с лишним. Все остальные `contain`-слоты (карта,
 * попап места, квесты, галерея, тело статьи) рисовали фото на прозрачном фоне.
 * Теперь `ImageCardMedia` сам находит цвет по адресу картинки — «забыть проп»
 * больше нельзя.
 *
 * Инварианты:
 *  - web: индекс включает слой заливки без единого пропа;
 *  - явный проп главнее индекса;
 *  - native не трогаем: там поля закрывает blur-слой expo-image.
 */
const renderer = require('react-test-renderer');
const { Platform, StyleSheet } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');
const {
  indexMediaImage,
  resetMediaPlaceholderIndex,
} = require('@/utils/mediaPlaceholderIndex');

const INDEXED_COLOR = '#5c6252';
const EXPLICIT_COLOR = '#7b7e78';
const MANIFEST_SRC = '/address-image/355/conversions/e4dc7a17.webp?w=640';
/** Тот же файл, но ступенью и роутом, которыми его рисует карточка. */
const RENDERED_SRC =
  'https://metravel.by/media-resize/legacy/355/conversions/e4dc7a17.webp?v=1785826436881&w=720&q=60&fit=contain';

const hasFillLayer = (tree: any): boolean =>
  tree.root.findAll((node: any) => node?.props?.testID === 'card-media-data-placeholder', {
    deep: true,
  }).length > 0;

const fillColor = (tree: any): string => {
  const nodes = tree.root.findAll(
    (n: any) => n?.props?.testID === 'card-media-data-placeholder',
    { deep: true },
  );
  for (const node of nodes) {
    const flattened = StyleSheet.flatten(node?.props?.style) as { backgroundColor?: string } | undefined;
    if (flattened?.backgroundColor) return String(flattened.backgroundColor);
  }
  return '';
};

const renderMedia = (props: Record<string, unknown> = {}) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(
      <ImageCardMedia
        testID="card-media"
        src={RENDERED_SRC}
        width={360}
        height={173}
        fit="contain"
        {...props}
      />,
    );
  });
  return tree;
};

describe('ImageCardMedia: заливка из общего индекса манифеста', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    resetMediaPlaceholderIndex();
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('web: без индекса и без пропа заливки нет (состояние прода до правки)', () => {
    expect(hasFillLayer(renderMedia())).toBe(false);
  });

  it('web: проиндексированный манифест включает заливку без единого пропа', () => {
    indexMediaImage({ id: 355, dominant_color: INDEXED_COLOR, src: MANIFEST_SRC } as any);

    const tree = renderMedia();
    expect(hasFillLayer(tree)).toBe(true);
    expect(String(fillColor(tree))).toContain('92, 98, 82'); // #5c6252 с альфой letterbox
  });

  it('web: явный placeholderColor главнее индекса', () => {
    indexMediaImage({ id: 355, dominant_color: INDEXED_COLOR, src: MANIFEST_SRC } as any);

    const tree = renderMedia({ placeholderColor: EXPLICIT_COLOR });
    expect(String(fillColor(tree))).toContain('123, 126, 120'); // #7b7e78
  });

  it('native: индекс не подменяет blur-слой expo-image', () => {
    indexMediaImage({ id: 355, dominant_color: INDEXED_COLOR, src: MANIFEST_SRC } as any);
    Platform.OS = 'android';

    expect(hasFillLayer(renderMedia({ showImmediately: true }))).toBe(false);
  });
});
