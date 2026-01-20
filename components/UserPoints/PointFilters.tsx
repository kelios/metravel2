import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { PointFilters as PointFiltersType, PointStatus } from '@/types/userPoints';
import { STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';

interface PointFiltersProps {
  filters: PointFiltersType;
  onChange: (filters: PointFiltersType) => void;
  siteCategoryOptions?: Array<{ id: string; name: string }>;
  availableStatuses?: string[];
  availableColors?: string[];
}

export const PointFilters: React.FC<PointFiltersProps> = ({
  filters,
  onChange,
  siteCategoryOptions,
  availableStatuses,
  availableColors,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const toggleSiteCategory = (id: string) => {
    const current = filters.siteCategories || [];
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    onChange({ ...filters, siteCategories: next });
  };

  const toggleStatus = (status: PointStatus) => {
    const current = filters.statuses || [];
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    onChange({ ...filters, statuses: next });
  };

  const toggleColor = (color: string) => {
    const current = filters.colors || [];
    const next = current.includes(color) ? current.filter((c) => c !== color) : [...current, color];
    onChange({ ...filters, colors: next });
  };

  const statusLabel = (status: PointStatus) => {
    const label = (STATUS_LABELS as Record<string, string>)[status as unknown as string];
    return label || String(status);
  };

  const activeStatusCount = (filters.statuses || []).length;
  const activeCategoryCount = (filters.siteCategories || []).length;
  const activeColorCount = (filters.colors || []).length;

  const radiusOptions = [100, 150, 200, 300, 500, null]; // null = all points
  const setRadius = (km: number | null) => {
    onChange({ ...filters, radiusKm: km });
  };

  const getRadiusLabel = (km: number | null) => {
    if (km === null) return 'Все точки';
    return `${km} км`;
  };

  return (
    <View style={styles.container}>
      <CollapsibleSection title="Радиус" defaultOpen icon="map-pin">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
          {radiusOptions.map((km) => {
            const isSelected = filters.radiusKm === km;
            return (
              <TouchableOpacity
                key={km === null ? 'all' : km}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setRadius(km)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {getRadiusLabel(km)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </CollapsibleSection>

      <CollapsibleSection title="Цвет" defaultOpen badge={activeColorCount} icon="circle">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
          {(availableColors ?? []).map((color) => {
            const isSelected = filters.colors?.includes(color);
            return (
              <TouchableOpacity
                key={color}
                style={[styles.colorChip, isSelected && styles.colorChipActive]}
                onPress={() => toggleColor(color)}
                accessibilityLabel={`Цвет ${color}`}
              >
                <View style={[styles.colorDot, { backgroundColor: color }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Статус" 
        defaultOpen={true}
        badge={activeStatusCount > 0 ? activeStatusCount : undefined}
        icon="tag"
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
          {(availableStatuses ?? []).map((statusValue) => {
            const status = statusValue as unknown as PointStatus;
            const isSelected = filters.statuses?.includes(status);
            return (
              <TouchableOpacity
                key={statusValue}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => toggleStatus(status)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {statusLabel(status)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </CollapsibleSection>

      {siteCategoryOptions?.length ? (
        <CollapsibleSection 
          title="Категории" 
          defaultOpen={false}
          badge={activeCategoryCount > 0 ? activeCategoryCount : undefined}
          icon="grid"
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
            {siteCategoryOptions.map((cat) => {
              const isSelected = filters.siteCategories?.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleSiteCategory(cat.id)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </CollapsibleSection>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.md,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    color: colors.text,
  },
  chipContainer: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600' as any,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '700' as any,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorChip: {
    padding: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  colorChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
});
