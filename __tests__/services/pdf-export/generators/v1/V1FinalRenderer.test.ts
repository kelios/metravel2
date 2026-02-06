// __tests__/services/pdf-export/generators/v1/V1FinalRenderer.test.ts

import { V1FinalRenderer } from '@/services/pdf-export/generators/v1/V1FinalRenderer';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';
import type { TravelForBook } from '@/types/pdf-export';

const makeTravels = (count: number, overrides?: Partial<TravelForBook>): TravelForBook[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Travel ${i + 1}`,
    countryName: `Country ${(i % 3) + 1}`,
    number_days: 5,
    ...overrides,
  } as TravelForBook));

describe('V1FinalRenderer', () => {
  let renderer: V1FinalRenderer;

  beforeEach(() => {
    renderer = new V1FinalRenderer({ theme: minimalTheme });
  });

  it('должен генерировать финальную страницу с базовой структурой', () => {
    const html = renderer.render(10, []);

    expect(html).toContain('final-page');
    expect(html).toContain('Спасибо за путешествие!');
    expect(html).toContain('MeTravel.by');
  });

  it('должен отображать номер страницы', () => {
    const html = renderer.render(42, []);

    expect(html).toContain('>42<');
  });

  it('должен отображать статистику путешествий', () => {
    const travels = makeTravels(3);
    const html = renderer.render(10, travels);

    expect(html).toContain('3');
    expect(html).toContain('путешествия');
  });

  it('должен отображать количество стран', () => {
    const travels = makeTravels(5);
    const html = renderer.render(10, travels);

    // 3 уникальных страны (Country 1, Country 2, Country 3)
    expect(html).toContain('3');
    expect(html).toContain('страны');
  });

  it('должен отображать количество дней', () => {
    const travels = makeTravels(2);
    const html = renderer.render(10, travels);

    // 2 * 5 = 10 дней
    expect(html).toContain('10');
    expect(html).toContain('дней');
  });

  it('должен правильно склонять "путешествие"', () => {
    const html1 = renderer.render(1, makeTravels(1));
    expect(html1).toContain('путешествие');

    const html3 = renderer.render(1, makeTravels(3));
    expect(html3).toContain('путешествия');

    const html7 = renderer.render(1, makeTravels(7));
    expect(html7).toContain('путешествий');
  });

  it('должен отображать цитату если указана', () => {
    const html = renderer.render(10, [], {
      text: 'Жизнь — это путешествие',
      author: 'Ральф Эмерсон',
    });

    expect(html).toContain('Жизнь — это путешествие');
    expect(html).toContain('Ральф Эмерсон');
  });

  it('не должен отображать цитату если не указана', () => {
    const html = renderer.render(10, []);

    expect(html).not.toContain('font-style: italic');
  });

  it('должен использовать год', () => {
    const html = renderer.render(10, []);

    expect(html).toContain(`© ${new Date().getFullYear()}`);
  });

  it('не должен отображать статистику если travels пуст', () => {
    const html = renderer.render(10, []);

    expect(html).not.toContain('font-size: 28pt');
  });
});
