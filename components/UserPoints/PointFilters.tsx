import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import Chip from '@/components/ui/Chip';

const NAMED_COLORS: Record<string, string> = {
  gray: '#9e9e9e',
  grey: '#9e9e9e',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  pink: '#ffc0cb',
  lightpink: '#ffb6c1',
  white: '#ffffff',
  silver: '#c0c0c0',
};

const parseHex = (hex: string) => {
  const raw = String(hex).trim().replace('#', '');
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
};

const parseRgb = (value: string) => {
  const m = String(value)
    .trim()
    .match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
  return { r, g, b };
};

const isLightColor = (value: string) => {
  const v = String(value ?? '').trim().toLowerCase();
  const normalized = NAMED_COLORS[v] ?? v;
  const rgb =
    normalized.startsWith('#') ? parseHex(normalized) : normalized.startsWith('rgb') ? parseRgb(normalized) : null;
  if (!rgb) return false;
  const r = Math.min(255, Math.max(0, rgb.r)) / 255;
  const g = Math.min(255, Math.max(0, rgb.g)) / 255;
  const b = Math.min(255, Math.max(0, rgb.b)) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.72;
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
              const borderColor = isLightColor(color) ? colors.textMuted : colors.border;
              return (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorChip, isSelected && styles.colorChipActive]}
                  onPress={() => toggleColor(color)}
                  accessibilityLabel={`Цвет ${color}`}
                >
                  <View style={[styles.colorDot, { backgroundColor: color, borderColor }]} />
                </TouchableOpacity>
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
              const borderColor = isLightColor(color) ? colors.textMuted : colors.border;
              return (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorChip, isSelected && styles.colorChipActive]}
                  onPress={() => toggleColor(color)}
                  accessibilityLabel={`Цвет ${color}`}
                >
                  <View style={[styles.colorDot, { backgroundColor: color, borderColor }]} />
                </TouchableOpacity>
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
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  colorChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
});
