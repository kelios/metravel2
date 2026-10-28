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
const { act } = require('react');
const renderer = require('test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');
const roots = new Set<import('test-renderer').Root>()
afterEach(async () => {
  for (const root of roots) await act(() => root.unmount())
  roots.clear()
})


const BLURHASH = 'LSF=~=I_-o-;5^xuRPR:yGs,M{WZ';
const COLOR = '#7b7e78';
const SRC = 'https://metravel.by/gallery/3994/conversions/one-detail_hd.jpg';

const placeholderNodes = (tree: any): any[] =>
  tree.container.queryAll(
    (node: any) => node?.props?.testID === 'slide-media-data-placeholder'
  );

const hasPlaceholder = (tree: any): boolean => placeholderNodes(tree).length > 0;

const renderMedia = async (props: Record<string, unknown>) => {
  let tree: any;
  await act(() => {
    tree = renderer.createRoot();
      roots.add(tree)
      tree.render(<ImageCardMedia
        testID="slide-media"
        src={SRC}
        width={368}
        height={471}
        fit="contain"
        {...props}
      />)
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

  it('web: один только blurhash не даёт слоя — blob-PNG на плитку не создаётся', async () => {
    const tree = await renderMedia({ loading: 'lazy', placeholderBlurhash: BLURHASH });
    expect(hasPlaceholder(tree)).toBe(false);
  });

  it('web: dominant_color заливает поля и остаётся под уже показанным фото', async () => {
    const tree = await renderMedia({
      loading: 'eager',
      priority: 'high',
      showImmediately: true,
      placeholderBlurhash: BLURHASH,
      placeholderColor: COLOR,
    });
    expect(hasPlaceholder(tree)).toBe(true);
  });

  it('web: слой заливки не тянет blurhash даже когда он передан вместе с цветом', async () => {
    const tree = await renderMedia({
      loading: 'lazy',
      placeholderBlurhash: BLURHASH,
      placeholderColor: COLOR,
    });
    const [node] = placeholderNodes(tree);
    expect(node).toBeTruthy();
    // Внутри слоя не должно быть ни одного источника с blurhash.
    const blurhashSources = tree.container.queryAll(
      (n: any) => typeof n?.props?.source?.blurhash === 'string'
    );
    expect(blurhashSources).toHaveLength(0);
  });

  it('native: blurhash по-прежнему рисуется', async () => {
    Platform.OS = 'ios';
    const tree = await renderMedia({ showImmediately: true, placeholderBlurhash: BLURHASH });
    expect(hasPlaceholder(tree)).toBe(true);
  });
});
