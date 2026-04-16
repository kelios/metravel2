import type { FilterOptions, FilterState } from './listTravelTypes';
import { buildSortingOptions } from './sortings';

type FilterOption = {
  id: string;
  name: string;
  count?: number;
};

export type TravelFilterGroup = {
  key: string;
  title: string;
  options: FilterOption[];
  multiSelect?: boolean;
  icon?: string;
};

export type FacetCounts = Record<string, Map<string, number>>;

type BuildTravelFilterGroupsParams = {
  options?: FilterOptions;
  facetCounts?: FacetCounts;
  selectedFilters?: FilterState | Record<string, unknown>;
  includeSort?: boolean;
  hideCountries?: boolean;
};

const getSelectedValue = (
  selectedFilters: BuildTravelFilterGroupsParams['selectedFilters'],
  filterKey: string
) => (selectedFilters && typeof selectedFilters === 'object' ? (selectedFilters as Record<string, unknown>)[filterKey] : undefined);

export const buildFacetCounts = (rawFacets: Record<string, unknown> | undefined): FacetCounts => {
  if (!rawFacets || typeof rawFacets !== 'object') {
    return {};
  }

  return Object.entries(rawFacets).reduce<FacetCounts>((acc, [facetKey, items]) => {
    const map = new Map<string, number>();
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const value = item as { id?: unknown; count?: unknown };
        map.set(String(value.id), Number(value.count) || 0);
      });
    }
    acc[facetKey] = map;
    return acc;
  }, {});
};

export const getFacetCount = (
  facetCounts: FacetCounts,
  facetKey: string,
  id: string | number
): number | undefined => {
  const facetMap = facetCounts[facetKey];
  if (!facetMap) {
    return undefined;
  }
  const value = facetMap.get(String(id));
  return typeof value === 'number' ? value : undefined;
};

export const isOptionSelected = (
  selectedFilters: BuildTravelFilterGroupsParams['selectedFilters'],
  filterKey: string,
  id: string | number
): boolean => {
  const currentValue = getSelectedValue(selectedFilters, filterKey);
  if (Array.isArray(currentValue)) {
    return currentValue.some((value) => String(value) === String(id));
  }
  return currentValue !== undefined && currentValue !== null && String(currentValue) === String(id);
};

export const shouldIncludeFacetOption = (
  facetCounts: FacetCounts,
  selectedFilters: BuildTravelFilterGroupsParams['selectedFilters'],
  facetKey: string,
  filterKey: string,
  id: string | number
): boolean => {
  const count = getFacetCount(facetCounts, facetKey, id);
  if (count === undefined || count > 0) {
    return true;
  }
  return isOptionSelected(selectedFilters, filterKey, id);
};

export const buildTravelFilterGroups = ({
  options,
  facetCounts = {},
  selectedFilters,
  includeSort = false,
  hideCountries = false,
}: BuildTravelFilterGroupsParams): TravelFilterGroup[] => {
  const groups: TravelFilterGroup[] = [];

  if (!hideCountries) {
    groups.push({
      key: 'countries',
      title: 'Страны',
      options: (options?.countries || [])
        .filter((country) => {
          const countryKey = country.country_id ?? country.id;
          return countryKey !== undefined && shouldIncludeFacetOption(facetCounts, selectedFilters, 'countries', 'countries', countryKey);
        })
        .map((country) => ({
          id: String(country.country_id ?? country.id),
          name: country.title_ru || (country as { name?: string }).name || '',
          count: getFacetCount(facetCounts, 'countries', (country.country_id ?? country.id) as string | number),
        })),
      multiSelect: true,
      icon: 'globe',
    });
  }

  if (includeSort) {
    groups.push({
      key: 'sort',
      title: 'Сортировка',
      options: buildSortingOptions(options?.sortings || []),
      multiSelect: false,
      icon: 'sliders',
    });
  }

  groups.push(
    {
      key: 'categories',
      title: 'Категории',
      options: (options?.categories || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'categories', 'categories', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'categories', item.id),
        })),
      multiSelect: true,
      icon: 'tag',
    },
    {
      key: 'categoryTravelAddress',
      title: 'Что посмотреть',
      options: (options?.categoryTravelAddress || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'categoryTravelAddress', 'categoryTravelAddress', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'categoryTravelAddress', item.id),
        })),
      multiSelect: true,
      icon: 'map-pin',
    },
    {
      key: 'transports',
      title: 'Транспорт',
      options: (options?.transports || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'transports', 'transports', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'transports', item.id),
        })),
      multiSelect: true,
      icon: 'truck',
    },
    {
      key: 'companions',
      title: 'Спутники',
      options: (options?.companions || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'companions', 'companions', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'companions', item.id),
        })),
      multiSelect: true,
      icon: 'users',
    },
    {
      key: 'complexity',
      title: 'Сложность',
      options: (options?.complexity || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'complexity', 'complexity', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'complexity', item.id),
        })),
      multiSelect: true,
      icon: 'activity',
    },
    {
      key: 'month',
      title: 'Месяц',
      options: (options?.month || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'month', 'month', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'month', item.id),
        })),
      multiSelect: true,
      icon: 'calendar',
    },
    {
      key: 'over_nights_stay',
      title: 'Ночлег',
      options: (options?.over_nights_stay || [])
        .filter((item) => shouldIncludeFacetOption(facetCounts, selectedFilters, 'over_nights_stay', 'over_nights_stay', item.id))
        .map((item) => ({
          id: String(item.id),
          name: item.name,
          count: getFacetCount(facetCounts, 'over_nights_stay', item.id),
        })),
      multiSelect: true,
      icon: 'moon',
    }
  );

  return groups;
};
