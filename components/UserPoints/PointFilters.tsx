import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import Chip from '@/components/ui/Chip';
import ColorChip from '@/components/ui/ColorChip';

interface PointFiltersProps {
  filters: PointFiltersType;
  onChange: (filters: PointFiltersType) => void;
  siteCategoryOptions?: Array<{ id: string; name: string }>;
  availableColors?: string[];
  presets?: Array<{ id: string; label: string }>;
  activePresetId?: string | null;
  onPresetChange?: (presetId: string | null) => void;
}

export const PointFilters: React.FC<PointFiltersProps> = ({
  filters,
  onChange,
  siteCategoryOptions,
  availableColors,
  presets,
  activePresetId,
  onPresetChange,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const toggleSiteCategory = (id: string) => {
    const current = filters.categoryIds || [];
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    onChange({ ...filters, categoryIds: next });
  };

  const toggleColor = (color: string) => {
    const current = filters.colors || [];
    const next = current.includes(color) ? current.filter((c) => c !== color) : [...current, color];
    onChange({ ...filters, colors: next });
  };

  const activeCategoryCount = (filters.categoryIds || []).length;
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
      {presets?.length ? (
        <CollapsibleSection title="Подборки" defaultOpen={false} icon="star">
          <View style={styles.chipWrapRow}>
            {presets.map((p) => {
              const isSelected = String(activePresetId ?? '') === p.id;
              return (
                <View key={p.id} style={styles.chipItem}>
                  <Chip
                    label={p.label}
                    selected={isSelected}
                    onPress={() => onPresetChange?.(isSelected ? null : p.id)}
                  />
                </View>
              );
            })}
          </View>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Радиус" defaultOpen icon="map-pin">
        {Platform.OS === 'web' ? (
          <View style={styles.chipWrapRow}>
            {radiusOptions.map((km) => {
              const isSelected = filters.radiusKm === km;
              return (
                <View key={km === null ? 'all' : km} style={styles.chipItem}>
                  <Chip label={getRadiusLabel(km)} selected={isSelected} onPress={() => setRadius(km)} />
                </View>
              );
            })}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {radiusOptions.map((km) => {
              const isSelected = filters.radiusKm === km;
              return (
                <View key={km === null ? 'all' : km} style={styles.chipItem}>
                  <Chip label={getRadiusLabel(km)} selected={isSelected} onPress={() => setRadius(km)} />
                </View>
              );
            })}
          </ScrollView>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Цвет" defaultOpen badge={activeColorCount} icon="circle">
        {Platform.OS === 'web' ? (
          <View style={styles.chipWrapRow}>
            {(availableColors ?? []).map((color) => {
              const isSelected = filters.colors?.includes(color);
              return (
                <ColorChip
                  key={color}
                  color={color}
                  selected={isSelected}
                  onPress={() => toggleColor(color)}
                  accessibilityLabel={`Цвет ${color}`}
                  style={styles.colorChip}
                  selectedStyle={styles.colorChipSelected}
                />
              );
            })}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {(availableColors ?? []).map((color) => {
              const isSelected = filters.colors?.includes(color);
              return (
                <ColorChip
                  key={color}
                  color={color}
                  selected={isSelected}
                  onPress={() => toggleColor(color)}
                  accessibilityLabel={`Цвет ${color}`}
                  style={styles.colorChip}
                  selectedStyle={styles.colorChipSelected}
                />
              );
            })}
          </ScrollView>
        )}
      </CollapsibleSection>

      {siteCategoryOptions?.length ? (
        <CollapsibleSection 
          title="Категории" 
          defaultOpen={false}
          badge={activeCategoryCount > 0 ? activeCategoryCount : undefined}
          icon="grid"
        >
          {Platform.OS === 'web' ? (
            <View style={styles.chipWrapRow}>
              {siteCategoryOptions.map((cat) => {
                const isSelected = filters.categoryIds?.includes(cat.id);
                return (
                  <View key={cat.id} style={styles.chipItem}>
                    <Chip label={cat.name} selected={isSelected} onPress={() => toggleSiteCategory(cat.id)} />
                  </View>
                );
              })}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
              {siteCategoryOptions.map((cat) => {
                const isSelected = filters.categoryIds?.includes(cat.id);
                return (
                  <View key={cat.id} style={styles.chipItem}>
                    <Chip label={cat.name} selected={isSelected} onPress={() => toggleSiteCategory(cat.id)} />
                  </View>
                );
              })}
            </ScrollView>
          )}
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
  chipScroll: {
    flexGrow: 0,
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
        } as any)
      : null),
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: DESIGN_TOKENS.spacing.md,
  },
  chipWrapRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chipItem: {
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  colorChip: {
    borderWidth: 2,
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  colorChipSelected: {
    backgroundColor: colors.backgroundTertiary,
  },
});
