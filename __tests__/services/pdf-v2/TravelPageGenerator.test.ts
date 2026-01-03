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
      coverType: 'auto',
      template: 'minimal',
      sortOrder: 'date-desc',
      includeToc: true,
      includeMap: true,
      includeGallery: true,
      includeChecklists: false,
      checklistSections: [],
    } as BookSettings;

    mockContext = {
      travel: mockTravel,
      settings: mockSettings,
      theme: {
        name: 'minimal',
        displayName: 'Минималистичная',
        description: 'Чистая тема',
        colors: {
          text: '#000',
          textSecondary: '#666',
          textMuted: '#999',
          background: '#fff',
          surface: '#f5f5f5',
          surfaceAlt: '#f0f0f0',
          accent: '#0066cc',
          accentStrong: '#0044aa',
          accentSoft: '#e6f0ff',
          accentLight: '#f0f8ff',
          border: '#ddd',
          borderLight: '#eee',
          infoBlock: { background: '#f0f8ff', border: '#b0d0ff', text: '#0066cc', icon: '#0066cc' },
          warningBlock: { background: '#fff8e6', border: '#ffd080', text: '#996600', icon: '#cc8800' },
          tipBlock: { background: '#e6ffe6', border: '#80cc80', text: '#006600', icon: '#00aa00' },
          dangerBlock: { background: '#ffe6e6', border: '#ff8080', text: '#cc0000', icon: '#ff0000' },
          cover: { background: '#fff', backgroundGradient: ['#fff', '#f0f0f0'], text: '#000', textSecondary: '#666' },
        },
        typography: {
          headingFont: 'Georgia, serif',
          bodyFont: 'Arial, sans-serif',
          monoFont: 'Courier, monospace',
          h1: { size: '32pt', weight: 700, lineHeight: 1.2, marginBottom: '16pt' },
          h2: { size: '24pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
          h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
          h4: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '6pt' },
          body: { size: '12pt', lineHeight: 1.6, marginBottom: '6mm' },
          small: { size: '10pt', lineHeight: 1.4 },
          caption: { size: '10pt', lineHeight: 1.4 },
        },
        spacing: {
          pagePadding: '20mm',
          sectionSpacing: '12mm',
          blockSpacing: '8mm',
          elementSpacing: '6mm',
          contentMaxWidth: '170mm',
          columnGap: '10mm',
        },
        blocks: {
          borderRadius: '4px',
          shadow: 'none',
          borderWidth: '1px',
        },
      },
      pageNumber: 1,
    } as PageContext;
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

