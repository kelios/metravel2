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
jest.resetModules();
jest.doMock('react-native', () => jest.requireActual('react-native-web'));
const { act } = require('react');
const { createRoot } = require('react-dom/client');
const renderer = require('test-renderer');
const { Platform } = require('react-native');
const mockWebImageProps = jest.fn();
const mockOptimizedInstances = new Map<object, Record<string, any>>();
jest.doMock('@/components/ui/ImageCardMediaWebHelpers', () => {
  const actual = jest.requireActual('@/components/ui/ImageCardMediaWebHelpers');
  const React = require('react');
  return { ...actual, WebMainImage: (props: Record<string, unknown>) => {
    mockWebImageProps(props);
    return React.createElement(actual.WebMainImage, props);
  } };
});
jest.doMock('@/components/ui/OptimizedImage', () => {
  const actual = jest.requireActual('@/components/ui/OptimizedImage');
  const React = require('react');
  return { ...actual, __esModule: true, default: function MockOptimizedImage(props: Record<string, unknown>) {
    const identity = React.useRef({});
    mockOptimizedInstances.set(identity.current, props);
    React.useEffect(() => () => { mockOptimizedInstances.delete(identity.current); }, []);
    return React.createElement(actual.default, props);
  } };
});
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');
type DOMRoot = import('react-dom/client').Root;
const hosts = new Map<DOMRoot, HTMLDivElement>();
const roots = new Set<import('test-renderer').Root>();
afterEach(async () => {
  for (const [root, host] of hosts) {
    await act(() => root.unmount());
    host.remove();
  }
  hosts.clear();
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
});

const SRC = 'https://metravel.by/quest-cover/quests/2/main/bff051ad.webp';
const OTHER_SRC = 'https://metravel.by/quest-cover/quests/3/main/aa11bb22.webp';
/** Отдельный URL: этот тест намеренно греет общий кэш загруженных картинок. */
const CACHED_SRC = 'https://metravel.by/quest-cover/quests/4/main/cc33dd44.webp';
const ALT = 'Обложка квеста Парк Прокоцим';
const SIZE = 132;

const renderMedia = async (props: Record<string, unknown> = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const tree: DOMRoot = createRoot(host);
  hosts.set(tree, host);
  await act(() => tree.render(<ImageCardMedia
    testID="quest-media" src={SRC} alt={ALT} width={SIZE} height={SIZE} fit="contain" {...props}
  />));
  return tree;
};

/** Фотография web-пути: единственный `<img>` с непустым `alt`. */
const mainImages = (tree: DOMRoot): HTMLImageElement[] =>
  Array.from(hosts.get(tree)!.querySelectorAll<HTMLImageElement>('img[alt]')).filter(image => image.alt.length > 0);

const fireImageError = async (tree: any) => {
  const [img] = mainImages(tree);
  expect(img).toBeDefined();
  await act(() => {
    img.dispatchEvent(new Event('error'));
  });
};

/**
 * Настоящая загрузка приходит с размерами кадра. Догадка по общему кэшу
 * (`loadedWebImageBaseCache`) размеров не несёт — на этом и держится защита от
 * бесконечного ретрая, поэтому фейковая загрузка эмулируется отдельно.
 */
const fireImageLoad = async (tree: DOMRoot) => {
  const [image] = mainImages(tree);
  expect(image).toBeDefined();
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 800 },
    naturalHeight: { configurable: true, value: 533 },
    currentSrc: { configurable: true, value: image.srcset.split(',')[0].trim().split(/\s+/)[0] || image.src },
  });
  await act(() => { image.dispatchEvent(new Event('load')); });
};

// A public child callback without decoded dimensions is only a cache guess.
const fireCacheGuessLoad = async (_tree: DOMRoot) => {
  const props = mockWebImageProps.mock.calls.at(-1)![0];
  await act(() => { props.onLoad(props.src); });
};

/** Пропускает паузу перед ретраем (600–1200 мс) на фейковых таймерах. */
const runRetryDelay = async () => {
  await act(() => {
    jest.advanceTimersByTime(1500);
  });
};

/** Внешний бокс компонента — по нему сверяется сохранённая геометрия. */
const container = (tree: DOMRoot): HTMLElement =>
  hosts.get(tree)!.querySelector<HTMLElement>('[data-testid="quest-media"]')!;
const flatStyle = (node: HTMLElement) => ({
  width: parseFloat(node.style.width), height: parseFloat(node.style.height), borderRadius: node.style.borderRadius,
});
const textNodes = (tree: DOMRoot): Element[] =>
  Array.from(hosts.get(tree)!.querySelectorAll('*')).filter(node => node.children.length === 0 && node.textContent!.trim().length > 0);

