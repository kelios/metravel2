import { lazy } from 'react';

function importFilterModules() {
  return Promise.all([
    import('@/context/MapFiltersContext'),
    import('@/components/MapPage/FiltersPanel'),
  ]);
}

let modules: ReturnType<typeof importFilterModules> | undefined;

export const FiltersProviderComponent = lazy(() =>
  (modules ??= importFilterModules()).then(([provider]) => ({ default: provider.FiltersProvider }))
);
export const FiltersPanelComponent = lazy(() =>
  (modules ??= importFilterModules()).then(([, panel]) => panel)
);
