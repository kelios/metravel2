// __tests__/services/pdf-export/TravelDataTransformer.test.ts
// ✅ ТЕСТЫ: Проверка трансформации данных для PDF экспорта

import { TravelDataTransformer } from '@/services/pdf-export/TravelDataTransformer';
import { ExportError } from '@/types/pdf-export';
import type { Travel } from '@/types/types';

describe('TravelDataTransformer', () => {
  let transformer: TravelDataTransformer;

  beforeEach(() => {
    transformer = new TravelDataTransformer();
  });

  describe('validate', () => {
    it('должен выбросить ошибку для пустого массива', () => {
      expect(() => transformer.validate([])).toThrow(ExportError);
      expect(() => transformer.validate([])).toThrow('Необходимо выбрать хотя бы одно путешествие');
    });

    it('должен выбросить ошибку для невалидного типа данных', () => {
      expect(() => transformer.validate(null as any)).toThrow(ExportError);
      expect(() => transformer.validate(undefined as any)).toThrow(ExportError);
    });

    it('должен выбросить ошибку для путешествия без ID', () => {
      const travels = [{ name: 'Test' }] as any[];
      expect(() => transformer.validate(travels)).toThrow(ExportError);
      expect(() => transformer.validate(travels)).toThrow('отсутствует ID');
    });

    it('должен выбросить ошибку для путешествия без названия', () => {
      const travels = [{ id: 1 }] as any[];
      expect(() => transformer.validate(travels)).toThrow(ExportError);
      expect(() => transformer.validate(travels)).toThrow('отсутствует название');
    });

    it('должен пройти валидацию для валидных данных', () => {
      const travels: Travel[] = [
        { id: 1, name: 'Test Travel', slug: 'test', url: 'test', youtube_link: '', userName: 'user', description: '', recommendation: '', plus: '', minus: '', cityName: '', countryName: '', countUnicIpView: '', gallery: [], travelAddress: [], userIds: '', year: '2024', monthName: 'Январь', number_days: 5, companions: [], countryCode: '', travel_image_thumb_url: '', travel_image_thumb_small_url: '' },
      ];
      expect(() => transformer.validate(travels)).not.toThrow();
    });
  });

  describe('transform', () => {
    it('должен преобразовать массив путешествий', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test Travel',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: 'Test description',
          recommendation: 'Test recommendation',
          plus: 'Test plus',
          minus: 'Test minus',
          cityName: 'Minsk',
          countryName: 'Belarus',
          countUnicIpView: '',
          gallery: ['https://example.com/image1.jpg'],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: 'Январь',
          number_days: 5,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Test Travel',
        slug: 'test',
        // normalizeRichText оборачивает простой текст в <p>
        description: '<p>Test description</p>',
        recommendation: '<p>Test recommendation</p>',
        plus: '<p>Test plus</p>',
        minus: '<p>Test minus</p>',
        countryName: 'Belarus',
        cityName: 'Minsk',
        year: '2024',
        monthName: 'Январь',
        number_days: 5,
      });
    });

    it('должен преобразовать галерею из массива строк', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].gallery).toHaveLength(2);
      expect(result[0].gallery?.[0]).toMatchObject({
        url: 'https://images.weserv.nl/?url=example.com%2Fimg1.jpg&w=1600&fit=inside',
      });
      expect(result[0].gallery?.[1]).toMatchObject({
        url: 'https://images.weserv.nl/?url=example.com%2Fimg2.jpg&w=1600&fit=inside',
      });
    });

    it('должен преобразовать галерею из массива объектов', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [
            { url: 'https://example.com/img1.jpg', id: 1 },
            { url: 'https://example.com/img2.jpg', id: 2 },
          ] as any,
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].gallery).toHaveLength(2);
      expect(result[0].gallery?.[0]).toMatchObject({
        url: 'https://images.weserv.nl/?url=example.com%2Fimg1.jpg&w=1600&fit=inside',
        id: 1,
      });
    });

    it('должен отфильтровать пустые значения из галереи', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: ['https://example.com/img1.jpg', '', null, undefined, 'https://example.com/img2.jpg'] as any,
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].gallery).toHaveLength(2);
      expect(result[0].gallery?.every(g => g.url && g.url.trim().length > 0)).toBe(true);
    });

    it('должен преобразовать travelAddress', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [
            { id: 1, address: 'Address 1', coord: '1,1', categoryName: 'Category 1' },
            { id: 2, address: 'Address 2', coord: '2,2' },
          ] as any,
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].travelAddress).toHaveLength(2);
      expect(result[0].travelAddress?.[0]).toMatchObject({
        id: '1',
        address: 'Address 1',
        coord: '1,1',
        categoryName: 'Category 1',
      });
    });

    it('должен обработать пустые значения', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: null as any,
          recommendation: undefined as any,
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: null as any,
          travelAddress: undefined as any,
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].description).toBeNull();
      expect(result[0].recommendation).toBeNull();
      expect(result[0].gallery).toBeUndefined();
      expect(result[0].travelAddress).toBeUndefined();
    });

    it('должен нормализовать строковые поля со значениями "null" и "undefined"', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: 'null' as any,
          recommendation: ' Undefined ' as any,
          plus: '   ',
          minus: '{}',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].description).toBeNull();
      expect(result[0].recommendation).toBeNull();
      expect(result[0].plus).toBeNull();
      expect(result[0].minus).toBeNull();
    });

    it('должен сохранять валидный HTML контент', () => {
      const richHtml = '<p>Текст <strong>с форматированием</strong></p>';
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: richHtml,
          recommendation: richHtml,
          plus: richHtml,
          minus: richHtml,
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].description).toBe(richHtml);
      expect(result[0].recommendation).toBe(richHtml);
      expect(result[0].plus).toBe(richHtml);
      expect(result[0].minus).toBe(richHtml);
    });

    it('должен очищать CSS переменные в контенте', () => {
      const richHtml = '<style>:root{--bg:#fff;--fg:#000;}</style><p style="color:var(--fg);background:var(--bg);">text</p>';
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: richHtml,
          recommendation: richHtml,
          plus: richHtml,
          minus: richHtml,
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      // var(--bg/--fg) заменяются на SAFE_COLOR_FALLBACK (rgb(31, 41, 55)),
      // inline-стили санитизируются до явных color/background значений
      expect(result[0].description).toMatch(/color\s*:\s*rgb\(31,\s*41,\s*55\)/);
      expect(result[0].description).toMatch(/background(-color)?\s*:\s*rgb\(31,\s*41,\s*55\)/);
      expect(result[0].description).not.toContain('--bg');
      expect(result[0].description).not.toContain(':root');
    });

    it('должен удалять скрипты и обработчики событий из richText', () => {
      const richHtml = `
        <p>Текст</p>
        <script>alert('xss')</script>
        <img src="javascript:alert(1)" onerror="alert(2)" />
        <a href="javascript:alert(3)">link</a>
      `;
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: richHtml,
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].description).not.toContain('<script');
      expect(result[0].description).not.toContain('onerror');
      expect(result[0].description).not.toContain('javascript:');
    });

    it('должен сохранять HTML img теги в richText (не удалять как RN <Image/>)', () => {
      const richHtml = '<p>До картинки</p><img src="https://example.com/cat.jpg" alt="cat"/><p>После картинки</p>';
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: richHtml,
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);

      expect(result[0].description).toContain('<img');
      expect(result[0].description).toContain('alt="cat"');
      // src должен быть переписан через безопасный прокси
      expect(result[0].description).toContain('https://images.weserv.nl/?url=');
    });

    it('должен переписывать локальные IP в richText <img src> на prod домен', () => {
      const richHtml = '<p>Фото</p><img src="https://192.168.50.36/gallery/5076/conversions/a.jpg?v=1" alt="a"/>';
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: richHtml,
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [],
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);
      expect(result[0].description).toContain('https://images.weserv.nl/?url=');
      // Внутри параметра url должен быть уже продовый домен, а не локальный IP
      expect(result[0].description).toContain(encodeURIComponent('metravel.by/gallery/5076/conversions/a.jpg?v=1'));
      expect(result[0].description).not.toContain('192.168.50.36');
    });

    it('должен нормализовать travelAddress.travelImageThumbUrl и переписать локальные IP на prod домен', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [
            {
              id: 1,
              address: 'Point',
              coord: '1,1',
              travelImageThumbUrl: 'https://192.168.50.36/gallery/5076/conversions/a-thumb.jpg',
            },
          ] as any,
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);
      const thumb = result[0].travelAddress?.[0]?.travelImageThumbUrl;
      expect(thumb).toBeTruthy();
      expect(String(thumb)).toContain('https://images.weserv.nl/?url=');
      expect(String(thumb)).toContain(encodeURIComponent('metravel.by/gallery/5076/conversions/a-thumb.jpg'));
      expect(String(thumb)).not.toContain('192.168.50.36');
    });

    it('должен сохранять blob URL для travelAddress.travelImageThumbUrl', () => {
      const travels: Travel[] = [
        {
          id: 1,
          name: 'Test',
          slug: 'test',
          url: 'test',
          youtube_link: '',
          userName: 'user',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          cityName: '',
          countryName: '',
          countUnicIpView: '',
          gallery: [],
          travelAddress: [
            { id: 1, address: 'Point', coord: '1,1', travelImageThumbUrl: 'blob:local-image' },
          ] as any,
          userIds: '',
          year: '2024',
          monthName: '',
          number_days: 0,
          companions: [],
          countryCode: '',
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
        },
      ];

      const result = transformer.transform(travels);
      expect(result[0].travelAddress?.[0]?.travelImageThumbUrl).toBe('blob:local-image');
    });
  });
});
