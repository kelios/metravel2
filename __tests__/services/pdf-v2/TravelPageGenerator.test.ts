// __tests__/services/pdf-v2/TravelPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор страниц путешествия

import { TravelPageGenerator } from '@/src/services/pdf-export/generators/v2/pages/TravelPageGenerator';
import type { PageContext } from '@/src/services/pdf-export/generators/v2/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';

describe('TravelPageGenerator', () => {
  let generator: TravelPageGenerator;
  let mockContext: PageContext;
  let mockTravel: TravelForBook;
  let mockSettings: BookSettings;

  beforeEach(() => {
    generator = new TravelPageGenerator();

    mockTravel = {
      id: 'travel-1',
      name: 'Путешествие в Париж',
      countryName: 'Франция',
      year: 2024,
      number_days: 7,
      travel_image_url: 'https://example.com/paris.jpg',
      travel_image_thumb_url: 'https://example.com/paris-thumb.jpg',
      description: 'Прекрасный город',
      content: {
        blocks: [
          {
            type: 'paragraph',
            data: { text: 'Это был незабываемый опыт' },
          },
        ],
      },
    } as TravelForBook;

    mockSettings = {
      title: 'Моя книга путешествий',
      authorName: 'Иван Иванов',
      includeMap: true,
      includeChecklist: true,
      includeGallery: true,
      mapStyle: 'standard',
      theme: 'elegant',
      quote: 'Путешествуй больше',
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
          surfaceAlt: '#f0f0f0',
          border: '#ddd',
        },
        typography: {
          headingFont: 'Georgia, serif',
          bodyFont: 'Arial, sans-serif',
          h1: { size: '32pt', weight: '700', lineHeight: '1.2' },
          h2: { size: '24pt', weight: '600', lineHeight: '1.3' },
          h3: { size: '20pt', weight: '600', lineHeight: '1.4' },
          h4: { size: '18pt', weight: '600', lineHeight: '1.4' },
          body: { size: '12pt', lineHeight: '1.6', marginBottom: '6mm' },
          caption: { size: '10pt', lineHeight: '1.4' },
          paragraph: { size: '12pt', lineHeight: '1.6', marginBottom: '6mm' },
          list: { size: '12pt', lineHeight: '1.6', marginBottom: '6mm' },
          quote: { size: '14pt', lineHeight: '1.7', marginBottom: '8mm' },
          code: { size: '11pt', lineHeight: '1.5', marginBottom: '6mm' },
        },
        spacing: {
          pagePadding: '20mm',
          sectionGap: '12mm',
          sectionSpacing: '12mm',
          elementGap: '6mm',
          elementSpacing: '6mm',
          blockSpacing: '8mm',
        },
        layout: {
          pageWidth: '210mm',
          pageHeight: '297mm',
        },
      },
      pageNumber: 1,
    };
  });

  describe('generate', () => {
    it('должен сгенерировать HTML с фото и контентом', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('travel-photo-page');
      expect(html).toContain('travel-content-page');
      expect(html).toContain(mockTravel.name);
    });

    it('должен включить изображение путешествия', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('img');
      // Изображение проксируется через weserv.nl
      expect(html).toContain('images.weserv.nl');
    });

    it('должен включить метаданные (страна, год, дни)', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain(mockTravel.countryName!);
      expect(html).toContain(String(mockTravel.year));
    });

    it('должен бросить ошибку если нет travel в контексте', async () => {
      const contextWithoutTravel = { ...mockContext, travel: undefined };

      await expect(generator.generate(contextWithoutTravel)).rejects.toThrow(
        'TravelPageGenerator requires travel in context'
      );
    });

    it('должен экранировать HTML в названии', async () => {
      mockContext.travel!.name = '<script>alert("xss")</script>';
      const html = await generator.generate(mockContext);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен обработать отсутствие изображения', async () => {
      mockContext.travel!.travel_image_url = undefined;
      mockContext.travel!.travel_image_thumb_url = undefined;

      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен включить описание если есть', async () => {
      const html = await generator.generate(mockContext);
      expect(html).toContain(mockTravel.description!);
    });
  });

  describe('estimatePageCount', () => {
    it('должен вернуть 2 страницы (фото + контент)', () => {
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('должен обработать travel без года', async () => {
      mockContext.travel!.year = undefined;
      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен обработать travel без страны', async () => {
      mockContext.travel!.countryName = undefined;
      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен обработать travel без количества дней', async () => {
      mockContext.travel!.number_days = undefined;
      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен обработать travel без контента', async () => {
      mockContext.travel!.content = undefined;
      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен обработать очень длинное название', async () => {
      mockContext.travel!.name = 'A'.repeat(200);
      const html = await generator.generate(mockContext);
      expect(html).toContain('overflow-wrap: anywhere');
    });
  });
});

