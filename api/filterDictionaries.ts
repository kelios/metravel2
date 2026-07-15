import type {
  FilterCountryOption,
  FilterDictionaries,
  FilterDictionaryOption,
  FilterSortingOption,
} from '@/types/types';

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object`);
  }
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string`);
  }
  return value.trim();
};

const normalizeDictionaryOption = (value: unknown, label: string): FilterDictionaryOption => {
  const item = asRecord(value, label);
  if (typeof item.id !== 'number' || !Number.isInteger(item.id)) {
    throw new Error(`Invalid ${label}.id: expected an integer`);
  }
  return {
    id: item.id,
    name: asNonEmptyString(item.name, `${label}.name`),
  };
};

const normalizeSortingOption = (value: unknown, label: string): FilterSortingOption => {
  const item = asRecord(value, label);
  const sortOrder = asNonEmptyString(item.sortOrder, `${label}.sortOrder`);
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new Error(`Invalid ${label}.sortOrder: expected asc or desc`);
  }
  return {
    id: asNonEmptyString(item.id, `${label}.id`),
    name: asNonEmptyString(item.name, `${label}.name`),
    sortBy: asNonEmptyString(item.sortBy, `${label}.sortBy`),
    sortOrder,
  };
};

const normalizeArray = <T>(
  value: unknown,
  label: string,
  normalizeItem: (item: unknown, itemLabel: string) => T,
): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an array`);
  }
  return value.map((item, index) => normalizeItem(item, `${label}[${index}]`));
};

export const normalizeFilterDictionaries = (payload: unknown): FilterDictionaries => {
  const response = asRecord(payload, 'filters response');

  return {
    categories: normalizeArray(response.categories, 'categories', normalizeDictionaryOption),
    categoryTravelAddress: normalizeArray(
      response.categoryTravelAddress,
      'categoryTravelAddress',
      normalizeDictionaryOption,
    ),
    companions: normalizeArray(response.companions, 'companions', normalizeDictionaryOption),
    complexity: normalizeArray(response.complexity, 'complexity', normalizeDictionaryOption),
    month: normalizeArray(response.month, 'month', normalizeDictionaryOption),
    over_nights_stay: normalizeArray(
      response.over_nights_stay,
      'over_nights_stay',
      normalizeDictionaryOption,
    ),
    sortings: normalizeArray(response.sortings, 'sortings', normalizeSortingOption),
    transports: normalizeArray(response.transports, 'transports', normalizeDictionaryOption),
  };
};

export const normalizeFilterCountries = (payload: unknown): FilterCountryOption[] =>
  normalizeArray(payload, 'countries response', (value, label) => {
    const item = asRecord(value, label);
    if (typeof item.country_id !== 'number' || !Number.isInteger(item.country_id)) {
      throw new Error(`Invalid ${label}.country_id: expected an integer`);
    }
    return {
      country_id: item.country_id,
      title_ru: asNonEmptyString(item.title_ru, `${label}.title_ru`),
    };
  });
