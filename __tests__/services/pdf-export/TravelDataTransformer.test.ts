// __tests__/services/pdf-export/TravelDataTransformer.test.ts
// ✅ ТЕСТЫ: Проверка трансформации данных для PDF экспорта

import { TravelDataTransformer } from '@/src/services/pdf-export/TravelDataTransformer';
import { ExportError, ExportErrorType } from '@/src/types/pdf-export';
import type { Travel } from '@/src/types/types';

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
        url: 'https://example.com/img1.jpg',
      });
      expect(result[0].gallery?.[1]).toMatchObject({
        url: 'https://example.com/img2.jpg',
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
        url: 'https://example.com/img1.jpg',
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
        },
      ];

      const result = transformer.transform(travels);

      // var(--bg/--fg) заменяются на SAFE_COLOR_FALLBACK (#1f2937),
      // inline-стили санитизируются до явных color/background значений
      expect(result[0].description).toContain('style="color:#1f2937; background:#1f2937;"');
      expect(result[0].description).not.toContain('--bg');
      expect(result[0].description).not.toContain(':root');
    });
  });
});

