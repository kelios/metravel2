import { ArticleConstructorService } from '@/src/services/pdf-export/constructor/ArticleConstructorService';
import type { PdfDocument, PdfPage } from '@/src/types/pdf-constructor';
import type { Travel } from '@/src/types/types';

// Мокаем зависимости конструктора

const mockGetDocument = jest.fn(() => createBaseDocument());
const mockLoadDocument = jest.fn((doc: PdfDocument) => {
  // no-op, поведение мокируется через jest
});

jest.mock('@/src/services/pdf-export/constructor/PdfDocumentBuilder', () => {
  return {
    PdfDocumentBuilder: jest.fn().mockImplementation(() => ({
      getDocument: mockGetDocument,
      loadDocument: mockLoadDocument,
    })),
  };
});

const mockRenderPage = jest.fn();

jest.mock('@/src/services/pdf-export/constructor/renderers/PageImageRenderer', () => {
  return {
    PageImageRenderer: jest.fn().mockImplementation(() => ({
      renderPage: mockRenderPage,
    })),
  };
});

const mockAssemblePdfWithPdfLib = jest.fn();

jest.mock('@/src/services/pdf-export/constructor/PdfAssembler', () => {
  return {
    PdfAssembler: jest.fn().mockImplementation(() => ({
      assemblePdfWithPdfLib: mockAssemblePdfWithPdfLib,
    })),
  };
});

const mockImport = jest.fn();

jest.mock('@/src/services/pdf-export/constructor/importers/ArticleImporter', () => {
  return {
    ArticleImporter: jest.fn().mockImplementation(() => ({
      import: mockImport,
    })),
  };
});

const mockGetTheme = jest.fn();
const mockGetDefaultTheme = jest.fn();

// ВАЖНО: путь должен совпадать с тем, что используется в ArticleConstructorService
jest.mock('@/src/services/pdf-export/constructor/themes/ThemeManager', () => ({
  themeManager: {
    getTheme: (...args: any[]) => mockGetTheme(...args),
    getDefaultTheme: (...args: any[]) => mockGetDefaultTheme(...args),
  },
}));

