import { buildSeoTitle, normalizeSeoLead } from '@/utils/seoText';

// Общие правила текста выдачи. Заголовок отдельно покрыт в
// __tests__/scripts/generate-seo-pages.test.ts (buildSeoTitle через SSG-обёртку),
// здесь фиксируем контракт самого модуля и очистку лида.
describe('seoText', () => {
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
