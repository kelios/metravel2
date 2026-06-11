import { lazy } from 'react';

const loadFiltersPanelModule = () => Promise.resolve(import('@/components/MapPage/FiltersPanel'));
const loadFiltersProviderModule = () =>
  Promise.resolve(import('@/context/MapFiltersContext')).then((m) => ({ default: m.FiltersProvider }));

export const FiltersPanelComponent = lazy(loadFiltersPanelModule);
export const FiltersProviderComponent = lazy(loadFiltersProviderModule);

export function preloadMapFiltersPanel() {
  void loadFiltersPanelModule();
  void loadFiltersProviderModule();
  return Promise.resolve();
}
