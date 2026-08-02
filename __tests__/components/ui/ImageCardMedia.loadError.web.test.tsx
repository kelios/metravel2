/**
 * @jest-environment jsdom
 *
 * #1212. Регресс прода 2026-08-02: карточка квеста на главной показывала подпись
 * «Обложка квеста …» со значком битой картинки вместо фотографии.
 *
 * Причина: `ImageCardMedia` только пробрасывал `onError` наружу и своего
 * состояния ошибки не имел, а `QuestForCityCard` проп не передаёт. Один упавший
 * запрос (воспроизведено одним `route.abort('connectionfailed')` по
 * `/quest-cover/**`) оставлял `<img>` битым навсегда: браузер рисует в кадре
 * `alt`, ретрая нет, на нейтральный плейсхолдер компонент не переключался.
 *
 * Тест обязан идти реальным web-путём `WebMainImage`: в jest-ветке компонент
 * рендерит `OptimizedImage`, у которого есть собственный ретрай и своя заглушка,
 * то есть дефекта там нет и тест ничего бы не доказывал. Поэтому, как и в
 * соседнем `ImageCardMedia.singleLayer.web.test.tsx`, снимается `JEST_WORKER_ID`.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const SRC = 'https://metravel.by/quest-cover/quests/2/main/bff051ad.webp';
const OTHER_SRC = 'https://metravel.by/quest-cover/quests/3/main/aa11bb22.webp';
/** Отдельный URL: этот тест намеренно греет общий кэш загруженных картинок. */
const CACHED_SRC = 'https://metravel.by/quest-cover/quests/4/main/cc33dd44.webp';
const ALT = 'Обложка квеста Парк Прокоцим';
const SIZE = 132;

const renderMedia = (props: Record<string, unknown> = {}) => {
  let tree: any;
  renderer.act(() => {
    tree = renderer.create(
      <ImageCardMedia
        testID="quest-media"
        src={SRC}
        alt={ALT}
        width={SIZE}
        height={SIZE}
        fit="contain"
        {...props}
      />,
    );
  });
  return tree;
};

/** Фотография web-пути: единственный `<img>` с непустым `alt`. */
const mainImages = (tree: any): any[] =>
  tree.root.findAll(
    (node: any) =>
      node?.type === 'img' &&
      typeof node?.props?.alt === 'string' &&
      node.props.alt.length > 0,
    { deep: true },
  );

const fireImageError = (tree: any) => {
  const [img] = mainImages(tree);
  expect(img).toBeDefined();
  renderer.act(() => {
    img.props.onError();
  });
};

const fireImageLoad = (tree: any) => {
  const [img] = mainImages(tree);
  expect(img).toBeDefined();
  renderer.act(() => {
    img.props.onLoad();
  });
};

/** Внешний бокс компонента — по нему сверяется сохранённая геометрия. */
const container = (tree: any): any => {
  const [node] = tree.root.findAll(
    (item: any) => item?.props?.['data-testid'] === 'quest-media',
    { deep: true },
  );
  return node;
};

const flatStyle = (node: any): Record<string, any> =>
  Object.assign({}, ...[].concat(node.props.style).filter(Boolean));

const textNodes = (tree: any): any[] =>
  tree.root.findAll(
    (node: any) =>
      typeof node?.props?.children === 'string' &&
      node.props.children.trim().length > 0,
    { deep: true },
  );

