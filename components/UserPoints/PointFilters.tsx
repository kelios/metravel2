import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { PointFilters as PointFiltersType, PointColor } from '@/types/userPoints';
import { COLOR_CATEGORIES } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface PointFiltersProps {
  filters: PointFiltersType;
  onChange: (filters: PointFiltersType) => void;
}

export const PointFilters: React.FC<PointFiltersProps> = ({ filters, onChange }) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const toggleColor = (color: PointColor) => {
    const currentColors = filters.colors || [];
    const newColors = currentColors.includes(color)
      ? currentColors.filter(c => c !== color)
      : [...currentColors, color];
    
    onChange({ ...filters, colors: newColors });
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
  chipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
  },
});
