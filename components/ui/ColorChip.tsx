import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

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

type ColorChipProps = {
  color: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  chipSize?: number;
  dotSize?: number;
  dotBorderWidth?: number;
  style?: StyleProp<ViewStyle>;
  selectedStyle?: StyleProp<ViewStyle>;
};

const DEFAULT_CHIP_SIZE = 32;
const DEFAULT_DOT_SIZE = 24;

const ColorChip = ({
  color,
  selected = false,
  onPress,
  accessibilityLabel,
  chipSize = DEFAULT_CHIP_SIZE,
  dotSize = DEFAULT_DOT_SIZE,
  dotBorderWidth = 2,
  style,
  selectedStyle,
}: ColorChipProps) => {
  const colors = useThemedColors();
  const chipRadius = chipSize / 2;
  const dotRadius = dotSize / 2;
  const dotBorderColor = isLightColor(color) ? colors.textMuted : colors.border;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Цвет ${color}`}
      style={[
        styles.chip,
        {
          width: chipSize,
          height: chipSize,
          borderRadius: chipRadius,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        selected && styles.chipSelected,
        selected && { borderColor: colors.primary },
        selected && selectedStyle,
        style,
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotRadius,
            backgroundColor: color,
            borderColor: dotBorderColor,
            borderWidth: dotBorderWidth,
          },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipSelected: {
    borderWidth: 2,
  },
  dot: {
    borderWidth: 2,
  },
});

export default React.memo(ColorChip);
