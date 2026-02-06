// __tests__/services/pdf-export/generators/pages/FinalPageGenerator.test.ts

import { FinalPageGenerator } from '@/services/pdf-export/generators/pages';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';

describe('FinalPageGenerator', () => {
  let generator: FinalPageGenerator;

  beforeEach(() => {
    generator = new FinalPageGenerator(minimalTheme);
  });

  describe('generate', () => {
    it('должен генерировать HTML финальной страницы', () => {
      const data = {
        totalTravels: 10,
      };

      const html = generator.generate(data, 50);

      expect(html).toContain('Спасибо за');
      expect(html).toContain('путешествие');
      expect(html).toContain('10');
      expect(html).toContain('путешествий');
    });

    it('должен отображать статистику', () => {
      const data = {
        totalTravels: 10,
        totalCountries: 5,
        totalDays: 100,
      };

      const html = generator.generate(data, 50);

      expect(html).toContain('10');
      expect(html).toContain('5');
      expect(html).toContain('100');
    });

    it('должен отображать цитату если указана', () => {
      const data = {
        totalTravels: 10,
        quote: {
          text: 'Мир - это книга',
          author: 'Святой Августин',
        },
      };

      const html = generator.generate(data, 50);

      expect(html).toContain('Мир - это книга');
      expect(html).toContain('Святой Августин');
    });

    it('должен правильно склонять "путешествие"', () => {
      const data1 = { totalTravels: 1 };
      const html1 = generator.generate(data1, 50);
      expect(html1).toContain('путешествие');

      const data2 = { totalTravels: 3 };
      const html2 = generator.generate(data2, 50);
      expect(html2).toContain('путешествия');

      const data5 = { totalTravels: 5 };
      const html5 = generator.generate(data5, 50);
      expect(html5).toContain('путешествий');
    });

    it('должен правильно склонять "страна"', () => {
      const data1 = { totalTravels: 5, totalCountries: 1 };
      const html1 = generator.generate(data1, 50);
      expect(html1).toContain('страна');

      const data2 = { totalTravels: 5, totalCountries: 3 };
      const html2 = generator.generate(data2, 50);
      expect(html2).toContain('страны');

      const data5 = { totalTravels: 5, totalCountries: 10 };
      const html5 = generator.generate(data5, 50);
      expect(html5).toContain('стран');
    });

    it('должен содержать бренд метравел', () => {
      const data = { totalTravels: 10 };
      const html = generator.generate(data, 50);

      expect(html).toContain('METRAVEL.BY');
    });

    it('должен отображать номер страницы', () => {
      const data = { totalTravels: 10 };
      const html = generator.generate(data, 42);

      expect(html).toContain('>42<');
    });
  });
});
