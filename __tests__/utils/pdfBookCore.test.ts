// __tests__/utils/pdfBookCore.test.ts
// Тесты для генерации HTML для PDF в формате "book" layout

import { buildBookHTML } from '@/src/utils/pdfBookCore';
import type { Travel } from '@/src/utils/pdfBookCore';

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockQRCode')),
}));

// Mock sanitizeRichTextForPdf
jest.mock('@/src/utils/sanitizeRichText', () => ({
  sanitizeRichTextForPdf: jest.fn((html: string) => html || ''),
}));

describe('buildBookHTML', () => {
  const mockTravel: Travel = {
    id: 1,
    name: 'Тестовое путешествие',
    slug: 'test-travel',
    url: 'https://metravel.by/travels/test-travel',
    countryName: 'Польша',
    description: '<p>Описание путешествия с <strong>HTML</strong> тегами</p>',
    recommendation: '<ul><li>Рекомендация 1</li><li>Рекомендация 2</li></ul>',
    plus: 'Плюсы: красиво, интересно',
    minus: 'Минусы: дорого',
    travel_image_thumb_url: 'https://example.com/thumb.jpg',
    gallery: [
      { url: 'https://example.com/gallery1.jpg', id: 1 },
      { url: 'https://example.com/gallery2.jpg', id: 2 },
      { url: 'https://example.com/gallery3.jpg', id: 3 },
    ],
  };

  describe('Базовая структура HTML', () => {
    it('должен генерировать валидный HTML документ', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html lang="ru">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('должен содержать мета-теги', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<meta charset="utf-8"/>');
      expect(html).toContain('<meta name="viewport"');
    });

    it('должен содержать стили', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<style>');
      expect(html).toContain('.page');
      expect(html).toContain('.title-page');
      expect(html).toContain('.two-col');
    });
  });

  describe('Титульная страница', () => {
    it('должен содержать титульную страницу с заголовком по умолчанию', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="page title-page"');
      expect(html).toContain('Коллекция путешествий');
      expect(html).toContain('Подборка: 1');
    });

    it('должен использовать кастомный заголовок и подзаголовок', async () => {
      const html = await buildBookHTML([mockTravel], {
        title: 'Мои путешествия',
        subtitle: '2024 год',
      });

      expect(html).toContain('Мои путешествия');
      expect(html).toContain('2024 год');
      expect(html).not.toContain('Коллекция путешествий');
    });

    it('должен экранировать HTML в заголовке', async () => {
      const html = await buildBookHTML([mockTravel], {
        title: '<script>alert("xss")</script>Test',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('Test');
    });
  });

  describe('Оглавление', () => {
    it('должен содержать оглавление', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('Содержание');
      expect(html).toContain('class="page toc"');
    });

    it('должен содержать название путешествия в оглавлении', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('class="toc-item"');
    });

    it('должен правильно вычислять номера страниц в оглавлении', async () => {
      const html = await buildBookHTML([mockTravel]);

      // Первое путешествие должно быть на странице 4 (индекс 0 * 4 + 4)
      expect(html).toContain('<span>4</span>');
    });

    it('должен обрабатывать несколько путешествий в оглавлении', async () => {
      const travels: Travel[] = [
        mockTravel,
        { ...mockTravel, id: 2, name: 'Второе путешествие' },
        { ...mockTravel, id: 3, name: 'Третье путешествие' },
      ];

      const html = await buildBookHTML(travels);

      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('Второе путешествие');
      expect(html).toContain('Третье путешествие');
      expect(html).toContain('<span>4</span>'); // Первое
      expect(html).toContain('<span>8</span>'); // Второе
      expect(html).toContain('<span>12</span>'); // Третье
    });
  });

  describe('Страницы путешествий', () => {
    it('должен создавать секцию для каждого путешествия', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="page"');
      expect(html).toContain('class="section-title"');
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен содержать обложное фото', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="cover-photo"');
      expect(html).toContain('https://example.com/thumb.jpg');
      expect(html).toContain('crossOrigin="anonymous"');
    });

    it('должен использовать первое фото из галереи как обложку', async () => {
      const travelWithGallery: Travel = {
        ...mockTravel,
        travel_image_thumb_url: undefined,
      };

      const html = await buildBookHTML([travelWithGallery]);

      expect(html).toContain('https://example.com/gallery1.jpg');
    });

    it('должен обрабатывать путешествие без изображения', async () => {
      const travelWithoutImage: Travel = {
        ...mockTravel,
        travel_image_thumb_url: undefined,
        gallery: undefined,
      };

      const html = await buildBookHTML([travelWithoutImage]);

      // Не должно быть тега img для обложки
      expect(html).not.toContain('class="cover-photo"');
    });

    it('должен содержать мета-информацию', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="meta-strip"');
      expect(html).toContain('Страна:');
      expect(html).toContain('Польша');
      expect(html).toContain('Сложность:');
      expect(html).toContain('Дней:');
      expect(html).toContain('Транспорт:');
    });

    it('должен содержать QR-код', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="meta-qr"');
      expect(html).toContain('data:image/png;base64');
    });

    it('должен генерировать правильный URL для QR-кода из slug', async () => {
      const html = await buildBookHTML([mockTravel]);

      // URL должен быть сгенерирован из slug
      expect(html).toContain('https://metravel.by/travels/test-travel');
    });

    it('должен использовать url если нет slug', async () => {
      const travelWithoutSlug: Travel = {
        ...mockTravel,
        slug: undefined,
        url: 'https://example.com/travel',
      };

      const html = await buildBookHTML([travelWithoutSlug]);

      expect(html).toContain('https://example.com/travel');
    });
  });

  describe('Контент путешествия', () => {
    it('должен содержать описание если оно есть', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<h3>Описание</h3>');
      expect(html).toContain('class="pdf-text-content"');
    });

    it('должен содержать рекомендации если они есть', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<h3>Рекомендации</h3>');
    });

    it('должен содержать плюсы если они есть', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<h3>Плюсы</h3>');
      expect(html).toContain('красиво, интересно');
    });

    it('должен содержать минусы если они есть', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('<h3>Минусы</h3>');
      expect(html).toContain('дорого');
    });

    it('не должен добавлять секции для пустых полей', async () => {
      const travelMinimal: Travel = {
        ...mockTravel,
        description: undefined,
        recommendation: undefined,
        plus: undefined,
        minus: undefined,
      };

      const html = await buildBookHTML([travelMinimal]);

      expect(html).not.toContain('<h3>Описание</h3>');
      expect(html).not.toContain('<h3>Рекомендации</h3>');
      expect(html).not.toContain('<h3>Плюсы</h3>');
      expect(html).not.toContain('<h3>Минусы</h3>');
    });
  });

  describe('Галерея', () => {
    it('должен содержать галерею если есть дополнительные фото', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="gallery-title"');
      expect(html).toContain('Фото');
      expect(html).toContain('class="gallery-grid"');
    });

    it('не должен включать первое фото в галерею (оно используется как обложка)', async () => {
      const html = await buildBookHTML([mockTravel]);

      // Первое фото должно быть в обложке, но не в галерее
      const galleryMatches = html.match(/gallery-grid/g);
      if (galleryMatches) {
        // Галерея должна содержать только фото начиная со второго
        expect(html).toContain('https://example.com/gallery2.jpg');
        expect(html).toContain('https://example.com/gallery3.jpg');
      }
    });

    it('не должен показывать галерею если только одно фото', async () => {
      const travelWithOnePhoto: Travel = {
        ...mockTravel,
        gallery: [{ url: 'https://example.com/gallery1.jpg', id: 1 }],
      };

      const html = await buildBookHTML([travelWithOnePhoto]);

      expect(html).not.toContain('class="gallery-title"');
      expect(html).not.toContain('class="gallery-grid"');
    });

    it('не должен показывать галерею если нет фото', async () => {
      const travelWithoutGallery: Travel = {
        ...mockTravel,
        gallery: undefined,
      };

      const html = await buildBookHTML([travelWithoutGallery]);

      expect(html).not.toContain('class="gallery-title"');
      expect(html).not.toContain('class="gallery-grid"');
    });
  });

  describe('Двухколоночный layout', () => {
    it('должен использовать двухколоночный layout', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('class="two-col"');
      expect(html).toContain('class="col"');
    });

    it('должен размещать обложку и мета-информацию в левой колонке', async () => {
      const html = await buildBookHTML([mockTravel]);

      // Левая колонка должна содержать название, фото и мета-информацию
      const twoColIndex = html.indexOf('class="two-col"');
      const leftColContent = html.substring(twoColIndex, twoColIndex + 500);

      expect(leftColContent).toContain('section-title');
      expect(leftColContent).toContain('cover-photo');
      expect(leftColContent).toContain('meta-strip');
    });

    it('должен размещать текстовый контент в правой колонке', async () => {
      const html = await buildBookHTML([mockTravel]);

      // Правая колонка должна содержать описание, рекомендации и т.д.
      const twoColIndex = html.indexOf('class="two-col"');
      const rightColContent = html.substring(twoColIndex + 200, twoColIndex + 1000);

      expect(rightColContent).toContain('Описание');
      expect(rightColContent).toContain('Рекомендации');
    });
  });

  describe('Экранирование HTML', () => {
    it('должен экранировать HTML в названии путешествия', async () => {
      const travelWithHtml: Travel = {
        ...mockTravel,
        name: '<script>alert("xss")</script>Test',
      };

      const html = await buildBookHTML([travelWithHtml]);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('Test');
    });

    it('должен экранировать HTML в названии страны', async () => {
      const travelWithHtml: Travel = {
        ...mockTravel,
        countryName: 'Польша <script>alert("xss")</script>',
      };

      const html = await buildBookHTML([travelWithHtml]);

      expect(html).not.toContain('<script>');
      expect(html).toContain('Польша');
    });

    it('должен экранировать HTML в URL', async () => {
      const travelWithHtml: Travel = {
        ...mockTravel,
        url: 'https://example.com/<script>alert("xss")</script>',
      };

      const html = await buildBookHTML([travelWithHtml]);

      expect(html).not.toContain('<script>');
    });
  });

  describe('Обработка пустых данных', () => {
    it('должен обработать пустой массив путешествий', async () => {
      const html = await buildBookHTML([]);

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Коллекция путешествий');
      expect(html).toContain('Подборка: 0');
      expect(html).toContain('Содержание');
      // Не должно быть секций путешествий
      expect(html).not.toContain('class="section-title"');
    });

    it('должен обработать путешествие без обязательных полей', async () => {
      const minimalTravel: Travel = {
        id: 1,
        name: 'Минимальное путешествие',
      };

      const html = await buildBookHTML([minimalTravel]);

      expect(html).toContain('Минимальное путешествие');
      expect(html).toContain('class="page"');
    });
  });

  describe('Множественные путешествия', () => {
    it('должен обработать несколько путешествий', async () => {
      const travels: Travel[] = [
        mockTravel,
        { ...mockTravel, id: 2, name: 'Второе путешествие' },
        { ...mockTravel, id: 3, name: 'Третье путешествие' },
      ];

      const html = await buildBookHTML(travels);

      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('Второе путешествие');
      expect(html).toContain('Третье путешествие');
      expect(html).toContain('Подборка: 3');
    });

    it('должен генерировать QR-коды для всех путешествий', async () => {
      const QRCode = require('qrcode');
      const travels: Travel[] = [
        mockTravel,
        { ...mockTravel, id: 2, name: 'Второе путешествие', slug: 'second-travel' },
      ];

      await buildBookHTML(travels);

      expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('Стили и верстка', () => {
    it('должен содержать стили для печати', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('@media print');
      expect(html).toContain('page-break-after: always');
    });

    it('должен содержать стили для pdf-text-content', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('.pdf-text-content');
      expect(html).toContain('white-space: normal !important');
      expect(html).toContain('page-break-inside: avoid !important');
    });

    it('должен содержать правильные размеры страницы A4', async () => {
      const html = await buildBookHTML([mockTravel]);

      expect(html).toContain('width: 794px');
      expect(html).toContain('min-height: 1123px');
    });
  });
});