describe('ImageCardMedia: сбой загрузки на web (#1212)', () => {
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

  it('пока картинка грузится, рисует её, а не плейсхолдер', () => {
    const tree = renderMedia();
    expect(mainImages(tree)).toHaveLength(1);
  });

  it('первый сбой не сдаётся: узел перемонтируется тем же URL', () => {
    const onError = jest.fn();
    const tree = renderMedia({ onError });
    const before = mainImages(tree)[0];
    // Читаем ДО сбоя: после ремоунта прежний узел размонтирован и его `props`
    // уже не прочитать.
    const srcBefore = before.props.src;

    fireImageError(tree);

    const after = mainImages(tree)[0];
    expect(after).toBeDefined();
    // Тот же URL — второй сетевой вариант на один слот запрещён (#1208).
    expect(after.props.src).toBe(srcBefore);
    // Узел именно новый: React пересоздаёт его по смене ключа, иначе браузер
    // не повторит запрос по неизменному `src`.
    expect(after).not.toBe(before);
    // Ретрай ещё не исчерпан — вызывающему рано говорить «картинки нет».
    expect(onError).not.toHaveBeenCalled();
  });

  it('успешный ретрай возвращает фотографию и не оставляет плейсхолдер', () => {
    const onError = jest.fn();
    const tree = renderMedia({ onError });

    fireImageError(tree);
    fireImageLoad(tree);

    expect(mainImages(tree)).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('второй сбой подряд убирает alt-текст из кадра', () => {
    const tree = renderMedia();

    fireImageError(tree);
    fireImageError(tree);

    // Ни одного узла с видимым alt: именно его рисовал браузер вместо фото.
    expect(mainImages(tree)).toHaveLength(0);
    // И никакого текста — плейсхолдер обязан быть нейтральным (AGENTS.md 4.2).
    expect(textNodes(tree)).toHaveLength(0);
  });

  it('плейсхолдер после сбоя сохраняет геометрию медиа', () => {
    const tree = renderMedia();
    const geometryBefore = flatStyle(container(tree));

    fireImageError(tree);
    fireImageError(tree);

    const geometryAfter = flatStyle(container(tree));
    expect(geometryAfter.width).toBe(SIZE);
    expect(geometryAfter.height).toBe(SIZE);
    expect(geometryAfter.width).toBe(geometryBefore.width);
    expect(geometryAfter.height).toBe(geometryBefore.height);
    expect(geometryAfter.borderRadius).toBe(geometryBefore.borderRadius);
  });

  it('вызывает onError вызывающего один раз — на терминальном сбое', () => {
    const onError = jest.fn();
    const tree = renderMedia({ onError });

    fireImageError(tree);
    fireImageError(tree);

    expect(onError).toHaveBeenCalledTimes(1);
  });

  /**
   * `loadedWebImageBaseCache` — общий на приложение Set загруженных
   * идентичностей. Если тот же файл уже загрузился в другой карточке, новая
   * стартует с `loaded=true` и `WebMainImage` рапортует загрузку СРАЗУ на
   * маунте — то есть раньше реального события `error`. Пока такой «загрузкой»
   * сбрасывался бюджет попыток, сбойная картинка уходила в бесконечный цикл
   * ремоунт → запрос → ошибка (по одному сетевому запросу на круг).
   */
  it('уже загруженная в другой карточке картинка всё равно сдаётся после ретрая', () => {
    const onError = jest.fn();
    const primed = renderMedia({ src: CACHED_SRC });
    fireImageLoad(primed);
    renderer.act(() => {
      primed.unmount();
    });

    const tree = renderMedia({ src: CACHED_SRC, onError });
    fireImageError(tree);
    fireImageError(tree);

    expect(mainImages(tree)).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('смена картинки сбрасывает состояние сбоя', () => {
    const tree = renderMedia();
    fireImageError(tree);
    fireImageError(tree);
    expect(mainImages(tree)).toHaveLength(0);

    renderer.act(() => {
      tree.update(
        <ImageCardMedia
          testID="quest-media"
          src={OTHER_SRC}
          alt={ALT}
          width={SIZE}
          height={SIZE}
          fit="contain"
        />,
      );
    });

    // Следующая карточка в переиспользованной ячейке обязана рендериться, а не
    // наследовать плейсхолдер предыдущей.
    expect(mainImages(tree)).toHaveLength(1);
  });
});

describe('ImageCardMedia: native отдаёт сбой владельцу ретрая (#802)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  /**
   * `OptimizedImage` зовёт `onError` на КАЖДОЙ попытке, включая те, которые сам
   * собирается ретраить. Если завести его ошибку на состояние `ImageCardMedia`,
   * первый транзиентный сбой снимет `OptimizedImage` с экрана до ретрая — это
   * возвращает дефект #802 («на Android нет ретрая → обложка застревает»).
   */
  /** `blurBackgroundRadius` получает только `OptimizedImage`. */
  const optimizedImages = (tree: any): any[] =>
    tree.root.findAll((node: any) => node?.props?.blurBackgroundRadius !== undefined, {
      deep: true,
    });

  it('не перехватывает ошибку OptimizedImage: он остаётся на экране и ретраит сам', () => {
    const onError = jest.fn();
    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <ImageCardMedia
          testID="native-media"
          src={SRC}
          alt={ALT}
          width={SIZE}
          height={SIZE}
          fit="contain"
          onError={onError}
        />,
      );
    });

    expect(optimizedImages(tree)).toHaveLength(1);

    renderer.act(() => {
      optimizedImages(tree)[0].props.onError();
    });

    // Ошибка ушла вызывающему...
    expect(onError).toHaveBeenCalledTimes(1);
    // ...а сам `OptimizedImage` остался смонтированным: иначе его собственные
    // попытки (`MAX_RETRY_ATTEMPTS`) оборвутся вместе с ним.
    expect(optimizedImages(tree)).toHaveLength(1);
  });
});
