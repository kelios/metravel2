import type { PointStatus } from '@/types/userPoints';
import { translate as i18nT, type TranslationKey } from '@/i18n'


type ActivePresetLike = { labelKey: TranslationKey } | null;

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
    chips.push({
      key: 'preset',
      label: i18nT('map:components.UserPoints.pointsFiltersMeta.podborka_value1_1bfc2cf9', {
        value1: i18nT(activePreset.labelKey),
      }),
    });
  }

  const q = String(searchQuery || '').trim();
  if (q) {
    chips.push({ key: 'search', label: i18nT('map:components.UserPoints.pointsFiltersMeta.poisk_value1_5cda830d', { value1: q }) });
  }

  const radiusKm = filters.radiusKm;
  if (radiusKm != null && Number.isFinite(Number(radiusKm)) && Number(radiusKm) !== 100) {
    chips.push({ key: 'radius', label: i18nT('map:components.UserPoints.pointsFiltersMeta.radius_value1_km_24430a34', { value1: Number(radiusKm) }) });
  }

  (filters.statuses ?? []).forEach((status) => {
    const label = statusLabels[status as unknown as string] || String(status);
    chips.push({ key: `status-${status}`, label: i18nT('map:components.UserPoints.pointsFiltersMeta.status_value1_7f7a4768', { value1: label }) });
  });

  (filters.categoryIds ?? []).forEach((catId) => {
    const label = categoryIdToName.get(catId) ?? catId;
    chips.push({ key: `category-${catId}`, label: i18nT('map:components.UserPoints.pointsFiltersMeta.kategoriya_value1_b51913d6', { value1: label }) });
  });

  (filters.colors ?? []).forEach((color) => {
    chips.push({ key: `color-${color}`, label: i18nT('map:components.UserPoints.pointsFiltersMeta.tsvet_value1_15250034', { value1: color }) });
  });

  return chips;
};
