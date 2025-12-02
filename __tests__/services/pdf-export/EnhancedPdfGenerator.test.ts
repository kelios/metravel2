// __tests__/services/pdf-export/EnhancedPdfGenerator.test.ts
// ✅ ТЕСТЫ: Тесты для улучшенного генератора PDF

import { EnhancedPdfGenerator } from '@/src/services/pdf-export/generators/EnhancedPdfGenerator';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { JSDOM } from 'jsdom';
import { TRAVEL_QUOTES } from '@/src/services/pdf-export/quotes/travelQuotes';

// Увеличиваем таймаут для тяжёлых HTML/PDF-тестов
jest.setTimeout(20000);

const ensureDomGlobals = () => {
  const globalObj = global as any;
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalObj.window = dom.window;
  globalObj.document = dom.window.document;
  globalObj.DOMParser = dom.window.DOMParser;
  globalObj.Node = dom.window.Node;
  globalObj.HTMLElement = dom.window.HTMLElement;
};

ensureDomGlobals();

describe('EnhancedPdfGenerator', () => {
  const mockTravel: TravelForBook = {
    id: 1,
    name: 'Тестовое путешествие',
    slug: 'test-travel',
    description: '<p>Описание путешествия</p>',
    recommendation: '<p>Рекомендации</p>',
    countryName: 'Россия',
    year: '2024',
    number_days: 7,
    travel_image_url: 'https://example.com/image.jpg',
    gallery: [
      { url: 'https://example.com/photo1.jpg' },
      { url: 'https://example.com/photo2.jpg' },
    ],
    travelAddress: [
      {
        id: '1',
        address: 'Москва, Красная площадь',
        coord: '55.7558,37.6173',
      },
    ],
    userName: 'Тестовый пользователь',
    plus: '<p>Плюсы: красиво</p>',
    minus: '<p>Минусы: дорого</p>',
  };

  const defaultSettings: BookSettings = {
    title: 'Тестовая книга',
    subtitle: 'Тестовый подзаголовок',
    coverType: 'auto',
    template: 'minimal',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  };

  describe('Генерация HTML', () => {
    it('должен генерировать HTML для одного путешествия', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const html = await generator.generate([mockTravel], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Тестовая книга');
      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('pdf-page');
    });

    it('должен генерировать HTML для нескольких путешествий', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travels = [mockTravel, { ...mockTravel, id: 2, name: 'Второе путешествие' }];
      const html = await generator.generate(travels, defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('Второе путешествие');
    });

    it('должен обрабатывать путешествие без описания', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithoutDescription = { ...mockTravel, description: null };
      const html = await generator.generate([travelWithoutDescription], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Описание путешествия отсутствует');
    });

    it('должен обрабатывать путешествие без фотографий', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithoutPhotos = { ...mockTravel, travel_image_url: undefined, gallery: undefined };
      const html = await generator.generate([travelWithoutPhotos], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен обрабатывать путешествие без карты', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithoutMap = { ...mockTravel, travelAddress: undefined };
      const settings = { ...defaultSettings, includeMap: true };
      const html = await generator.generate([travelWithoutMap], settings);

      expect(html).toBeTruthy();
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен обрабатывать длинный текст', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const longDescription = '<p>' + 'Длинный текст. '.repeat(100) + '</p>';
      const travelWithLongText = { ...mockTravel, description: longDescription };
      const html = await generator.generate([travelWithLongText], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Длинный текст');
    });

    it('должен подставлять одну из travel-цитат в книгу', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const html = await generator.generate([mockTravel], defaultSettings);

      const hasQuote = TRAVEL_QUOTES.some((q) => html.includes(q.text));
      expect(hasQuote).toBe(true);
    });
  });

  describe('Темы оформления', () => {
    const themes: Array<'minimal' | 'light' | 'dark' | 'travel-magazine'> = [
      'minimal',
      'light',
      'dark',
      'travel-magazine',
    ];

    themes.forEach((theme) => {
      it(`должен генерировать HTML с темой ${theme}`, async () => {
        const generator = new EnhancedPdfGenerator(theme);
        const settings = { ...defaultSettings, template: theme };
        const html = await generator.generate([mockTravel], settings);

        expect(html).toBeTruthy();
        expect(html).toContain('pdf-page');
      });
    });
  });

  describe('Оглавление', () => {
    it('должен включать оглавление когда includeToc = true', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeToc: true };
      const html = await generator.generate([mockTravel], settings);

      expect(html).toContain('Содержание');
    });

    it('не должен включать оглавление когда includeToc = false', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeToc: false };
      const html = await generator.generate([mockTravel], settings);

      expect(html).not.toContain('Содержание');
    });
  });

  describe('Галерея', () => {
    it('должен включать inline-галерею когда includeGallery = true и есть фото', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeGallery: true };
      const html = await generator.generate([mockTravel], settings);

      // Все URL из gallery должны присутствовать в HTML
      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
    });

    it('не должен включать inline-галерею когда includeGallery = false', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeGallery: false };
      const html = await generator.generate([mockTravel], settings);

      expect(html).not.toContain('photo1.jpg');
      expect(html).not.toContain('photo2.jpg');
    });

    it('должен корректно обрабатывать отсутствие фотографий', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithoutGallery = { ...mockTravel, gallery: undefined };
      const settings = { ...defaultSettings, includeGallery: true };
      const html = await generator.generate([travelWithoutGallery], settings);

      // В HTML не должно быть grid-блока галереи, так как фотографий нет
      expect(html).not.toMatch(/grid-template-columns:\s*repeat\(\d+, 1fr\)/);
    });
  });

  describe('Специальные блоки', () => {
    it('должен выводить плюсы и минусы, если данные есть', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const html = await generator.generate([mockTravel], defaultSettings);

      expect(html).toContain('Плюсы');
      expect(html).toContain('Минусы');
    });

    it('должен выводить QR и ссылку на онлайн-версию', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const html = await generator.generate([mockTravel], defaultSettings);

      expect(html).toContain('Онлайн-версия');
      expect(html).toContain('https://metravel.by/travels/test-travel');
    });

    it('должен добавлять страницу чек-листов при включении', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = {
        ...defaultSettings,
        includeChecklists: true,
        checklistSections: ['clothing', 'documents'],
      } as BookSettings;

      const html = await generator.generate([mockTravel], settings);
      expect(html).toContain('Чек-листы путешествия');
      expect(html).toContain('Документы');
    });
  });

  describe('Карта', () => {
    it('должен включать карту когда includeMap = true и есть адреса', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeMap: true };
      const html = await generator.generate([mockTravel], settings);

      expect(html).toContain('Маршрут');
    });

    it('не должен включать карту когда includeMap = false', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, includeMap: false };
      const html = await generator.generate([mockTravel], settings);

      expect(html).not.toContain('Маршрут');
    });

    it('должен разбивать адрес точки на заголовок и подзаголовок', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithAddress = {
        ...mockTravel,
        travelAddress: [
          {
            id: '1',
            address: 'Москва, Красная площадь, Россия',
            coord: '55.7558,37.6173',
          },
        ],
      } as TravelForBook;

      const html = await generator.generate([travelWithAddress], defaultSettings);

      expect(html).toContain('Москва');
      expect(html).toContain('Красная площадь');
    });

    it('должен скрывать координаты когда showCoordinatesOnMapPage = false', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const settings = { ...defaultSettings, showCoordinatesOnMapPage: false } as BookSettings;
      const html = await generator.generate([mockTravel], settings);

      expect(html).not.toContain('55.7558,37.6173');
    });
  });

  describe('Специальные блоки', () => {
    it('должен обрабатывать блоки с советами', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithTip = {
        ...mockTravel,
        description: '<div class="tip">Это совет</div>',
      };
      const html = await generator.generate([travelWithTip], defaultSettings);

      expect(html).toBeTruthy();
    });

    it('должен обрабатывать блоки с предупреждениями', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithWarning = {
        ...mockTravel,
        description: '<div class="warning">Это предупреждение</div>',
      };
      const html = await generator.generate([travelWithWarning], defaultSettings);

      expect(html).toBeTruthy();
    });
  });

  describe('Краевые случаи', () => {
    it('должен обрабатывать пустой массив путешествий', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const html = await generator.generate([], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Тестовая книга');
    });

    it('должен обрабатывать путешествие с минимальными данными', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const minimalTravel: TravelForBook = {
        id: 1,
        name: 'Минимальное путешествие',
      };
      const html = await generator.generate([minimalTravel], defaultSettings);

      expect(html).toBeTruthy();
      expect(html).toContain('Минимальное путешествие');
    });

    it('должен обрабатывать очень длинное название', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const travelWithLongName = {
        ...mockTravel,
        name: 'Очень длинное название путешествия '.repeat(10),
      };
      const html = await generator.generate([travelWithLongName], defaultSettings);

      expect(html).toBeTruthy();
    });

    it('должен обрабатывать HTML с множеством тегов', async () => {
      const generator = new EnhancedPdfGenerator('minimal');
      const complexHtml = `
        <h1>Заголовок</h1>
        <p>Параграф 1</p>
        <ul>
          <li>Элемент 1</li>
          <li>Элемент 2</li>
        </ul>
        <blockquote>Цитата</blockquote>
        <img src="https://example.com/image.jpg" alt="Изображение" />
      `;
      const travelWithComplexHtml = {
        ...mockTravel,
        description: complexHtml,
      };
      const html = await generator.generate([travelWithComplexHtml], defaultSettings);

      expect(html).toBeTruthy();
    });
  });
});
