import type {
  FilterCountryOption,
  FilterDictionaries,
  FilterDictionaryOption,
  FilterSortingOption,
  TravelFilters,
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

/**
 * Raw dictionaries payload accepted by the upsert wizard surface: an
 * already-normalized `TravelFilters`, a `{ data: { filters } }` / `{ data }`
 * wrapper, or a raw backend object using alias keys.
 */
export type UpsertFilterDictionariesInput =
  | TravelFilters
  | Record<string, unknown>
  | null
  | undefined;

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

// Upsert wizard binds dictionary options to `MultiSelectField`, whose selection is
// persisted as `string[]` in `TravelFormData`. Option ids are therefore canonicalized
// to strings here, unlike the strict number-id `normalizeFilterDictionaries` that feeds
// the search/list filters.
const toStringOptions = (value: unknown): TravelFilters['categories'] => {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const rec = asPlainRecord(item);
    if (rec) {
      const id = rec.id ?? rec.value ?? rec.category_id ?? rec.pk ?? index;
      const name =
        rec.name ?? rec.name_ru ?? rec.title_ru ?? rec.title ?? rec.text ?? String(id);
      return { id: String(id), name: String(name) };
    }
    return { id: String(index), name: String(item) };
  });
};

const toCountryOptions = (value: unknown): TravelFilters['countries'] => {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const rec = asPlainRecord(item);
    if (rec) {
      const id = rec.country_id ?? rec.id ?? rec.pk ?? index;
      const titleRu = rec.title_ru ?? rec.name_ru ?? rec.name ?? rec.title ?? String(id);
      return { country_id: String(id), title_ru: String(titleRu) };
    }
    return { country_id: String(index), title_ru: String(item) };
  });
};

const resolveDictionariesSource = (input: unknown): Record<string, unknown> => {
  const root = asPlainRecord(input);
  if (!root) return {};
  const data = asPlainRecord(root.data);
  if (data) {
    const nested = asPlainRecord(data.filters);
    return nested ?? data;
  }
  return root;
};

const pickAlias = (source: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

/**
 * Normalize the upsert-wizard filter dictionaries into a guaranteed `TravelFilters`
 * (string ids). Accepts wrapped responses and backend alias keys; malformed data
 * degrades to empty lists instead of throwing so the wizard never hard-fails.
 */
export const normalizeUpsertFilterDictionaries = (
  input: UpsertFilterDictionariesInput,
): TravelFilters => {
  const source = resolveDictionariesSource(input);
  return {
    categories: toStringOptions(
      pickAlias(source, ['categories', 'categoriesTravel', 'categories_travel']),
    ),
    transports: toStringOptions(pickAlias(source, ['transports', 'transportsTravel'])),
    complexity: toStringOptions(pickAlias(source, ['complexity', 'complexityTravel'])),
    companions: toStringOptions(pickAlias(source, ['companions', 'companionsTravel'])),
    over_nights_stay: toStringOptions(
      pickAlias(source, ['over_nights_stay', 'overNightsStay', 'overnights']),
    ),
    month: toStringOptions(pickAlias(source, ['month', 'months'])),
    countries: toCountryOptions(source.countries),
  };
};
