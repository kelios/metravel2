// __tests__/services/pdf-export/ArticlePdfGenerator.test.ts
// ✅ ТЕСТЫ: Тесты для генератора HTML одной статьи (ArticlePdfGenerator)

import { ArticlePdfGenerator, type ArticleExportSettings } from '@/src/services/pdf-export/generators/ArticlePdfGenerator';
import type { ArticlePdfModel, Section } from '@/src/types/article-pdf';
import { JSDOM } from 'jsdom';

const ensureDomGlobals = () => {
  const globalObj = global as any;
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalObj.window = dom.window;
  globalObj.document = dom.window.document;
  globalObj.DOMParser = dom.window.DOMParser;
  globalObj.HTMLElement = dom.window.HTMLElement;
};

ensureDomGlobals();

const defaultSettings: ArticleExportSettings = {
  theme: 'light',
  format: 'A4',
  includeToc: true,
  includeMap: true,
  includeRecommendations: true,
  language: 'ru',
};

const baseModel: ArticlePdfModel = {
  title: 'Тестовая статья',
  subtitle: 'Подзаголовок',
  author: 'Автор',
  coverImage: {
    url: 'https://example.com/cover.jpg',
    alt: 'Обложка',
  },
  meta: {
    country: 'Беларусь',
    region: 'Минск',
    days: 3,
    distanceKm: 42,
    difficulty: 'Средняя',
    season: 'Лето',
    format: 'Поход',
  },
  sections: [],
  map: {
    image: { url: 'https://example.com/map.jpg', alt: 'Карта' },
    description: 'Описание карты',
    points: [
      { name: 'Точка 1', lat: 53.9, lng: 27.5667 },
      { name: 'Точка 2', lat: 54.0, lng: 27.6 },
    ],
  },
  recommendations: [
    {
      title: 'Что взять с собой',
      items: ['Документы', 'Деньги', 'Вода'],
      type: 'checklist',
    },
  ],
  gallery: [
    { url: 'https://example.com/photo1.jpg', alt: 'Фото 1' },
    { url: 'https://example.com/photo2.jpg', alt: 'Фото 2' },
  ],
};

const buildModel = (sections: Section[]): ArticlePdfModel => ({
  ...baseModel,
  sections,
});

describe('ArticlePdfGenerator', () => {
  it('генерирует валидный HTML-документ с базовыми элементами', () => {
    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(buildModel([]), defaultSettings);

    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toMatch(/<html[^>]*lang="ru"/i);
    expect(html).toMatch(/<head>/i);
    expect(html).toMatch(/<body>/i);
    expect(html).toContain('Тестовая статья');
    expect(html).toContain('Информация о маршруте');
  });

  it('рендерит секции с заголовками, параграфами и списками', () => {
    const sections: Section[] = [
      { type: 'heading', level: 2, text: 'Раздел 1' },
      { type: 'paragraph', text: 'Короткий абзац текста.' },
      {
        type: 'list',
        ordered: false,
        items: ['Пункт 1', 'Пункт 2', 'Пункт 3'],
      },
      { type: 'heading', level: 3, text: 'Подраздел' },
      { type: 'paragraph', text: 'Ещё один абзац.' },
    ];

    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(buildModel(sections), defaultSettings);

    expect(html).toContain('<h2');
    expect(html).toContain('Раздел 1');
    expect(html).toContain('<h3');
    expect(html).toContain('Подраздел');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Пункт 1</li>');
    expect(html).toContain('Короткий абзац текста');
  });

  it('обрабатывает очень длинный текст (несколько страниц)', () => {
    const longText = 'Очень длинный текст. '.repeat(300);
    const sections: Section[] = [
      { type: 'heading', level: 2, text: 'Длинный раздел' },
      { type: 'paragraph', text: longText },
    ];

    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(buildModel(sections), defaultSettings);

    expect(html).toContain('Длинный раздел');
    expect(html).toContain('Очень длинный текст');
    expect(html).toMatch(/class="pdf-page"/); // есть страницы
  });

  it('рендерит инфоблоки разных типов (tip, warning, important)', () => {
    const sections: Section[] = [
      { type: 'infoBlock', variant: 'tip', text: 'Совет', title: 'Полезно' },
      { type: 'infoBlock', variant: 'warning', text: 'Осторожно', title: 'Важно' },
      { type: 'infoBlock', variant: 'important', text: 'Инфо', title: 'Информация' },
    ];

    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(buildModel(sections), defaultSettings);

    expect(html).toContain('class="info-block tip"');
    expect(html).toContain('class="info-block warning"');
    expect(html).toContain('class="info-block important"');
  });

  it('рендерит изображения и галерею без потери элементов', () => {
    const sections: Section[] = [
      {
        type: 'image',
        image: { url: 'https://example.com/one.jpg', alt: 'One' },
        caption: 'Подпись 1',
      },
      {
        type: 'imageGallery',
        images: [
          { url: 'https://example.com/g1.jpg', alt: 'G1' },
          { url: 'https://example.com/g2.jpg', alt: 'G2' },
        ],
        caption: 'Галерея',
      },
    ];

    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(buildModel(sections), defaultSettings);

    expect(html).toContain('content-image');
    expect(html).toContain('image-gallery');
    expect(html).toContain('Подпись 1');
    expect(html).toContain('Галерея');
  });

  it('генерирует fallback-контент при отсутствии секций', () => {
    const model: ArticlePdfModel = {
      ...baseModel,
      sections: [],
    };

    const generator = new ArticlePdfGenerator('light');
    const html = generator.generate(model, defaultSettings);

    expect(html).toContain('К сожалению, контент статьи не удалось извлечь');
  });

  it('корректно включает/исключает карту и рекомендации по настройкам', () => {
    const generator = new ArticlePdfGenerator('light');

    const withAll = generator.generate(buildModel([]), {
      ...defaultSettings,
      includeMap: true,
      includeRecommendations: true,
    });
    expect(withAll).toContain('Карта маршрута');
    expect(withAll).toContain('Рекомендации и полезная информация');

    const withoutMap = generator.generate(buildModel([]), {
      ...defaultSettings,
      includeMap: false,
      includeRecommendations: true,
    });
    expect(withoutMap).not.toContain('Карта маршрута');

    const withoutRecs = generator.generate(buildModel([]), {
      ...defaultSettings,
      includeMap: true,
      includeRecommendations: false,
    });
    expect(withoutRecs).not.toContain('Рекомендации и полезная информация');
  });

  it('использует корректный lang в html по настройке language', () => {
    const generator = new ArticlePdfGenerator('light');
    const htmlRu = generator.generate(buildModel([]), { ...defaultSettings, language: 'ru' });
    const htmlEn = generator.generate(buildModel([]), { ...defaultSettings, language: 'en' });

    expect(htmlRu).toMatch(/<html[^>]*lang="ru"/i);
    expect(htmlEn).toMatch(/<html[^>]*lang="en"/i);
  });
});
