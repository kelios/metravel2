/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://metravel.by/"}
 */

import { render, waitFor } from '@testing-library/react';

let StableContent: (typeof import('@/components/travel/StableContent.web'))['default'];

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    primary: '#0a84ff',
    focus: '#ff00ff',
    surfaceMuted: '#f7f7f7',
    borderLight: '#e5e7eb',
    backgroundSecondary: '#fafafa',
    mutedBackground: '#f3f4f6',
    boxShadows: {
      card: '0 8px 24px rgba(0, 0, 0, 0.08)',
      light: '0 4px 14px rgba(0, 0, 0, 0.06)',
    },
  }),
}));

jest.mock('@/components/travel/FullscreenGallery', () => ({
  __esModule: true,
  default: require('@/components/travel/FullscreenGallery.web').default,
}));

// Заглушка обязана донести LETTERBOX_FILL_ALPHA: useWebEffects берёт альфу оттуда,
// чтобы заливка полей в теле статьи и в ImageCardMedia не разъезжались.
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  LETTERBOX_FILL_ALPHA: 0.75,
}));

/**
 * #1233: поля letterbox под `contain`-фото закрывает доминантный цвет кадра, а не
 * нейтральная заливка темы.
 *
 * Проверяем именно рантайм-ветку: CSS-контракт (`webStyles.letterboxFill.test.ts`)
 * держит переменную в правилах, но первая версия правки доехала до прода мёртвой —
 * заливка пропускала ячейки `.img-jrow`, а под них уходит КАЖДЫЙ абзац-картинка,
 * включая одиночный. Тест на стилях этого не ловил.
 */
describe('rich image letterbox fill runtime (#1233)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  const stubCanvas = (pixel: number[] | Error) => {
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage: () => undefined,
      getImageData: () => {
        if (pixel instanceof Error) throw pixel;
        return { data: pixel };
      },
    })) as unknown as typeof originalGetContext;
  };

  const markLoaded = (img: HTMLImageElement, width = 1200, height = 1600) => {
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  };

  // Одиночный абзац-картинка — самый частый случай в теле статьи. groupConsecutiveImages
  // всё равно заворачивает его в `.img-jrow`, поэтому это и есть основной путь заливки.
  const LONE_PORTRAIT =
    '<p>Текст до фото.</p><p><img src="https://metravel.by/media-resize/uploads/portrait.jpg" /></p><p>Текст после.</p>';

  beforeAll(async () => {
    StableContent = (await import('@/components/travel/StableContent.web')).default;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    const existing = document.getElementById('travel-rich-text-styles');
    if (existing?.parentNode) existing.parentNode.removeChild(existing);
  });

  const renderAndLoadImage = async (html: string) => {
    const { container } = render(<StableContent html={html} contentWidth={700} />);
    await waitFor(() => {
      expect(container.querySelector('.travel-rich-text img')).toBeTruthy();
    });
    const img = container.querySelector('.travel-rich-text img') as HTMLImageElement;
    markLoaded(img);
    img.dispatchEvent(new Event('load'));
    return { container, img };
  };

  it('paints the frame of a lone body photo, which lives inside a justified row', async () => {
    stubCanvas([10, 20, 30, 255]);
    const { img } = await renderAndLoadImage(LONE_PORTRAIT);

    expect(img.closest('.img-jrow')).toBeTruthy();
    const frame = img.closest('.rich-image-frame') as HTMLElement;
    expect(frame).toBeTruthy();
    expect(frame.style.getPropertyValue('--travel-rich-image-fill')).toBe('rgba(10, 20, 30, 0.75)');
  });

  it('leaves the frame on the neutral surface when the canvas is tainted', async () => {
    stubCanvas(new DOMException('Tainted canvas', 'SecurityError'));
    const { img } = await renderAndLoadImage(LONE_PORTRAIT);

    const frame = img.closest('.rich-image-frame') as HTMLElement;
    expect(frame.style.getPropertyValue('--travel-rich-image-fill')).toBe('');
  });

  // Полностью прозрачный кадр усредняется в чёрный — это не его цвет, и подставлять
  // чёрные поля под прозрачный PNG нельзя.
  it('does not treat a fully transparent frame as black', async () => {
    stubCanvas([0, 0, 0, 0]);
    const { img } = await renderAndLoadImage(LONE_PORTRAIT);

    const frame = img.closest('.rich-image-frame') as HTMLElement;
    expect(frame.style.getPropertyValue('--travel-rich-image-fill')).toBe('');
  });
});
