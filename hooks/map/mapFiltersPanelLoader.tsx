import FiltersPanel from '@/components/MapPage/FiltersPanel';
import { FiltersProvider } from '@/context/MapFiltersContext';

export const FiltersPanelComponent = FiltersPanel;
export const FiltersProviderComponent = FiltersProvider;

export function preloadMapFiltersPanel() {
  return Promise.resolve();
}
