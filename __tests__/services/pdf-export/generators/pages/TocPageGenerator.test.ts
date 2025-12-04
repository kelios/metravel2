// __tests__/services/pdf-export/generators/pages/TocPageGenerator.test.ts

import { TocPageGenerator } from '@/src/services/pdf-export/generators/pages';
import { minimalTheme } from '@/src/services/pdf-export/themes/PdfThemeConfig';

describe('TocPageGenerator', () => {
  let generator: TocPageGenerator;

  beforeEach(() => {
    generator = new TocPageGenerator(minimalTheme);
  });

  describe('generate', () => {
    it('должен генерировать HTML оглавления', () => {
      const entries = [
        {
          travel: {
            id: 1,
            name: 'Париж',
            countryName: 'Франция',
            year: 2024,
          },
          pageNumber: 3,
        },
      ];

      const html = generator.generate(entries, 2);

      expect(html).toContain('Оглавление');
      expect(html).toContain('Париж');
      expect(html).toContain('Франция');
      expect(html).toContain('2024');
      expect(html).toContain('стр. 3');
    });

    it('должен отображать миниатюры если есть', () => {
      const entries = [
        {
          travel: {
            id: 1,
            name: 'Париж',
            travel_image_thumb_small_url: 'https://example.com/thumb.jpg',
          },
          pageNumber: 3,
        },
      ];

      const html = generator.generate(entries, 2);

      expect(html).toContain('https://example.com/thumb.jpg');
    });

    it('должен отображать номер страницы', () => {
      const entries: any[] = [];
      const html = generator.generate(entries, 5);

      expect(html).toContain('>5<');
    });

    it('должен отображать несколько путешествий', () => {
      const entries = [
        {
          travel: {
            id: 1,
            name: 'Париж',
            countryName: 'Франция',
            year: 2024,
          },
          pageNumber: 3,
        },
        {
          travel: {
            id: 2,
            name: 'Лондон',
            countryName: 'Великобритания',
            year: 2023,
          },
          pageNumber: 5,
        },
      ];

      const html = generator.generate(entries, 2);

      expect(html).toContain('Париж');
      expect(html).toContain('Лондон');
      expect(html).toContain('Франция');
      expect(html).toContain('Великобритания');
    });

    it('должен экранировать HTML в названиях', () => {
      const entries = [
        {
          travel: {
            id: 1,
            name: '<script>alert("xss")</script>',
          },
          pageNumber: 3,
        },
      ];

      const html = generator.generate(entries, 2);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен работать с пустым списком', () => {
      const entries: any[] = [];
      const html = generator.generate(entries, 2);

      expect(html).toContain('Оглавление');
      expect(html).toContain('pdf-page');
    });
  });
});
