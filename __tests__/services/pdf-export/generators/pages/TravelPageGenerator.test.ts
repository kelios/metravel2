// __tests__/services/pdf-export/generators/pages/TravelPageGenerator.test.ts

import { TravelPageGenerator } from '@/src/services/pdf-export/generators/pages';
import { minimalTheme } from '@/src/services/pdf-export/themes/PdfThemeConfig';

describe('TravelPageGenerator', () => {
  let generator: TravelPageGenerator;

  beforeEach(() => {
    generator = new TravelPageGenerator(minimalTheme);
  });

  const mockTravel = {
    id: 1,
    name: 'Париж',
    countryName: 'Франция',
    year: 2024,
    description: 'Прекрасный город',
    travel_image_url: 'https://example.com/paris.jpg',
  };

  describe('generateSpread', () => {
    it('должен генерировать разворот (2 страницы)', () => {
      const html = generator.generateSpread(mockTravel, 3);

      expect(html).toContain('travel-photo-page');
      expect(html).toContain('travel-content-page');
    });

    it('должен содержать название путешествия', () => {
      const html = generator.generateSpread(mockTravel, 3);

      expect(html).toContain('Париж');
    });
  });

  describe('generatePhotoPage', () => {
    it('должен генерировать страницу с фото', () => {
      const html = generator.generatePhotoPage(mockTravel, 3);

      expect(html).toContain('Париж');
      expect(html).toContain('https://example.com/paris.jpg');
      expect(html).toContain('travel-photo-page');
    });

    it('должен отображать метаданные в оверлее', () => {
      const html = generator.generatePhotoPage(mockTravel, 3);

      expect(html).toContain('Франция');
      expect(html).toContain('2024');
    });

    it('должен отображать номер страницы', () => {
      const html = generator.generatePhotoPage(mockTravel, 7);

      expect(html).toContain('>7<');
    });

    it('должен иметь безопасные переносы для длинного названия в оверлее', () => {
      const travel = {
        ...mockTravel,
        name: 'Очень-длинное-название-путешествия-с-супердлиннымсловомбезпробелов-1234567890',
      };

      const html = generator.generatePhotoPage(travel, 3);

      expect(html).toContain('overflow-wrap: anywhere');
      expect(html).toContain('word-break: break-word');
      expect(html).toContain('hyphens: auto');
    });
  });

  describe('generateContentPage', () => {
    it('должен генерировать страницу с контентом', () => {
      const html = generator.generateContentPage(mockTravel, 4);

      expect(html).toContain('Париж');
      expect(html).toContain('Прекрасный город');
      expect(html).toContain('travel-content-page');
    });

    it('должен отображать метаданные если включено', () => {
      const travel = {
        ...mockTravel,
        number_days: 5,
      };

      const html = generator.generateContentPage(travel, 4, {
        showMetadata: true,
      });

      expect(html).toContain('5');
      expect(html).toContain('дней');
    });

    it('должен правильно склонять "день"', () => {
      const travel1 = { ...mockTravel, number_days: 1 };
      const html1 = generator.generateContentPage(travel1, 4, { showMetadata: true });
      expect(html1).toContain('день');

      const travel2 = { ...mockTravel, number_days: 3 };
      const html2 = generator.generateContentPage(travel2, 4, { showMetadata: true });
      expect(html2).toContain('дня');

      const travel5 = { ...mockTravel, number_days: 5 };
      const html5 = generator.generateContentPage(travel5, 4, { showMetadata: true });
      expect(html5).toContain('дней');
    });

    it('должен отображать QR код если указан', () => {
      const html = generator.generateContentPage(mockTravel, 4, {
        qrCode: 'data:image/png;base64,abc123',
      });

      expect(html).toContain('data:image/png;base64,abc123');
    });

    it('должен отображать плюсы если есть', () => {
      const travel = {
        ...mockTravel,
        plus: 'Красивая архитектура\nВкусная еда',
      };

      const html = generator.generateContentPage(travel, 4);

      expect(html).toContain('Понравилось');
      expect(html).toContain('Красивая архитектура');
      expect(html).toContain('Вкусная еда');
    });

    it('должен отображать минусы если есть', () => {
      const travel = {
        ...mockTravel,
        minus: 'Дорого\nМного туристов',
      };

      const html = generator.generateContentPage(travel, 4);

      expect(html).toContain('Не понравилось');
      expect(html).toContain('Дорого');
      expect(html).toContain('Много туристов');
    });

    it('должен отображать рекомендации если есть', () => {
      const travel = {
        ...mockTravel,
        recommendation: 'Посетить Эйфелеву башню\nПопробовать круассаны',
      };

      const html = generator.generateContentPage(travel, 4);

      expect(html).toContain('Рекомендации');
      expect(html).toContain('Посетить Эйфелеву башню');
      expect(html).toContain('Попробовать круассаны');
    });

    it('должен экранировать HTML', () => {
      const travel = {
        ...mockTravel,
        description: '<script>alert("xss")</script>',
      };

      const html = generator.generateContentPage(travel, 4);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен иметь безопасные переносы для длинного названия в заголовке и метаданных', () => {
      const travel = {
        ...mockTravel,
        name: 'Очень-длинное-название-путешествия-с-супердлиннымсловомбезпробелов-1234567890',
        countryName: 'СупердлиннаяСтранаБезПробеловСупердлиннаяСтранаБезПробелов',
        number_days: 123456,
      };

      const html = generator.generateContentPage(travel, 4, { showMetadata: true });

      expect(html).toContain('overflow-wrap: anywhere');
      expect(html).toContain('word-break: break-word');
      expect(html).toContain('hyphens: auto');
      expect(html).toContain('page-break-inside: avoid');
    });
  });
});
