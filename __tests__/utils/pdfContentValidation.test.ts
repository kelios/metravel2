// __tests__/utils/pdfContentValidation.test.ts
// ✅ ТЕСТЫ: Проверка наличия всех элементов в сгенерированном HTML для PDF

import { buildPhotoBookHTML } from '@/src/utils/pdfBookGenerator';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockQRCode')),
}));

const proxied = (url: string) =>
  `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=1600&fit=inside`;

// Mock DOMParser для браузерного окружения
if (typeof DOMParser === 'undefined') {
  global.DOMParser = class DOMParser {
    parseFromString(str: string, type: string) {
      // Простой парсер для тестов
      const parser = require('jsdom').JSDOM;
      const dom = new parser(str);
      return dom.window.document;
    }
  } as any;
}

/**
 * Вспомогательная функция для парсинга HTML и проверки элементов
 */
function parseHTML(html: string): {
  hasCover: boolean;
  hasToc: boolean;
  hasTravelPages: boolean;
  hasGallery: boolean;
  hasFinalPage: boolean;
  travelCount: number;
  galleryCount: number;
  imageCount: number;
  qrCodeCount: number;
} {
  // Используем регулярные выражения для проверки, так как DOMParser может быть недоступен
  return {
    hasCover: /class="pdf-page cover-page"/.test(html) || /cover-page/.test(html),
    hasToc: /class="pdf-page toc-page"/.test(html) || /Содержание/.test(html),
    hasTravelPages: /travel-photo-page|travel-text-page/.test(html),
    hasGallery: /class="pdf-page gallery-page"/.test(html) || /Фотогалерея/.test(html),
    hasFinalPage: /class="pdf-page final-page"/.test(html) || /Спасибо за путешествие/.test(html),
    travelCount: (html.match(/travel-photo-page/g) || []).length,
    galleryCount: (html.match(/gallery-page/g) || []).length,
    imageCount: (html.match(/<img[^>]*>/g) || []).length,
    qrCodeCount: (html.match(/QR Code|qr-code/gi) || []).length,
  };
}

