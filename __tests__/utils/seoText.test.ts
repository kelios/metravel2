import { buildSeoTitle, htmlToPlainText, normalizeSeoLead } from '@/utils/seoText';

// Общие правила текста выдачи. Заголовок отдельно покрыт в
// __tests__/scripts/generate-seo-pages.test.ts (buildSeoTitle через SSG-обёртку),
// здесь фиксируем контракт самого модуля и очистку лида.
describe('seoText', () => {
  describe('htmlToPlainText', () => {
    it.each([
      ['<p>Жемыславле</p><p>Дворец Умястовских</p>', 'Жемыславле Дворец Умястовских'],
      ['<p>Проверьте вы.</p><p>Ищите новый маршрут</p>', 'Проверьте вы. Ищите новый маршрут'],
      ['<ul><li>Первый пункт</li><li>Второй пункт</li></ul>', 'Первый пункт Второй пункт'],
      ['<strong>Беларусь.</strong><strong>Ищите дворец</strong>', 'Беларусь. Ищите дворец'],
    ])('preserves a readable boundary for adjacent fragments', (html, expected) => {
      expect(htmlToPlainText(html)).toBe(expected);
    });

    it('removes executable and comment markup without leaking or doubling whitespace', () => {
      expect(
        htmlToPlainText('<style>.x{}</style><p>A&nbsp;&amp;&nbsp;B</p><!-- hidden --><script>alert(1)</script>'),
      ).toBe('A & B');
    });

    it('decodes decimal and hexadecimal entities', () => {
      expect(htmlToPlainText('&#1046;&#x435;&#1084;&#1099;&#1089;&#1083;&#1072;&#1074;&#1083;&#1100;')).toBe(
        'Жемыславль',
      );
      expect(htmlToPlainText('&constructor; &unknown;')).toBe('&constructor; &unknown;');
    });

    it.each([
      ['(<strong>Минск</strong>)', '(Минск)'],
      ['&laquo;<strong>Минск</strong>&raquo;', '«Минск»'],
      ['Санкт-<strong>Петербург</strong>', 'Санкт-Петербург'],
      ['<strong>RU</strong>/<strong>EN</strong>', 'RU/EN'],
      ['слово - слово', 'слово - слово'],
    ])('does not introduce spaces around punctuation inside inline markup', (html, expected) => {
      expect(htmlToPlainText(html)).toBe(expected);
    });

    it('drops executable content even when its closing tag is missing', () => {
      expect(htmlToPlainText('<p>Visible</p><script>alert(1)')).toBe('Visible');
      expect(htmlToPlainText('<p>Visible</p><style>.hidden{}')).toBe('Visible');
    });
  });

  describe('buildSeoTitle', () => {
    it('keeps the brand suffix while it fits the budget', () => {
      expect(buildSeoTitle('Албания. Влёра')).toBe('Албания. Влёра | Metravel');
    });

    it('drops the brand instead of the keywords when both do not fit', () => {
      const name = 'Смолевуд: натурная площадка Беларусьфильма под Минском';
      expect(buildSeoTitle(name)).toBe(name);
    });
  });

  describe('normalizeSeoLead', () => {
    it('strips decorative pictographs so the snippet starts with meaning', () => {
      expect(normalizeSeoLead('🏰 Форты Первой мировой 📍 Местоположение')).toBe(
        'Форты Первой мировой Местоположение',
      );
      expect(normalizeSeoLead('Италия 🇮🇹 Озеро Гарда')).toBe('Италия Озеро Гарда');
    });

    it('drops the leading "from-to (Nкм)" service line', () => {
      expect(normalizeSeoLead('Краков - Каспровый Верх (107км 1 час 40 минут) 🏔 Каспровый Верх (1987 м)')).toBe(
        'Каспровый Верх (1987 м)',
      );
      expect(normalizeSeoLead('От Кракова до парковки (80 км 1ч 20) Парковка в Хуциско')).toBe(
        'Парковка в Хуциско',
      );
    });

    it('keeps typography that carries meaning', () => {
      const lead = 'Маршрут: Zamek Grodno → Zapora na Jeziorze — высота 350 м, №4, 12 °C';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('does not eat the whole lead when the route line is the only sentence', () => {
      // Строка маршрута — весь текст: сниппет без неё пустой, поэтому оставляем как есть.
      expect(normalizeSeoLead('Краков - Закопане (107 км)')).toBe('Краков - Закопане (107 км)');
    });

    it('collapses the whitespace left behind and trims dangling punctuation', () => {
      expect(normalizeSeoLead('  🌊  Ростока  ,  историческая часть города ')).toBe(
        'Ростока, историческая часть города',
      );
    });

    it('returns an empty string for empty input', () => {
      expect(normalizeSeoLead('')).toBe('');
      expect(normalizeSeoLead(null)).toBe('');
    });
  });
});