// simple helper to create a base document
const createBaseDocument = (overrides: Partial<PdfDocument> = {}): PdfDocument => ({
  id: 'doc-1',
  title: 'Test Document',
  pages: [],
  theme: {
    id: 'simple',
    name: 'Simple',
    colors: {
      primary: '#000',
      secondary: '#111',
      text: '#000',
      textSecondary: '#333',
      background: '#fff',
      surface: '#eee',
      accent: '#f60',
      border: '#ddd',
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
  },
  format: 'A4',
  orientation: 'portrait',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  // по умолчанию билдер возвращает пустой документ
  mockGetDocument.mockReturnValue(createBaseDocument());
});

describe('ArticleConstructorService', () => {
  it('createDocument initializes builder with title and format and returns document', () => {
    const service = new ArticleConstructorService();

    const doc = service.createDocument('My Title', 'A5');

    expect(mockGetDocument).toHaveBeenCalled();
    expect(doc.title).toBe('Test Document'); // берётся из createBaseDocument
  });

  it('importArticle uses themeManager and importer, then loads document into builder', () => {
    const service = new ArticleConstructorService();
    const travel: Travel = { id: 't1' } as any;

    const theme = { id: 'theme', name: 'Theme' } as any;
    mockGetTheme.mockReturnValue(theme);
    mockGetDefaultTheme.mockReturnValue(theme);

    const importedDoc = createBaseDocument({ id: 'imported-doc', title: 'Imported' });
    mockImport.mockReturnValue(importedDoc);

    const result = service.importArticle(travel, 'light');

    expect(mockGetTheme).toHaveBeenCalledWith('light');
    expect(mockImport).toHaveBeenCalledWith(travel, theme);
    expect(mockLoadDocument).toHaveBeenCalledWith(importedDoc);
    expect(result.id).toBe('doc-1'); // getDocument() возвращает createBaseDocument
  });

  it('exportToPdf renders pages and assembles pdf with correct filename and progress events', async () => {
    const pages: PdfPage[] = [
      {
        id: 'p1',
        pageNumber: 1,
        format: 'A4',
        orientation: 'portrait',
        blocks: [],
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      },
      {
        id: 'p2',
        pageNumber: 2,
        format: 'A4',
        orientation: 'portrait',
        blocks: [],
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      },
    ];

    const document = createBaseDocument({ title: 'Test Doc', pages });
    mockGetDocument.mockReturnValue(document);

    mockRenderPage.mockResolvedValue({ imageData: 'img' });
    mockAssemblePdfWithPdfLib.mockResolvedValue({
      blob: new Blob(),
      filename: 'test_doc_2020-01-01',
      size: 123,
    });

    const service = new ArticleConstructorService();
    const progressEvents: Array<{ p: number; m: string }> = [];

    const result = await service.exportToPdf({}, (p, m) => {
      progressEvents.push({ p, m });
    });

    expect(mockRenderPage).toHaveBeenCalledTimes(2);
    expect(mockAssemblePdfWithPdfLib).toHaveBeenCalledTimes(1);

    const [[renderedPages, filename]] = mockAssemblePdfWithPdfLib.mock.calls as any;
    expect(renderedPages).toHaveLength(2);
    expect(typeof filename).toBe('string');
    expect(filename.startsWith('test_doc_')).toBe(true);

    // Проверяем прогресс (важно что есть 0 и 100)
    expect(progressEvents.some((e) => e.p === 0)).toBe(true);
    expect(progressEvents.some((e) => e.p === 100 && e.m === 'Готово!')).toBe(true);

    expect(result.filename).toBe('test_doc_2020-01-01');
  });

  it('previewPage renders single page and returns imageData', async () => {
    const pages: PdfPage[] = [
      {
        id: 'preview-page',
        pageNumber: 1,
        format: 'A4',
        orientation: 'portrait',
        blocks: [],
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      },
    ];

    const document = createBaseDocument({ pages });
    mockGetDocument.mockReturnValue(document);

    mockRenderPage.mockResolvedValue({ imageData: 'preview-data' });

    const service = new ArticleConstructorService();
    const data = await service.previewPage('preview-page');

    expect(mockRenderPage).toHaveBeenCalledWith(pages[0], document.theme);
    expect(data).toBe('preview-data');
  });

  it('previewPage throws when page not found', async () => {
    const document = createBaseDocument({ pages: [] });
    mockGetDocument.mockReturnValue(document);

    const service = new ArticleConstructorService();

    await expect(service.previewPage('missing')).rejects.toThrow('Page not found');
  });

  it('saveDocument writes to localStorage and throws user-friendly error on failure', () => {
    const service = new ArticleConstructorService();
    const setItemMock = jest.fn();
    // простой in-memory localStorage мок
    (global as any).localStorage = {
      setItem: setItemMock,
      getItem: jest.fn(),
    };

    // успешный сценарий
    setItemMock.mockImplementationOnce(() => undefined);
    expect(() => service.saveDocument('key')).not.toThrow();

    // сценарий с ошибкой
    setItemMock.mockImplementationOnce(() => {
      throw new Error('failed');
    });

    expect(() => service.saveDocument('key')).toThrow('Не удалось сохранить документ');
  });

  it('loadDocument reads from localStorage and loads into builder, returns document or null', () => {
    const service = new ArticleConstructorService();
    const getItemMock = jest.fn();
    (global as any).localStorage = {
      setItem: jest.fn(),
      getItem: getItemMock,
    };

    const stored = createBaseDocument({ id: 'stored', title: 'Stored' });
    getItemMock.mockReturnValueOnce(JSON.stringify(stored));

    const loaded = service.loadDocument('key');
    expect(loaded).not.toBeNull();
    expect(loaded && loaded.id).toBe('stored');
    expect(mockLoadDocument).toHaveBeenCalled();

    // no data
    getItemMock.mockReturnValueOnce(null);
    const loadedNull = service.loadDocument('key');
    expect(loadedNull).toBeNull();
  });
});
