// __tests__/services/pdf-export/PdfExportService.test.ts
// ✅ ТЕСТЫ: Интеграционные тесты для PdfExportService

import { PdfExportService } from '@/src/services/pdf-export/PdfExportService';
import { Html2PdfRenderer } from '@/src/renderers/pdf/Html2PdfRenderer';
import { TravelDataTransformer } from '@/src/services/pdf-export/TravelDataTransformer';
import { ExportError, ExportErrorType, ExportStage } from '@/src/types/pdf-export';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { Platform } from 'react-native';

// Mock html2pdf
const mockHtml2PdfWorker = {
  set: jest.fn(function () {
    return mockHtml2PdfWorker;
  }),
  from: jest.fn(function () {
    return mockHtml2PdfWorker;
  }),
  save: jest.fn(() => Promise.resolve()),
  outputPdf: jest.fn(() => Promise.resolve(new Blob(['mock pdf'], { type: 'application/pdf' }))),
};

const mockHtml2Pdf = jest.fn(() => mockHtml2PdfWorker);

global.window = {
  html2pdf: mockHtml2Pdf as any,
} as any;

// Mock buildPhotoBookHTML
jest.mock('@/src/utils/pdfBookGenerator', () => ({
  buildPhotoBookHTML: jest.fn(() => Promise.resolve(`
    <!doctype html>
    <html>
    <head><style>.pdf-page { width: 210mm; }</style></head>
    <body>
      <section class="pdf-page cover-page">Cover</section>
      <section class="pdf-page travel-photo-page">Photo</section>
      <section class="pdf-page travel-text-page">Text</section>
    </body>
    </html>
  `)),
}));

// Mock ImageLoader
jest.mock('@/src/infrastructure/image/ImageLoader', () => ({
  ImageLoader: jest.fn().mockImplementation(() => ({
    loadImagesFromContainer: jest.fn(() => Promise.resolve()),
    clearCache: jest.fn(),
  })),
}));

describe('PdfExportService', () => {
  let service: PdfExportService;
  let renderer: Html2PdfRenderer;
  let mockTravels: Travel[];

  beforeEach(() => {
    (Platform as any).OS = 'web';
    renderer = new Html2PdfRenderer();
    service = new PdfExportService(renderer);
    
    mockTravels = [
      {
        id: 1,
        name: 'Test Travel',
        slug: 'test',
        url: 'test',
        youtube_link: '',
        userName: 'user',
        description: 'Description',
        recommendation: 'Recommendation',
        plus: 'Plus',
        minus: 'Minus',
        cityName: 'City',
        countryName: 'Country',
        countUnicIpView: '',
        gallery: ['https://example.com/img.jpg'],
        travelAddress: [],
        userIds: '',
        year: '2024',
        monthName: 'January',
        number_days: 5,
        companions: [],
        countryCode: '',
      },
    ];

    // Mock document.createElement
    global.document = {
      createElement: jest.fn((tag: string) => {
        const element = {
          tagName: tag.toUpperCase(),
          style: {} as any,
          innerHTML: '',
          textContent: '',
          children: [],
          parentNode: null,
          appendChild: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          scrollWidth: 794,
          scrollHeight: 1123,
          offsetWidth: 794,
          offsetHeight: 1123,
          offsetHeight: 1123,
        } as any;
        return element;
      }),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      } as any,
      head: {
        appendChild: jest.fn(),
      } as any,
    } as any;

    // Mock DOMParser
    global.DOMParser = jest.fn().mockImplementation(() => ({
      parseFromString: jest.fn(() => ({
        body: { innerHTML: '<section>Test</section>' },
        head: { querySelectorAll: jest.fn(() => []) },
      })),
    })) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('export', () => {
    const settings: BookSettings = {
      title: 'Test Book',
      subtitle: '',
      coverType: 'auto',
      template: 'classic',
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
    };

    it('должен успешно экспортировать PDF', async () => {
      const result = await service.export(mockTravels, settings);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toContain('Test_Book');
      expect(result.size).toBeGreaterThan(0);
    });

    it('должен вызвать progress callback', async () => {
      const progressCallback = jest.fn();
      
      await service.export(mockTravels, settings, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      const calls = progressCallback.mock.calls;
      
      // Проверяем, что были вызовы для разных этапов
      const stages = calls.map(call => call[0].stage);
      expect(stages).toContain(ExportStage.VALIDATING);
      expect(stages).toContain(ExportStage.TRANSFORMING);
      expect(stages).toContain(ExportStage.GENERATING_HTML);
      expect(stages).toContain(ExportStage.LOADING_IMAGES);
      expect(stages).toContain(ExportStage.RENDERING);
      expect(stages).toContain(ExportStage.COMPLETE);
    });

    it('должен обновлять прогресс от 0 до 100', async () => {
      const progressValues: number[] = [];
      const progressCallback = (progress: any) => {
        progressValues.push(progress.progress);
      };
      
      await service.export(mockTravels, settings, progressCallback);

      expect(progressValues.length).toBeGreaterThan(0);
      expect(Math.min(...progressValues)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...progressValues)).toBeLessThanOrEqual(100);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('должен выбросить ошибку для пустого массива', async () => {
      await expect(service.export([], settings)).rejects.toThrow(ExportError);
      await expect(service.export([], settings)).rejects.toThrow('Необходимо выбрать');
    });

    it('должен выбросить ошибку для невалидных данных', async () => {
      const invalidTravels = [{ name: 'Test' }] as any[];
      
      await expect(service.export(invalidTravels, settings)).rejects.toThrow(ExportError);
    });
  });

  describe('preview', () => {
    const settings: BookSettings = {
      title: 'Test Book',
      subtitle: '',
      coverType: 'auto',
      template: 'classic',
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
    };

    it('должен успешно создать превью', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.fetch = jest.fn(() => 
        Promise.resolve({
          blob: () => Promise.resolve(new Blob(['mock'], { type: 'application/pdf' })),
        } as any)
      );

      const result = await service.preview(mockTravels, settings);

      expect(result).toBeDefined();
      expect(result.blobUrl).toBe('blob:mock-url');
      expect(result.size).toBeGreaterThan(0);
    });

    it('должен вызвать progress callback для превью', async () => {
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.fetch = jest.fn(() => 
        Promise.resolve({
          blob: () => Promise.resolve(new Blob(['mock'], { type: 'application/pdf' })),
        } as any)
      );

      const progressCallback = jest.fn();
      
      await service.preview(mockTravels, settings, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('subscribeToProgress', () => {
    it('должен позволить подписаться на прогресс', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribeToProgress(callback);

      expect(typeof unsubscribe).toBe('function');
      
      // Вызываем отписку
      unsubscribe();
    });
  });
});

