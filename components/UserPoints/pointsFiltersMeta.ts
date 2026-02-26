import type { PointStatus } from '@/types/userPoints';

type ActivePresetLike = { label: string } | null;

type BuildParams = {
  activePreset: ActivePresetLike;
  categoryIdToName: Map<string, string>;
  filters: {
    statuses?: PointStatus[];
    categoryIds?: string[];
    colors?: string[];
    radiusKm?: number;
  };
  searchQuery: string;
  statusLabels: Record<string, string>;
};

export const computeHasActiveFilters = (params: {
  activePresetId: string | null;
  filters: {
    statuses?: PointStatus[];
    categoryIds?: string[];
    colors?: string[];
    radiusKm?: number;
  };
  searchQuery: string;
}): boolean => {
  const { activePresetId, filters, searchQuery } = params;
  const hasSearch = String(searchQuery || '').trim().length > 0;
  const radiusKm = filters.radiusKm;
  const hasRadius = radiusKm != null && Number.isFinite(Number(radiusKm)) && Number(radiusKm) !== 100;
  return (
    (filters.statuses?.length ?? 0) > 0 ||
    (filters.categoryIds?.length ?? 0) > 0 ||
    (filters.colors?.length ?? 0) > 0 ||
    hasSearch ||
    hasRadius ||
    Boolean(activePresetId)
  );
};

export const buildActiveFilterChips = ({
  activePreset,
  categoryIdToName,
  filters,
  searchQuery,
  statusLabels,
}: BuildParams): Array<{ key: string; label: string }> => {
  const chips: Array<{ key: string; label: string }> = [];

  if (activePreset) {
    chips.push({ key: 'preset', label: `Подборка: ${activePreset.label}` });
  }

  const q = String(searchQuery || '').trim();
  if (q) {
    chips.push({ key: 'search', label: `Поиск: ${q}` });
  }

  const radiusKm = filters.radiusKm;
  if (radiusKm != null && Number.isFinite(Number(radiusKm)) && Number(radiusKm) !== 100) {
    chips.push({ key: 'radius', label: `Радиус: ${Number(radiusKm)} км` });
  }

  (filters.statuses ?? []).forEach((status) => {
    const label = statusLabels[status as unknown as string] || String(status);
    chips.push({ key: `status-${status}`, label: `Статус: ${label}` });
  });

  (filters.categoryIds ?? []).forEach((catId) => {
    const label = categoryIdToName.get(catId) ?? catId;
    chips.push({ key: `category-${catId}`, label: `Категория: ${label}` });
  });

  (filters.colors ?? []).forEach((color) => {
    chips.push({ key: `color-${color}`, label: `Цвет: ${color}` });
  });

  return chips;
};
