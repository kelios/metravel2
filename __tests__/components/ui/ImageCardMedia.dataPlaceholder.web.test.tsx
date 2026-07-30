/**
 * @jest-environment jsdom
 *
 * #1145: blurhash-подложка на web не должна оставаться под уже показанной картинкой.
 *
 * `ImageDataPlaceholder` рисует `<ExpoImage source={{ blurhash }}>`, а на web это
 * настоящий `<img>` с `blob:`-адресом, `loading="lazy"` и `fetchpriority="auto"`,
 * растянутый в режиме `cover` на всю плитку. По площади он перекрывает `contain`-фото,
 * поэтому Chrome берёт LCP именно по нему. На travel-детали слайдер монтируется после
 * гидрации, и в прод-замере 2026-07-30 такая подложка стала финальным LCP-кандидатом:
 * mobile 10 925 мс, desktop 11 283 мс, Load Delay 83–91 %.
 *
 * Инвариант: подложка живёт только пока резкий слой не показан.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const BLURHASH = 'LSF=~=I_-o-;5^xuRPR:yGs,M{WZ';
const SRC = 'https://metravel.by/gallery/3994/conversions/one-detail_hd.jpg';

const hasPlaceholder = (tree: any): boolean =>
  tree.root.findAll(
    (node: any) => node?.props?.testID === 'slide-media-data-placeholder',
    { deep: true },
  ).length > 0;

describe('ImageCardMedia: blurhash-подложка на web', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('рисуется, пока картинка не показана', () => {
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          testID="slide-media"
          src={SRC}
          width={368}
          height={471}
          fit="contain"
          loading="lazy"
          placeholderBlurhash={BLURHASH}
        />,
      );
    });

    expect(hasPlaceholder(tree)).toBe(true);
  });

  it('не монтируется, когда картинка уже показана (первый слайд из кэша hero)', () => {
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          testID="slide-media"
          src={SRC}
          width={368}
          height={471}
          fit="contain"
          loading="eager"
          priority="high"
          showImmediately
          placeholderBlurhash={BLURHASH}
        />,
      );
    });

    expect(hasPlaceholder(tree)).toBe(false);
  });

  it('на native поведение не меняется', () => {
    Platform.OS = 'ios';
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          testID="slide-media"
          src={SRC}
          width={368}
          height={471}
          fit="contain"
          showImmediately
          placeholderBlurhash={BLURHASH}
        />,
      );
    });

    expect(hasPlaceholder(tree)).toBe(true);
  });
});
