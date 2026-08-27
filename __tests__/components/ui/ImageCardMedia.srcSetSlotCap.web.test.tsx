/**
 * @jest-environment jsdom
 *
 * Кандидаты `srcSet` не должны быть крупнее того, что слот покажет на своём DPR.
 *
 * Полы лестницы (160/320/480/640) не зависят от размера слота, поэтому мелкие
 * слоты получали заведомо лишних кандидатов. Для аватара это оплачивалось
 * мастером: слот 96 CSS px на DPR 2 требует 192, ближайшим в наборе был 320 — а
 * 320 у storage-профиля `avatar` и есть мастер. Замер прода 2026-08-03,
 * `/avatar/profile/82/avatar/f9b9811452104523b2088f840a77a6ee.webp`:
 * w=96 → 738 B, w=160 → 1 572 B, w=320 → 88 492 B `stored-master`.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const AVATAR_SRC =
  'https://metravel.by/avatar/profile/82/avatar/f9b9811452104523b2088f840a77a6ee.webp';
const COVER_SRC = 'https://metravel.by/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG';

const renderMedia = (props: Record<string, unknown>) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(<ImageCardMedia testID="card-media" loading="lazy" {...props} />);
  });
  return tree;
};

const srcSetWidths = (tree: any): number[] => {
  const nodes = tree.root.findAll((node: any) => typeof node?.props?.srcSet === 'string', {
    deep: true,
  });
  const srcSet: string = nodes.length ? nodes[0].props.srcSet : '';
  return Array.from(srcSet.matchAll(/\s(\d+)w/g)).map((entry: any) => Number(entry[1]));
};

describe('ImageCardMedia: srcSet не перерастает слот', () => {
  const originalPlatform = Platform.OS;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    Platform.OS = 'web';
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  it('аватар 96px не предлагает ступень 320 — мастер профиля avatar', () => {
    const widths = srcSetWidths(
      renderMedia({ src: AVATAR_SRC, width: 96, height: 96, fit: 'cover' }),
    );

    expect(widths.length).toBeGreaterThan(0);
    expect(widths).not.toContain(320);
    expect(Math.max(...widths)).toBeLessThanOrEqual(96 * 2);
  });

  it('аватар 44px оставляет хотя бы одного кандидата', () => {
    // 44 × 2 = 88 — ниже самой мелкой ступени. `srcSet` не должен исчезнуть
    // совсем, иначе браузер уйдёт на неоптимизированный `src`.
    const widths = srcSetWidths(
      renderMedia({ src: AVATAR_SRC, width: 44, height: 44, fit: 'cover' }),
    );

    expect(widths).toEqual([160]);
  });

  it('карточка 320px сохраняет прежнюю лестницу до 640', () => {
    const widths = srcSetWidths(
      renderMedia({ src: COVER_SRC, width: 320, height: 240, fit: 'cover' }),
    );

    expect(widths).toEqual([160, 320, 480, 640]);
  });

  it('оставляет blob-превью в src без ложных responsive-кандидатов', () => {
    const blobUrl = 'blob:http://localhost/route-point-preview';
    const tree = renderMedia({
      src: blobUrl,
      width: 320,
      height: 240,
      fit: 'contain',
      loading: 'eager',
    });
    const mainImage = tree.root.find(
      (node: any) => node.type === 'img' && !node.props?.['aria-hidden'],
    );

    expect(mainImage.props.src).toBe(blobUrl);
    expect(mainImage.props.srcSet).toBeUndefined();
    expect(mainImage.props.loading).toBe('eager');
  });

  it('не повторяет неизменный server URL как ложные width-кандидаты', () => {
    const serverUrl = 'https://example.com/travel-address/point.png';
    const tree = renderMedia({
      src: serverUrl,
      width: 320,
      height: 240,
      fit: 'contain',
    });
    const mainImage = tree.root.find(
      (node: any) => node.type === 'img' && !node.props?.['aria-hidden'],
    );

    expect(mainImage.props.src).toBe(serverUrl);
    expect(mainImage.props.srcSet).toBeUndefined();
  });
});
