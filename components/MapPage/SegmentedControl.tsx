import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View, Text, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';

type Tone = 'default' | 'subtle';

interface SegmentedControlOption {
  key: string;
  label: string;
  icon?: string;
  iconSource?: 'map' | 'material';
  badge?: number;
}

function getSegmentIconColor(
  colors: ThemedColors,
  tone: Tone,
  active: boolean,
  isHovered: boolean,
): string {
  // Активный сегмент — сплошная primary-заливка (единый стиль «выбрано» с
  // radius-сегментами), поэтому иконка/текст на нём — textOnPrimary в обоих
  // тонах.
  if (active) return colors.textOnPrimary;
  if (tone === 'subtle') {
    return isHovered ? colors.primaryText : colors.textMuted;
  }
  return isHovered ? colors.primary : colors.text;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
  compact?: boolean;
  dense?: boolean;
  noOuterMargins?: boolean;
  disabled?: boolean;
  disabledKeys?: string[];
  role?: 'radio' | 'button';
  tone?: Tone;
  iconOnly?: boolean;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
  dense = false,
  noOuterMargins = false,
  disabled = false,
  disabledKeys = [],
  role = 'radio',
  tone = 'default',
  iconOnly = false,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const colors = useThemedColors();
  const styles = useMemo(
    () => getStyles(colors, compact, tone, dense, noOuterMargins),
    [colors, compact, tone, dense, noOuterMargins]
  );

  const activeIndex = options.findIndex((o) => o.key === value);
  const pillAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.spring(pillAnim, {
      toValue: activeIndex,
      friction: 8,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, pillAnim]);

  const count = options.length || 1;
  const pillLeft = pillAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => `${(i / count) * 100}%`),
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.segmentedControl}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            width: `${100 / count}%` as any,
            left: pillLeft as any,
            pointerEvents: 'none',
          },
        ]}
      />
      {options.map(({ key, label, icon, badge }) => {
        const active = value === key;
        const isDisabled = disabled || disabledKeys.includes(key);
        const isHovered = hoveredKey === key && !active && !isDisabled;

        const iconColor = getSegmentIconColor(colors, tone, active, isHovered);

        return (
          <CardActionPressable
            key={key}
            testID={`segmented-${key}`}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              isHovered && styles.segmentHovered,
              isDisabled && styles.segmentDisabled,
              globalFocusStyles.focusable,
            ]}
            onPress={() => {
              if (isDisabled) return;
              onChange(key);
            }}
            onHoverIn={() => setHoveredKey(key)}
            onHoverOut={() => setHoveredKey((current) => (current === key ? null : current))}
            disabled={isDisabled}
            accessibilityState={
              role === 'radio'
                ? ({ checked: active, disabled: isDisabled } as any)
                : ({ selected: active, disabled: isDisabled } as any)
            }
            accessibilityLabel={badge ? `${label} (${badge})` : label}
            title={label}
            accessibilityRole={role}
          >
            {icon && (
              <MapIcon
                name={icon}
                size={iconOnly ? (compact ? 20 : 18) : compact && dense ? 14 : 16}
                color={iconColor}
              />
            )}
            {!iconOnly && (
              <Text style={[
                styles.segmentText,
                active && styles.segmentTextActive,
                isHovered && styles.segmentTextHover,
              ]} numberOfLines={1} ellipsizeMode="tail">
                {label}
              </Text>
            )}
            {typeof badge === 'number' && badge > 0 && (
              <View style={[
                styles.badge,
                active && styles.badgeActive,
              ]}>
                <Text style={[
                  styles.badgeText,
                  active && styles.badgeTextActive,
                ]}>
                  {badge}
                </Text>
              </View>
            )}
          </CardActionPressable>
        );
      })}
    </View>
  );
};

const getStyles = (
  colors: ThemedColors,
  compact: boolean,
  tone: Tone,
  dense: boolean,
  noOuterMargins: boolean,
) => StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: tone === 'subtle' ? colors.backgroundSecondary : colors.surface,
    borderRadius: compact && dense ? 10 : 12,
    padding: compact ? 1 : 2,
    marginHorizontal: noOuterMargins ? 0 : (compact ? 0 : 12),
    marginVertical: noOuterMargins ? 0 : (compact ? (dense ? 2 : 4) : 8),
    borderWidth: 1,
    borderColor: tone === 'subtle' ? colors.borderLight : colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: compact && dense ? 1 : 2,
    bottom: compact && dense ? 1 : 2,
    borderRadius: compact && dense ? 5 : 6,
    // Единый стиль активного сегмента в обоих тонах: сплошная primary-заливка
    // (как у radius-сегментов), без outline-варианта.
    backgroundColor: colors.primary,
    ...(Platform.OS === 'web' ? ({ transition: 'left 0.2s ease' } as any) : null),
  },
  segment: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // compact+dense: ужимаем gap/паддинги, чтобы «Маршрут» помещался целиком
    // на узких Android-раскладках (иначе ellipsize → «Марш…»).
    gap: compact ? (dense ? 3 : 6) : 4,
    paddingVertical: compact ? (dense ? 7 : 8) : 8,
    paddingHorizontal: compact ? (dense ? 4 : 12) : 8,
    borderRadius: dense ? 5 : 6,
    minWidth: compact ? (dense ? 0 : 72) : 0,
    minHeight: compact ? (dense ? 40 : 44) : 44,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  segmentPressed: {
    opacity: 0.6,
  },
  segmentHovered: {
    backgroundColor: colors.primarySoft,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: compact && dense ? 12 : 13,
    fontWeight: '600',
    color: colors.textMuted,
    // Без flexShrink текст сообщает полную интринзик-ширину: равноширокие
    // flex:1 сегменты подстраиваются под самую длинную подпись («Маршрут»)
    // и не усекаются многоточием на узких Android-раскладках.
    flexShrink: 0,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  segmentTextHover: {
    color: colors.primary,
  },
  badge: {
    backgroundColor: tone === 'subtle' ? colors.surface : colors.surfaceLight,
    borderRadius: compact && dense ? 9 : 10,
    minWidth: compact && dense ? 18 : 20,
    height: compact && dense ? 18 : 20,
    paddingHorizontal: compact && dense ? 5 : 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: compact && dense ? 3 : 4,
    ...(tone === 'subtle'
      ? {
          borderWidth: 1,
          borderColor: colors.border,
        }
      : null),
  },
  badgeActive: {
    // Активный сегмент — сплошная primary-заливка в обоих тонах, поэтому бейдж
    // на нём всегда полупрозрачно-белый с контрастным текстом.
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: compact && dense ? 10 : 11,
    fontWeight: '700',
    color: colors.text,
  },
  badgeTextActive: {
    color: colors.textOnPrimary,
  },
});

export default React.memo(SegmentedControl);
