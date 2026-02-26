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
});
