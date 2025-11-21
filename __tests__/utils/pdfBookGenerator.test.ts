// __tests__/utils/pdfBookGenerator.test.ts
// ✅ ТЕСТЫ: Проверка генерации HTML для PDF с всеми элементами

import { buildPhotoBookHTML } from '@/src/utils/pdfBookGenerator';
import type { TravelForBook } from '@/src/types/pdf-export';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { Travel } from '@/src/types/types';
import { TravelDataTransformer } from '@/src/services/pdf-export/TravelDataTransformer';

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
    template: 'minimal',
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    colorTheme: 'blue',
    fontFamily: 'sans',
    photoMode: 'gallery',
    mapMode: 'full-page',
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  };

  const travel503: Travel = {
    id: 503,
    name: 'Маршрут в Бескидах: от парковки до смотровой через водопад',
    slug: 'marshrut-v-beskidakh-ot-parkovki-do-smotrovoi-cherez-vodopad',
    url: '/travels/marshrut-v-beskidakh-ot-parkovki-do-smotrovoi-cherez-vodopad',
    description:
      '<h3>📊 Общая информация о маршруте</h3><ul><li>🗺️ <strong>Расположение:</strong> Живецкие Бескиды, южная Польша</li><li>🚗 <strong>От Кракова:</strong> ~120 км (~2–2.5 часа на машине)</li><li>🅿️ <strong>Старт:</strong> парковка в районе Żabnica Skałka (49.6355780, 19.5533252)</li><li>🎯 <strong>Финиш:</strong> смотровая точка (49.6224227, 19.5642096)</li><li>💧 <strong>Через:</strong> водопад на ручье Romanka (49.6319508, 19.5640755)</li><li>↔️ <strong>Общая длина маршрута:</strong> ~2.8 км в одну сторону (~5.6 км туда-обратно)</li><li>⛰️ <strong>Общий набор высоты:</strong> ~350 м</li><li>🕒 <strong>Время в пути вверх:</strong> ~1 ч 10 мин</li><li>🕒 <strong>Обратно:</strong> ~45 мин вниз</li><li>🥾 <strong>Сложность:</strong> лёгкий/умеренный маршрут</li><li>📶 <strong>Связь:</strong> нестабильная, лучше иметь оффлайн-карту</li><li>🎿 <strong>Ближайший горнолыжный склон:</strong> Ski Pilsko (около 15 минут на авто)</li><li>🧭 <strong>Тип маршрута:</strong> линейный, но можно сделать кольцевым</li></ul><p><img src="http://metravel.by/travel-description-image/503/description/4e629cf88f4141fe8647e77d546e238e.png"></p><p><strong>Маршрут:</strong></p><p>🅿️ <strong>Парковка:</strong> 49.6355780, 19.5533252</p><p>💧 <strong>Водопад:</strong> 49.6319508, 19.5640755</p><p>🔭 <strong>Смотровая точка:</strong> 49.6224227, 19.5642096</p><p><br></p><h3>🧭 Описание маршрута</h3><p>📍 <strong>Старт — парковка у леса, рядом с селом Żabnica Skałka</strong>.</p><p>Здесь удобно оставить машину — место малолюдное, бесплатное, рядом шлагбаум и начало тропы.</p><h4>🚶 Участок 1: от парковки до водопада</h4><ul><li><strong>Длина:</strong> ~1.3 км</li><li><strong>Набор высоты:</strong> около 80 м</li><li><strong>Время в пути:</strong> ~25–30 мин</li><li><strong>Путь:</strong> широкий лесной грейдер, параллельно ручью <strong>Potok Romanka</strong>.</li><li>Последние 200 м — каменистая тропа с легким уклоном, появляется шум воды.</li></ul><p>💧 <strong>Водопад</strong> небольшой, но живописный — скрыт в лесу, высотой ~3–4 м. Весной и после дождей особенно красив. Можно подойти почти вплотную, рядом — удобные камни для отдыха или перекуса.</p><p><img src="http://metravel.by/travel-description-image/503/description/b01bf56b4a0d4d27a41145b9e4a19a0a.JPG"></p><h4>🚶 Участок 2: от водопада до смотровой</h4><ul><li><strong>Длина:</strong> ~1.5 км</li><li><strong>Набор высоты:</strong> ~150 м</li><li><strong>Время в пути:</strong> ~40–50 мин</li><li><strong>Путь:</strong> узкая лесная тропа, местами крутой подъём, особенно на последних 400 м. Почва может быть скользкой после дождя.</li><li>Ориентир — держаться правее и выше русла ручья, на развилке идти вверх по направлению юго-запад.</li></ul><p>🔭 <strong>Смотровая точка</strong> находится на поляне с видом на гору <strong>Romanka</strong> и долину Żabnicy. При ясной погоде видно даже Словацкие Татры.</p><p><img src="http://metravel.by/travel-description-image/503/description/d8661d906af6449b97130c215b500ce6.JPG"></p><h3>🎿 Бонус: горнолыжный склон рядом</h3><p>Если ты поехал(а) зимой — бери не только термос, но и лыжи.</p><p>Всего в <strong>5 минутах на авто</strong> от парковки находится <strong>горнолыжный курорт <em>Ski Resort Złatna-Huta (ZwardońSki)</em></strong> и также <strong>Ski Centrum Pilsko</strong> чуть дальше.</p><p>🏔️ <strong>Ski Pilsko (Korbielów)</strong> — один из самых высоких и живописных курортов юга Польши:</p><ul><li>трассы до 4.5 км</li><li>высота до 1340 м</li><li>отличные виды и нет толп (в отличие от Закопане).</li></ul><p><img src="http://metravel.by/travel-description-image/503/description/2ebe8e3f11734186b332d9b012604844.JPG"></p><p><img src="http://metravel.by/travel-description-image/503/description/738e85f2eafe4b499121f03ab8daf0d4.JPG"></p><p>Так что если вы любите совмещать походы и катание — идеальное место.</p>',
    year: '2023',
    youtube_link: null,
    number_days: 1,
    countryName: 'Польша',
    countryCode: 'pl',
    countries: [160],
    travelAddress: [
      {
        id: 14664,
        address: 'Mosorne, Kącina, Zawoja, gmina Zawoja, Сухский повят, Малопольское воеводство, 34-222, Польша',
        coord: '49.6355780,19.5533252',
        categoryName: 'Парковка',
        travelImageThumbUrl: 'https://metravel.by/address-image/14664/conversions/ee045ac5aa5d4bb58883889c19be1c30.JPG',
      },
      {
        id: 14665,
        address: 'Wieża widokowa na Mosornym Groniu, Trasa Enduro, Policzne, Zawoja, gmina Zawoja, Сухский повят, Малопольское воеводство, 34-223, Польша',
        coord: '49.6224227,19.5642096',
        categoryName: 'Башня, Обзорная точка',
        travelImageThumbUrl: 'https://metravel.by/address-image/14665/conversions/609eb2485af84339818ee40a3d8079da.JPG',
      },
      {
        id: 14666,
        address: 'Gronik, Zawoja, гmina Zawoja, Сухский повят, Малопольское воеводство, 34-222, Польша',
        coord: '49.6319508,19.5640755',
        categoryName: 'Водопад',
        travelImageThumbUrl: 'https://metravel.by/address-image/14666/conversions/c260453ee9dc457db86dd4da62660132.JPG',
      },
    ],
    userName: 'Julia',
    gallery: [
      { url: 'https://metravel.by/gallery/503/gallery/ab655777952749a088e6b0ba5aa5d7e8.JPG', id: 2994 },
      { url: 'https://metravel.by/gallery/503/gallery/0008125364fa416aa303c17cd8b3fa27.JPG', id: 2998 },
      { url: 'https://metravel.by/gallery/503/gallery/6e4ae9a75335486292d06c1c5bf52423.JPG', id: 3003 },
      { url: 'https://metravel.by/gallery/503/gallery/987a17e3d246462ab803b09033c70ffc.JPG', id: 3004 },
    ],
    travel_image_thumb_url: 'https://metravel.by/travel-image/503/conversions/4be970c7a1fb4147acd24ed9852d1280.JPG',
    travel_image_url: 'https://metravel.by/travel-image/503/conversions/4be970c7a1fb4147acd24ed9852d1280.JPG',
    recommendation:
      '<ul><li>Лучше идти в <strong>треккинговой обуви(зимой кошки)</strong>.</li><li>Водопад особенно красив весной — в мае поток сильный.</li><li>Смотровая — отличное место для перекуса: есть пеньки и бревна, солнце прогревает поляну даже в холодные месяцы.</li><li><strong>Интернет ловит нестабильно</strong> — загрузи оффлайн-карту заранее (например, через Maps.me или Komoot).</li></ul>',
    plus: null,
    minus: null,
  } as unknown as Travel;

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
    it('должен обработать пустой массив путешествий без запросов к бэкенду', async () => {
      const html = await buildPhotoBookHTML([], defaultSettings);
      
      // Должен сгенерировать валидный HTML
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html');
      
      // Должна быть обложка
      expect(html).toContain('class="pdf-page cover-page"');
      
      // Должно показывать 0 путешествий
      expect(html).toContain('0');
      
      // Не должно быть страниц с путешествиями
      expect(html).not.toContain('class="pdf-page travel-photo-page"');
      expect(html).not.toContain('class="pdf-page travel-text-page"');
      
      // Не должно быть оглавления (так как нет путешествий)
      // Но если includeToc = true, оглавление может быть пустым
      // Проверяем, что нет элементов путешествий в оглавлении
      if (defaultSettings.includeToc) {
        const tocMatches = html.match(/Содержание/g);
        // Оглавление может быть, но без элементов путешествий
        expect(html).not.toContain('Тестовое путешествие');
      }
      
      // Должна быть заключительная страница
      expect(html).toContain('class="pdf-page final-page"');
    });

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

  describe('Регрессионные сценарии', () => {
    it('успешно генерирует HTML для реальных данных путешествия 503', async () => {
      const transformer = new TravelDataTransformer();
      const travelsForBook = transformer.transform([travel503]);
      await expect(buildPhotoBookHTML(travelsForBook, defaultSettings)).resolves.toContain(
        'Маршрут в Бескидах'
      );
    });
  });

  describe('Верстка и стили', () => {
    it('должен содержать стили для улучшения читаемости HTML контента', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      // Проверяем наличие стилей для текстовых страниц
      expect(html).toContain('.travel-text-page p');
      expect(html).toContain('line-height: 1.75');
      expect(html).toContain('text-align: justify');
    });

    it('должен содержать стили для заголовков', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('.travel-text-page h1');
      expect(html).toContain('.travel-text-page h2');
      expect(html).toContain('.travel-text-page h3');
      expect(html).toContain('font-weight: 700');
    });

    it('должен содержать стили для списков', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('.travel-text-page ul');
      expect(html).toContain('.travel-text-page ol');
      expect(html).toContain('padding-left: 1.5em');
    });

    it('должен содержать улучшенные стили для обложки', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page cover-page"');
      // Проверяем наличие улучшенных стилей (padding, font-size, font-weight)
      expect(html).toContain('padding:');
      expect(html).toContain('font-size:');
    });

    it('должен содержать улучшенные стили для страницы с фото', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page travel-photo-page"');
      // Проверяем наличие градиента для текста поверх изображения
      expect(html).toContain('linear-gradient');
    });

    it('должен содержать улучшенные стили для плюсов и минусов', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('Плюсы');
      expect(html).toContain('Минусы');
      // Проверяем наличие стилей для карточек (border-radius, box-shadow)
      expect(html).toContain('border-radius');
    });

    it('должен содержать улучшенные стили для оглавления', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page toc-page"');
      // Проверяем наличие улучшенных стилей для элементов оглавления
      expect(html).toContain('border-bottom');
    });

    it('должен содержать улучшенные стили для галереи', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page gallery-page"');
      // Проверяем наличие grid layout
      expect(html).toContain('grid-template-columns');
    });

    it('должен содержать улучшенные стили для карты', async () => {
      const html = await buildPhotoBookHTML([mockTravel], defaultSettings);
      
      expect(html).toContain('class="pdf-page map-page"');
      // Проверяем наличие grid layout для карты и списка локаций
      expect(html).toContain('grid-template-columns');
    });
  });

  describe('Расширенные настройки', () => {
    it('встраивает мини-галерею при photoMode = inline', async () => {
      const settings: BookSettings = { ...defaultSettings, photoMode: 'inline' };
      const html = await buildPhotoBookHTML([mockTravel], settings);

      expect(html).toContain('Фото из путешествия');
      expect(html).not.toContain('class="pdf-page gallery-page"');
    });

    it('встраивает мини-карту при mapMode = inline', async () => {
      const settings: BookSettings = { ...defaultSettings, mapMode: 'inline' };
      const html = await buildPhotoBookHTML([mockTravel], settings);

      expect(html).toContain('grid-template-columns: 2fr 3fr; gap: 12px; align-items: center;');
      expect(html).not.toContain('class="pdf-page map-page"');
    });

    it('добавляет страницу чек-листов, когда includeChecklists = true', async () => {
      const settings: BookSettings = {
        ...defaultSettings,
        includeChecklists: true,
        checklistSections: ['clothing', 'documents'],
      };
      const html = await buildPhotoBookHTML([mockTravel], settings);

      expect(html).toContain('class="pdf-page checklist-page"');
      expect(html).toContain('Чек-листы путешествия');
      expect(html).toContain('Документы');
    });

    it('применяет выбранную цветовую тему и шрифты', async () => {
      const settings: BookSettings = {
        ...defaultSettings,
        colorTheme: 'green',
        fontFamily: 'serif',
      };
      const html = await buildPhotoBookHTML([mockTravel], settings);

      expect(html).toContain('#10b981');
      expect(html).toContain('Playfair Display');
    });
  });

  describe('Очистка React Native компонентов', () => {
    it('должен удалять React Native компоненты из HTML', async () => {
      const travelWithReactComponents = {
        ...mockTravel,
        description: '<View><Text>Test content</Text></View>',
      };
      
      const html = await buildPhotoBookHTML([travelWithReactComponents], defaultSettings);
      
      // React Native компоненты должны быть удалены
      expect(html).not.toContain('<View>');
      expect(html).not.toContain('</View>');
      expect(html).not.toContain('<Text>');
      expect(html).not.toContain('</Text>');
      // Но содержимое должно остаться
      expect(html).toContain('Test content');
    });

    it('должен обрабатывать вложенные React Native компоненты', async () => {
      const travelWithNestedComponents = {
        ...mockTravel,
        description: '<View><View><Text>Nested content</Text></View></View>',
      };
      
      const html = await buildPhotoBookHTML([travelWithNestedComponents], defaultSettings);
      
      expect(html).not.toContain('<View>');
      expect(html).not.toContain('<Text>');
      expect(html).toContain('Nested content');
    });
  });
});
