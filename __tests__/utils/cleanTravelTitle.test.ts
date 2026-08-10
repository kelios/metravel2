import { cleanTravelTitle } from '@/utils/cleanTravelTitle';

describe('cleanTravelTitle', () => {
  it('returns original title when country is absent', () => {
    expect(cleanTravelTitle('Поездка в Грузию', null)).toBe('Поездка в Грузию');
  });

  it('removes country mention from title and trims punctuation', () => {
    expect(cleanTravelTitle('Маршрут в Беларусь,', 'Беларусь')).toBe('Маршрут');
  });

  it('keeps original title when cleaning result becomes empty', () => {
    expect(cleanTravelTitle('Беларусь', 'Беларусь')).toBe('Беларусь');
  });

  // Реальные заголовки с прода: travel 177 в избранном рендерился как
  // «. Варшава - Закопане - Морское Око - Краков», travel 178 в истории — как
  // «за 4 дня: маршрут из Минска в Гданьск». Страна вырезается из начала строки,
  // поэтому осиротевший разделитель и строчная буква оказывались первым символом.
  it('drops the punctuation orphaned at the start, not only at the end', () => {
    expect(
      cleanTravelTitle('Польша. Варшава - Закопане - Морское Око - Краков', 'Польша'),
    ).toBe('Варшава - Закопане - Морское Око - Краков');
  });

  it('restores the leading capital when the country was the first word', () => {
    expect(cleanTravelTitle('Польша за 4 дня: маршрут из Минска в Гданьск', 'Польша')).toBe(
      'За 4 дня: маршрут из Минска в Гданьск',
    );
  });

  it('leaves an already capitalized title untouched', () => {
    expect(cleanTravelTitle('Беларусь: Минск за выходные', 'Беларусь')).toBe(
      'Минск за выходные',
    );
  });
});
