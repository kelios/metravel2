// __tests__/services/pdf-v2/CoverPageGenerator.test.ts
// ✅ ТЕСТЫ: Генератор обложки

import { CoverPageGenerator } from '@/services/pdf-export/generators/v2/pages/CoverPageGenerator';
import { ImageProcessor } from '@/services/pdf-export/generators/v2/processors/ImageProcessor';
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig';
import type { PageContext } from '@/services/pdf-export/generators/v2/types';

describe('CoverPageGenerator', () => {
  let imageProcessor: ImageProcessor;
  let generator: CoverPageGenerator;
  let mockContext: PageContext;

  beforeEach(() => {
    imageProcessor = new ImageProcessor({
      proxyEnabled: true,
      proxyUrl: 'https://images.weserv.nl',
      maxWidth: 1600,
      cacheEnabled: false,
      cacheTTL: 3600000,
    });

    const mockQuote = {
      text: 'Путешествие — это жизнь',
      author: 'Тестовый автор',
    };

    generator = new CoverPageGenerator(imageProcessor, mockQuote);

    mockContext = {
      travels: [
        {
          id: '1',
          name: 'Тестовое путешествие',
          userName: 'Иван Иванов',
          year: 2024,
          countryName: 'Беларусь',
          coverImageUrl: 'https://example.com/cover.jpg',
          gallery: [],
        },
      ],
      settings: {
        title: 'Моя книга путешествий',
        subtitle: 'Приключения 2024',
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
      pageNumber: 1,
    };
  });

  it('генерирует обложку с изображением', async () => {
    const html = await generator.generate(mockContext);

    expect(html).toContain('pdf-page');
    expect(html).toContain('cover-page');
    expect(html).toContain('Моя книга путешествий');
    expect(html).toContain('Приключения 2024');
    expect(html).toContain('Иван Иванов');
  });

  it('включает цитату на обложке', async () => {
    const html = await generator.generate(mockContext);

    expect(html).toContain('Путешествие — это жизнь');
    expect(html).toContain('Тестовый автор');
  });

  it('генерирует обложку без изображения', async () => {
    mockContext.travels = [
      {
        ...mockContext.travels![0],
        coverImageUrl: undefined,
        gallery: [],
      },
    ];

    const html = await generator.generate(mockContext);

    expect(html).toContain('pdf-page');
    expect(html).toContain('Моя книга путешествий');
  });

  it('работает без цитаты', async () => {
    const generatorNoQuote = new CoverPageGenerator(imageProcessor);
    const html = await generatorNoQuote.generate(mockContext);

    expect(html).toContain('Моя книга путешествий');
    expect(html).not.toContain('Путешествие — это жизнь');
  });

  it('правильно форматирует диапазон лет', async () => {
    mockContext.travels = [
      { ...mockContext.travels![0], year: 2020 },
      { ...mockContext.travels![0], year: 2024, id: '2' },
    ];

    const html = await generator.generate(mockContext);

    expect(html).toContain('2020–2024');
  });

  it('правильно склоняет слово "путешествие"', async () => {
    // 1 путешествие
    mockContext.travels = [mockContext.travels![0]];
    let html = await generator.generate(mockContext);
    expect(html).toContain('1 путешествие');

    // 2 путешествия
    mockContext.travels = [
      mockContext.travels![0],
      { ...mockContext.travels![0], id: '2' },
    ];
    html = await generator.generate(mockContext);
    expect(html).toContain('2 путешествия');

    // 5 путешествий
    mockContext.travels = [
      ...mockContext.travels,
      { ...mockContext.travels![0], id: '3' },
      { ...mockContext.travels![0], id: '4' },
      { ...mockContext.travels![0], id: '5' },
    ];
    html = await generator.generate(mockContext);
    expect(html).toContain('5 путешествий');
  });

  it('экранирует HTML в данных', async () => {
    mockContext.settings.title = '<script>alert("XSS")</script>';
    mockContext.travels![0].userName = '<b>Bold Name</b>';

    const html = await generator.generate(mockContext);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;Bold Name&lt;/b&gt;');
  });

  it('применяет тему правильно', async () => {
    const html = await generator.generate(mockContext);

    const { colors, typography } = mockContext.theme;
    expect(html).toContain(typography.h1.size);
    expect(html).toContain(colors.cover.text);
  });

  it('оценивает количество страниц как 1', () => {
    const count = generator.estimatePageCount(mockContext);
    expect(count).toBe(1);
  });
});