describe('ImageCardMedia: сбой загрузки на web (#1212)', () => {
  const originalPlatform = Platform.OS;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    Platform.OS = 'web';
    // Разметку web-слоёв компонент рисует только вне jest-ветки.
    delete process.env.JEST_WORKER_ID;
    mockWebImageProps.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalPlatform;
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  it('пока картинка грузится, рисует её, а не плейсхолдер', async () => {
    const tree = await renderMedia();
    expect(mainImages(tree)).toHaveLength(1);
  });

  /**
   * Замер прода 2026-08-02 `/quests`: 8 обложек одной пачкой → 6 × HTTP 503, те
   * же 8 URL через 900 мс последовательно → 8 × 200. Мгновенный ретрай попадает
   * в то же окно rate-limit'а, поэтому между попытками обязана быть пауза, а
   * узел на это время снят — иначе в кадре снова alt-текст.
   */
  it('первый сбой снимает узел и ждёт паузу, а не бьёт повторно сразу', async () => {
    const onError = jest.fn();
    const tree = await renderMedia({ onError });

    await fireImageError(tree);

    expect(mainImages(tree)).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it('после паузы повторяет запрос ТЕМ ЖЕ URL новым узлом', async () => {
    const onError = jest.fn();
    const tree = await renderMedia({ onError });
    const srcBefore = mainImages(tree)[0].src;

    await fireImageError(tree);
    await runRetryDelay();

    const after = mainImages(tree)[0];
    expect(after).toBeDefined();
    // Тот же URL — второй сетевой вариант на один слот запрещён (#1208).
    expect(after.src).toBe(srcBefore);
    // Ретрай ещё не исчерпан — вызывающему рано говорить «картинки нет».
    expect(onError).not.toHaveBeenCalled();
  });

  it('успешный ретрай возвращает фотографию и не оставляет плейсхолдер', async () => {
    const onError = jest.fn();
    const tree = await renderMedia({ onError });

    await fireImageError(tree);
    await runRetryDelay();
    await fireImageLoad(tree);

    expect(mainImages(tree)).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('второй сбой подряд убирает alt-текст из кадра', async () => {
    const tree = await renderMedia();

    await fireImageError(tree);
    await runRetryDelay();
    await fireImageError(tree);

    // Ни одного узла с видимым alt: именно его рисовал браузер вместо фото.
    expect(mainImages(tree)).toHaveLength(0);
    // И никакого текста — плейсхолдер обязан быть нейтральным (AGENTS.md 4.2).
    expect(textNodes(tree)).toHaveLength(0);
  });

  it('плейсхолдер после сбоя сохраняет геометрию медиа', async () => {
    const tree = await renderMedia();
    const geometryBefore = flatStyle(container(tree));

    await fireImageError(tree);
    await runRetryDelay();
    await fireImageError(tree);

    const geometryAfter = flatStyle(container(tree));
    expect(geometryAfter.width).toBe(SIZE);
    expect(geometryAfter.height).toBe(SIZE);
    expect(geometryAfter.width).toBe(geometryBefore.width);
    expect(geometryAfter.height).toBe(geometryBefore.height);
    expect(geometryAfter.borderRadius).toBe(geometryBefore.borderRadius);
  });

  it('вызывает onError вызывающего один раз — на терминальном сбое', async () => {
    const onError = jest.fn();
    const tree = await renderMedia({ onError });

    await fireImageError(tree);
    await runRetryDelay();
    await fireImageError(tree);

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
  it('уже загруженная в другой карточке картинка всё равно сдаётся после ретрая', async () => {
    const onError = jest.fn();
    const primed = await renderMedia({ src: CACHED_SRC });
    await fireImageLoad(primed);
    await act(() => {
      primed.unmount();
    });

    const tree = await renderMedia({ src: CACHED_SRC, onError });
    // Догадка по общему кэшу: «загрузка» без размеров кадра приходит РАНЬШЕ
    // реальной ошибки и не должна возвращать бюджет попыток.
    await fireCacheGuessLoad(tree);
    await fireImageError(tree);
    await runRetryDelay();
    await fireCacheGuessLoad(tree);
    await fireImageError(tree);

    expect(mainImages(tree)).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('смена картинки сбрасывает состояние сбоя', async () => {
    const tree = await renderMedia();
    await fireImageError(tree);
    await runRetryDelay();
    await fireImageError(tree);
    expect(mainImages(tree)).toHaveLength(0);

    await act(() => {
      tree.render(
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
  // Observe the real OptimizedImage boundary; blurBackgroundRadius is not a host prop.
  const optimizedImages = () => [...mockOptimizedInstances.values()];

  it('не перехватывает ошибку OptimizedImage: он остаётся на экране и ретраит сам', async () => {
    const onError = jest.fn();
    let tree: any;
    await act(() => {
      tree = renderer.createRoot();
      roots.add(tree)
      tree.render(<ImageCardMedia
          testID="native-media"
          src={SRC}
          alt={ALT}
          width={SIZE}
          height={SIZE}
          fit="contain"
          onError={onError}
        />)
    });

    expect(optimizedImages()).toHaveLength(1);

    await act(() => {
      optimizedImages()[0].onError();
    });

    // Ошибка ушла вызывающему...
    expect(onError).toHaveBeenCalledTimes(1);
    // ...а сам `OptimizedImage` остался смонтированным: иначе его собственные
    // попытки (`MAX_RETRY_ATTEMPTS`) оборвутся вместе с ним.
    expect(optimizedImages()).toHaveLength(1);
  });
});
