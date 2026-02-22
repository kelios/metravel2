// components/MapPage/SegmentedControl.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View, Text, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface SegmentedControlOption {
  key: string;
  label: string;
  icon?: string;
  badge?: number; // Количество для отображения в badge
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
  tone?: 'default' | 'subtle';
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
}) => {
  const colors = useThemedColors();
  const styles = useMemo(
    () => getStyles(colors, compact, tone, dense, noOuterMargins),
    [colors, compact, tone, dense, noOuterMargins]
  );

  const activeIndex = options.findIndex((o) => o.key === value);
  const pillAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    const idx = options.findIndex((o) => o.key === value);
    if (idx < 0) return;
    Animated.spring(pillAnim, {
      toValue: idx,
      friction: 8,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [value, options, pillAnim]);

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

        const iconColor = tone === 'subtle'
          ? (active ? colors.primaryText : colors.textMuted)
          : (active ? colors.textOnPrimary : colors.text);

        return (
          <CardActionPressable
            key={key}
            testID={`segmented-${key}`}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              isDisabled && styles.segmentDisabled,
              globalFocusStyles.focusable,
            ]}
            onPress={() => {
              if (isDisabled) return;
              onChange(key);
            }}
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
                size={compact && dense ? 14 : 16}
                color={iconColor}
              />
            )}
            <Text style={[
              styles.segmentText,
              active && styles.segmentTextActive,
            ]} numberOfLines={1} ellipsizeMode="tail">
              {label}
            </Text>
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
  tone: 'default' | 'subtle',
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
    backgroundColor: tone === 'subtle' ? colors.primarySoft : colors.primary,
    ...(tone === 'subtle'
      ? {
          borderWidth: 1,
          borderColor: colors.primary,
        }
      : null),
    ...(Platform.OS === 'web' ? ({ transition: 'left 0.2s ease' } as any) : null),
  },
  segment: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? (dense ? 4 : 6) : 4,
    paddingVertical: compact ? (dense ? 7 : 8) : 8,
    paddingHorizontal: compact ? (dense ? 8 : 12) : 8,
    borderRadius: dense ? 5 : 6,
    minWidth: compact ? (dense ? 0 : 72) : 0,
    minHeight: compact ? (dense ? 36 : 40) : 40,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  segmentPressed: {
    opacity: 0.6,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: compact && dense ? 12 : 13,
    fontWeight: '600',
    color: colors.textMuted,
    flexShrink: 1,
  },
  segmentTextActive: {
    color: tone === 'subtle' ? colors.primaryText : colors.textOnPrimary,
    fontWeight: '700',
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
    backgroundColor: tone === 'subtle' ? colors.primarySoft : 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: compact && dense ? 10 : 11,
    fontWeight: '700',
    color: colors.text,
  },
  badgeTextActive: {
    color: tone === 'subtle' ? colors.primaryText : colors.textOnPrimary,
  },
});

export default React.memo(SegmentedControl);
