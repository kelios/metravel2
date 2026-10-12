import type { FilterState } from '@/components/listTravel/filters/types';

export function getFilterGroupResetState(selected: unknown, defaults: unknown) {
  const selectedIds = new Set(Array.isArray(selected) ? selected.map(String) : []);
  const defaultIds = new Set(Array.isArray(defaults) ? defaults.map(String) : []);
  const isResettable = selectedIds.size !== defaultIds.size ||
    [...selectedIds].some((id) => !defaultIds.has(id));
  return {
    isResettable,
    count: isResettable ? selectedIds.size || defaultIds.size : 0,
    resetValues: [...defaultIds],
  };
}

export function getModernFiltersActiveCount(
  selectedFilters: FilterState,
  defaultSelectedFilters?: Partial<FilterState>,
) {
  const keys = new Set([...Object.keys(selectedFilters), ...Object.keys(defaultSelectedFilters ?? {})]);
  let count = selectedFilters.allAuthorsUnpublishedOnly === true ? 1 : 0;
  // Match the year sent by buildTravelQueryParams, including a nonempty value
  // that the user may need to clear after entering an invalid year.
  if (String(selectedFilters.year ?? '').trim() !== String(defaultSelectedFilters?.year ?? '').trim()) {
    count += 1;
  }
  for (const key of keys) {
    if (!Array.isArray(selectedFilters[key]) && !Array.isArray(defaultSelectedFilters?.[key])) continue;
    count += getFilterGroupResetState(selectedFilters[key], defaultSelectedFilters?.[key]).count;
  }
  return count;
}
