import { PdfAssembler } from '@/src/services/pdf-export/constructor/PdfAssembler';
import type { RenderedPage } from '@/src/types/pdf-constructor';

// Happy-path тест для PdfAssembler.assemblePdfWithPdfLib
// Мокаем pdf-lib и atob, чтобы не зависеть от реальной реализации.

jest.mock('pdf-lib', () => {
  const addPageMock = jest.fn();
  const embedPngMock = jest.fn();
  const embedJpgMock = jest.fn();
  const drawImageMock = jest.fn();

  const pdfPageMock = {
    drawImage: drawImageMock,
  } as any;

  addPageMock.mockReturnValue(pdfPageMock);

  const pdfDocMock = {
    embedPng: embedPngMock,
    embedJpg: embedJpgMock,
    addPage: addPageMock,
    save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  } as any;

  return {
    PDFDocument: {
      create: jest.fn().mockResolvedValue(pdfDocMock),
    },
  };
});

// Простейшая реализация atob для base64 -> string
const originalAtob = (global as any).atob;
beforeAll(() => {
  (global as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
});

afterAll(() => {
  (global as any).atob = originalAtob;
});

const createPages = (): RenderedPage[] => [
  {
    pageId: 'p2',
    pageNumber: 2,
    width: 200,
    height: 400,
    imageData: 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64'),
  },
  {
    pageId: 'p1',
    pageNumber: 1,
    width: 100,
    height: 200,
    imageData: 'data:image/jpeg;base64,' + Buffer.from('JPEGDATA').toString('base64'),
  },
];

describe('PdfAssembler.assemblePdfWithPdfLib', () => {
  it('assembles pdf from rendered pages using pdf-lib and returns PdfExportResult', async () => {
    const assembler = new PdfAssembler({ dpi: 100, imageFormat: 'png' });
    const pages = createPages();

    const result = await assembler.assemblePdfWithPdfLib(pages, 'my_export');

    // filename должен иметь .pdf
    expect(result.filename).toBe('my_export.pdf');
    // страницы сортируются по pageNumber
    expect(result.pagesCount).toBe(2);
    expect(result.renderedPages.map(p => p.pageId)).toEqual(['p1', 'p2']);
    // blob должен быть не пустым
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.size).toBe(result.blob.size);
  });

  it('throws error when no pages provided', async () => {
    const assembler = new PdfAssembler();
    await expect(assembler.assemblePdfWithPdfLib([], 'empty')).rejects.toThrow('No pages to assemble');
  });
});
