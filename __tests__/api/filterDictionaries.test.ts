import {
  normalizeFilterCountries,
  normalizeFilterDictionaries,
} from '@/api/filterDictionaries';

const validFiltersPayload = () => ({
  categories: [{ id: 1, name: 'Походы' }],
  categoryTravelAddress: [{ id: 2, name: 'Музей' }],
  companions: [{ id: 3, name: 'Семья' }],
  complexity: [{ id: 4, name: 'Легко' }],
  month: [{ id: 5, name: 'Май' }],
  over_nights_stay: [{ id: 6, name: 'Отель' }],
  transports: [{ id: 7, name: 'Автомобиль' }],
  sortings: [{ id: 'new', name: 'Новые', sortBy: 'created_at', sortOrder: 'desc' }],
});

describe('filter dictionary runtime contract', () => {
  it('accepts the deployed object-array payload without countries or year', () => {
    expect(normalizeFilterDictionaries(validFiltersPayload())).toEqual(validFiltersPayload());
  });

  it('rejects a malformed option item', () => {
    const payload = validFiltersPayload();
    payload.categories = [{ id: 1, name: '' }];

    expect(() => normalizeFilterDictionaries(payload)).toThrow('categories[0].name');
  });

  it('rejects a missing required array', () => {
    const { transports: _transports, ...payload } = validFiltersPayload();

    expect(() => normalizeFilterDictionaries(payload)).toThrow('Invalid transports');
  });

  it('validates the dedicated countries payload separately', () => {
    expect(
      normalizeFilterCountries([
        { country_id: 1, title_ru: 'Беларусь' },
        { country_id: 2, title_ru: 'Польша' },
      ]),
    ).toEqual([
      { country_id: 1, title_ru: 'Беларусь' },
      { country_id: 2, title_ru: 'Польша' },
    ]);

    expect(() => normalizeFilterCountries([{ id: 1, name: 'Беларусь' }])).toThrow(
      'country_id',
    );
  });
});
