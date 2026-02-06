// __tests__/services/pdf-v2/TocPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор оглавления

import { TocPageGenerator } from '@/services/pdf-export/generators/v2/pages/TocPageGenerator';
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig';
import type { PageContext } from '@/services/pdf-export/generators/v2/types';

describe('TocPageGenerator', () => {
  let mockContext: PageContext;

  beforeEach(() => {
    mockContext = {
      travels: [
        {
          id: '1',
          name: 'Путешествие в Минск',
          countryName: 'Беларусь',
          year: 2024,
        },
        {
          id: '2',
          name: 'Поездка в Варшаву',
          countryName: 'Польша',
          year: 2023,
        },
      ],
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
      pageNumber: 2,
    };
  });

  it('генерирует оглавление с несколькими путешествиями', () => {
    const meta = [
      { travel: mockContext.travels![0], startPage: 3 },
      { travel: mockContext.travels![1], startPage: 7 },
    ];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).toContain('pdf-page');
    expect(html).toContain('toc-page');
    expect(html).toContain('Содержание');
    expect(html).toContain('Путешествие в Минск');
    expect(html).toContain('Поездка в Варшаву');
    expect(html).toContain('Беларусь');
    expect(html).toContain('Польша');
    expect(html).toContain('3'); // номер страницы
    expect(html).toContain('7'); // номер страницы
  });

  it('генерирует оглавление для одного путешествия', () => {
    const meta = [{ travel: mockContext.travels![0], startPage: 3 }];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).toContain('Путешествие в Минск');
    expect(html).toContain('1 путешествие');
  });

  it('правильно склоняет "путешествие"', () => {
    const meta = [
      { travel: mockContext.travels![0], startPage: 3 },
      { travel: mockContext.travels![1], startPage: 7 },
    ];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).toContain('2 путешествия');
  });

  it('работает без страны', () => {
    const meta = [
      { travel: { ...mockContext.travels![0], countryName: undefined }, startPage: 3 },
    ];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).toContain('Путешествие в Минск');
    expect(html).toContain('2024');
  });

  it('работает без года', () => {
    const meta = [
      { travel: { ...mockContext.travels![0], year: undefined }, startPage: 3 },
    ];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).toContain('Путешествие в Минск');
    expect(html).toContain('Беларусь');
  });

  it('экранирует HTML в названиях', () => {
    const meta = [
      { travel: { ...mockContext.travels![0], name: '<script>alert("XSS")</script>' }, startPage: 3 },
    ];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('применяет тему правильно', () => {
    const meta = [{ travel: mockContext.travels![0], startPage: 3 }];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate(mockContext);

    const { colors, typography } = mockContext.theme;
    expect(html).toContain(colors.text);
    expect(html).toContain(typography.h1.size);
  });

  it('отображает номер страницы', () => {
    const meta = [{ travel: mockContext.travels![0], startPage: 3 }];
    const generator = new TocPageGenerator(meta);
    const html = generator.generate({ ...mockContext, pageNumber: 2 });

    expect(html).toContain('>2<');
  });

  it('оценивает количество страниц как 1', () => {
    const meta = [{ travel: mockContext.travels![0], startPage: 3 }];
    const generator = new TocPageGenerator(meta);
    const count = generator.estimatePageCount(mockContext);

    expect(count).toBe(1);
  });
});

