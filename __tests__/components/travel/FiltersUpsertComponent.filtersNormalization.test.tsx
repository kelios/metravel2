import React from 'react';
import { render } from '@testing-library/react-native';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import MultiSelectField from '@/components/forms/MultiSelectField';

jest.mock('@/components/MultiSelectField', () => {
  return {
    __esModule: true,
    default: jest.fn(() => null),
  };
});

jest.mock('@/components/CheckboxComponent', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('@/components/travel/PhotoUploadWithPreview', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('react-native-paper', () => {
  return {
    Button: () => null,
  };
});

describe('FiltersUpsertComponent - filters normalization', () => {
  const baseFormData: any = {
    id: null,
    publish: false,
    countries: [],
    categories: [],
    transports: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    month: [],
    visa: false,
  };

  const setFormData = jest.fn();
  const onSave = jest.fn();

  const getCallByLabel = (label: string) => {
    const mock = MultiSelectField as unknown as jest.Mock;
    const calls = mock.mock.calls.map((c) => c[0]);
    const found = calls.find((p: any) => p?.label === label);
    if (!found) {
      throw new Error(`MultiSelectField not rendered for label: ${label}`);
    }
    return found;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all filter selects with non-empty items for expected API shapes', () => {
    const filters: any = {
      categories: [
        { id: 1, name: 'Дайвинг' },
        { id: 2, name: 'Поход' },
      ],
      countries: [
        { country_id: 19, title_ru: 'Австралия' },
        { country_id: 3, title_ru: 'Беларусь' },
      ],
      transports: [{ id: 1, name: 'Машина' }],
      complexity: [{ id: 1, name: 'Зеленый' }],
      companions: [{ id: 3, name: 'Ребенок(от 1-3 лет)' }],
      over_nights_stay: [{ id: 1, name: 'Палатка' }],
      month: [{ id: 1, name: 'Январь' }],
      categoryTravelAddress: [{ id: 1, name: 'Акведук' }],
    };

    render(
      <FiltersUpsertComponent
        filters={filters}
        formData={baseFormData}
        setFormData={setFormData}
        onSave={onSave}
        showSaveButton={false}
        showPreviewButton={false}
        showPublishControls={false}
        showCoverImage={false}
        showCountries={true}
        showCategories={true}
        showAdditionalFields={true}
      />
    );

    const countries = getCallByLabel('Страны для путешествия *');
    expect(Array.isArray(countries.items)).toBe(true);
    expect(countries.items.length).toBeGreaterThan(0);
    expect(countries.labelField).toBe('title_ru');
    expect(countries.valueField).toBe('country_id');
    expect(typeof countries.items[0].country_id).toBe('string');
    expect(typeof countries.items[0].title_ru).toBe('string');

    const categories = getCallByLabel('Категории путешествий *');
    expect(Array.isArray(categories.items)).toBe(true);
    expect(categories.items.length).toBeGreaterThan(0);
    expect(categories.labelField).toBe('name');
    expect(categories.valueField).toBe('id');
    expect(typeof categories.items[0].id).toBe('string');
    expect(typeof categories.items[0].name).toBe('string');

    const transports = getCallByLabel('Средства передвижения');
    expect(transports.items.length).toBeGreaterThan(0);
    expect(typeof transports.items[0].id).toBe('string');
    expect(typeof transports.items[0].name).toBe('string');

    const complexity = getCallByLabel('Физическая подготовка');
    expect(complexity.items.length).toBeGreaterThan(0);
    expect(typeof complexity.items[0].id).toBe('string');
    expect(typeof complexity.items[0].name).toBe('string');

    const companions = getCallByLabel('Путешествуете с...');
    expect(companions.items.length).toBeGreaterThan(0);
    expect(typeof companions.items[0].id).toBe('string');
    expect(typeof companions.items[0].name).toBe('string');

    const overnights = getCallByLabel('Ночлег...');
    expect(overnights.items.length).toBeGreaterThan(0);
    expect(typeof overnights.items[0].id).toBe('string');
    expect(typeof overnights.items[0].name).toBe('string');

    const month = getCallByLabel('Месяц путешествия');
    expect(month.items.length).toBeGreaterThan(0);
    expect(typeof month.items[0].id).toBe('string');
    expect(typeof month.items[0].name).toBe('string');
  });

  it('supports alternative keys and still provides non-empty items', () => {
    const filters: any = {
      categoriesTravel: ['Горы', 'Море'],
      months: ['Январь'],
      overNightsStay: ['Палатка'],
      transportsTravel: ['Автобус'],
      complexityTravel: ['Зеленый'],
      companionsTravel: ['Собака'],
      category_travel_address: ['Парковка'],
      countries: [{ country_id: 3, title_ru: 'Беларусь' }],
    };

    render(
      <FiltersUpsertComponent
        filters={filters}
        formData={baseFormData}
        setFormData={setFormData}
        onSave={onSave}
        showSaveButton={false}
        showPreviewButton={false}
        showPublishControls={false}
        showCoverImage={false}
        showCountries={true}
        showCategories={true}
        showAdditionalFields={true}
      />
    );

    const categories = getCallByLabel('Категории путешествий *');
    expect(categories.items.length).toBeGreaterThan(0);

    const transports = getCallByLabel('Средства передвижения');
    expect(transports.items.length).toBeGreaterThan(0);

    const complexity = getCallByLabel('Физическая подготовка');
    expect(complexity.items.length).toBeGreaterThan(0);

    const companions = getCallByLabel('Путешествуете с...');
    expect(companions.items.length).toBeGreaterThan(0);

    const overnights = getCallByLabel('Ночлег...');
    expect(overnights.items.length).toBeGreaterThan(0);

    const month = getCallByLabel('Месяц путешествия');
    expect(month.items.length).toBeGreaterThan(0);

    const countries = getCallByLabel('Страны для путешествия *');
    expect(countries.items.length).toBeGreaterThan(0);
  });

  it('supports wrapped filters shape (data/result) and still provides non-empty items', () => {
    const filters: any = {
      data: {
        categories: [{ id: 1, name: 'Дайвинг' }],
        transports: [{ id: 1, name: 'Машина' }],
        complexity: [{ id: 1, name: 'Зеленый' }],
        companions: [{ id: 3, name: 'Собака' }],
        over_nights_stay: [{ id: 1, name: 'Палатка' }],
        month: [{ id: 1, name: 'Январь' }],
        categoryTravelAddress: [{ id: 1, name: 'Парковка' }],
        countries: [{ country_id: 3, title_ru: 'Беларусь' }],
      },
    };

    render(
      <FiltersUpsertComponent
        filters={filters}
        formData={baseFormData}
        setFormData={setFormData}
        onSave={onSave}
        showSaveButton={false}
        showPreviewButton={false}
        showPublishControls={false}
        showCoverImage={false}
        showCountries={true}
        showCategories={true}
        showAdditionalFields={true}
      />
    );

    expect(getCallByLabel('Категории путешествий *').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Средства передвижения').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Физическая подготовка').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Путешествуете с...').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Ночлег...').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Месяц путешествия').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Страны для путешествия *').items.length).toBeGreaterThan(0);
  });

  it('supports deeply nested filters shape (data.filters.*) and still provides non-empty items', () => {
    const filters: any = {
      data: {
        filters: {
          categories: [{ id: 1, name: 'Дайвинг' }],
          transports: [{ id: 1, name: 'Машина' }],
          complexity: [{ id: 1, name: 'Зеленый' }],
          companions: [{ id: 3, name: 'Собака' }],
          over_nights_stay: [{ id: 1, name: 'Палатка' }],
          month: [{ id: 1, name: 'Январь' }],
          categoryTravelAddress: [{ id: 1, name: 'Парковка' }],
          countries: [{ country_id: 3, title_ru: 'Беларусь' }],
        },
      },
    };

    render(
      <FiltersUpsertComponent
        filters={filters}
        formData={baseFormData}
        setFormData={setFormData}
        onSave={onSave}
        showSaveButton={false}
        showPreviewButton={false}
        showPublishControls={false}
        showCoverImage={false}
        showCountries={true}
        showCategories={true}
        showAdditionalFields={true}
      />
    );

    expect(getCallByLabel('Категории путешествий *').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Средства передвижения').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Физическая подготовка').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Путешествуете с...').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Ночлег...').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Месяц путешествия').items.length).toBeGreaterThan(0);
    expect(getCallByLabel('Страны для путешествия *').items.length).toBeGreaterThan(0);
  });
});
