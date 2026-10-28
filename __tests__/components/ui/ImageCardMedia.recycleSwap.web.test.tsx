/**
 * @jest-environment jsdom
 *
 * Ячейка FlashList остаётся смонтированной, но каждый новый источник получает
 * собственный `<img>`. Он не наследует чужие пиксели и показывает свои готовые
 * пиксели средствами браузера, без ожидания JS-гейта раскрытия (#2705).
 */
jest.resetModules();
jest.doMock('react-native', () => jest.requireActual('react-native-web'));
const { act } = require('react');
const { createRoot } = require('react-dom/client');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const SRC_A = 'https://metravel.by/travel-image/682/conversions/aaa.webp';
const SRC_B = 'https://metravel.by/travel-image/683/conversions/bbb.webp';
const COLOR = '#7b7e78';

const findMainImage = (host: HTMLDivElement): HTMLImageElement => {
  const images = host.querySelectorAll<HTMLImageElement>('img:not([aria-hidden="true"])');
  expect(images).toHaveLength(1);
  return images[0];
};

/** Настоящее событие `load`: пиксели у DOM-узла появились. */
const fireLoad = async (host: HTMLDivElement, image: HTMLImageElement) => {
  Object.defineProperties(image, {
    currentSrc: { configurable: true, value: image.srcset.split(',')[0].trim().split(/\s+/)[0] || image.src },
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 800 },
    naturalHeight: { configurable: true, value: 600 },
  });
  expect(image).toBe(findMainImage(host));
  await act(() => { image.dispatchEvent(new Event('load')); });
};

describe('ImageCardMedia: подмена картинки в рециклируемой ячейке (web)', () => {
  const originalPlatform = Platform.OS;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;
  let host: HTMLDivElement;
  let root: import('react-dom/client').Root;

  beforeEach(() => {
    Platform.OS = 'web';
    // Разметку web-слоёв компонент рисует только вне jest-ветки.
    delete process.env.JEST_WORKER_ID;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    Platform.OS = originalPlatform;
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
    else delete process.env.JEST_WORKER_ID;
  });

  const renderMedia = async () => {
    const nodes: HTMLImageElement[] = [];
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
    const rerender = async (src: string) => {
      await act(() => root.render(element(src)));
      const image = findMainImage(host);
      if (!nodes.includes(image)) nodes.push(image);
    };
    await rerender(SRC_A);
    return { nodes, rerender };
  };

  it('меняет native img при смене фото и оставляет показ собственных пикселей браузеру', async () => {
    const { nodes, rerender } = await renderMedia();

    await fireLoad(host, nodes[0]);
    expect(findMainImage(host).style.opacity).toBe('1');

    await rerender(SRC_B);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].isConnected).toBe(false);
    expect(findMainImage(host).src).toContain('bbb.webp');
    expect(nodes[1].currentSrc).toBe('');
    expect(findMainImage(host).style.opacity).toBe('1');

    await fireLoad(host, nodes[1]);
    expect(findMainImage(host).style.opacity).toBe('1');
    await rerender(SRC_A);
    expect(nodes).toHaveLength(3);
    expect(nodes[1].isConnected).toBe(false);
    expect(findMainImage(host).style.opacity).toBe('1');
  });

  it('оставляет заливку из данных под ещё не загруженной картинкой', async () => {
    const { nodes, rerender } = await renderMedia();
    await fireLoad(host, nodes[0]);
    await rerender(SRC_B);
    expect(host.querySelector('[data-testid="card-media-data-placeholder"]')).not.toBeNull();
  });

  it('не гасит слой, когда меняются только параметры оптимизации того же файла', async () => {
    const { nodes, rerender } = await renderMedia();
    await fireLoad(host, nodes[0]);
    await rerender(`${SRC_A}?w=640&q=60`);
    expect(nodes).toHaveLength(1);
    expect(findMainImage(host).style.opacity).toBe('1');
  });
});
