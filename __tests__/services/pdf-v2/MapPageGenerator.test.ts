// __tests__/services/pdf-v2/MapPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор страницы карты маршрута

import { MapPageGenerator } from '@/src/services/pdf-export/generators/v2/pages/MapPageGenerator';
import type { PageContext } from '@/src/services/pdf-export/generators/v2/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';

// Мокируем generateLeafletRouteSnapshot
jest.mock('@/src/utils/mapImageGenerator', () => ({
  generateLeafletRouteSnapshot: jest.fn().mockResolvedValue('data:image/png;base64,mockimage'),
}));

describe('MapPageGenerator', () => {
  let generator: MapPageGenerator;
  let mockContext: PageContext;
  let mockTravel: TravelForBook;
  let mockSettings: BookSettings;

  beforeEach(() => {
    generator = new MapPageGenerator();

    mockTravel = {
      id: 'travel-1',
      name: 'Европейское турне',
    } as TravelForBook;

    mockSettings = {
      title: 'Моя книга',
      authorName: 'Автор',
      includeMap: true,
      coverType: 'auto',
      template: 'minimal',
      sortOrder: 'date-desc',
      includeToc: true,
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
          surfaceAlt: '#e0e0e0',
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
          h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
          h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '6pt' },
          body: { size: '12pt', lineHeight: 1.6, marginBottom: '8pt' },
          small: { size: '10pt', lineHeight: 1.4 },
          caption: { size: '10pt', lineHeight: 1.4 },
        },
        spacing: {
          pagePadding: '20mm',
          sectionSpacing: '12mm',
          blockSpacing: '8mm',
          elementSpacing: '4mm',
          contentMaxWidth: '170mm',
          columnGap: '10mm',
        },
        blocks: {
          borderRadius: '4px',
          shadow: 'none',
          borderWidth: '1px',
        },
      },
      pageNumber: 7,
      metadata: {
        locations: [
          { name: 'Париж', lat: 48.8566, lng: 2.3522 },
          { name: 'Лондон', lat: 51.5074, lng: -0.1278 },
          { name: 'Берлин', lat: 52.52, lng: 13.405 },
        ],
      },
    } as PageContext;
  });

  describe('generate', () => {
    it('должен сгенерировать HTML карты', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('map-page');
      expect(html).toContain('Маршрут');
    });

    it('должен включить изображение карты если есть координаты', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('img');
      expect(html).toContain('data:image/png;base64,mockimage');
    });

    it('должен включить список локаций', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('Париж');
      expect(html).toContain('Лондон');
      expect(html).toContain('Берлин');
    });

    it('должен бросить ошибку если нет travel в контексте', async () => {
      const contextWithoutTravel = { ...mockContext, travel: undefined };

      await expect(generator.generate(contextWithoutTravel)).rejects.toThrow(
        'MapPageGenerator requires travel in context'
      );
    });

    it('должен вернуть пустую строку если нет локаций', async () => {
      mockContext.metadata = { locations: [] };
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен обработать отсутствие metadata', async () => {
      mockContext.metadata = undefined;
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен использовать SVG fallback если нет координат', async () => {
      mockContext.metadata = {
        locations: [
          { name: 'Неизвестное место' },
        ],
      };

      const html = await generator.generate(mockContext);
      expect(html).toContain('<svg');
    });

    it('должен использовать SVG fallback если generateLeafletRouteSnapshot fails', async () => {
      const { generateLeafletRouteSnapshot } = require('@/src/utils/mapImageGenerator');
      generateLeafletRouteSnapshot.mockRejectedValueOnce(new Error('Map error'));

      const html = await generator.generate(mockContext);
      expect(html).toContain('<svg');
    });

    it('должен обработать локации без координат', async () => {
      mockContext.metadata = {
        locations: [
          { name: 'Париж', lat: 48.8566, lng: 2.3522 },
          { name: 'Неизвестно' },
        ],
      };

      const html = await generator.generate(mockContext);
      expect(html).toContain('Париж');
      expect(html).toContain('Неизвестно');
    });

    it('должен нумеровать локации', async () => {
      const html = await generator.generate(mockContext);

      // Генератор использует обычные цифры в кружочках (styled spans)
      expect(html).toContain('>1</span>');
      expect(html).toContain('>2</span>');
      expect(html).toContain('>3</span>');
    });

    it('должен экранировать HTML в названиях локаций', async () => {
      mockContext.metadata = {
        locations: [
          { name: '<script>alert("xss")</script>', lat: 48.8566, lng: 2.3522 },
        ],
      };

      const html = await generator.generate(mockContext);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('estimatePageCount', () => {
    it('должен вернуть 1 страницу если есть локации', () => {
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(1);
    });

    it('должен вернуть 0 если нет локаций', () => {
      mockContext.metadata = { locations: [] };
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(0);
    });

    it('должен вернуть 0 если нет metadata', () => {
      mockContext.metadata = undefined;
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(0);
    });

    it('должен вернуть 0 если нет travel', () => {
      const contextWithoutTravel = { ...mockContext, travel: undefined };
      const count = generator.estimatePageCount(contextWithoutTravel);
      expect(count).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('должен обработать очень длинные названия локаций', async () => {
      mockContext.metadata = {
        locations: [
          { name: 'A'.repeat(200), lat: 48.8566, lng: 2.3522 },
        ],
      };

      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });

    it('должен обработать большое количество локаций', async () => {
      mockContext.metadata = {
        locations: Array.from({ length: 50 }, (_, i) => ({
          name: `Место ${i + 1}`,
          lat: 48 + i * 0.1,
          lng: 2 + i * 0.1,
        })),
      };

      const html = await generator.generate(mockContext);
      expect(html).toContain('Место 1');
      expect(html).toContain('Место 50');
    }, 15000);

    it('должен обработать невалидные координаты', async () => {
      mockContext.metadata = {
        locations: [
          { name: 'Место 1', lat: NaN, lng: 2.3522 },
          { name: 'Место 2', lat: 48.8566, lng: Infinity },
          { name: 'Место 3', lat: 48.8566, lng: 2.3522 },
        ],
      };

      const html = await generator.generate(mockContext);
      expect(html).toBeTruthy();
    });
  });
});

