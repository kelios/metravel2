import { PageImageRenderer } from '@/src/services/pdf-export/constructor/renderers/PageImageRenderer';
import type { PdfPage, PdfTheme } from '@/src/types/pdf-constructor';

// Happy-path тест для PageImageRenderer.renderPage с простым paragraph-блоком.
// Canvas / FileReader / toBlob замоканы, чтобы не требовать реального браузерного окружения.

describe('PageImageRenderer (happy path)', () => {
  const createTheme = (): PdfTheme => ({
    id: 'simple',
    name: 'Simple',
    colors: {
      primary: '#ff9f5a',
      secondary: '#6b7280',
      text: '#111827',
      textSecondary: '#6b7280',
      background: '#ffffff',
      surface: '#f9fafb',
      accent: '#ff9f5a',
      border: '#e5e7eb',
      tipBlock: { background: '#f0fdf4', border: '#22c55e', text: '#166534' },
      importantBlock: { background: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
      warningBlock: { background: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingSizes: { h1: 32, h2: 24, h3: 20 },
      bodySize: 14,
      lineHeight: 1.6,
    },
    spacing: {
      pagePadding: 20,
      blockSpacing: 16,
      elementSpacing: 8,
    },
    blocks: {
      borderRadius: 8,
      borderWidth: 1,
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
  });

  const createSimplePage = (): PdfPage => ({
    id: 'page-1',
    pageNumber: 1,
    format: 'A4',
    orientation: 'portrait',
    background: { color: '#ffffff' },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    blocks: [
      {
        id: 'block-1',
        type: 'paragraph',
        position: { x: 10, y: 20, width: 100, height: 20, unit: 'mm' },
        styles: { fontSize: 14, lineHeight: 1.6, color: '#111827' },
        content: 'Простой текст параграфа для рендера.',
      } as any,
    ],
  });

  let originalCreateElement: any;

  beforeAll(() => {
    originalCreateElement = global.document.createElement;
  });

  afterAll(() => {
    global.document.createElement = originalCreateElement;
  });

  it('renderPage returns RenderedPage with imageData and expected dimensions', async () => {
    const theme = createTheme();
    const page = createSimplePage();

    // Мокаем canvas и контекст
    const fillRect = jest.fn();
    const fillText = jest.fn();
    const measureText = jest.fn().mockReturnValue({ width: 10 });

    const mockCtx: Partial<CanvasRenderingContext2D> = {
      fillRect,
      fillText,
      measureText: measureText as any,
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
    };

    const mockCanvas: any = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockCtx),
    };

    (global.document as any).createElement = jest.fn(() => mockCanvas);

    // Подменяем приватный canvasToImage, чтобы не зависеть от FileReader/toBlob
    const imageData = 'data:image/png;base64,TEST';
    const canvasToImageSpy = jest
      .spyOn(PageImageRenderer.prototype as any, 'canvasToImage')
      .mockResolvedValue(imageData);

    const renderer = new PageImageRenderer({ dpi: 96, imageFormat: 'png' });

    const rendered = await renderer.renderPage(page, theme);

    expect(rendered.pageId).toBe('page-1');
    expect(rendered.pageNumber).toBe(1);
    expect(rendered.imageData).toBe(imageData);

    // При 96 DPI и формате A4 ожидаем ненулевые размеры
    expect(rendered.width).toBeGreaterThan(0);
    expect(rendered.height).toBeGreaterThan(0);

    // Убедимся, что фон страницы отрисован
    expect(fillRect).toHaveBeenCalled();

    // И что текст параграфа попытались вывести на canvas
    expect(fillText).toHaveBeenCalledWith(
      expect.stringContaining('Простой текст'),
      expect.any(Number),
      expect.any(Number),
    );

    canvasToImageSpy.mockRestore();
  });
});
