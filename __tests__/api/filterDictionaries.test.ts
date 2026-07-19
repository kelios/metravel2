import {
  normalizeFilterCountries,
  normalizeFilterDictionaries,
  normalizeUpsertFilterDictionaries,
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

describe('upsert wizard filter dictionaries normalizer', () => {
  it('canonicalizes number ids to strings and keeps names', () => {
    const result = normalizeUpsertFilterDictionaries({
      categories: [{ id: 1, name: 'Походы' }],
      transports: [{ id: 7, name: 'Автомобиль' }],
      complexity: [{ id: 4, name: 'Легко' }],
      companions: [{ id: 3, name: 'Семья' }],
      over_nights_stay: [{ id: 6, name: 'Отель' }],
      month: [{ id: 5, name: 'Май' }],
      countries: [{ country_id: 2, title_ru: 'Польша' }],
    });

    expect(result.categories).toEqual([{ id: '1', name: 'Походы' }]);
    expect(result.transports).toEqual([{ id: '7', name: 'Автомобиль' }]);
    expect(result.countries).toEqual([{ country_id: '2', title_ru: 'Польша' }]);
  });

  it('accepts already-normalized string-id TravelFilters unchanged', () => {
    const input = {
      categories: [{ id: '1', name: 'Горы' }],
      transports: [{ id: '2', name: 'Поезд' }],
      complexity: [{ id: '3', name: 'Средне' }],
      companions: [{ id: '4', name: 'Друзья' }],
      over_nights_stay: [{ id: '5', name: 'Палатка' }],
      month: [{ id: '6', name: 'Июнь' }],
      countries: [{ country_id: '7', title_ru: 'Беларусь' }],
    };

    expect(normalizeUpsertFilterDictionaries(input)).toEqual(input);
  });

  it('resolves backend alias keys and a { data: { filters } } wrapper', () => {
    const result = normalizeUpsertFilterDictionaries({
      data: {
        filters: {
          categoriesTravel: [{ category_id: 10, name_ru: 'Море' }],
          transportsTravel: [{ value: 11, title: 'Самолёт' }],
          overNightsStay: [{ pk: 12, text: 'Кемпинг' }],
          months: [{ id: 13, name: 'Июль' }],
          countries: [{ id: 14, name: 'Литва' }],
        },
      },
    });

    expect(result.categories).toEqual([{ id: '10', name: 'Море' }]);
    expect(result.transports).toEqual([{ id: '11', name: 'Самолёт' }]);
    expect(result.over_nights_stay).toEqual([{ id: '12', name: 'Кемпинг' }]);
    expect(result.month).toEqual([{ id: '13', name: 'Июль' }]);
    expect(result.countries).toEqual([{ country_id: '14', title_ru: 'Литва' }]);
    expect(result.complexity).toEqual([]);
    expect(result.companions).toEqual([]);
  });

  it('degrades to empty lists for null, wrong-typed or malformed data instead of throwing', () => {
    const empty = {
      categories: [],
      transports: [],
      complexity: [],
      companions: [],
      over_nights_stay: [],
      month: [],
      countries: [],
    };

    expect(normalizeUpsertFilterDictionaries(null)).toEqual(empty);
    expect(normalizeUpsertFilterDictionaries(undefined)).toEqual(empty);
    expect(
      normalizeUpsertFilterDictionaries({ categories: 'not-an-array' } as unknown as Record<string, unknown>),
    ).toEqual(empty);
  });
});
