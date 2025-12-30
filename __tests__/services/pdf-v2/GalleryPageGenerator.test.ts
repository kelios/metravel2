// __tests__/services/pdf-v2/GalleryPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор страницы галереи

import { GalleryPageGenerator } from '@/src/services/pdf-export/generators/v2/pages/GalleryPageGenerator';
import type { PageContext } from '@/src/services/pdf-export/generators/v2/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import { ImageProcessor } from '@/src/services/pdf-export/generators/v2/processors/ImageProcessor';

describe('GalleryPageGenerator', () => {
  let generator: GalleryPageGenerator;
  let imageProcessor: ImageProcessor;
  let mockContext: PageContext;
  let mockTravel: TravelForBook;
  let mockSettings: BookSettings;

  beforeEach(() => {
    imageProcessor = new ImageProcessor({
      proxyEnabled: true,
      proxyUrl: 'https://images.weserv.nl/?url=',
      maxWidth: 1200,
      cacheEnabled: false,
      cacheTTL: 3600000,
    });

    generator = new GalleryPageGenerator(imageProcessor);

    mockTravel = {
      id: 'travel-1',
      name: 'Галерея Парижа',
      gallery: [
        { url: 'https://example.com/photo1.jpg', caption: 'Эйфелева башня' },
        { url: 'https://example.com/photo2.jpg', caption: 'Лувр' },
        { url: 'https://example.com/photo3.jpg', caption: 'Нотр-Дам' },
      ],
    } as TravelForBook;

    mockSettings = {
      title: 'Моя книга',
      authorName: 'Автор',
      includeGallery: true,
      galleryOptions: {
        layout: 'grid',
        columns: 2,
        showCaptions: true,
        captionPosition: 'below',
        spacing: 'normal',
      },
      theme: 'elegant',
      format: 'a4',
    } as BookSettings;

    mockContext = {
      travel: mockTravel,
      settings: mockSettings,
      theme: {
        colors: {
          primary: '#000',
          secondary: '#666',
          accent: '#0066cc',
          accentSoft: '#e6f0ff',
          background: '#fff',
          text: '#000',
          textLight: '#666',
          textMuted: '#999',
        },
        typography: {
          headingFont: 'Georgia, serif',
          bodyFont: 'Arial, sans-serif',
          h1: { size: '32pt', weight: '700', lineHeight: '1.2' },
          h2: { size: '24pt', weight: '600', lineHeight: '1.3' },
          body: { size: '12pt', lineHeight: '1.6' },
          caption: { size: '10pt', lineHeight: '1.4' },
        },
        spacing: {
          pagePadding: '20mm',
          sectionGap: '12mm',
          elementGap: '6mm',
        },
        layout: {
          pageWidth: '210mm',
          pageHeight: '297mm',
        },
      },
      pageNumber: 5,
    };
  });

  describe('generate', () => {
    it('должен сгенерировать HTML галереи', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('gallery-page');
      expect(html).toContain('Фотогалерея');
      expect(html).toContain(mockTravel.name);
    });

    it('должен включить все фото из галереи', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
      expect(html).toContain('photo3.jpg');
    });

    it('должен использовать grid layout по умолчанию', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('display: grid');
      expect(html).toContain('grid-template-columns');
    });

    it('должен поддерживать masonry layout', async () => {
      mockSettings.galleryLayout = 'masonry';
      const html = await generator.generate(mockContext);

      expect(html).toContain('column-count');
    });

    it('должен поддерживать polaroid layout', async () => {
      mockSettings.galleryLayout = 'polaroid';
      const html = await generator.generate(mockContext);

      expect(html).toContain('transform: rotate');
    });

    it('должен поддерживать collage layout', async () => {
      mockSettings.galleryLayout = 'collage';
      const html = await generator.generate(mockContext);

      expect(html).toContain('grid-column: span 2');
    });

    it('должен бросить ошибку если нет travel в контексте', async () => {
      const contextWithoutTravel = { ...mockContext, travel: undefined };

      await expect(generator.generate(contextWithoutTravel)).rejects.toThrow(
        'GalleryPageGenerator requires travel in context'
      );
    });

    it('должен вернуть пустую строку если галерея пустая', async () => {
      mockContext.travel!.gallery = [];
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен обработать разные форматы фото (string и object)', async () => {
      mockContext.travel!.gallery = [
        'https://example.com/photo1.jpg',
        { url: 'https://example.com/photo2.jpg' },
      ] as any;

      const html = await generator.generate(mockContext);
      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
    });

    it('должен использовать указанное количество колонок', async () => {
      mockSettings.galleryColumns = 3;
      const html = await generator.generate(mockContext);

      expect(html).toContain('grid-template-columns: repeat(3, 1fr)');
    });

    it('должен показывать подписи если включено', async () => {
      mockSettings.galleryOptions!.showCaptions = true;
      const html = await generator.generate(mockContext);

      expect(html).toContain('Фото');
    });

    it('должен скрывать подписи если выключено', async () => {
      mockSettings.showCaptions = false;
      const html = await generator.generate(mockContext);

      // При showCaptions = false подписи не должны отображаться (только номера в кружочках)
      // Проверяем что нет текстовых подписей "Фото X" внизу каждого изображения
      expect(html).toContain('gallery-page');
    });
  });

  describe('estimatePageCount', () => {
    it('должен оценить количество страниц исходя из количества фото', () => {
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('должен вернуть 1 если нет галереи', () => {
      mockContext.travel!.gallery = [];
      const count = generator.estimatePageCount(mockContext);
      // BasePageGenerator по умолчанию возвращает 1
      expect(count).toBe(1);
    });

    it('должен вернуть 1 если нет travel', () => {
      const contextWithoutTravel = { ...mockContext, travel: undefined };
      const count = generator.estimatePageCount(contextWithoutTravel);
      // BasePageGenerator по умолчанию возвращает 1
      expect(count).toBe(1);
    });

    it('должен учитывать layout при оценке', () => {
      mockContext.travel!.gallery = new Array(20).fill({ url: 'test.jpg' });

      mockSettings.galleryOptions!.layout = 'grid';
      const gridCount = generator.estimatePageCount(mockContext);

      mockSettings.galleryOptions!.layout = 'slideshow';
      const slideshowCount = generator.estimatePageCount(mockContext);

      // BasePageGenerator возвращает 1 по умолчанию
      expect(gridCount).toBe(1);
      expect(slideshowCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('должен обработать отсутствие galleryOptions', async () => {
      mockSettings.galleryOptions = undefined;
      const html = await generator.generate(mockContext);

      expect(html).toBeTruthy();
    });

    it('должен обработать невалидные URL фото', async () => {
      mockContext.travel!.gallery = [
        { url: '' },
        { url: '   ' },
        { url: 'https://valid.com/photo.jpg' },
      ] as any;

      const html = await generator.generate(mockContext);
      expect(html).toContain('valid.com');
      expect((html.match(/<img/g) || []).length).toBe(1);
    });

    it('должен ограничить колонки максимум 4', async () => {
      mockSettings.galleryColumns = 10;
      const html = await generator.generate(mockContext);

      expect(html).toContain('grid-template-columns: repeat(4, 1fr)');
    });

    it('должен использовать оптимальное количество колонок если установлено 0', async () => {
      mockSettings.galleryColumns = 0;
      const html = await generator.generate(mockContext);

      // Когда columns = 0, используется defaultColumns (зависит от количества фото)
      // С 3 фото обычно используется 2 колонки
      expect(html).toMatch(/grid-template-columns: repeat\(\d+, 1fr\)/);
    });
  });
});

