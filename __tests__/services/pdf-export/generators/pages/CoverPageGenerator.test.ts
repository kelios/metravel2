// __tests__/services/pdf-export/generators/pages/CoverPageGenerator.test.ts

import { CoverPageGenerator } from '@/services/pdf-export/generators/pages';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';

describe('CoverPageGenerator', () => {
  let generator: CoverPageGenerator;

  beforeEach(() => {
    generator = new CoverPageGenerator(minimalTheme);
  });

  describe('generate', () => {
    it('должен генерировать HTML обложки', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 10,
      };

      const html = await generator.generate(data);

      expect(html).toContain('Мои путешествия');
      expect(html).toContain('Иван Иванов');
      expect(html).toContain('10');
      expect(html).toContain('pdf-page');
      expect(html).toContain('cover-page');
    });

    it('не должен рендерить заголовок если title пустой', async () => {
      const data = {
        title: '   ',
        userName: 'Иван Иванов',
        travelCount: 10,
      };

      const html = await generator.generate(data);

      expect(html).not.toContain('<h1');
      expect(html).toContain('Иван Иванов');
      expect(html).toContain('cover-page');
    });

    it('должен отображать подзаголовок если указан', async () => {
      const data = {
        title: 'Мои путешествия',
        subtitle: 'Сборник впечатлений',
        userName: 'Иван Иванов',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).toContain('Сборник впечатлений');
    });

    it('должен отображать диапазон лет если указан', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 5,
        yearRange: '2020-2024',
      };

      const html = await generator.generate(data);

      expect(html).toContain('2020-2024');
    });

    it('должен отображать фоновое изображение если указано', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 5,
        coverImage: 'https://example.com/cover.jpg',
      };

      const html = await generator.generate(data);

      expect(html).toContain('https://example.com/cover.jpg');
    });

    it('должен отображать цитату если указана', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 5,
        quote: {
          text: 'Путешествие - это жизнь',
          author: 'Ганс Христиан Андерсен',
        },
      };

      const html = await generator.generate(data);

      expect(html).toContain('Путешествие - это жизнь');
      expect(html).toContain('Ганс Христиан Андерсен');
    });

    it('должен экранировать HTML в тексте', async () => {
      const data = {
        title: '<script>alert("xss")</script>',
        userName: 'Иван Иванов',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен правильно склонять "путешествие"', async () => {
      const data1 = {
        title: 'Тест',
        userName: 'Тест',
        travelCount: 1,
      };
      const html1 = await generator.generate(data1);
      expect(html1).toContain('путешествие');

      const data2 = {
        title: 'Тест',
        userName: 'Тест',
        travelCount: 3,
      };
      const html2 = await generator.generate(data2);
      expect(html2).toContain('путешествия');

      const data5 = {
        title: 'Тест',
        userName: 'Тест',
        travelCount: 5,
      };
      const html5 = await generator.generate(data5);
      expect(html5).toContain('путешествий');
    });

    it('должен содержать логотип MeTravel', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).toContain('MeTravel');
    });

    it('должен содержать дату создания', async () => {
      const data = {
        title: 'Мои путешествия',
        userName: 'Иван Иванов',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).toContain('Создано');
    });

    it('должен иметь безопасные переносы для длинного заголовка', async () => {
      const data = {
        title: 'Очень-длинный-заголовок-с-супердлиннымсловомбезпробелов-1234567890',
        userName: 'Иван Иванов',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).toContain('overflow-wrap: anywhere');
      expect(html).toContain('word-break: break-word');
      expect(html).toContain('hyphens: auto');
    });

    it('не должен содержать невалидные псевдоселекторы в inline-style', async () => {
      const data = {
        title: 'Тест',
        userName: 'Тест',
        travelCount: 5,
      };

      const html = await generator.generate(data);

      expect(html).not.toContain('&::after');
    });
  });
});
