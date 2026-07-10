import { getCountryCodeByCoords } from '@/utils/geoCountry';

describe('getCountryCodeByCoords', () => {
  it('resolves Sarajevo to BA, not the overlapping IT/HR boxes', () => {
    // Регресс: у Сараево на бэке country_code=null, поэтому группировка идёт
    // через этот фолбэк. Раньше широкий bbox Италии (а затем Хорватии)
    // перехватывал точку, и город уходил в IT/HR вместо Боснии.
    expect(getCountryCodeByCoords(43.8563, 18.4131)).toBe('BA');
  });

  it('resolves core Italian cities to IT', () => {
    expect(getCountryCodeByCoords(41.9028, 12.4964)).toBe('IT'); // Рим
  });

  it('returns undefined for coordinates outside known boxes', () => {
    expect(getCountryCodeByCoords(0, 0)).toBeUndefined();
  });
});
