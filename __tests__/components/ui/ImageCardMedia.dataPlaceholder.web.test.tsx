/**
 * @jest-environment jsdom
 *
 * Решение владельца 2026-08-02: на web одна картинка — один растр.
 *
 * `ImageDataPlaceholder` с blurhash — это `<ExpoImage source={{ blurhash }}>`, а на
 * web expo-image декодирует хеш в canvas 32×32, апскейлит его ×10 и отдаёт
 * `blob:`-PNG 320×320 (~48 КБ и отдельная строка в Network на каждую плитку;
 * см. `expo-image/src/utils/blurhash/useBlurhash.tsx`, `scaleRatio = 10`).
 * Под размытыми полями letterbox этого не нужно — там достаточно
 * `dominant_color` из того же манифеста, который стоит ноль ресурсов.
 *
 * Инварианты:
 *  - web: blurhash в разметку не попадает вообще;
 *  - web: заливка цветом лежит под фото и НЕ снимается после его появления —
 *    иначе поля `contain` останутся пустыми (ради них раньше поднимали сетевую
 *    blur-подложку);
 *  - native: blurhash по-прежнему рисует expo-image.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const BLURHASH = 'LSF=~=I_-o-;5^xuRPR:yGs,M{WZ';
const COLOR = '#7b7e78';
const SRC = 'https://metravel.by/gallery/3994/conversions/one-detail_hd.jpg';

const placeholderNodes = (tree: any): any[] =>
  tree.root.findAll(
    (node: any) => node?.props?.testID === 'slide-media-data-placeholder',
    { deep: true },
  );

const hasPlaceholder = (tree: any): boolean => placeholderNodes(tree).length > 0;

const renderMedia = (props: Record<string, unknown>) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(
      <ImageCardMedia
        testID="slide-media"
        src={SRC}
        width={368}
        height={471}
        fit="contain"
        {...props}
      />,
    );
  });
  return tree;
};

describe('ImageCardMedia: слой-заливка из данных', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('web: один только blurhash не даёт слоя — blob-PNG на плитку не создаётся', () => {
    const tree = renderMedia({ loading: 'lazy', placeholderBlurhash: BLURHASH });
    expect(hasPlaceholder(tree)).toBe(false);
  });

  it('web: dominant_color заливает поля и остаётся под уже показанным фото', () => {
    const tree = renderMedia({
      loading: 'eager',
      priority: 'high',
      showImmediately: true,
      placeholderBlurhash: BLURHASH,
      placeholderColor: COLOR,
    });
    expect(hasPlaceholder(tree)).toBe(true);
  });

  it('web: слой заливки не тянет blurhash даже когда он передан вместе с цветом', () => {
    const tree = renderMedia({
      loading: 'lazy',
      placeholderBlurhash: BLURHASH,
      placeholderColor: COLOR,
    });
    const [node] = placeholderNodes(tree);
    expect(node).toBeTruthy();
    // Внутри слоя не должно быть ни одного источника с blurhash.
    const blurhashSources = tree.root.findAll(
      (n: any) => typeof n?.props?.source?.blurhash === 'string',
      { deep: true },
    );
    expect(blurhashSources).toHaveLength(0);
  });

  it('native: blurhash по-прежнему рисуется', () => {
    Platform.OS = 'ios';
    const tree = renderMedia({ showImmediately: true, placeholderBlurhash: BLURHASH });
    expect(hasPlaceholder(tree)).toBe(true);
  });
});
