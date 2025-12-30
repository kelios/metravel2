// __tests__/services/pdf-v2/FinalPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор финальной страницы

import { FinalPageGenerator } from '@/src/services/pdf-export/generators/v2/pages/FinalPageGenerator';
import { getThemeConfig } from '@/src/services/pdf-export/themes/PdfThemeConfig';
import type { PageContext } from '@/src/services/pdf-export/generators/v2/types';

describe('FinalPageGenerator', () => {
  let mockContext: PageContext;

  beforeEach(() => {
    mockContext = {
      settings: {
        title: 'Моя книга',
        template: 'minimal',
        sortOrder: 'newest',
        includeToc: true,
        includeGallery: true,
        includeChecklists: false,
        galleryLayout: 'grid',
        galleryColumns: 3,
        showCaptions: true,
        captionPosition: 'bottom',
        gallerySpacing: 'normal',
        checklistSections: [],
      },
      theme: getThemeConfig('minimal'),
      pageNumber: 10,
    };
  });

  it('генерирует финальную страницу с цитатой', () => {
    const quote = {
      text: 'Мир — это книга, и те, кто не путешествует, читают лишь одну её страницу',
      author: 'Святой Августин',
    };
    const generator = new FinalPageGenerator(quote);
    const html = generator.generate(mockContext);

    expect(html).toContain('pdf-page');
    expect(html).toContain('final-page');
    expect(html).toContain('Спасибо за путешествие!');
    expect(html).toContain('Мир — это книга');
    expect(html).toContain('Святой Августин');
    expect(html).toContain('MeTravel.by');
  });

  it('генерирует финальную страницу без цитаты', () => {
    const generator = new FinalPageGenerator();
    const html = generator.generate(mockContext);

    expect(html).toContain('Спасибо за путешествие!');
    expect(html).toContain('MeTravel.by');
  });

  it('генерирует цитату без автора', () => {
    const quote = {
      text: 'Путешествие — лучший учитель',
    };
    const generator = new FinalPageGenerator(quote);
    const html = generator.generate(mockContext);

    expect(html).toContain('Путешествие — лучший учитель');
    expect(html).not.toContain('undefined');
  });

  it('экранирует HTML в цитате', () => {
    const quote = {
      text: '<script>alert("XSS")</script>',
      author: '<b>Bold</b>',
    };
    const generator = new FinalPageGenerator(quote);
    const html = generator.generate(mockContext);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;');
  });

  it('отображает текущий год в копирайте', () => {
    const generator = new FinalPageGenerator();
    const html = generator.generate(mockContext);
    const currentYear = new Date().getFullYear();

    expect(html).toContain(`© ${currentYear}`);
  });

  it('отображает номер страницы', () => {
    const generator = new FinalPageGenerator();
    const html = generator.generate({ ...mockContext, pageNumber: 15 });

    expect(html).toContain('>15<');
  });

  it('применяет тему правильно', () => {
    const generator = new FinalPageGenerator();
    const html = generator.generate(mockContext);

    const { colors, typography } = mockContext.theme;
    expect(html).toContain(colors.text);
    expect(html).toContain(typography.h1.size);
  });

  it('содержит благодарственное сообщение', () => {
    const generator = new FinalPageGenerator();
    const html = generator.generate(mockContext);

    expect(html).toContain('Пусть эта книга напоминает о самых тёплых эмоциях');
  });

  it('оценивает количество страниц как 1', () => {
    const generator = new FinalPageGenerator();
    const count = generator.estimatePageCount(mockContext);

    expect(count).toBe(1);
  });
});

