// __tests__/utils/pdfBookGenerator.test.ts
// ✅ ТЕСТЫ: Проверка генерации HTML для PDF с всеми элементами

import { buildPhotoBookHTML } from '@/src/utils/pdfBookGenerator';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockQRCode')),
}));

const proxied = (url: string) =>
  `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=1600&fit=inside`;
const proxiedHtml = (url: string) => proxied(url).replace(/&/g, '&amp;');

describe('buildPhotoBookHTML', () => {
  const mockTravel: TravelForBook = {
    id: 1,
    name: 'Тестовое путешествие',
    slug: 'test-travel',
    url: 'https://metravel.by/travels/test-travel',
    description: '<p>Описание путешествия с <strong>HTML</strong> тегами</p>',
    recommendation: '<ul><li>Рекомендация 1</li><li>Рекомендация 2</li></ul>',
    plus: 'Плюсы: красиво, интересно',
    minus: 'Минусы: дорого',
    countryName: 'Польша',
    cityName: 'Варшава',
    year: '2024',
    monthName: 'Январь',
    number_days: 5,
    travel_image_url: 'https://example.com/cover.jpg',
    travel_image_thumb_url: 'https://example.com/thumb.jpg',
    gallery: [
      { url: 'https://example.com/gallery1.jpg', id: 1 },
      { url: 'https://example.com/gallery2.jpg', id: 2 },
      { url: 'https://example.com/gallery3.jpg', id: 3 },
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

  describe('Обложка', () => {
    it('должен содержать обложку с заголовком', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page cover-page"');
      expect(html).toContain('Мои путешествия');
      expect(html).toContain('Тестовый альбом');
    });

    it('должен содержать информацию о количестве путешествий', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('1');
      expect(html).toContain('путешествие');
    });

    it('должен содержать год путешествия', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('2024');
    });

    it('должен содержать имя пользователя', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('TestUser');
    });

    it('должен содержать дату создания', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Создано');
      expect(html).toContain(new Date().getFullYear().toString());
    });

    it('должен содержать брендинг MeTravel', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('MeTravel');
    });
  });

  describe('Оглавление', () => {
    it('должен содержать оглавление когда includeToc = true', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Содержание');
      expect(html).toContain('class="pdf-page toc-page"');
    });

    it('не должен содержать оглавление когда includeToc = false', async () => {
      const settings = { ...defaultSettings, includeToc: false };
      const html = await buildPhotoBookHTML([mockTravel], settings);
      
      expect(html).not.toContain('Содержание');
    });

    it('должен содержать название путешествия в оглавлении', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен содержать страну в оглавлении', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Польша');
    });

    it('должен содержать миниатюру или изображение путешествия в оглавлении', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain(proxiedHtml(mockTravel.travel_image_thumb_url as string));
    });
  });

  describe('Страницы путешествий', () => {
    it('должен содержать страницу с фото путешествия', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page travel-photo-page"');
      expect(html).toContain(proxiedHtml(mockTravel.travel_image_url as string));
    });

    it('должен содержать название путешествия на странице с фото', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен содержать страницу с описанием', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page travel-text-page"');
      expect(html).toContain('Описание');
    });

    it('должен содержать текст описания', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Описание путешествия');
      // HTML теги должны быть санитизированы, но текст остаться
      expect(html).toContain('HTML');
    });

    it('должен содержать раздел рекомендаций', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Рекомендации');
      expect(html).toContain('Рекомендация 1');
    });

    it('должен содержать раздел плюсов', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Плюсы');
      expect(html).toContain('красиво, интересно');
    });

    it('должен содержать раздел минусов', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Минусы');
      expect(html).toContain('дорого');
    });

    it('должен содержать мета-информацию (страна, год, дни)', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Польша');
      expect(html).toContain('2024');
      expect(html).toContain('5');
      expect(html).toContain('дней');
    });

    it('должен содержать QR-код', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('data:image/png;base64');
    });

    it('должен содержать ссылку на онлайн-версию', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Онлайн-версия');
      expect(html).toContain('https://metravel.by/travels/test-travel');
    });

    it('должен содержать номера страниц', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      // Проверяем наличие номеров страниц (они должны быть в разных местах)
      const pageNumberMatches = html.match(/\d+/g);
      expect(pageNumberMatches?.length).toBeGreaterThan(0);
    });
  });

  describe('Галерея фотографий', () => {
    it('должен содержать галерею когда includeGallery = true', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Фотогалерея');
      expect(html).toContain('class="pdf-page gallery-page"');
    });

    it('не должен содержать галерею когда includeGallery = false', async () => {
      const settings = { ...defaultSettings, includeGallery: false };
      const html = await buildPhotoBookHTML([mockTravel], settings);
      
      expect(html).not.toContain('Фотогалерея');
    });

    it('должен содержать все фотографии из галереи', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain(proxiedHtml('https://example.com/gallery1.jpg'));
      expect(html).toContain(proxiedHtml('https://example.com/gallery2.jpg'));
      expect(html).toContain(proxiedHtml('https://example.com/gallery3.jpg'));
    });

    it('должен содержать название путешествия в галерее', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Тестовое путешествие');
    });

    it('должен содержать количество фотографий в галерее', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('3');
      expect(html).toContain('фотографии');
    });
  });

  describe('Страницы карты и координат', () => {
    it('должен добавлять карту, когда includeMap = true и есть координаты', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);

      expect(html).toContain('class="pdf-page map-page"');
      expect(html).toContain('Маршрут');
      expect(html).toContain('Минск');
    });

    it('не должен добавлять карту, когда includeMap = false', async () => {
      const settings = { ...defaultSettings, includeMap: false };
      const html = await buildPhotoBookHTML([mockTravel], settings);

      expect(html).not.toContain('class="pdf-page map-page"');
      expect(html).not.toContain('Маршрут');
    });
  });

  describe('Обработка пустых данных', () => {
    it('должен обработать путешествие без описания', async () => {
      const travelWithoutDescription = { ...mockTravel, description: null };
      const html = await buildPhotoBookHTML([travelWithoutDescription], defaultSettings);
      
      expect(html).toContain('Описание');
      expect(html).toContain('Описание путешествия отсутствует');
    });

    it('должен обработать путешествие без галереи', async () => {
      const travelWithoutGallery = { ...mockTravel, gallery: undefined };
      const html = await buildPhotoBookHTML([travelWithoutGallery], defaultSettings);
      
      // Галерея не должна быть создана, если нет фотографий
      const galleryMatches = html.match(/Фотогалерея/g);
      expect(galleryMatches).toBeNull();
    });

    it('должен обработать путешествие без изображения обложки', async () => {
      const travelWithoutImage = { ...mockTravel, travel_image_url: undefined, gallery: undefined };
      const html = await buildPhotoBookHTML([travelWithoutImage], defaultSettings);
      
      // Должен использоваться градиентный фон
      expect(html).toContain('linear-gradient');
    });
  });

  describe('Множественные путешествия', () => {
    it('должен обработать несколько путешествий', async () => {
      const travels: TravelForBook[] = [
        mockTravel,
        { ...mockTravel, id: 2, name: 'Второе путешествие', year: '2023' },
        { ...mockTravel, id: 3, name: 'Третье путешествие', year: '2022' },
      ];

      const html = await buildPhotoBookHTML(travels, defaultSettings);
      
      expect(html).toContain('Тестовое путешествие');
      expect(html).toContain('Второе путешествие');
      expect(html).toContain('Третье путешествие');
      expect(html).toContain('3');
      expect(html).toContain('путешествия');
    });

    it('должен правильно отсортировать путешествия по дате (desc)', async () => {
      const travels: TravelForBook[] = [
        { ...mockTravel, id: 1, name: 'Первое', year: '2022' },
        { ...mockTravel, id: 2, name: 'Второе', year: '2024' },
        { ...mockTravel, id: 3, name: 'Третье', year: '2023' },
      ];

      const html = await buildPhotoBookHTML(travels, defaultSettings);
      
      // Проверяем порядок появления в HTML (первое должно быть 2024)
      const firstTravelIndex = html.indexOf('Второе');
      const secondTravelIndex = html.indexOf('Третье');
      const thirdTravelIndex = html.indexOf('Первое');
      
      expect(firstTravelIndex).toBeLessThan(secondTravelIndex);
      expect(secondTravelIndex).toBeLessThan(thirdTravelIndex);
    });
  });

  describe('Заключительная страница', () => {
    it('должен содержать заключительную страницу', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page final-page"');
      expect(html).toContain('Спасибо за путешествие');
      expect(html).toContain('MeTravel');
    });
  });

  describe('Структура HTML', () => {
    it('должен быть валидным HTML документом', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('должен содержать стили', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('<style>');
      expect(html).toContain('.pdf-page');
      expect(html).toContain('210mm');
      expect(html).toContain('297mm');
    });

    it('должен экранировать HTML в тексте', async () => {
      const travelWithScript = {
        ...mockTravel,
        description: '<script>alert("xss")</script>Test',
      };
      const html = await buildPhotoBookHTML([travelWithScript], defaultSettings);
      
      // Скрипты должны быть удалены
      expect(html).not.toContain('<script>');
      expect(html).toContain('Test');
    });
  });
});

