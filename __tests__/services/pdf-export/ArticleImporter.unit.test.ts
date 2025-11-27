import { ArticleImporter } from '@/src/services/pdf-export/constructor/importers/ArticleImporter';
import type { PdfDocument, PdfTheme } from '@/src/types/pdf-constructor';
import type { Travel } from '@/src/types/types';

// Юнит-тесты happy-path для ArticleImporter.
// Мы используем реальный PdfDocumentBuilder, но подменяем parser и validator на простые моки
// через доступ к приватным полям через приведение к any.

const createTheme = (): PdfTheme => ({
  id: 'simple',
  name: 'Simple',
  colors: {
    primary: '#ff9f5a',
    secondary: '#6b7280',
    text: '#1a202c',
    textSecondary: '#6b7280',
    background: '#ffffff',
    surface: '#f9fafb',
    accent: '#ff9f5a',
    border: '#e5e7eb',
    tipBlock: {
      background: '#f0fdf4',
      border: '#22c55e',
      text: '#166534',
    },
    importantBlock: {
      background: '#eff6ff',
      border: '#3b82f6',
      text: '#1e40af',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
    },
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingSizes: {
      h1: 32,
      h2: 24,
      h3: 20,
    },
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
});

const createSimpleTravel = (): Travel => ({
  id: 'travel-1',
  name: 'Короткое путешествие',
} as any);

const createModel = () => ({
  title: 'Заголовок статьи',
  subtitle: 'Подзаголовок статьи',
  author: 'Автор Статьи',
  coverImage: {
    url: 'https://example.com/cover.jpg',
    alt: 'Cover',
  },
  meta: {
    country: 'Россия',
    region: 'Алтай',
    days: 3,
    distanceKm: 120,
    difficulty: 'Лёгкий',
  },
  sections: [
    { type: 'heading', level: 3, text: 'Раздел 1' },
    { type: 'paragraph', text: 'Короткий текст параграфа.' },
    {
      type: 'image',
      image: {
        url: 'https://example.com/pic.jpg',
        alt: 'Фото',
        caption: 'Подпись к фото',
      },
      caption: 'Альтернативная подпись',
    },
    {
      type: 'list',
      ordered: false,
      items: ['Пункт 1', 'Пункт 2'],
    },
    {
      type: 'infoBlock',
      variant: 'tip',
      text: 'Полезный совет',
    },
    {
      type: 'quote',
      text: 'Мудрая цитата',
    },
    {
      type: 'imageGallery',
      images: [
        { url: 'https://example.com/g1.jpg', alt: 'g1', caption: 'Галерея 1' },
        { url: 'https://example.com/g2.jpg', alt: 'g2', caption: 'Галерея 2' },
      ],
    },
  ],
  map: {
    image: {
      url: 'https://example.com/map.jpg',
      alt: 'Карта',
    },
    points: [],
    description: 'Описание карты',
  },
  recommendations: [
    {
      title: 'Где остановиться',
      items: ['Отель 1', 'Отель 2'],
    },
  ],
} as any);

describe('ArticleImporter (happy path)', () => {
  it('creates PdfDocument with cover, meta, content, map and recommendations pages from parsed model', () => {
    const theme = createTheme();
    const travel = createSimpleTravel();
    const model = createModel();

    const importer = new ArticleImporter();

    // Подменяем приватные parser и validator на простые моки
    (importer as any).validator = {
      validate: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    };

    (importer as any).parser = {
      parse: jest.fn().mockReturnValue(model),
    };

    const document: PdfDocument = importer.import(travel, theme);

    // Заголовок документа берётся из travel.name
    expect(document.title).toBe('Короткое путешествие');
    expect(document.pages.length).toBeGreaterThanOrEqual(4);

    const allBlocks = document.pages.flatMap((p) => p.blocks);
    const blockTypes = allBlocks.map((b) => b.type);

    // Обложка с заголовком статьи
    const coverPage = document.pages.find((page) =>
      page.blocks.some((b) => b.type === 'heading-h1' && b.content === model.title),
    );
    expect(coverPage).toBeTruthy();

    // Страница с метаданными
    const metaPage = document.pages.find((page) =>
      page.blocks.some((b) => b.type === 'heading-h2' && b.content === 'Информация о маршруте'),
    );
    expect(metaPage).toBeTruthy();
    if (metaPage) {
      const metaTexts = metaPage.blocks.map((b) => String(b.content));
      expect(metaTexts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Страна: Россия'),
          expect.stringContaining('Регион: Алтай'),
          expect.stringContaining('Длительность: 3 дней'),
          expect.stringContaining('Длина маршрута: 120 км'),
          expect.stringContaining('Сложность: Лёгкий'),
        ]),
      );
    }

    // Контентные блоки: проверяем, что разные типы секций преобразованы в ожидаемые типы блоков
    expect(blockTypes).toEqual(
      expect.arrayContaining([
        'heading-h3', // из heading level 3
        'paragraph', // из paragraph и list
        'image-with-caption',
        'tip-block',
        'quote',
        'image-gallery',
      ]),
    );

    // Страница с картой
    const mapPage = document.pages.find((page) =>
      page.blocks.some((b) => b.type === 'map'),
    );
    expect(mapPage).toBeTruthy();

    // Страница с рекомендациями
    const recPage = document.pages.find((page) =>
      page.blocks.some((b) => b.type === 'heading-h3' && b.content === 'Где остановиться'),
    );
    expect(recPage).toBeTruthy();
    if (recPage) {
      const recTexts = recPage.blocks.map((b) => String(b.content));
      expect(recTexts.join('\n')).toContain('Отель 1');
      expect(recTexts.join('\n')).toContain('Отель 2');
    }
  });
});
