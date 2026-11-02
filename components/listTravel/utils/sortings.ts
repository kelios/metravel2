import { createCollator, translate as i18nT } from '@/i18n'
import { CATALOG_PROXIMITY_SORT_IDS } from './catalogSort'

const SORTING_NAME_MAP: Record<string, string> = {
  // #2903: клиентские варианты публичного каталога (см. ./catalogSort).
  get distance() { return i18nT('travel:components.listTravel.sortings.distance') },
  get relevance() { return i18nT('travel:components.listTravel.sortings.relevance') },
  get newest() { return i18nT('travel:components.listTravel.sortings.newest') },
  get oldest() { return i18nT('travel:components.listTravel.sortings.oldest') },
  get popular_desc() { return i18nT('travel:components.listTravel.sortings.popularDesc') },
  get popular_asc() { return i18nT('travel:components.listTravel.sortings.popularAsc') },
  get updated_desc() { return i18nT('travel:components.listTravel.sortings.updatedDesc') },
  get created_desc() { return i18nT('travel:components.listTravel.sortings.createdDesc') },
  get created_asc() { return i18nT('travel:components.listTravel.sortings.createdAsc') },
  get name_asc() { return i18nT('travel:components.listTravel.sortings.nameAsc') },
  get name_desc() { return i18nT('travel:components.listTravel.sortings.nameDesc') },
  get year_desc() { return i18nT('travel:components.listTravel.sortings.yearDesc') },
  get year_asc() { return i18nT('travel:components.listTravel.sortings.yearAsc') },
  get days_desc() { return i18nT('travel:components.listTravel.sortings.daysDesc') },
  get days_asc() { return i18nT('travel:components.listTravel.sortings.daysAsc') },
  get people_desc() { return i18nT('travel:components.listTravel.sortings.peopleDesc') },
  get people_asc() { return i18nT('travel:components.listTravel.sortings.peopleAsc') },
  get rating_desc() { return i18nT('travel:components.listTravel.sortings.ratingDesc') },
};

const HIDDEN_SORTINGS = new Set([
  'budget_desc',
  'budget_asc',
  'created_asc',
  'created_desc',
  'updated_asc',
  'updated_desc',
  'days_desc',
  'days_asc',
  'people_desc',
  'people_asc',
  'rating_asc',
]);

const SORTING_ORDER: string[] = [
  'distance',
  'relevance',
  'newest',
  'oldest',
  'popular_desc',
  'popular_asc',
  'rating_desc',
  'created_desc',
  'created_asc',
  'updated_desc',
  'name_asc',
  'name_desc',
  'year_desc',
  'year_asc',
  'days_desc',
  'days_asc',
  'people_desc',
  'people_asc',
];

const SORTING_ORDER_INDEX = new Map(SORTING_ORDER.map((id, idx) => [id, idx]));

export const getSortingLabel = (sortingId: string, fallbackName?: string): string => {
  const normalizedId = String(sortingId || '').trim();
  if (normalizedId && SORTING_NAME_MAP[normalizedId]) {
    return SORTING_NAME_MAP[normalizedId];
  }
  return String(fallbackName || normalizedId || i18nT('travel:components.listTravel.sortings.fallback'));
};

export const buildSortingOptions = (sortings: Array<{ id?: unknown; name?: unknown }> = []) => {
  return sortings
    .map((sorting) => {
      const id = String(sorting?.id ?? '').trim();
      const name = typeof sorting?.name === 'string' ? sorting.name : undefined;
      return { id, name };
    })
    .filter((sorting) => sorting.id.length > 0 && !HIDDEN_SORTINGS.has(sorting.id))
    .sort((a, b) => {
      const aIdx = SORTING_ORDER_INDEX.get(a.id);
      const bIdx = SORTING_ORDER_INDEX.get(b.id);
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
      return createCollator().compare(a.id, b.id);
    })
    .map((sorting) => ({
      id: sorting.id,
      name: getSortingLabel(sorting.id, sorting.name),
    }));
};

/**
 * Visible sortings the backend always exposes, mirrored client-side so the
 * header sort control can render before the (lazily-fetched) filter options
 * query resolves — e.g. on mobile where filters load only when the overlay opens.
 */
const DEFAULT_SORTING_IDS = [
  'newest',
  'oldest',
  'popular_desc',
  'popular_asc',
  'name_asc',
  'name_desc',
  'year_desc',
  'year_asc',
];

export const getDefaultSortingOptions = () =>
  buildSortingOptions(DEFAULT_SORTING_IDS.map((id) => ({ id })));

const CATALOG_HEADER_REQUIRED_SORTING_IDS = new Set([
  'newest',
  'oldest',
  'popular_desc',
]);

const mergeCatalogHeaderSortingOptions = (
  sortings: Array<{ id?: unknown; name?: unknown }>,
) => {
  const fromApi = buildSortingOptions(sortings);
  if (!fromApi.length) return getDefaultSortingOptions();

  const byId = new Map(fromApi.map((sorting) => [sorting.id, sorting]));
  getDefaultSortingOptions().forEach((sorting) => {
    if (CATALOG_HEADER_REQUIRED_SORTING_IDS.has(sorting.id) && !byId.has(sorting.id)) {
      byId.set(sorting.id, sorting);
    }
  });

  return buildSortingOptions(Array.from(byId.values()));
};

/**
 * `includeProximity` (#2903, публичный каталог) добавляет «Ближе ко мне» и
 * «По релевантности» поверх готового списка: пока опции фильтров не пришли,
 * под ними остаётся полный клиентский список по умолчанию.
 */
export const getCatalogHeaderSortingOptions = (
  sortings: Array<{ id?: unknown; name?: unknown }> = [],
  { includeProximity = false }: { includeProximity?: boolean } = {},
) => {
  const options = mergeCatalogHeaderSortingOptions(sortings);
  return includeProximity ? buildSortingOptions(withCatalogProximitySortings(options)) : options;
};

/**
 * #2903: публичный каталог (поиск, «Беларусь») дополняет серверный список
 * сортировок вариантами «Ближе ко мне» и «По релевантности». Своих поездок и
 * экспорта это не касается — там расстояние от человека ничего не значит.
 */
export const withCatalogProximitySortings = <T extends { id?: unknown; name?: unknown }>(
  sortings: readonly T[] = [],
): Array<T | { id: string }> => {
  const known = new Set(sortings.map((sorting) => String(sorting?.id ?? '').trim()))
  const extra = CATALOG_PROXIMITY_SORT_IDS.filter((id) => !known.has(id)).map((id) => ({ id }))
  return [...extra, ...sortings]
}
