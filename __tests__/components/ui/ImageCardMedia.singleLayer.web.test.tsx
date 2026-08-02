/**
 * @jest-environment jsdom
 *
 * Решение владельца 2026-08-02: на web карточка рисует ОДИН слой фотографии.
 *
 * До этого на каждую плитку приходилось три растра: `blob:`-PNG из blurhash
 * (expo-image апскейлит хеш ×10 → 320×320, ~48 КБ), сама фотография и её
 * размытая копия вторым `<img>` с тем же URL. Сетевой запрос был один (файл
 * брался из кэша), но декодов и DOM-узлов — три, и всё это в рециклируемом
 * списке.
 *
 * Здесь закреплено то, что осталось: одна фотография, показанная сразу, и
 * дешёвая заливка полей из данных манифеста.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const SRC = 'https://metravel.by/media-resize/legacy/682/conversions/cover.webp';
const BLURHASH = 'LSF=~=I_-o-;5^xuRPR:yGs,M{WZ';
const COLOR = '#7b7e78';

const renderMedia = (props: Record<string, unknown> = {}) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(
      <ImageCardMedia
        testID="card-media"
        src={SRC}
        width={408}
        height={272}
        fit="contain"
        loading="lazy"
        placeholderBlurhash={BLURHASH}
        placeholderColor={COLOR}
        {...props}
      />,
    );
  });
  return tree;
};

describe('ImageCardMedia: один слой фотографии на web', () => {
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

  it('не рисует размытую копию фотографии вторым слоем', () => {
    const tree = renderMedia();
    // Ни одного узла с `data-blur-backdrop`: второй <img> с тем же файлом снят.
    const backdrops = tree.root.findAll(
      (node: any) => node?.props?.['data-blur-backdrop'] !== undefined,
      { deep: true },
    );
    expect(backdrops).toHaveLength(0);
  });

  it('не заводит blob-слой из blurhash даже когда хеш передан', () => {
    const tree = renderMedia();
    const blurhashSources = tree.root.findAll(
      (node: any) => typeof node?.props?.source?.blurhash === 'string',
      { deep: true },
    );
    expect(blurhashSources).toHaveLength(0);
  });

  it('не тянет отдельный LQIP-файл под фотографию', () => {
    const tree = renderMedia({ placeholderSrc: 'https://metravel.by/gallery/lqip.webp' });
    const lqip = tree.root.findAll(
      (node: any) => typeof node?.props?.src === 'string' && node.props.src.includes('lqip'),
      { deep: true },
    );
    expect(lqip).toHaveLength(0);
  });

});
