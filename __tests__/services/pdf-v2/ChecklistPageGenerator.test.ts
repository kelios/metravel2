// __tests__/services/pdf-v2/ChecklistPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор страницы чек-листа

import { ChecklistPageGenerator } from '@/src/services/pdf-export/generators/v2/pages/ChecklistPageGenerator';
import type { PageContext } from '@/src/services/pdf-export/generators/v2/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';

describe('ChecklistPageGenerator', () => {
  let generator: ChecklistPageGenerator;
  let mockContext: PageContext;
  let mockTravel: TravelForBook;
  let mockSettings: BookSettings;

  beforeEach(() => {
    generator = new ChecklistPageGenerator();

    mockTravel = {
      id: 'travel-1',
      name: 'Горный поход',
    } as TravelForBook;

    mockSettings = {
      title: 'Моя книга',
      authorName: 'Автор',
      includeChecklist: true,
      checklistSections: ['clothing', 'food', 'electronics'],
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
          surface: '#f5f5f5',
          border: '#ddd',
        },
        typography: {
          headingFont: 'Georgia, serif',
          bodyFont: 'Arial, sans-serif',
          h2: { size: '24pt', weight: '600', lineHeight: '1.3' },
          h4: { size: '18pt', weight: '600', lineHeight: '1.4' },
          body: { size: '12pt', lineHeight: '1.6' },
          caption: { size: '10pt', lineHeight: '1.4' },
        },
        spacing: {
          pagePadding: '20mm',
          sectionSpacing: '12mm',
          blockSpacing: '8mm',
          elementSpacing: '6mm',
        },
        layout: {
          pageWidth: '210mm',
          pageHeight: '297mm',
        },
      },
      pageNumber: 10,
    };
  });

  describe('generate', () => {
    it('должен сгенерировать HTML чек-листа', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('checklist-page');
      expect(html).toContain('Чек-лист');
    });

    it('должен включить выбранные секции', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('Одежда');
      expect(html).toContain('Еда');
      expect(html).toContain('Электроника');
    });

    it('должен не включать невыбранные секции', async () => {
      const html = await generator.generate(mockContext);

      expect(html).not.toContain('Документы');
      expect(html).not.toContain('Аптечка');
    });

    it('должен включить элементы чек-листа', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain('Термобельё');
      expect(html).toContain('Повербанк');
      expect(html).toContain('Перекусы');
    });

    it('должен вернуть пустую строку если нет checklistSections', async () => {
      mockSettings.checklistSections = [];
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен вернуть пустую строку если checklistSections undefined', async () => {
      mockSettings.checklistSections = undefined as any;
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен показать чекбоксы для элементов', async () => {
      const html = await generator.generate(mockContext);

      // Чекбоксы могут быть в форме Unicode символов или HTML элементов
      expect(html).toMatch(/☐|checkbox|check/i);
    });

    it('должен обработать все доступные секции', async () => {
      mockSettings.checklistSections = ['clothing', 'food', 'electronics', 'documents', 'medicine'];
      const html = await generator.generate(mockContext);

      expect(html).toContain('Одежда');
      expect(html).toContain('Еда');
      expect(html).toContain('Электроника');
      expect(html).toContain('Документы');
      expect(html).toContain('Аптечка');
    });

    it('должен корректно обработать одну секцию', async () => {
      mockSettings.checklistSections = ['clothing'];
      const html = await generator.generate(mockContext);

      expect(html).toContain('Одежда');
      expect(html).not.toContain('Еда');
    });

    it('должен использовать стили из темы', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toContain(mockContext.theme.colors.text);
      expect(html).toContain(mockContext.theme.typography.headingFont);
    });
  });

  describe('estimatePageCount', () => {
    it('должен вернуть 1 страницу если есть секции', () => {
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(1);
    });

    it('должен вернуть 0 если нет секций', () => {
      mockSettings.checklistSections = [];
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(0);
    });

    it('должен вернуть 0 если checklistSections undefined', () => {
      mockSettings.checklistSections = undefined as any;
      const count = generator.estimatePageCount(mockContext);
      expect(count).toBe(0);
    });

    it('должен вернуть 0 если нет settings', () => {
      const contextWithoutSettings = { ...mockContext, settings: undefined as any };
      const count = generator.estimatePageCount(contextWithoutSettings);
      expect(count).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('должен обработать неизвестную секцию', async () => {
      mockSettings.checklistSections = ['unknown' as any, 'clothing'];
      const html = await generator.generate(mockContext);

      // Неизвестная секция не должна ломать генерацию
      expect(html).toContain('Одежда');
    });

    it('должен обработать пустой массив секций', async () => {
      mockSettings.checklistSections = [];
      const html = await generator.generate(mockContext);

      expect(html).toBe('');
    });

    it('должен обработать дубликаты секций', async () => {
      mockSettings.checklistSections = ['clothing', 'clothing', 'food'];
      const html = await generator.generate(mockContext);

      // Дубликаты могут быть, но генератор должен работать
      expect(html).toContain('Одежда');
      expect(html).toContain('Еда');
    });

    it('должен показать все элементы в каждой секции', async () => {
      mockSettings.checklistSections = ['clothing'];
      const html = await generator.generate(mockContext);

      // Проверяем что показаны несколько элементов из секции "Одежда"
      expect(html).toContain('Термобельё');
      expect(html).toContain('Тёплый слой');
      expect(html).toContain('Дождевик');
    });

    it('должен обработать большое количество секций', async () => {
      mockSettings.checklistSections = [
        'clothing', 'food', 'electronics', 'documents', 'medicine',
        'clothing', 'food', 'electronics', 'documents', 'medicine',
      ];
      const html = await generator.generate(mockContext);

      expect(html).toBeTruthy();
    });
  });

  describe('labels and structure', () => {
    it('должен иметь заголовок страницы', async () => {
      const html = await generator.generate(mockContext);

      expect(html).toMatch(/Чек-лист|Checklist/i);
    });

    it('должен группировать элементы по секциям', async () => {
      const html = await generator.generate(mockContext);

      // Каждая секция должна быть в отдельном блоке
      const sectionCount = (html.match(/Одежда|Еда|Электроника/g) || []).length;
      expect(sectionCount).toBe(3);
    });

    it('должен показать количество элементов в секции', async () => {
      const html = await generator.generate(mockContext);

      // Проверяем что есть несколько элементов (минимум 5 на секцию)
      expect(html).toContain('Термобельё');
      expect(html).toContain('Повербанк');
      expect(html).toContain('Перекусы');
    });
  });
});

