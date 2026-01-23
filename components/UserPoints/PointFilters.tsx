import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import Chip from '@/components/ui/Chip';
import ColorChip from '@/components/ui/ColorChip';

const RADIUS_OPTIONS: Array<number | null> = [100, 150, 200, 300, 500, null]; // null = all points

const getRadiusLabel = (km: number | null) => {
  if (km === null) return 'Все точки';
  return `${km} км`;
};

const toggleListValue = <T,>(list: T[] | undefined, value: T) => {
  const current = list ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
};

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

  const ChipsContainer = React.useCallback(
    ({ children }: { children: React.ReactNode }) =>
      Platform.OS === 'web' ? (
        <View style={styles.chipWrapRow}>{children}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {children}
        </ScrollView>
      ),
    [styles]
  );

  const toggleSiteCategory = (id: string) => {
    onChange({ ...filters, categoryIds: toggleListValue(filters.categoryIds, id) });
  };

  const toggleColor = (color: string) => {
    onChange({ ...filters, colors: toggleListValue(filters.colors, color) });
  };

  const activeCategoryCount = filters.categoryIds?.length ?? 0;
  const activeColorCount = filters.colors?.length ?? 0;

  const setRadius = (km: number | null) => {
    onChange({ ...filters, radiusKm: km });
  };

  return (
    <View style={styles.container}>
      {presets?.length ? (
        <CollapsibleSection title="Подборки" defaultOpen={false} icon="star">
          <ChipsContainer>
            {presets.map((p) => {
              const isSelected = activePresetId === p.id;
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
          </ChipsContainer>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Радиус" defaultOpen icon="map-pin">
        <ChipsContainer>
          {RADIUS_OPTIONS.map((km) => {
            const isSelected = filters.radiusKm === km;
            return (
              <View key={km === null ? 'all' : km} style={styles.chipItem}>
                <Chip label={getRadiusLabel(km)} selected={isSelected} onPress={() => setRadius(km)} />
              </View>
            );
          })}
        </ChipsContainer>
      </CollapsibleSection>

      <CollapsibleSection title="Цвет" defaultOpen badge={activeColorCount} icon="circle">
        <ChipsContainer>
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
        </ChipsContainer>
      </CollapsibleSection>

      {siteCategoryOptions?.length ? (
        <CollapsibleSection
          title="Категории"
          defaultOpen={false}
          badge={activeCategoryCount || undefined}
          icon="grid"
        >
          <ChipsContainer>
            {siteCategoryOptions.map((cat) => {
              const isSelected = filters.categoryIds?.includes(cat.id);
              return (
                <View key={cat.id} style={styles.chipItem}>
                  <Chip label={cat.name} selected={isSelected} onPress={() => toggleSiteCategory(cat.id)} />
                </View>
              );
            })}
          </ChipsContainer>
        </CollapsibleSection>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.md,
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
