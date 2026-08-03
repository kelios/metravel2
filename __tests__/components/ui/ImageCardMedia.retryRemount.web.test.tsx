/**
 * @jest-environment jsdom
 *
 * #1212, находка приёмки 2026-08-03. Ретрай чинил битую картинку, но стоил
 * лишнего сетевого запроса: замер прода в transient-режиме (первый ответ
 * оборван, дальше сеть исправна) дал на каждую обложку главной
 * `ABORT → PASS(3899 мс) → PASS(4524 мс)` — три попытки одним и тем же
 * `?w=320&q=60&fit=contain`, и на desktop 1280@2x, и на mobile 390@3x.
 *
 * Третью давал возврат ключа узла: успех снимал состояние сбоя, суффикс
 * `-retry` исчезал, React выбрасывал только что загруженный `<img>` и монтировал
 * новый. Инвариант — ремоунт ровно один на идентичность картинки.
 *
 * Отдельный файл, а не соседний `ImageCardMedia.loadError.web.test.tsx`: там
 * `WebMainImage` настоящий, а он берёт размеры кадра из DOM-узла, которого в
 * jsdom нет (`naturalWidth` всегда 0). Настоящая загрузка «с пикселями» —
 * единственное, что сбрасывает состояние сбоя, поэтому здесь `WebMainImage`
 * заменён заглушкой, отдающей `onLoad` наружу вместе с размерами.
 */
const renderer = require('react-test-renderer');
const { Platform } = require('react-native');

/** Каждое монтирование web-узла = один сетевой запрос браузера. */
const mockWebImageMounts: string[] = [];

jest.mock('@/components/ui/ImageCardMediaWebHelpers', () => {
  const actual = jest.requireActual('@/components/ui/ImageCardMediaWebHelpers');
  const React = require('react');
  return {
    ...actual,
    WebMainImage: (props: any) => {
      // Пустые зависимости здесь и есть смысл счётчика: считаем МОНТИРОВАНИЯ,
      // а не смены `src` — смена URL живого узла сетевого ремоунта не даёт.
      React.useEffect(() => {
        mockWebImageMounts.push(String(props?.src ?? ''));
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return React.createElement('img', {
        alt: props?.alt,
        src: props?.src,
        onLoad: props?.onLoad,
        onError: props?.onError,
      });
    },
  };
});

const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const SRC = 'https://metravel.by/quest-cover/quests/2/main/bff051ad.webp';
const ALT = 'Обложка квеста Парк Прокоцим';
const SIZE = 132;

const mainImages = (tree: any): any[] =>
  tree.root.findAll(
    (node: any) =>
      node?.type === 'img' &&
      typeof node?.props?.alt === 'string' &&
      node.props.alt.length > 0,
    { deep: true },
  );

describe('ImageCardMedia: ретрай не тянет третий запрос (#1212)', () => {
  const originalPlatform = Platform.OS;
  const originalJestWorkerId = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    Platform.OS = 'web';
    // Web-слои компонент рисует только вне jest-ветки.
    delete process.env.JEST_WORKER_ID;
    jest.useFakeTimers();
    mockWebImageMounts.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalPlatform;
    if (originalJestWorkerId) process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  it('успешный ретрай оставляет узел на месте: ровно два монтирования', () => {
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
        />,
      );
    });
    expect(mockWebImageMounts).toHaveLength(1);

    renderer.act(() => {
      mainImages(tree)[0].props.onError();
    });
    renderer.act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockWebImageMounts).toHaveLength(2);

    // Настоящая загрузка: размеры кадра снимают состояние сбоя.
    renderer.act(() => {
      mainImages(tree)[0].props.onLoad(SRC, { width: 800, height: 533 });
    });

    expect(mockWebImageMounts).toHaveLength(2);
    // И фотография осталась в кадре, а не сменилась плейсхолдером.
    expect(mainImages(tree)).toHaveLength(1);
  });
});
