/**
 * @jest-environment jsdom
 *
 * #3426: `<link rel="prefetch" as="image">` Chromium отправляет с `Accept`
 * документа, а медиа-маршруты отвечают с `Vary: Accept`, поэтому `<img>` не
 * берёт ответ подсказки из кэша и качает файл второй раз (замер #3420).
 * ImageCardMedia не ставит такую подсказку ни при каких пропсах — в том числе
 * для ленивой низкоприоритетной картинки своего origin, ради которой ветка
 * подсказки существовала.
 */
const { act } = require('react');
const renderer = require('test-renderer');
const { Platform } = require('react-native');
const { default: ImageCardMedia } = require('@/components/ui/ImageCardMedia');

const roots = new Set<import('test-renderer').Root>();
afterEach(async () => {
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
});

const headImageHints = () =>
  document.head.querySelectorAll('link[rel="prefetch"], link[rel="preload"][as="image"]');

describe('ImageCardMedia: без head-подсказок картинки на web (#3426)', () => {
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

  it('ленивая low-картинка своего origin не добавляет <link rel=prefetch>', async () => {
    const legacyProps: Record<string, unknown> = { prefetch: true };
    await act(() => {
      const root = renderer.createRoot();
      roots.add(root);
      root.render(
        <ImageCardMedia
          src={`${window.location.origin}/media-resize/legacy/682/conversions/slide.webp`}
          width={408}
          height={272}
          loading="lazy"
          priority="low"
          {...legacyProps}
        />,
      );
    });

    expect(headImageHints()).toHaveLength(0);
  });
});