describe('PDF Content Validation - Проверка всех элементов', () => {
  const completeTravel: TravelForBook = {
    id: 1,
    name: 'Полное путешествие',
    slug: 'complete-travel',
    url: 'https://metravel.by/travels/complete-travel',
    description: '<p>Полное описание путешествия с деталями</p>',
    recommendation: '<ul><li>Рекомендация 1</li><li>Рекомендация 2</li></ul>',
    plus: 'Много плюсов: красиво, интересно, познавательно',
    minus: 'Есть минусы: дорого, далеко',
    countryName: 'Польша',
    cityName: 'Варшава',
    year: '2024',
    monthName: 'Январь',
    number_days: 7,
    travel_image_url: 'https://example.com/cover.jpg',
    travel_image_thumb_url: 'https://example.com/thumb.jpg',
    gallery: [
      { url: 'https://example.com/gallery1.jpg', id: 1 },
      { url: 'https://example.com/gallery2.jpg', id: 2 },
      { url: 'https://example.com/gallery3.jpg', id: 3 },
      { url: 'https://example.com/gallery4.jpg', id: 4 },
    ],
    userName: 'TestUser',
    travelAddress: [
      { id: '1', address: 'Минск', coord: '53.9023,27.5619', categoryName: 'Город' },
      { id: '2', address: 'Брест', coord: '52.0976,23.7341', categoryName: 'Город' },
    ],
  };

  const defaultSettings: BookSettings = {
    title: 'Мои путешествия',
    subtitle: 'Тестовый альбом',
    coverType: 'auto',
    template: 'classic',
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
  };

  describe('Обязательные элементы', () => {
    it('должен содержать ВСЕ обязательные элементы для одного путешествия', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);
      const parsed = parseHTML(html);

      // Обложка
      expect(parsed.hasCover).toBe(true);
      expect(html).toContain('cover-page');

      // Оглавление
      expect(parsed.hasToc).toBe(true);
      expect(html).toContain('Содержание');

      // Страницы путешествия (фото + текст)
      expect(parsed.hasTravelPages).toBe(true);
      expect(parsed.travelCount).toBeGreaterThan(0);
      expect(html).toContain('travel-photo-page');
      expect(html).toContain('travel-text-page');

      // Галерея
      expect(parsed.hasGallery).toBe(true);
      expect(html).toContain('Фотогалерея');

      // Заключительная страница
      expect(parsed.hasFinalPage).toBe(true);
      expect(html).toContain('final-page');

      // Изображения
      expect(parsed.imageCount).toBeGreaterThan(0);

      // QR-коды
      expect(parsed.qrCodeCount).toBeGreaterThan(0);
    });

    it('должен содержать правильное количество страниц для нескольких путешествий', async () => {
      const travels: TravelForBook[] = [
        completeTravel,
        { ...completeTravel, id: 2, name: 'Второе путешествие' },
        { ...completeTravel, id: 3, name: 'Третье путешествие' },
      ];

      const html = await buildPhotoBookHTML(travels, defaultSettings);
      const parsed = parseHTML(html);

      // Должна быть одна обложка
      expect(html.match(/cover-page/g)?.length).toBe(1);

      // Должно быть одно оглавление
      expect(html.match(/toc-page/g)?.length).toBe(1);

      // Должно быть по 2 страницы на каждое путешествие (фото + текст)
      expect(parsed.travelCount).toBe(travels.length);

      // Должно быть по одной галерее на каждое путешествие
      expect(parsed.galleryCount).toBe(travels.length);

      // Должна быть одна заключительная страница
      expect(html.match(/final-page/g)?.length).toBe(1);
    });
  });

  describe('Содержимое обложки', () => {
    it('должен содержать все элементы обложки', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Мои путешествия'); // Заголовок
      expect(html).toContain('Тестовый альбом'); // Подзаголовок
      expect(html).toContain('TestUser'); // Имя пользователя
      expect(html).toContain('1'); // Количество путешествий
      expect(html).toContain('2024'); // Год
      expect(html).toContain('Создано'); // Дата создания
      expect(html).toContain('MeTravel'); // Брендинг
    });
  });

  describe('Содержимое оглавления', () => {
    it('должен содержать все элементы оглавления', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Содержание');
      expect(html).toContain('Полное путешествие'); // Название
      expect(html).toContain('Польша'); // Страна
      expect(html).toContain('2024'); // Год
      expect(html).toContain('travel_image_thumb'); // Миниатюра
    });
  });

  describe('Содержимое страниц путешествия', () => {
    it('должен содержать все элементы на странице с фото', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Полное путешествие'); // Название
      expect(html).toContain('Польша'); // Страна
      expect(html).toContain('Варшава'); // Город
      expect(html).toContain('2024'); // Год
      expect(html).toContain('Январь'); // Месяц
      expect(html).toContain('7'); // Количество дней
      expect(html).toContain(proxied('https://example.com/cover.jpg')); // Обложка
    });

    it('должен содержать все элементы на странице с текстом', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Описание'); // Заголовок раздела
      expect(html).toContain('Полное описание путешествия'); // Текст описания
      expect(html).toContain('Рекомендации'); // Заголовок раздела
      expect(html).toContain('Рекомендация 1'); // Текст рекомендации
      expect(html).toContain('Плюсы'); // Заголовок раздела
      expect(html).toContain('красиво, интересно'); // Текст плюсов
      expect(html).toContain('Минусы'); // Заголовок раздела
      expect(html).toContain('дорого, далеко'); // Текст минусов
      expect(html).toContain('Онлайн-версия'); // Ссылка
      expect(html).toContain('https://metravel.by/travels/complete-travel'); // URL
    });
  });

  describe('Содержимое галереи', () => {
    it('должен содержать все фотографии из галереи', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Фотогалерея');
      expect(html).toContain('Полное путешествие'); // Название в галерее
      expect(html).toContain(proxied('https://example.com/gallery1.jpg'));
      expect(html).toContain(proxied('https://example.com/gallery2.jpg'));
      expect(html).toContain(proxied('https://example.com/gallery3.jpg'));
      expect(html).toContain(proxied('https://example.com/gallery4.jpg'));
      expect(html).toContain('4'); // Количество фотографий
      expect(html).toContain('фотографии');
    });

    it('не должен содержать галерею когда includeGallery = false', async () => {
      const settings = { ...defaultSettings, includeGallery: false };
      const html = await buildPhotoBookHTML([completeTravel], settings);

      expect(html).not.toContain('Фотогалерея');
      expect(html).not.toContain('gallery-page');
    });
  });

  describe('Карты путешествий', () => {
    it('должен содержать страницу с картой, если есть travelAddress', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);
      expect(html).toContain('class="pdf-page map-page"');
      expect(html).toContain('Маршрут');
      expect(html).toContain('Минск');
    });

    it('не должен добавлять карту при includeMap = false', async () => {
      const settings = { ...defaultSettings, includeMap: false };
      const html = await buildPhotoBookHTML([completeTravel], settings);
      expect(html).not.toContain('class="pdf-page map-page"');
    });
  });

  describe('QR-коды и ссылки', () => {
    it('должен содержать QR-код для каждого путешествия', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('data:image/png;base64');
    });

    it('должен содержать ссылку на онлайн-версию', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('Онлайн-версия');
      expect(html).toContain('https://metravel.by/travels/complete-travel');
    });
  });

  describe('Номера страниц', () => {
    it('должен содержать номера страниц на всех страницах', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      // Номера страниц должны быть в разных местах
      const pageNumberPattern = /<div[^>]*>\d+<\/div>/g;
      const matches = html.match(pageNumberPattern);
      expect(matches?.length).toBeGreaterThan(0);
    });
  });

  describe('Стили и форматирование', () => {
    it('должен содержать все необходимые стили', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('<style>');
      expect(html).toContain('.pdf-page');
      expect(html).toContain('210mm'); // Ширина страницы
      expect(html).toContain('297mm'); // Высота страницы
      expect(html).toContain('page-break-after'); // Разрывы страниц
    });

    it('должен содержать правильные цвета и стили', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      expect(html).toContain('#ff9f5a'); // Оранжевый цвет
      expect(html).toContain('font-weight');
      expect(html).toContain('border-radius');
    });
  });

  describe('Валидация данных', () => {
    it('должен обработать путешествие без описания', async () => {
      const travelWithoutDesc = { ...completeTravel, description: null };
      const html = await buildPhotoBookHTML([travelWithoutDesc], defaultSettings);

      expect(html).toContain('Описание');
      expect(html).toContain('Описание путешествия отсутствует');
    });

    it('должен обработать путешествие без рекомендаций', async () => {
      const travelWithoutRec = { ...completeTravel, recommendation: null };
      const html = await buildPhotoBookHTML([travelWithoutRec], defaultSettings);

      // Рекомендации не должны быть, если их нет
      const recMatches = html.match(/Рекомендации/g);
      expect(recMatches?.length || 0).toBe(0);
    });

    it('должен обработать путешествие без плюсов и минусов', async () => {
      const travelWithoutPM = { ...completeTravel, plus: null, minus: null };
      const html = await buildPhotoBookHTML([travelWithoutPM], defaultSettings);

      // Плюсы и минусы не должны быть, если их нет
      expect(html).not.toContain('Плюсы');
      expect(html).not.toContain('Минусы');
    });
  });

  describe('Полная проверка структуры', () => {
    it('должен содержать правильную структуру HTML документа', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      // Проверяем структуру
      expect(html).toMatch(/<!doctype html>/i);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<head>/i);
      expect(html).toMatch(/<body>/i);
      expect(html).toMatch(/<\/body>/i);
      expect(html).toMatch(/<\/html>/i);

      // Проверяем наличие всех секций
      const sections = html.match(/<section[^>]*class="pdf-page[^"]*"/g);
      expect(sections?.length).toBeGreaterThanOrEqual(5); // cover + toc + 2 travel pages + gallery + final
    });

    it('должен содержать все изображения с правильными атрибутами', async () => {
      const html = await buildPhotoBookHTML([completeTravel], defaultSettings);

      // Все изображения должны иметь crossorigin
      const imgTags = html.match(/<img[^>]*>/g) || [];
      imgTags.forEach(img => {
        expect(img).toMatch(/crossorigin="anonymous"/i);
      });
    });
  });
});

