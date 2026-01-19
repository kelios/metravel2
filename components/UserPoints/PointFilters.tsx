import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { PointFilters as PointFiltersType, PointColor, PointStatus } from '@/types/userPoints';
import { COLOR_CATEGORIES, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface PointFiltersProps {
  filters: PointFiltersType;
  onChange: (filters: PointFiltersType) => void;
  siteCategoryOptions?: Array<{ id: string; name: string }>;
}

export const PointFilters: React.FC<PointFiltersProps> = ({ filters, onChange, siteCategoryOptions }) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const toggleColor = (color: PointColor) => {
    const currentColors = filters.colors || [];
    const newColors = currentColors.includes(color)
      ? currentColors.filter(c => c !== color)
      : [...currentColors, color];
    
    onChange({ ...filters, colors: newColors });
  };

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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Фильтр по цветам:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
        {Object.entries(COLOR_CATEGORIES).map(([colorKey, colorInfo]) => {
          const isSelected = filters.colors?.includes(colorKey as PointColor);
          
          return (
            <TouchableOpacity
              key={colorKey}
              style={[
                styles.chip,
                { borderColor: colorInfo.color },
                isSelected && { backgroundColor: colorInfo.color + '20' }
              ]}
              onPress={() => toggleColor(colorKey as PointColor)}
            >
              <Text style={[styles.chipText, isSelected && { fontWeight: '600' }]}>
                {colorInfo.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, { marginTop: DESIGN_TOKENS.spacing.md }]}>Статус:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
        {(Object.keys(STATUS_LABELS) as unknown as PointStatus[]).map((status) => {
          const isSelected = filters.statuses?.includes(status);
          return (
            <TouchableOpacity
              key={status}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => toggleStatus(status)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {siteCategoryOptions?.length ? (
        <>
          <Text style={[styles.label, { marginTop: DESIGN_TOKENS.spacing.md }]}>Категории:</Text>
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
        </>
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
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 2,
    marginRight: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
  },
  chipTextActive: {
    fontWeight: '600' as any,
    color: colors.text,
  },
});
